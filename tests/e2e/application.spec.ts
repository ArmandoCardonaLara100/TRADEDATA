import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {workbookFixture} from '../workbook-fixture';
import {createClient} from '@supabase/supabase-js';
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const origin={Origin:base};
const credentials={email:`qa-${Date.now()}@example.test`,password:randomBytes(24).toString('base64url'),name:'QA Workspace'};
let owner:APIRequestContext,outsider:APIRequestContext,accountId:string,tradeId:string;
const testUserIds:string[]=[];
const admin=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_TEST_SECRET_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
test.beforeAll(async({playwright})=>{
 for(const email of [credentials.email,`other-${credentials.email}`]){
  const {data,error}=await admin.auth.admin.createUser({email,password:credentials.password,email_confirm:true,user_metadata:{name:credentials.name}});
  if(error)throw new Error(`Test user provisioning failed: ${error.code}`);
  testUserIds.push(data.user.id);
 }
 owner=await playwright.request.newContext({baseURL:base,extraHTTPHeaders:origin});outsider=await playwright.request.newContext({baseURL:base,extraHTTPHeaders:origin});
 const a=await owner.post('/api/auth/sign-in/email',{data:credentials});expect(a.status(),await a.text()).toBe(200);
 const b=await outsider.post('/api/auth/sign-in/email',{data:{...credentials,email:`other-${credentials.email}`}});expect(b.status(),await b.text()).toBe(200);
 const file=process.env.SOURCE_WORKBOOK?await readFile(process.env.SOURCE_WORKBOOK):workbookFixture();
 const response=await owner.post('/api/import',{multipart:{file:{name:'Trading Web.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file}}});expect(response.status(),await response.text()).toBe(201);const result=await response.json();accountId=result.imported[1].id;
 const pref=await owner.patch('/api/preferences',{data:{theme:'dark',accountId}});expect(pref.status()).toBe(200);
 tradeId=(await (await owner.get(`/api/trades?accountId=${accountId}`)).json()).trades[0].id;
});
test.afterAll(async()=>{
 await owner?.dispose();await outsider?.dispose();
 // An approved review references its moderator, so remove test reviews before test users.
 if(testUserIds.length){const {error}=await admin.from('review_submissions').delete().in('user_id',testUserIds);if(error)throw new Error(`Test review cleanup failed: ${error.code}`);}
 for(const id of testUserIds){const {error}=await admin.auth.admin.deleteUser(id);if(error)throw new Error(`Test user cleanup failed: ${error.message}`);}
});
test('hosted Supabase RLS isolates users without application filtering',async()=>{
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {error:loginError}=await client.auth.signInWithPassword({email:`other-${credentials.email}`,password:credentials.password});expect(loginError).toBeNull();
 for(const table of ['trading_accounts','trades','account_records','trade_records']){
  const {data,error}=await client.from(table).select('*').eq('user_id',testUserIds[0]);expect(error).toBeNull();expect(data).toEqual([]);
 }
 const stolen=await client.from('trades').insert({user_id:testUserIds[1],accountId,sequence:9999,pnl:99});expect(stolen.error?.code).toBe('23503');
 const forged=await client.from('trading_accounts').insert({user_id:testUserIds[0],name:'forged',initialBalance:100});expect(forged.error?.code).toBe('42501');
 const rpc=await client.rpc('save_trade',{p_data:{accountId,pnl:'99'}});expect(rpc.error?.code).toBe('P0002');
 const changed=await client.from('trades').update({pnl:999}).eq('id',tradeId).select();expect(changed.error).toBeNull();expect(changed.data).toEqual([]);
 const deleted=await client.from('trading_accounts').delete().eq('id',accountId).select();expect(deleted.data).toEqual([]);
 const own=await client.from('trading_accounts').insert({user_id:testUserIds[1],name:'B isolation check',initialBalance:100}).select('id').single();expect(own.error).toBeNull();
 const otherClient=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 expect((await otherClient.auth.signInWithPassword(credentials)).error).toBeNull();
 const otherRead=await otherClient.from('account_records').select('*').eq('id',own.data!.id);expect(otherRead.error).toBeNull();expect(otherRead.data).toEqual([]);
 const otherWrite=await otherClient.from('trading_accounts').delete().eq('id',own.data!.id).select();expect(otherWrite.error).toBeNull();expect(otherWrite.data).toEqual([]);
 await client.from('trading_accounts').delete().eq('id',own.data!.id);await otherClient.auth.signOut({scope:'local'});
 await client.auth.signOut({scope:'local'});
});
test('authenticated parity, validation, isolated access and conflicting edits',async({request})=>{
 expect((await request.get('/api/workspace')).status()).toBe(401);
 const result=await (await owner.get(`/api/workspace?accountId=${accountId}`)).json();expect(result.analytics.total).toBe(38);expect(result.analytics.balance).toBe(6352);expect(result.analytics.netProfit).toBe(352);expect(result.analytics.worksheetBreakEvenCount).toBe(10);
 expect((await outsider.get(`/api/workspace?accountId=${accountId}`)).status()).toBe(404);
 expect((await outsider.get(`/api/trades?accountId=${accountId}`)).status()).toBe(404);
 expect((await outsider.post('/api/trades',{data:{accountId,pnl:'50'}})).status()).toBe(404);
 expect((await outsider.delete(`/api/accounts/${accountId}`)).status()).toBe(404);
 expect((await owner.post('/api/accounts',{headers:{Origin:'https://untrusted.example'},data:{name:'CSRF',initialBalance:'100'}})).status()).toBe(403);
 expect((await owner.post('/api/trades',{data:{accountId,pnl:'NaN'}})).status()).toBe(422);
 const account=await (await owner.post('/api/accounts',{data:{name:'Lifecycle test',initialBalance:'1000',breakEvenBand:'10'}})).json();
 const created=await owner.post('/api/trades',{data:{accountId:account.id,symbol:'TEST',pnl:'100',riskPercent:'.01',rewardRisk:'2'}});
 // Decimal input requires a leading zero.
 expect(created.status()).toBe(422);
 const trade=await (await owner.post('/api/trades',{data:{accountId:account.id,symbol:'TEST',pnl:'100',riskPercent:'0.01',rewardRisk:'2'}})).json();expect(trade.version).toBe(1);
 const updated=await owner.patch(`/api/trades/${trade.id}`,{data:{accountId:account.id,pnl:'150',symbol:'TEST',version:1}});expect(updated.status()).toBe(200);
 expect((await owner.patch(`/api/trades/${trade.id}`,{data:{accountId:account.id,pnl:'200',version:1},timeout:10000})).status()).toBe(409);
 expect((await outsider.delete(`/api/trades/${trade.id}?version=2`)).status()).toBe(409);
 const balance=await (await owner.get(`/api/workspace?accountId=${account.id}`)).json();expect(balance.analytics.balance).toBe(1150);
 expect((await owner.delete(`/api/trades/${trade.id}?version=2`)).status()).toBe(200);expect((await owner.delete(`/api/accounts/${account.id}`)).status()).toBe(200);
 const other=await (await outsider.get('/api/workspace')).json();expect(other.accounts).toHaveLength(0);
});
test('concurrent operation creation uses unique sequences',async()=>{
 const a=await (await owner.post('/api/accounts',{data:{name:'Concurrency test',initialBalance:'1000'}})).json();
 const results=await Promise.all(Array.from({length:8},()=>owner.post('/api/trades',{data:{accountId:a.id,pnl:'1'}})));
 expect(results.every(r=>r.status()===201)).toBe(true);const rows=await Promise.all(results.map(r=>r.json()));expect(new Set(rows.map(t=>t.sequence)).size).toBe(8);
 expect((await owner.delete(`/api/accounts/${a.id}`)).status()).toBe(200);
});
test('calendar follows dated journal changes and keeps account ownership',async({request,page})=>{
 expect((await request.get('/api/calendar?accountId=unknown&month=2026-10')).status()).toBe(401);
 expect((await outsider.get(`/api/calendar?accountId=${accountId}&month=2026-10`)).status()).toBe(404);
 expect((await owner.get(`/api/calendar?accountId=${accountId}&month=2026-13`)).status()).toBe(422);
 const account=await (await owner.post('/api/accounts',{data:{name:'Calendar test',initialBalance:'1000'}})).json();
 const create=async(pnl:string)=>{
  const response=await owner.post('/api/trades',{data:{accountId:account.id,date:'2026-10-05',symbol:'TEST',pnl}});
  expect(response.status(),await response.text()).toBe(201);
  return response.json();
 };
 const first=await create('100');
 const second=await create('-40');
 const read=async()=>{
  const response=await owner.get(`/api/calendar?accountId=${account.id}&month=2026-10`);
  expect(response.status(),await response.text()).toBe(200);
  return (await response.json()).trades;
 };
 expect((await read()).map((trade:{id:string})=>trade.id)).toEqual([first.id,second.id]);
 expect((await owner.patch('/api/preferences',{data:{theme:'dark',accountId:account.id}})).status()).toBe(200);
 const state=await owner.storageState();await page.context().addCookies(state.cookies);
 await page.goto('/calendar');
 await expect(page.getByRole('heading',{name:'October 2026'})).toBeVisible();
 const day=page.getByRole('button',{name:/October 5, 2026.*2 operations.*\+\$60\.00/});
 await expect(day).toBeVisible();await day.click();
 await expect(page.getByRole('dialog').getByText('TEST')).toHaveCount(2);
 await expect(page.getByRole('dialog').getByText('+$60.00')).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Close dialog'}).click();
 await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'.data/calendar-mobile.png',fullPage:true});
 for(const width of [320,768,1366,1920]){
  await page.setViewportSize({width,height:900});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await page.getByRole('button',{name:'Next month'}).click();
 await expect(page.getByRole('heading',{name:'November 2026'})).toBeVisible();
 await page.getByRole('button',{name:'Previous month'}).click();
 await expect(page.getByRole('heading',{name:'October 2026'})).toBeVisible();
 await page.getByLabel('Language').selectOption('es');
 await expect(page.getByRole('heading',{name:'Calendario de trading'})).toBeVisible();
 await page.getByLabel('Language').selectOption('en');
 for(const theme of ['light','dark','system']){
  await page.getByLabel('Color theme').selectOption(theme);
  expect(['light','dark']).toContain(await page.getAttribute('html','data-theme'));
 }
 const changed=await owner.patch(`/api/trades/${second.id}`,{data:{accountId:account.id,date:'2026-10-06',symbol:'TEST',pnl:'-40',version:second.version}});
 expect(changed.status(),await changed.text()).toBe(200);
 expect((await read()).map((trade:{date:string})=>trade.date)).toEqual(['2026-10-05','2026-10-06']);
 await page.getByRole('button',{name:'Refresh calendar'}).click();
 await expect(page.getByRole('button',{name:/October 6, 2026.*-\$40\.00/})).toHaveClass(/calendar-day loss/);
 expect((await outsider.get(`/api/calendar?accountId=${account.id}&month=2026-10`)).status()).toBe(404);
 expect((await owner.delete(`/api/trades/${first.id}?version=${first.version}`)).status()).toBe(200);
 expect((await read()).map((trade:{id:string})=>trade.id)).toEqual([second.id]);
 await page.getByRole('button',{name:'Refresh calendar'}).click();
 await expect(page.getByRole('button',{name:/October 5, 2026/})).toHaveCount(0);
 expect((await owner.patch('/api/preferences',{data:{theme:'dark',accountId}})).status()).toBe(200);
 expect((await owner.delete(`/api/accounts/${account.id}`)).status()).toBe(200);
});
test('trade date, review fields, private evidence and four-section PDF persist',async()=>{
 const created=await owner.post('/api/accounts',{data:{name:'Review fields test',initialBalance:'10000'}});
 expect(created.status(),await created.text()).toBe(201);
 const account=await created.json();
 const saved=await owner.post('/api/trades',{data:{accountId:account.id,date:'2026-10-18',symbol:'EUR/USD',pnl:'125',strategy:'Breakout',setupGrade:'A+',mindset:'fear',feelings:'Waited for confirmation.'}});
 expect(saved.status(),await saved.text()).toBe(201);
 const record=await saved.json();
 expect(record).toMatchObject({date:'2026-10-18',setupGrade:'A+',mindset:'fear',feelings:'Waited for confirmation.'});
 const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/f2kAAAAASUVORK5CYII=','base64');
 const upload=await owner.post(`/api/trades/${record.id}/evidence`,{multipart:{image:{name:'chart.png',mimeType:'image/png',buffer:png}}});
 expect(upload.status(),await upload.text()).toBe(200);
 const image=await owner.get(`/api/trades/${record.id}/evidence`);
 expect(image.status()).toBe(200);expect(image.headers()['content-type']).toContain('image/png');expect(await image.body()).toEqual(png);
 expect((await outsider.get(`/api/trades/${record.id}/evidence`)).status()).toBe(404);
 const stored=await (await owner.get(`/api/trades?accountId=${account.id}`)).json();
 expect(stored.trades[0]).toMatchObject({date:'2026-10-18',setupGrade:'A+',mindset:'fear',feelings:'Waited for confirmation.'});
 expect(stored.trades[0].evidencePath).toContain(`${testUserIds[0]}/${record.id}/`);
 const calendar=await (await owner.get(`/api/calendar?accountId=${account.id}&month=2026-10`)).json();
 expect(calendar.trades[0].date).toBe('2026-10-18');
 const report=await owner.get(`/api/report?accountId=${account.id}&month=2026-10&lang=en`);
 expect(report.status(),await report.text()).toBe(200);expect(report.headers()['content-type']).toContain('application/pdf');
 const pdf=await report.body();expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
 expect((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(4);
 const edited=await owner.patch(`/api/trades/${record.id}`,{data:{accountId:account.id,date:'2026-10-17',symbol:'EUR/USD',pnl:'125',setupGrade:'B+',mindset:'neutral',feelings:'Followed the plan.',version:record.version}});
 expect(edited.status(),await edited.text()).toBe(200);
 expect(await edited.json()).toMatchObject({date:'2026-10-17',setupGrade:'B+',mindset:'neutral',feelings:'Followed the plan.'});
 const moved=await (await owner.get(`/api/calendar?accountId=${account.id}&month=2026-10`)).json();expect(moved.trades[0].date).toBe('2026-10-17');
 expect((await owner.delete(`/api/trades/${record.id}/evidence`)).status()).toBe(200);
 expect((await owner.get(`/api/trades/${record.id}/evidence`)).status()).toBe(404);
 expect((await owner.delete(`/api/accounts/${account.id}`)).status()).toBe(200);
});
test('review submission, moderation and public publication remain ownership-scoped',async({request})=>{
 const own=await owner.post('/api/reviews',{data:{reviewText:'Owner review must remain pending.'}});expect(own.status(),await own.text()).toBe(201);
 const ownReview=await own.json();expect(ownReview.status).toBe('pending');
 const other=await outsider.post('/api/reviews',{data:{reviewText:'A second trader review for moderation.'}});expect(other.status(),await other.text()).toBe(201);
 const otherReview=await other.json();expect(otherReview.status).toBe('pending');
 const role=await admin.from('user_roles').upsert({user_id:testUserIds[0],role:'review_admin'});expect(role.error).toBeNull();
 expect((await owner.patch(`/api/reviews/${ownReview.id}`,{data:{action:'approve'}})).status()).toBe(403);
 const approved=await owner.patch(`/api/reviews/${otherReview.id}`,{data:{action:'approve'}});expect(approved.status(),await approved.text()).toBe(200);expect((await approved.json()).status).toBe('approved');
 const landing=await request.get('/');expect(landing.status()).toBe(200);expect(await landing.text()).toContain(otherReview.reviewText);
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false,autoRefreshToken:false}});
 expect((await client.auth.signInWithPassword({email:`other-${credentials.email}`,password:credentials.password})).error).toBeNull();
 const tamper=await client.from('review_submissions').update({status:'rejected'}).eq('id',otherReview.id).select();expect(tamper.error).toBeNull();expect(tamper.data).toEqual([]);
 await client.auth.signOut({scope:'local'});
});
test('public authentication navigation and Google OAuth initiation are complete',async({page,request})=>{
 await page.goto('/');await page.getByRole('link',{name:'Log in',exact:true}).click();await expect(page).toHaveURL(/\/login$/);
 await expect(page.getByRole('button',{name:'Continue with Google',exact:true})).toBeVisible();await expect(page.getByRole('link',{name:'Back to Home',exact:true})).toBeVisible();
 await page.getByLabel('Color theme').selectOption('system');expect(await page.evaluate(()=>localStorage.getItem('theme'))).toBe('system');expect(['light','dark']).toContain(await page.getAttribute('html','data-theme'));
 await page.getByLabel('Language').selectOption('es');await expect(page.getByRole('button',{name:'Continuar con Google',exact:true})).toBeVisible();await page.getByRole('link',{name:'Volver al inicio',exact:true}).click();await expect(page).toHaveURL(base+'/');
 await page.goto('/auth/callback?flow=google');await expect(page).toHaveURL(/\/login\?authError=oauth$/);await expect(page.locator('.error-message')).toContainText('No se pudo completar el acceso con Google');
 const response=await request.post('/api/auth/sign-in/google',{headers:origin,data:{}});expect(response.status(),await response.text()).toBe(200);const payload=await response.json();const authorization=new URL(payload.url);expect(authorization.pathname).toContain('/auth/v1/authorize');expect(authorization.searchParams.get('provider')).toBe('google');const redirect=authorization.searchParams.get('redirect_to')||'';expect(redirect).toContain('/auth/callback');expect(redirect).toContain('flow=google');
});
test('login, import parity, journal filters, editing, saving and deletion through UI',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',entry=>{if(entry.type()==='error')errors.push(entry.text());});
 await page.goto('/login');await page.getByLabel('Email address').fill(credentials.email);await page.getByLabel('Password',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 await expect(page.getByText('$6,352.00',{exact:true})).toBeVisible();
 await expect(page.getByRole('link',{name:'Calculator',exact:true})).toHaveCount(0);
 await page.getByRole('link',{name:'Trading journal',exact:true}).click();await expect(page.getByRole('table')).toBeVisible();
 await page.getByLabel('Filter by result').selectOption('win');await expect(page.getByText('1–11 of 11 operations')).toBeVisible();
 await page.getByLabel('Search operations').fill('GBP/USD');await expect(page.getByText('1–4 of 4 operations')).toBeVisible();
 await page.getByLabel('Search operations').fill('');await page.getByLabel('Filter by result').selectOption('all');
 await page.getByRole('button',{name:'Record operation',exact:true}).first().click();await expect(page.getByRole('dialog')).toContainText('Pause before you record');await page.getByRole('button',{name:'Continue',exact:true}).click();
 const today=await page.evaluate(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
 await expect(page.getByLabel('Trade date')).toHaveValue(today);
 await page.getByLabel('Trade date').fill('2026-10-17');await page.getByLabel('Instrument',{exact:true}).fill('QA/USD');await page.getByLabel('Net result (USD)').fill('125');await page.getByLabel('Risk per trade (%)').fill('1');await page.getByLabel('Planned reward / risk (R)').fill('2');
 await page.getByText('Context & trade review').click();await page.getByLabel('Setup grade').selectOption('A+');await page.getByLabel('Mindset & execution').selectOption('fear');await page.getByLabel('Mindset note (optional)').fill('Waited for the setup.');
 await page.getByLabel('Paste a chart screenshot here, or choose an image.').evaluate(node=>{
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/f2kAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  const transfer=new DataTransfer();transfer.items.add(new File([png],'chart.png',{type:'image/png'}));
  node.dispatchEvent(new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
 });
 await expect(page.getByAltText('Trade evidence screenshot')).toBeVisible();
 await page.getByRole('button',{name:'Record operation',exact:true}).last().click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByLabel('Search operations').fill('QA/USD');await page.getByText('QA/USD',{exact:true}).click();await expect(page.getByText('Waited for the setup.')).toBeVisible();await expect(page.getByAltText('Trade evidence screenshot')).toBeVisible();await page.getByRole('button',{name:'Edit operation',exact:true}).click();await page.getByLabel('Net result (USD)').fill('150');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('+$150.00',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('+$150.00',{exact:true})).toBeVisible();await page.getByText('QA/USD',{exact:true}).click();await page.getByRole('button',{name:'Delete operation',exact:true}).click();await page.getByRole('button',{name:'Delete operation',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('link',{name:'Monte Carlo',exact:true}).click();await expect(page.getByText('Possible account paths')).toBeVisible();await expect(page.locator('.simulation-chart svg')).toBeVisible();
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByLabel('Scenario name').fill('Verified simulation');await page.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(page.getByText('Scenario saved to your workspace.')).toBeVisible();
 await page.getByRole('link',{name:'Funded accounts',exact:true}).click();await expect(page.getByText('$104.00',{exact:true})).toBeVisible();await page.getByLabel('Cost per account ($)').fill('30');await expect(page.getByText('$90.00',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByLabel('Scenario name').fill('Verified bankroll');await page.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.reload();await page.getByRole('button',{name:'Saved scenarios',exact:true}).click();await page.getByRole('button',{name:/^Verified bankroll/}).click();await expect(page.getByLabel('Cost per account ($)')).toHaveValue('30');await expect(page.getByText('$90.00',{exact:true})).toBeVisible();
 expect(errors).toEqual([]);await page.getByRole('button',{name:'Log out'}).click();await expect(page).toHaveURL(base+'/');await page.goto('/journal');await expect(page).toHaveURL(/login/);
 await page.getByLabel('Email address').fill(credentials.email);await page.getByLabel('Password',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/dashboard/);await expect(page.getByText('$6,352.00',{exact:true})).toBeVisible();
 for(const path of ['/statistics','/calendar','/review','/settings']){await page.goto(path);await expect(page.locator('main#main')).toBeVisible();}
 expect(errors).toEqual([]);
});
test('responsive themes, navigation and accessibility',async({page})=>{
 const state=await owner.storageState();await page.context().addCookies(state.cookies);
 for(const viewport of [{width:1440,height:1000},{width:820,height:1180},{width:390,height:844}]){
  await page.setViewportSize(viewport);await page.goto('/dashboard');await expect(page.getByText('$6,352.00',{exact:true})).toBeVisible();
  for(const theme of ['dark','light']){await page.evaluate(value=>{localStorage.setItem('theme',value);document.documentElement.setAttribute('data-theme',value);},theme);await expect(page.locator('.equity-chart svg')).toBeVisible();
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   await page.screenshot({path:`.data/dashboard-${viewport.width}-${theme}.png`,fullPage:true});
   const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).disableRules(['color-contrast']).analyze();expect(result.violations.map(v=>({id:v.id,description:v.description,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  }
 }
 await page.locator('button[aria-label="Open navigation"]').evaluate((button:HTMLButtonElement)=>button.click());await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('link',{name:'Monte Carlo',exact:true}).click();await expect(page.getByText('Possible account paths')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'.data/monte-carlo-mobile.png',fullPage:true});
});
test('numeric inputs stay natural, account deletion refreshes safely, and the brand returns home',async({page})=>{
 const state=await owner.storageState();await page.context().addCookies(state.cookies);
 await page.goto('/monte-carlo');
 for(const value of ['12','13','12.5','0.25']){await page.getByRole('spinbutton',{name:'Profit target',exact:true}).fill(value);await expect(page.getByRole('spinbutton',{name:'Profit target',exact:true})).toHaveValue(value);}
 await page.getByText('Capital & reproducibility').click();
 for(const value of ['1000','1000.75']){await page.getByLabel('Starting balance ($)').fill(value);await expect(page.getByLabel('Starting balance ($)')).toHaveValue(value);}

 const created=await (await owner.post('/api/accounts',{data:{name:'Deletion UI test',initialBalance:'1000.00000000',breakEvenBand:'12.50000000'}})).json();
 await page.goto('/settings');await page.getByLabel('Edit Deletion UI test').click();
 await expect(page.getByLabel('Initial balance')).toHaveValue('1000');await expect(page.getByLabel('Break-even band')).toHaveValue('12.5');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByLabel('Trading account',{exact:true}).selectOption(created.id);
 await page.getByRole('button',{name:'Delete trading account: Deletion UI test'}).first().click();
 await expect(page.getByRole('dialog')).toContainText('Your TRADEDATA login account will not be deleted.');
 await page.getByRole('button',{name:'Delete account',exact:true}).click();
 await expect(page.getByText('Trading account deleted.')).toBeVisible();
 await expect(page.getByLabel('Trading account',{exact:true}).locator(`option[value="${created.id}"]`)).toHaveCount(0);

 for(const path of ['/dashboard','/statistics','/monte-carlo','/settings']){
  await page.goto(path);await page.getByRole('link',{name:'Go to TRADEDATA home'}).first().click();await expect(page).toHaveURL(base+'/');
 }
 await page.goto('/dashboard');await expect(page.locator('main#main')).toBeVisible();
});

test('deleting the last trading account keeps the session and shows the empty state',async({page})=>{
 const only=await (await outsider.post('/api/accounts',{data:{name:'Only account',initialBalance:'1000'}})).json();
 const state=await outsider.storageState();await page.context().addCookies(state.cookies);await page.goto('/dashboard');
 await expect(page.getByLabel('Trading account',{exact:true})).toHaveValue(only.id);
 await page.getByRole('button',{name:'Delete trading account: Only account'}).first().click();await page.getByRole('button',{name:'Delete account',exact:true}).click();
 await expect(page.getByText('Your trading story starts here')).toBeVisible();await expect(page).toHaveURL(/dashboard/);
 await page.reload();await expect(page.getByText('Your trading story starts here')).toBeVisible();
});

test('a failed trading-account deletion leaves the account available',async({page})=>{
 const created=await (await owner.post('/api/accounts',{data:{name:'Deletion failure test',initialBalance:'1000'}})).json();
 const state=await owner.storageState();await page.context().addCookies(state.cookies);await page.goto('/dashboard');await page.getByLabel('Trading account',{exact:true}).selectOption(created.id);
 await page.route(`**/api/accounts/${created.id}`,route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Internal details'})}));
 await page.getByRole('button',{name:'Delete trading account: Deletion failure test'}).first().click();await page.getByRole('button',{name:'Delete account',exact:true}).click();
 await expect(page.getByText('The trading account could not be deleted. Please try again.')).toBeVisible();await expect(page.getByLabel('Trading account',{exact:true})).toHaveValue(created.id);
 await page.unroute(`**/api/accounts/${created.id}`);expect((await owner.delete(`/api/accounts/${created.id}`)).status()).toBe(200);
});
