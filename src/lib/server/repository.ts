import {z} from 'zod';
import {supabaseServer} from '../supabase/server';
import {HttpError} from './http';
import {calculateAnalytics} from '../analytics/journal';
import {calendarMonthBounds} from '../analytics/calendar';
import {accountSchema,tradeSchema,scenarioSchema,reviewSubmissionSchema,reviewModerationSchema} from '../validation/schemas';
import type {AccountRule,AccountType,DrawdownType,SavedInstrument,SavedStrategy,Trade,TradingAccount} from '@/types/trading';
import type {Json} from '../supabase/types';
import type {parseWorkbook} from '../import/workbook';
import type {ReviewSubmission,ReviewWorkspace,ReviewStatus} from '@/types/reviews';
import {allEvidencePaths,EVIDENCE_BUCKET} from '../evidence';

type DbError={code:string;message:string;details?:string};
export function check(error:DbError|null) {
 if(!error)return;
 if(error.code==='PT409')throw new HttpError(409,'This operation changed or was removed. Refresh before editing again.');
 if(error.code==='P0002')throw new HttpError(404,'Trading account not found.');
 if(error.code==='42501')throw new HttpError(403,'You do not have access to this record.');
 console.error('Database request failed:',error.code);
 throw new HttpError(500,'The database request failed. Your changes were not saved. Please try again.');
}
// Numeric fields are text in RLS-protected views, preserving input precision.
function ruleDto(raw:unknown):AccountRule {
 const rule=raw as {phase_number?:number|null;profitTarget?:string;maxLossLimit?:string;dailyLossLimit?:string;drawdownType?:DrawdownType};
 if(typeof rule?.profitTarget!=='string'||typeof rule.maxLossLimit!=='string'||typeof rule.dailyLossLimit!=='string'||!['static','trailing'].includes(rule.drawdownType||''))throw new Error('Invalid account rule response.');
 return {phaseNumber:rule.phase_number??null,profitTarget:rule.profitTarget,maxLossLimit:rule.maxLossLimit,dailyLossLimit:rule.dailyLossLimit,drawdownType:rule.drawdownType!};
}
function accountDto(raw:unknown,rules:AccountRule[]=[]):TradingAccount {
 const a=raw as TradingAccount&{accountType?:AccountType|null;currentPhase?:number|null};
 if(!a?.id||typeof a.initialBalance!=='string')throw new Error('Invalid account response.');
 return {...a,accountType:a.accountType??null,currentPhase:a.currentPhase??null,rules};
}
function tradeDto(raw:unknown):Trade {
 const t=raw as Trade&{tradeTime?:string|null;grossPnl?:string|null;commission?:string|null};
 if(!t?.id||(t.pnl!==null&&typeof t.pnl!=='string')||(t.grossPnl!=null&&typeof t.grossPnl!=='string')||(t.commission!=null&&typeof t.commission!=='string'))throw new Error('Invalid operation response.');
 return {...t,tradeTime:t.tradeTime??null,grossPnl:t.grossPnl??t.pnl,commission:t.commission??'0'};
}
function instrumentDto(raw:unknown):SavedInstrument {
 const item=raw as {id?:string;name?:string;created_at?:string;updated_at?:string};
 if(!item.id||!item.name||!item.created_at||!item.updated_at)throw new Error('Invalid saved instrument response.');
 return {id:item.id,name:item.name,createdAt:item.created_at,updatedAt:item.updated_at};
}
function strategyDto(raw:unknown):SavedStrategy {
 const item=raw as {id?:string;name?:string};
 if(!item.id||!item.name)throw new Error('Invalid saved strategy response.');
 return {id:item.id,name:item.name};
}
function reviewDto(raw:unknown):ReviewSubmission {
 const review=raw as {id?:string;user_id?:string;reviewer_name?:string;review_text?:string;status?:ReviewStatus;submitted_at?:string;approved_at?:string|null;approved_by?:string|null};
 if(!review?.id||!review.user_id||!review.reviewer_name||!review.review_text||!review.submitted_at||!['pending','approved','rejected'].includes(review.status||''))throw new Error('Invalid review response.');
 return {id:review.id,userId:review.user_id,reviewerName:review.reviewer_name,reviewText:review.review_text,status:review.status!,submittedAt:review.submitted_at,approvedAt:review.approved_at||null,approvedBy:review.approved_by||null};
}
export async function ownedAccount(userId:string,id:string){
 const db=await supabaseServer();
 const [accountResult,rulesResult]=await Promise.all([
  db.from('account_records').select('*').eq('user_id',userId).eq('id',id).maybeSingle(),
  db.from('account_rule_records').select('*').eq('user_id',userId).eq('account_id',id).order('phase_number'),
 ]);
 check(accountResult.error);check(rulesResult.error);if(!accountResult.data)throw new HttpError(404,'Trading account not found.');
 return accountDto(accountResult.data,(rulesResult.data||[]).map(ruleDto));
}
export async function getWorkspace(userId:string,accountId?:string){
 const db=await supabaseServer();
 const [accountsResult,preferencesResult,rulesResult,instrumentsResult,strategiesResult]=await Promise.all([
  db.from('account_records').select('*').eq('user_id',userId).order('createdAt'),
  db.from('preferences').select('*').eq('user_id',userId).maybeSingle(),
  db.from('account_rule_records').select('*').eq('user_id',userId).order('phase_number'),
  db.from('saved_instruments').select('*').eq('user_id',userId).order('name'),
  db.from('strategies').select('id,name').eq('user_id',userId).order('name'),
 ]);
 check(accountsResult.error);check(preferencesResult.error);check(rulesResult.error);check(instrumentsResult.error);check(strategiesResult.error);
 const rulesByAccount=new Map<string,AccountRule[]>();
 for(const raw of rulesResult.data||[]){if(!raw.account_id)continue;const rules=rulesByAccount.get(raw.account_id)||[];rules.push(ruleDto(raw));rulesByAccount.set(raw.account_id,rules);}
 const accounts=(accountsResult.data||[]).map(raw=>accountDto(raw,rulesByAccount.get(raw.id!)||[])),preference=preferencesResult.data,instruments=(instrumentsResult.data||[]).map(instrumentDto),strategies=(strategiesResult.data||[]).map(strategyDto);
 const account=accounts.find(a=>a.id===(accountId||preference?.selectedAccountId))||(accountId?undefined:accounts[0]);
 if(accountId&&!account)throw new HttpError(404,'Trading account not found.');
 if(!account)return {accounts,account:null,analytics:null,recent:[],instruments,strategies,theme:preference?.theme||'system'};
 // Paginate past PostgREST's row cap so statistics never silently omit trades.
 const records:Trade[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from('trade_records').select('*').eq('user_id',userId).eq('accountId',account.id).order('sequence').range(offset,offset+499);
  check(error);records.push(...(data||[]).map(tradeDto));if((data?.length||0)<500)break;
 }
 const analytics=calculateAnalytics(records,account);
 if(analytics.equity.length>1500){
  const original=analytics.equity,step=Math.ceil(original.length/500),sample=[original[0]];
  for(let i=1;i<original.length;i+=step){const bucket=original.slice(i,i+step);const min=bucket.reduce((a,b)=>a.balance<b.balance?a:b),max=bucket.reduce((a,b)=>a.balance>b.balance?a:b);sample.push(...[min,max].sort((a,b)=>a.sequence-b.sequence));}
  sample.push(original.at(-1)!);analytics.equity=[...new Map(sample.map(p=>[p.sequence,p])).values()];
 }
 return {accounts,account,analytics,recent:records.slice(-6).reverse(),instruments,strategies,theme:preference?.theme||'system'};
}
export async function saveInstrument(userId:string,raw:unknown,id?:string){
 const name=z.string().trim().min(1).max(30).parse((raw as {name?:unknown})?.name),db=await supabaseServer();
 const result=id?await db.from('saved_instruments').update({name,updated_at:new Date().toISOString()}).eq('id',id).eq('user_id',userId).select('*').maybeSingle():await db.from('saved_instruments').insert({user_id:userId,name}).select('*').single();
 if(result.error?.code==='23505')throw new HttpError(409,'This instrument is already saved.');
 check(result.error);if(!result.data)throw new HttpError(404,'Saved instrument not found.');return instrumentDto(result.data);
}
export async function removeInstrument(userId:string,id:string){
 const db=await supabaseServer(),result=await db.from('saved_instruments').delete().eq('id',id).eq('user_id',userId).select('id');
 check(result.error);if(!result.data?.length)throw new HttpError(404,'Saved instrument not found.');
}
export async function saveStrategy(userId:string,raw:unknown){
 const name=z.string().trim().min(1).max(80).parse((raw as {name?:unknown})?.name),db=await supabaseServer();
 const existing=await db.from('strategies').select('id,name').eq('user_id',userId);
 check(existing.error);if((existing.data||[]).some(item=>item.name.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new HttpError(409,'This strategy is already saved.');
 const result=await db.from('strategies').insert({user_id:userId,name}).select('id,name').single();
 if(result.error?.code==='23505')throw new HttpError(409,'This strategy is already saved.');
 check(result.error);return strategyDto(result.data);
}
export async function removeStrategy(userId:string,id:string){
 const db=await supabaseServer(),result=await db.from('strategies').delete().eq('id',id).eq('user_id',userId).select('id');
 check(result.error);if(!result.data?.length)throw new HttpError(404,'Saved strategy not found.');
}
export async function createAccount(userId:string,raw:unknown){
 const data=accountSchema.parse(raw),db=await supabaseServer();
 const result=await db.rpc('save_trading_account',{p_data:data as unknown as Json});
 check(result.error);return ownedAccount(userId,result.data!);
}
export async function updateAccount(userId:string,id:string,raw:unknown){
 const data=accountSchema.parse(raw),db=await supabaseServer();
 const result=await db.rpc('save_trading_account',{p_data:data as unknown as Json,p_id:id});
 check(result.error);return ownedAccount(userId,result.data!);
}
export async function removeAccount(userId:string,id:string){
 const db=await supabaseServer();const paths:string[]=[];
 for(let offset=0;;offset+=500){const r=await db.from('trades').select('evidencePath,additionalEvidencePaths').eq('accountId',id).eq('user_id',userId).range(offset,offset+499);check(r.error);paths.push(...(r.data||[]).flatMap(allEvidencePaths));if((r.data?.length||0)<500)break;}
 const {data,error}=await db.from('trading_accounts').delete().eq('id',id).eq('user_id',userId).select('id');
 check(error);if(!data?.length)throw new HttpError(404,'Trading account not found.');
 for(let offset=0;offset<paths.length;offset+=100)await db.storage.from(EVIDENCE_BUCKET).remove(paths.slice(offset,offset+100));
}
export async function listTrades(userId:string,params:URLSearchParams){
 const account=await ownedAccount(userId,params.get('accountId')||''),db=await supabaseServer();
 const page=Math.min(100000,Math.max(1,Math.floor(Number(params.get('page'))||1))),exporting=params.get('export')==='1',reporting=params.get('report')==='1';
 // Filter/sort monetary values on the numeric base table; return precision-safe
 // records from the view after selecting IDs.
 const search=(params.get('search')||'').slice(0,200).replace(/[\\%_]/g,'\\$&').replace(/"/g,'\\"');
 const sort=['sequence','date','pnl','symbol'].includes(params.get('sort')||'')?params.get('sort')!:'sequence';
 const ascending=params.get('direction')==='asc',outcome=params.get('outcome'),from=params.get('from'),to=params.get('to');
 const query=()=>{
  let q=db.from('trades').select('id',{count:'exact'}).eq('user_id',userId).eq('accountId',account.id);
  if(search)q=q.or(['symbol','notes','strategy','tags'].map(c=>c+'.ilike."%'+search+'%"').join(','));
  if(outcome==='win')q=q.gt('pnl',Number(account.breakEvenBand));
  if(outcome==='loss')q=q.lt('pnl',-Number(account.breakEvenBand));
  if(outcome==='breakeven')q=q.gte('pnl',-Number(account.breakEvenBand)).lte('pnl',Number(account.breakEvenBand));
  if(outcome==='open')q=q.is('pnl',null);
  if(from&&/^\d{4}-\d{2}-\d{2}$/.test(from))q=q.gte('date',from);
  if(to&&/^\d{4}-\d{2}-\d{2}$/.test(to))q=q.lte('date',to);
  return q.order(sort,{ascending}).order('sequence',{ascending});
 };
 const records:Trade[]=[];let total=0;
 for(let offset=exporting?0:(page-1)*20;;offset+=500){
  const size=exporting?500:20,{data,error,count}=await query().range(offset,offset+size-1);
  check(error);total=count||0;
  if(reporting&&total>5000)throw new HttpError(422,'The PDF report supports up to 5,000 operations. Export CSV for larger histories.');
  if(exporting&&total>50000)throw new HttpError(422,'Filter your export to 50,000 operations or fewer.');
  if(data?.length){
   const rows=await db.from('trade_records').select('*').in('id',data.map(r=>r.id));check(rows.error);
   const map=new Map((rows.data||[]).map(r=>[r.id,tradeDto(r)]));
   records.push(...data.flatMap(r=>map.has(r.id)?[map.get(r.id)!]:[]));
  }
  if(!exporting||(data?.length||0)<500)break;
 }
 return {trades:records,total,page,pageSize:exporting?50000:20};
}
export async function listCalendarTrades(userId:string,accountId:string,month:string):Promise<Trade[]> {
 const account=await ownedAccount(userId,accountId);
 const bounds=calendarMonthBounds(month);
 if(!bounds)throw new HttpError(422,'Choose a valid calendar month.');
 const db=await supabaseServer(),records:Trade[]=[];
 for(let offset=0;;offset+=500){
  const {data,error}=await db.from('trade_records').select('*')
   .eq('user_id',userId).eq('accountId',account.id)
   .gte('date',bounds.start).lt('date',bounds.end)
   .order('date').order('sequence').range(offset,offset+499);
  check(error);records.push(...(data||[]).map(tradeDto));
  if((data?.length||0)<500)break;
 }
 return records;
}
export async function saveTrade(userId:string,raw:unknown,id?:string){
 const data=tradeSchema.parse(raw);await ownedAccount(userId,data.accountId);
 if(id&&!data.version)throw new HttpError(422,'A record version is required.');
 const db=await supabaseServer(),result=await db.rpc('save_trade',{p_data:data as Json,...(id?{p_id:id}:{})});
 check(result.error);return tradeDto(result.data);
}
export async function removeTrade(userId:string,id:string,version:number){
 const db=await supabaseServer(),{data,error}=await db.from('trades').delete().eq('user_id',userId).eq('id',id).eq('version',version).select('id,evidencePath,additionalEvidencePaths');
 check(error);if(!data?.length)throw new HttpError(409,'This operation changed or was removed. Refresh and try again.');
 return allEvidencePaths(data[0]);
}
export async function removeEvidenceFiles(paths:string[]){
 if(!paths.length)return;
 const db=await supabaseServer(),{error}=await db.storage.from(EVIDENCE_BUCKET).remove(paths);
 if(error)console.error('Evidence cleanup failed:',error.message);
}
export async function saveScenario(userId:string,raw:unknown){
 const data=scenarioSchema.parse(raw),db=await supabaseServer();
 const result=await db.from('scenarios').insert({...data,user_id:userId}).select('*').single();check(result.error);return result.data;
}
export async function listScenarios(userId:string){
 const db=await supabaseServer(),records=[];
 for(let offset=0;;offset+=500){const r=await db.from('scenarios').select('*').eq('user_id',userId).order('createdAt',{ascending:false}).order('id').range(offset,offset+499);check(r.error);records.push(...r.data||[]);if((r.data?.length||0)<500)break;}
 return records;
}
export async function removeScenario(userId:string,id:string){
 const db=await supabaseServer(),{data,error}=await db.from('scenarios').delete().eq('user_id',userId).eq('id',id).select('id');
 check(error);if(!data?.length)throw new HttpError(404,'Scenario not found.');
}
export async function savePreferences(userId:string,theme:'light'|'dark'|'system',accountId:string|null){
 if(accountId)await ownedAccount(userId,accountId);
 const db=await supabaseServer(),r=await db.from('preferences').upsert({user_id:userId,theme,selectedAccountId:accountId,updated_at:new Date().toISOString()});
 check(r.error);
}
export async function importWorkbook(parsed:ReturnType<typeof parseWorkbook>){
 const db=await supabaseServer(),result=await db.rpc('import_workbook',{p_sheets:parsed as unknown as Json});
 check(result.error);return result.data;
}
export async function isReviewAdmin(userId:string){
 const db=await supabaseServer(),{data,error}=await db.from('user_roles').select('role').eq('user_id',userId).in('role',['review_admin','admin']).maybeSingle();
 check(error);return Boolean(data);
}
export async function getReviewWorkspace(userId:string):Promise<ReviewWorkspace>{
 const db=await supabaseServer();
 const roleResult=await db.from('user_roles').select('role').eq('user_id',userId).maybeSingle();check(roleResult.error);
 const legacyModerator=roleResult.data?.role==='review_admin';
 const query=db.from('review_submissions').select('*').order('submitted_at',{ascending:false});
 const reviews=legacyModerator?await query:await query.eq('user_id',userId);
 check(reviews.error);
 return {reviews:(reviews.data||[]).map(reviewDto),isAdmin:legacyModerator};
}
export async function getApprovedReviews(){
 const db=await supabaseServer(),{data,error}=await db.from('review_submissions').select('*').eq('status','approved').order('approved_at',{ascending:false}).limit(6);
 check(error);return (data||[]).map(reviewDto);
}
export async function submitReview(userId:string,raw:unknown){
 const {reviewText}=reviewSubmissionSchema.parse(raw),db=await supabaseServer();
 // The database trigger replaces these ownership and status values with the
 // authenticated user's profile data before RLS evaluates the insert.
 const {data,error}=await db.from('review_submissions').insert({user_id:userId,reviewer_name:'Submitting user',review_text:reviewText,status:'pending'}).select('*').single();
 check(error);return reviewDto(data);
}
export async function moderateReview(userId:string,id:string,raw:unknown){
  const {action}=reviewModerationSchema.parse(raw);
 if(!await isReviewAdmin(userId))throw new HttpError(403,'You do not have permission to moderate reviews.');
 const db=await supabaseServer();
 const target=await db.from('review_submissions').select('user_id').eq('id',id).maybeSingle();
 check(target.error);if(!target.data)throw new HttpError(404,'Review not found.');
 if(target.data.user_id===userId)throw new HttpError(403,'Administrators cannot moderate their own reviews.');
 const status:ReviewStatus=action==='approve'?'approved':'rejected';
 const {data,error}=await db.from('review_submissions').update({status}).eq('id',id).select('*').maybeSingle();
 check(error);if(!data)throw new HttpError(404,'Review not found.');return reviewDto(data);
}
export async function removeReview(userId:string,id:string){
 if(!await isReviewAdmin(userId))throw new HttpError(403,'You do not have permission to delete reviews.');
 const db=await supabaseServer();
 const target=await db.from('review_submissions').select('user_id').eq('id',id).maybeSingle();
 check(target.error);if(!target.data)throw new HttpError(404,'Review not found.');
 if(target.data.user_id===userId)throw new HttpError(403,'Administrators cannot delete their own reviews.');
 const {data,error}=await db.from('review_submissions').delete().eq('id',id).select('id');
 check(error);if(!data?.length)throw new HttpError(404,'Review not found.');
}
