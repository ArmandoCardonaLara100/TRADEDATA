import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,afterAll,expect,test} from 'vitest';

const db=new PGlite();
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
let accountId:string;
beforeAll(async()=>{
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key,created_at timestamptz not null default now(),banned_until timestamptz);
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
 alter table storage.objects enable row level security;
 create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(regexp_replace(path,'/[^/]*$',''),'/')$$;
 grant usage on schema storage to authenticated;
 grant select,insert,delete on storage.objects to authenticated;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users(id) values ('${a}'),('${b}'),('${c}');`);
 const dir=new URL('../supabase/migrations/',import.meta.url);
 for(const file of (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,dir),'utf8'));
});
afterAll(()=>db.close());
async function asUser<T>(id:string,work:()=>Promise<T>){
 await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
 try{return await work();}finally{await db.exec('reset role');}
}
test('RLS protects every user table, views, ownership reassignment and foreign accounts',async()=>{
 await asUser(a,async()=>{
  const result=await db.query<{id:string}>(`insert into trading_accounts(user_id,name,"initialBalance") values ($1,'Owner A','6000.12345678') returning id`,[a]);accountId=result.rows[0].id;
  await db.query('insert into profiles(id,name) values($1,$2)',[a,'A']);
  await db.query('insert into strategies(user_id,name) values($1,$2)',[a,'A strategy']);
  await db.query('insert into saved_instruments(user_id,name) values($1,$2)',[a,'EUR/USD']);
  await db.query("insert into scenarios(user_id,name,kind,input) values($1,'A scenario','bankroll','{}')",[a]);
  await db.query('insert into preferences(user_id,"selectedAccountId") values($1,$2)',[a,accountId]);
  await db.query('select save_trade($1::jsonb)',[JSON.stringify({accountId,pnl:'0.12345678'})]);
  expect((await db.query<{initialBalance:string}>('select "initialBalance" from account_records')).rows[0].initialBalance).toBe('6000.12345678');
 });
 await asUser(b,async()=>{
  for(const table of ['profiles','trading_accounts','trades','trade_shares','saved_instruments','strategies','scenarios','preferences','account_records','trade_records']){
   expect((await db.query('select * from '+table)).rows).toHaveLength(0);
  }
  expect((await db.query('update trading_accounts set name=$1 where id=$2 returning id',['Intrusion',accountId])).rows).toHaveLength(0);
  expect((await db.query('delete from trading_accounts where id=$1 returning id',[accountId])).rows).toHaveLength(0);
  await expect(db.query('insert into trading_accounts(user_id,name,"initialBalance") values($1,$2,100)',[a,'Forged'])).rejects.toThrow(/row-level security/);
  await expect(db.query('insert into trades(user_id,"accountId",sequence) values($1,$2,2)',[b,accountId])).rejects.toThrow(/foreign key/);
  await expect(db.query('insert into saved_instruments(user_id,name) values($1,$2)',[a,'FORGED'])).rejects.toThrow(/row-level security/);
  await expect(db.query('select save_trade($1::jsonb)',[JSON.stringify({accountId,pnl:'999'})])).rejects.toThrow(/Account not found/);
 });
 await asUser(a,async()=>{
  await expect(db.query('update trading_accounts set user_id=$1 where id=$2',[b,accountId])).rejects.toThrow(/row-level security/);
  expect((await db.query('select * from trade_records')).rows).toHaveLength(1);
 });
});
test('account types and independent rules persist while account IDs and trades stay unchanged',async()=>{
 let challengeId:string;
 await asUser(a,async()=>{
  const payload={name:'Three-phase evaluation',currency:'USD',initialBalance:'100000',breakEvenBand:'0',accountType:'challenge',currentPhase:2,rules:[
   {phaseNumber:1,profitTarget:'8',maxLossLimit:'10',dailyLossLimit:'5',drawdownType:'static'},
   {phaseNumber:2,profitTarget:'5',maxLossLimit:'9',dailyLossLimit:'4',drawdownType:'trailing'},
   {phaseNumber:3,profitTarget:'4',maxLossLimit:'8',dailyLossLimit:'3',drawdownType:'static'},
  ]};
  const created=await db.query<{save_trading_account:string}>('select save_trading_account($1::jsonb)',[JSON.stringify(payload)]);challengeId=created.rows[0].save_trading_account;
  await db.query('select save_trade($1::jsonb)',[JSON.stringify({accountId:challengeId,pnl:'125'})]);
  const rules=await db.query<{phase_number:number;profitTarget:string}>('select phase_number,"profitTarget" from account_rule_records where account_id=$1 order by phase_number',[challengeId]);
  expect(rules.rows.map(rule=>[rule.phase_number,rule.profitTarget])).toEqual([[1,'8.00000000'],[2,'5.00000000'],[3,'4.00000000']]);
  const funded={...payload,name:'Funded now',accountType:'funded',currentPhase:null,rules:[{phaseNumber:null,profitTarget:'6',maxLossLimit:'10',dailyLossLimit:'5',drawdownType:'trailing'}]};
  expect((await db.query<{save_trading_account:string}>('select save_trading_account($1::jsonb,$2)',[JSON.stringify(funded),challengeId])).rows[0].save_trading_account).toBe(challengeId);
  expect((await db.query('select id from trades where "accountId"=$1',[challengeId])).rows).toHaveLength(1);
  expect((await db.query<{accountType:string;currentPhase:number|null}>('select "accountType","currentPhase" from account_records where id=$1',[challengeId])).rows[0]).toEqual({accountType:'funded',currentPhase:null});
  expect((await db.query<{rule_kind:string}>('select rule_kind from account_rule_records where account_id=$1',[challengeId])).rows).toEqual([{rule_kind:'funded'}]);
 });
 await asUser(b,async()=>{
  expect((await db.query('select * from account_rule_records where account_id=$1',[challengeId!])).rows).toHaveLength(0);
  await expect(db.query('select save_trading_account($1::jsonb,$2)',[JSON.stringify({name:'Intrusion',currency:'USD',initialBalance:'1',breakEvenBand:'0',accountType:'demo',currentPhase:null,rules:[]}),challengeId!])).rejects.toThrow(/Account not found/);
 });
});
test('trade updates reject stale versions and return precise money',async()=>{
 await asUser(a,async()=>{
  const create=await db.query<{save_trade:{id:string;version:number;pnl:string}}>('select save_trade($1::jsonb)',[JSON.stringify({accountId,pnl:'999999999999.12345678'})]);
  const row=create.rows[0].save_trade;expect(row.pnl).toBe('999999999999.12345678');
  const updated=await db.query<{save_trade:{version:number}}>('select save_trade($1::jsonb,$2)',[JSON.stringify({accountId,pnl:'123.45',version:1}),row.id]);
  expect(updated.rows[0].save_trade.version).toBe(2);
  await expect(db.query('select save_trade($1::jsonb,$2)',[JSON.stringify({accountId,pnl:'100',version:1}),row.id])).rejects.toMatchObject({code:'PT409'});
 });
});
test('gross result, commission cost and operation time are enforced at the database boundary',async()=>{
 await asUser(a,async()=>{
  const created=await db.query<{save_trade:{id:string;grossPnl:string;commission:string;pnl:string;tradeTime:string}}>('select save_trade($1::jsonb)',[JSON.stringify({accountId,grossPnl:'100',commission:'120',tradeTime:'09:45'})]);
  expect(created.rows[0].save_trade).toMatchObject({grossPnl:'100.00000000',commission:'-120.00000000',pnl:'-20.00000000',tradeTime:'09:45:00'});
  const id=created.rows[0].save_trade.id;
  const changed=await db.query<{save_trade:{grossPnl:string;commission:string;pnl:string}}>('select save_trade($1::jsonb,$2)',[JSON.stringify({accountId,grossPnl:'150',commission:'-10',tradeTime:'10:00',version:1}),id]);
  expect(changed.rows[0].save_trade).toMatchObject({grossPnl:'150.00000000',commission:'-10.00000000',pnl:'140.00000000'});
 });
});
test('grade, mindset, note, and edited Trade Date persist through the view and RPC',async()=>{
 await asUser(a,async()=>{
  const created=await db.query<{save_trade:{id:string;version:number;date:string;setupGrade:string;mindset:string;feelings:string}}>('select save_trade($1::jsonb)',[JSON.stringify({accountId,date:'2026-10-21',setupGrade:'A+',mindset:'fear',feelings:'Entered too early'})]);
  const row=created.rows[0].save_trade;
  expect(row).toMatchObject({date:'2026-10-21',setupGrade:'A+',mindset:'fear',feelings:'Entered too early'});
  const updated=await db.query<{save_trade:{date:string;setupGrade:string;mindset:string}}>('select save_trade($1::jsonb,$2)',[JSON.stringify({accountId,date:'2026-10-18',setupGrade:'B+',mindset:'neutral',feelings:'Waited for confirmation',version:row.version}),row.id]);
  expect(updated.rows[0].save_trade).toMatchObject({date:'2026-10-18',setupGrade:'B+',mindset:'neutral'});
  expect((await db.query<{date:string}>('select date::text as date from trade_records where id=$1',[row.id])).rows[0].date).toBe('2026-10-18');
 });
});
test('private evidence objects are readable and writable only for the owning trade user',async()=>{
 let path:string;
 await asUser(a,async()=>{
  const r=await db.query<{id:string}>('select id from trades where "accountId"=$1 limit 1',[accountId]);
  path=`${a}/${r.rows[0].id}/sample.png`;
  await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['trade-evidence',path]);
  expect((await db.query('select name from storage.objects')).rows).toHaveLength(1);
 });
 await asUser(b,async()=>{
  expect((await db.query('select name from storage.objects')).rows).toHaveLength(0);
  await expect(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['trade-evidence',path])).rejects.toThrow(/row-level security/);
 });
});
test('share capability records remain owner-only and anonymous users cannot list them',async()=>{
 let shareId:string;
 await asUser(a,async()=>{
  const trade=(await db.query<{id:string}>('select id from trades where "accountId"=$1 limit 1',[accountId])).rows[0];
  const inserted=await db.query<{id:string}>(`insert into trade_shares(trade_id,user_id,token_hash) values($1,$2,$3) returning id`,[trade.id,a,'a'.repeat(64)]);
  shareId=inserted.rows[0].id;
  expect((await db.query('select id from trade_shares where id=$1',[shareId])).rows).toHaveLength(1);
 });
 await asUser(b,async()=>{
  expect((await db.query('select id from trade_shares where id=$1',[shareId!])).rows).toHaveLength(0);
  expect((await db.query('update trade_shares set enabled=false where id=$1 returning id',[shareId!])).rows).toHaveLength(0);
 });
 await db.exec('set role anon');
 try{await expect(db.query('select * from trade_shares')).rejects.toThrow(/permission denied/);}finally{await db.exec('reset role');}
});
test('deleting a trading account cascades trades without deleting the auth user',async()=>{
 await asUser(a,async()=>{
  const created=await db.query<{id:string}>(`insert into trading_accounts(user_id,name,"initialBalance") values ($1,'Deletion test','1000') returning id`,[a]);
  const id=created.rows[0].id;
  await db.query('select save_trade($1::jsonb)',[JSON.stringify({accountId:id,pnl:'12.5'})]);
  await db.query('update preferences set "selectedAccountId"=$1 where user_id=$2',[id,a]);
  await db.query('delete from trading_accounts where id=$1',[id]);
  expect((await db.query('select * from trades where "accountId"=$1',[id])).rows).toHaveLength(0);
  expect((await db.query<{selectedAccountId:string|null}>('select "selectedAccountId" from preferences where user_id=$1',[a])).rows[0].selectedAccountId).toBeNull();
 });
 expect((await db.query('select id from auth.users where id=$1',[a])).rows).toHaveLength(1);
});
test('anonymous role has no access and RPCs do not bypass RLS',async()=>{
 await db.exec('set role anon');
 try {
  await expect(db.query('select * from trade_records')).rejects.toThrow(/permission denied/);
  await expect(db.query("select import_workbook('[]')")).rejects.toThrow(/permission denied/);
 } finally {await db.exec('reset role');}
});
test('reviews stay pending until a different authorized moderator approves them',async()=>{
 let reviewId:string;
 await db.query('insert into user_roles(user_id,role) values($1,$2)',[a,'review_admin']);
 await asUser(b,async()=>{
  await db.query('insert into profiles(id,name) values($1,$2) on conflict (id) do update set name=excluded.name',[b,'Trader B']);
  const inserted=await db.query<{id:string;user_id:string;reviewer_name:string;status:string}>(`insert into review_submissions(user_id,reviewer_name,review_text,status) values($1,'Forged name','Useful and private','approved') returning id,user_id,reviewer_name,status`,[a]);
  const review=inserted.rows[0];reviewId=review.id;
  expect(review.user_id).toBe(b);expect(review.reviewer_name).toBe('Trader B');expect(review.status).toBe('pending');
  expect((await db.query('select * from review_submissions')).rows).toHaveLength(1);
  expect((await db.query(`update review_submissions set status='approved' where id=$1 returning id`,[review.id])).rows).toHaveLength(0);
 });
 await db.exec('set role anon');
 try {expect((await db.query('select * from review_submissions')).rows).toHaveLength(0);} finally {await db.exec('reset role');}
 await asUser(a,async()=>{
  expect((await db.query('select * from review_submissions where id=$1',[reviewId!])).rows).toHaveLength(1);
  const approved=await db.query<{status:string;approved_by:string}>(`update review_submissions set status='approved' where id=$1 returning status,approved_by`,[reviewId!]);
  expect(approved.rows[0].status).toBe('approved');expect(approved.rows[0].approved_by).toBe(a);
  const own=await db.query<{id:string}>(`insert into review_submissions(user_id,reviewer_name,review_text) values($1,'Ignored','My own review') returning id`,[a]);
  expect((await db.query(`update review_submissions set status='approved' where id=$1 returning id`,[own.rows[0].id])).rows).toHaveLength(0);
 });
 await asUser(b,async()=>expect((await db.query<{status:string}>('select status from review_submissions where id=$1',[reviewId!])).rows[0].status).toBe('approved'));
});
test('analytics are append-only through the validated RPC and raw events remain private',async()=>{
 await asUser(b,async()=>{
  await db.query("select record_analytics_event('overview','overview_viewed','{}'::jsonb)");
  await db.query("select record_analytics_event('news','news_filter_changed','{\"filter_name\":\"currency\"}'::jsonb)");
  await db.query("select record_analytics_event('news','news_article_opened','{\"category\":\"forex\"}'::jsonb)");
  await db.query("select record_analytics_event('trading_journal','instrument_saved','{}'::jsonb)");
  await expect(db.query('select * from analytics_events')).rejects.toThrow(/permission denied/);
  await expect(db.query("insert into analytics_events(user_id,feature,event_name) values($1,'overview','overview_viewed')",[b])).rejects.toThrow(/permission denied/);
  await expect(db.query("select record_analytics_event('overview','overview_viewed','{\"private_note\":\"no\"}'::jsonb)")).rejects.toThrow(/Unsupported analytics metadata key/);
  await expect(db.query("select record_analytics_event('news','news_filter_changed','{\"filter_name\":\"private trade note\"}'::jsonb)")).rejects.toThrow(/Invalid analytics filter metadata/);
  await expect(db.query("select record_analytics_event('news','news_article_opened','{\"category\":\"private-note\"}'::jsonb)")).rejects.toThrow(/Invalid analytics category metadata/);
  await expect(db.query("select record_analytics_event('monte_carlo','simulation_run','{\"simulation_size\":1001}'::jsonb)")).rejects.toThrow(/Invalid analytics simulation metadata/);
 });
 await db.exec('set role anon');
 try{await expect(db.query("select record_analytics_event('overview','overview_viewed','{}')")).rejects.toThrow(/permission denied/);}finally{await db.exec('reset role');}
});
test('full-admin analytics are database-aggregated and denied to users and review admins',async()=>{
 await db.query('insert into user_roles(user_id,role) values($1,$2)',[c,'admin']);
 await db.query('insert into profiles(id,name) values($1,$2)',[c,'Full Admin']);
 await asUser(b,async()=>await expect(db.query("select get_admin_dashboard('30d',1,'all',1)")).rejects.toThrow(/Administrator access required/));
 await asUser(a,async()=>await expect(db.query("select get_admin_dashboard('30d',1,'all',1)")).rejects.toThrow(/Administrator access required/));
 await asUser(c,async()=>{
  const result=await db.query<{get_admin_dashboard:{kpis:{totalUsers:number;weeklyActiveUsers:number};features:unknown[];featureTimeline:unknown[];users:{items:Array<Record<string,unknown>>}}}>("select get_admin_dashboard('30d',1,'all',1)");
  expect(result.rows[0].get_admin_dashboard.kpis.totalUsers).toBe(3);
  expect(result.rows[0].get_admin_dashboard.kpis.weeklyActiveUsers).toBeGreaterThanOrEqual(1);
  expect(result.rows[0].get_admin_dashboard.features).toHaveLength(9);
  expect(result.rows[0].get_admin_dashboard.featureTimeline.length).toBeGreaterThanOrEqual(1);
  expect(result.rows[0].get_admin_dashboard.users.items.every(user=>!('id' in user)&&!('email' in user))).toBe(true);
  const news=await db.query<{get_admin_news_analytics:{views:number;articleOpens:number;uniqueReaders:number;categories:{category:string;opens:number}[]}}>("select get_admin_news_analytics('30d')");
  expect(news.rows[0].get_admin_news_analytics).toMatchObject({articleOpens:1,uniqueReaders:1,categories:[{category:'forex',opens:1}]});
 });
});
test('full admins can moderate other users while review admins remain compatible',async()=>{
 let reviewId:string;
 await asUser(b,async()=>{reviewId=(await db.query<{id:string}>("insert into review_submissions(user_id,reviewer_name,review_text) values($1,'Ignored','Admin workflow') returning id",[b])).rows[0].id;});
 await asUser(c,async()=>{
  const updated=await db.query<{status:string}>("update review_submissions set status='approved' where id=$1 returning status",[reviewId!]);
  expect(updated.rows[0].status).toBe('approved');
  await expect(db.query('select * from review_moderation_audit')).rejects.toThrow(/permission denied/);
 });
});
