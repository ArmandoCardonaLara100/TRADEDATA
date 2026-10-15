import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {beforeAll,afterAll,expect,test} from 'vitest';

const db=new PGlite();
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
let accountId:string;
beforeAll(async()=>{
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon;
 grant execute on function auth.uid() to authenticated,anon;
 insert into auth.users values ('${a}'),('${b}');`);
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
  await db.query("insert into scenarios(user_id,name,kind,input) values($1,'A scenario','bankroll','{}')",[a]);
  await db.query('insert into preferences(user_id,"selectedAccountId") values($1,$2)',[a,accountId]);
  await db.query('select save_trade($1::jsonb)',[JSON.stringify({accountId,pnl:'0.12345678'})]);
  expect((await db.query<{initialBalance:string}>('select "initialBalance" from account_records')).rows[0].initialBalance).toBe('6000.12345678');
 });
 await asUser(b,async()=>{
  for(const table of ['profiles','trading_accounts','trades','strategies','scenarios','preferences','account_records','trade_records']){
   expect((await db.query('select * from '+table)).rows).toHaveLength(0);
  }
  expect((await db.query('update trading_accounts set name=$1 where id=$2 returning id',['Intrusion',accountId])).rows).toHaveLength(0);
  expect((await db.query('delete from trading_accounts where id=$1 returning id',[accountId])).rows).toHaveLength(0);
  await expect(db.query('insert into trading_accounts(user_id,name,"initialBalance") values($1,$2,100)',[a,'Forged'])).rejects.toThrow(/row-level security/);
  await expect(db.query('insert into trades(user_id,"accountId",sequence) values($1,$2,2)',[b,accountId])).rejects.toThrow(/foreign key/);
  await expect(db.query('select save_trade($1::jsonb)',[JSON.stringify({accountId,pnl:'999'})])).rejects.toThrow(/Account not found/);
 });
 await asUser(a,async()=>{
  await expect(db.query('update trading_accounts set user_id=$1 where id=$2',[b,accountId])).rejects.toThrow(/row-level security/);
  expect((await db.query('select * from trade_records')).rows).toHaveLength(1);
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
