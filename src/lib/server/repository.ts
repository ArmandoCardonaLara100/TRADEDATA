import {supabaseServer} from '../supabase/server';
import {HttpError} from './http';
import {calculateAnalytics} from '../analytics/journal';
import {calendarMonthBounds} from '../analytics/calendar';
import {accountSchema,tradeSchema,scenarioSchema,reviewSubmissionSchema,reviewModerationSchema} from '../validation/schemas';
import type {Trade,TradingAccount} from '@/types/trading';
import type {Json} from '../supabase/types';
import type {parseWorkbook} from '../import/workbook';
import type {ReviewSubmission,ReviewWorkspace,ReviewStatus} from '@/types/reviews';

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
function accountDto(raw:unknown):TradingAccount {
 const a=raw as TradingAccount;
 if(!a?.id||typeof a.initialBalance!=='string')throw new Error('Invalid account response.');
 return a;
}
function tradeDto(raw:unknown):Trade {
 const t=raw as Trade;
 if(!t?.id||(t.pnl!==null&&typeof t.pnl!=='string'))throw new Error('Invalid operation response.');
 return t;
}
function reviewDto(raw:unknown):ReviewSubmission {
 const review=raw as {id?:string;user_id?:string;reviewer_name?:string;review_text?:string;status?:ReviewStatus;submitted_at?:string;approved_at?:string|null;approved_by?:string|null};
 if(!review?.id||!review.user_id||!review.reviewer_name||!review.review_text||!review.submitted_at||!['pending','approved','rejected'].includes(review.status||''))throw new Error('Invalid review response.');
 return {id:review.id,userId:review.user_id,reviewerName:review.reviewer_name,reviewText:review.review_text,status:review.status!,submittedAt:review.submitted_at,approvedAt:review.approved_at||null,approvedBy:review.approved_by||null};
}
export async function ownedAccount(userId:string,id:string){
 const db=await supabaseServer();
 const {data,error}=await db.from('account_records').select('*').eq('user_id',userId).eq('id',id).maybeSingle();
 check(error);if(!data)throw new HttpError(404,'Trading account not found.');return accountDto(data);
}
export async function getWorkspace(userId:string,accountId?:string){
 const db=await supabaseServer();
 const [accountsResult,preferencesResult]=await Promise.all([
  db.from('account_records').select('*').eq('user_id',userId).order('createdAt'),
  db.from('preferences').select('*').eq('user_id',userId).maybeSingle(),
 ]);
 check(accountsResult.error);check(preferencesResult.error);
 const accounts=(accountsResult.data||[]).map(accountDto),preference=preferencesResult.data;
 const account=accounts.find(a=>a.id===(accountId||preference?.selectedAccountId))||(accountId?undefined:accounts[0]);
 if(accountId&&!account)throw new HttpError(404,'Trading account not found.');
 if(!account)return {accounts,account:null,analytics:null,recent:[],theme:preference?.theme||'system'};
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
 return {accounts,account,analytics,recent:records.slice(-6).reverse(),theme:preference?.theme||'system'};
}
export async function createAccount(userId:string,raw:unknown){
 const data=accountSchema.parse(raw),db=await supabaseServer();
 const {data:row,error}=await db.from('trading_accounts').insert({...data,user_id:userId}).select('id').single();
 check(error);return ownedAccount(userId,row!.id);
}
export async function updateAccount(userId:string,id:string,raw:unknown){
 const data=accountSchema.parse(raw),db=await supabaseServer();
 const {data:row,error}=await db.from('trading_accounts').update(data).eq('id',id).eq('user_id',userId).select('id').maybeSingle();
 check(error);if(!row)throw new HttpError(404,'Trading account not found.');return ownedAccount(userId,id);
}
export async function removeAccount(userId:string,id:string){
 const db=await supabaseServer();const {data,error}=await db.from('trading_accounts').delete().eq('id',id).eq('user_id',userId).select('id');
 check(error);if(!data?.length)throw new HttpError(404,'Trading account not found.');
}
export async function listTrades(userId:string,params:URLSearchParams){
 const account=await ownedAccount(userId,params.get('accountId')||''),db=await supabaseServer();
 const page=Math.min(100000,Math.max(1,Math.floor(Number(params.get('page'))||1))),exporting=params.get('export')==='1';
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
 const db=await supabaseServer(),{data,error}=await db.from('trades').delete().eq('user_id',userId).eq('id',id).eq('version',version).select('id');
 check(error);if(!data?.length)throw new HttpError(409,'This operation changed or was removed. Refresh and try again.');
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
 const db=await supabaseServer(),{data,error}=await db.from('user_roles').select('role').eq('user_id',userId).eq('role','review_admin').maybeSingle();
 check(error);return Boolean(data);
}
export async function getReviewWorkspace(userId:string):Promise<ReviewWorkspace>{
 const db=await supabaseServer();
 const [reviews,admin]=await Promise.all([
  db.from('review_submissions').select('*').order('submitted_at',{ascending:false}),
  isReviewAdmin(userId),
 ]);
 check(reviews.error);
 return {reviews:(reviews.data||[]).map(reviewDto),isAdmin:admin};
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
