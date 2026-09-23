import {and,asc,desc,eq,ilike,or,sql,gte,lte,count} from 'drizzle-orm';
import {database} from '../database';
import {tradingAccounts,trades,strategies,scenarios,preferences} from '../database/schema';
import {HttpError} from './http';
import {calculateAnalytics} from '../analytics/journal';
import {accountSchema,tradeSchema,scenarioSchema} from '../validation/schemas';
import type {Trade,TradingAccount} from '@/types/trading';
const accountDto=(a:typeof tradingAccounts.$inferSelect):TradingAccount=>({id:a.id,name:a.name,currency:a.currency,initialBalance:a.initialBalance,breakEvenBand:a.breakEvenBand,sourceSheet:a.sourceSheet,baselineBreakEven:a.baselineBreakEven,riskMetric:a.riskMetric as TradingAccount['riskMetric'],createdAt:a.createdAt.toISOString()});
const tradeDto=(t:typeof trades.$inferSelect):Trade=>({id:t.id,accountId:t.accountId,sequence:t.sequence,date:t.date,symbol:t.symbol,riskPercent:t.riskPercent,rewardRisk:t.rewardRisk,duration:t.duration===null?null:Number(t.duration),pnl:t.pnl,notes:t.notes,feelings:t.feelings,evidenceUrl:t.evidenceUrl,strategy:t.strategy,direction:t.direction as Trade['direction'],session:t.session,tags:t.tags,sourceRow:t.sourceRow,version:t.version});
export async function ownedAccount(userId:string,id:string){const db=await database();const [a]=await db.select().from(tradingAccounts).where(and(eq(tradingAccounts.userId,userId),eq(tradingAccounts.id,id)));if(!a)throw new HttpError(404,'Trading account not found.');return a;}
export async function getWorkspace(userId:string,accountId?:string){
 const db=await database();const rows=await db.select().from(tradingAccounts).where(eq(tradingAccounts.userId,userId)).orderBy(asc(tradingAccounts.createdAt));
 const [preference]=await db.select().from(preferences).where(eq(preferences.userId,userId));
 const account=rows.find(a=>a.id===(accountId||preference?.selectedAccountId))||(accountId?undefined:rows[0]);
 if(accountId&&!account)throw new HttpError(404,'Trading account not found.');
 const accounts=rows.map(accountDto);if(!account)return {accounts,account:null,analytics:null,recent:[],theme:preference?.theme||'system'};
 const raw=await db.select().from(trades).where(and(eq(trades.userId,userId),eq(trades.accountId,account.id))).orderBy(asc(trades.sequence));
 const records=raw.map(tradeDto),analytics=calculateAnalytics(records,accountDto(account));
 // Preserve bucket minima/maxima for large charts instead of dropping drawdowns.
 if(analytics.equity.length>1500){const original=analytics.equity,step=Math.ceil(original.length/500),sample=[original[0]];for(let i=1;i<original.length;i+=step){const bucket=original.slice(i,i+step);const min=bucket.reduce((a,b)=>a.balance<b.balance?a:b),max=bucket.reduce((a,b)=>a.balance>b.balance?a:b);sample.push(...[min,max].sort((a,b)=>a.sequence-b.sequence));}sample.push(original.at(-1)!);analytics.equity=[...new Map(sample.map(p=>[p.sequence,p])).values()];}
 return {accounts,account:accountDto(account),analytics,recent:records.slice(-6).reverse(),theme:preference?.theme||'system'};
}
export async function createAccount(userId:string,raw:unknown){const data=accountSchema.parse(raw),db=await database();const [a]=await db.insert(tradingAccounts).values({...data,id:crypto.randomUUID(),userId}).returning();return accountDto(a);}
export async function updateAccount(userId:string,id:string,raw:unknown){const data=accountSchema.parse(raw),db=await database();const [a]=await db.update(tradingAccounts).set(data).where(and(eq(tradingAccounts.id,id),eq(tradingAccounts.userId,userId))).returning();if(!a)throw new HttpError(404,'Trading account not found.');return accountDto(a);}
export async function removeAccount(userId:string,id:string){const db=await database();const result=await db.delete(tradingAccounts).where(and(eq(tradingAccounts.id,id),eq(tradingAccounts.userId,userId))).returning({id:tradingAccounts.id});if(!result.length)throw new HttpError(404,'Trading account not found.');}
export async function listTrades(userId:string,params:URLSearchParams){
 const account=await ownedAccount(userId,params.get('accountId')||''),db=await database();
 const conditions=[eq(trades.userId,userId),eq(trades.accountId,account.id)];const search=(params.get('search')||'').slice(0,200).replace(/[\\%_]/g,'\\$&');
 if(search)conditions.push(or(ilike(trades.symbol,`%${search}%`),ilike(trades.notes,`%${search}%`),ilike(trades.strategy,`%${search}%`),ilike(trades.tags,`%${search}%`))!);
 const outcome=params.get('outcome');if(outcome==='win')conditions.push(sql`${trades.pnl}>${account.breakEvenBand}::numeric`);if(outcome==='loss')conditions.push(sql`${trades.pnl}<-${account.breakEvenBand}::numeric`);if(outcome==='breakeven')conditions.push(sql`${trades.pnl} BETWEEN -${account.breakEvenBand}::numeric AND ${account.breakEvenBand}::numeric`);if(outcome==='open')conditions.push(sql`${trades.pnl} IS NULL`);
 const from=params.get('from'),to=params.get('to');if(from&&/^\d{4}-\d{2}-\d{2}$/.test(from))conditions.push(gte(trades.date,from));if(to&&/^\d{4}-\d{2}-\d{2}$/.test(to))conditions.push(lte(trades.date,to));
 const page=Math.min(100000,Math.max(1,Number(params.get('page'))||1)),size=params.get('export')==='1'?50000:20;
 const columns={sequence:trades.sequence,date:trades.date,pnl:trades.pnl,symbol:trades.symbol};const sort=columns[params.get('sort') as keyof typeof columns]||trades.sequence;
 const order=params.get('direction')==='asc'?asc:desc,where=and(...conditions);
 const [total,rows]=await Promise.all([db.select({value:count()}).from(trades).where(where),db.select().from(trades).where(where).orderBy(order(sort),order(trades.sequence)).limit(size).offset(params.get('export')==='1'?0:(page-1)*size)]);
 if(params.get('export')==='1'&&total[0].value>size)throw new HttpError(422,'Filter your export to 50,000 operations or fewer.');
 return {trades:rows.map(tradeDto),total:total[0].value,page,pageSize:size};
}
export async function saveTrade(userId:string,raw:unknown,id?:string){
 const data=tradeSchema.parse(raw),db=await database();await ownedAccount(userId,data.accountId);
 return db.transaction(async tx=>{
  if(data.strategy)await tx.insert(strategies).values({id:crypto.randomUUID(),userId,name:data.strategy}).onConflictDoNothing();
  const {version,sequence,...fields}=data;const converted={...fields,duration:data.duration===null?null:String(data.duration)};
  if(id){if(!version)throw new HttpError(422,'A record version is required.');const [row]=await tx.update(trades).set({...converted,version:sql`${trades.version}+1`,updatedAt:new Date()}).where(and(eq(trades.id,id),eq(trades.userId,userId),eq(trades.accountId,data.accountId),eq(trades.version,version))).returning();if(!row)throw new HttpError(409,'This operation changed or was removed. Refresh before editing again.');return tradeDto(row);}
  // Atomic allocation prevents duplicate operation numbers under concurrent requests.
  const [account]=await tx.update(tradingAccounts).set({lastSequence:sql`${tradingAccounts.lastSequence}+1`}).where(and(eq(tradingAccounts.id,data.accountId),eq(tradingAccounts.userId,userId))).returning({sequence:tradingAccounts.lastSequence});
  if(!account)throw new HttpError(404,'Trading account not found.');
  const [row]=await tx.insert(trades).values({...converted,id:crypto.randomUUID(),userId,sequence:account.sequence}).returning();return tradeDto(row);
 });
}
export async function removeTrade(userId:string,id:string,version:number){const db=await database();const rows=await db.delete(trades).where(and(eq(trades.id,id),eq(trades.userId,userId),eq(trades.version,version))).returning({id:trades.id});if(!rows.length)throw new HttpError(409,'This operation changed or was removed. Refresh and try again.');}
export async function saveScenario(userId:string,raw:unknown){const data=scenarioSchema.parse(raw),db=await database();const [s]=await db.insert(scenarios).values({...data,id:crypto.randomUUID(),userId}).returning();return s;}
export async function listScenarios(userId:string){const db=await database();return db.select({id:scenarios.id,name:scenarios.name,kind:scenarios.kind,input:scenarios.input,createdAt:scenarios.createdAt}).from(scenarios).where(eq(scenarios.userId,userId)).orderBy(desc(scenarios.createdAt));}
export async function removeScenario(userId:string,id:string){const db=await database();const rows=await db.delete(scenarios).where(and(eq(scenarios.userId,userId),eq(scenarios.id,id))).returning();if(!rows.length)throw new HttpError(404,'Scenario not found.');}
export async function savePreferences(userId:string,theme:'light'|'dark'|'system',accountId:string|null){if(accountId)await ownedAccount(userId,accountId);const db=await database();await db.insert(preferences).values({userId,theme,selectedAccountId:accountId}).onConflictDoUpdate({target:preferences.userId,set:{theme,selectedAccountId:accountId,updatedAt:new Date()}});}
