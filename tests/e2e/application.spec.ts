import {test,expect,type APIRequestContext} from '@playwright/test';
import {randomBytes} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import {workbookFixture} from '../workbook-fixture';
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
const origin={Origin:base};
const credentials={email:`qa-${Date.now()}@example.test`,password:randomBytes(24).toString('base64url'),name:'QA Workspace'};
let owner:APIRequestContext,outsider:APIRequestContext,accountId:string,tradeId:string;
test.beforeAll(async({playwright})=>{
 owner=await playwright.request.newContext({baseURL:base,extraHTTPHeaders:origin});outsider=await playwright.request.newContext({baseURL:base,extraHTTPHeaders:origin});
 const a=await owner.post('/api/auth/sign-up/email',{data:credentials});expect(a.status(),await a.text()).toBe(200);
 const b=await outsider.post('/api/auth/sign-up/email',{data:{...credentials,email:`other-${credentials.email}`}});expect(b.status(),await b.text()).toBe(200);
 const file=process.env.SOURCE_WORKBOOK?await readFile(process.env.SOURCE_WORKBOOK):workbookFixture();
 const response=await owner.post('/api/import',{multipart:{file:{name:'Trading Web.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:file}}});expect(response.status(),await response.text()).toBe(201);const result=await response.json();accountId=result.imported[1].id;
 const pref=await owner.patch('/api/preferences',{data:{theme:'dark',accountId}});expect(pref.status()).toBe(200);
 tradeId=(await (await owner.get(`/api/trades?accountId=${accountId}`)).json()).trades[0].id;
});
test.afterAll(async()=>{await owner?.dispose();await outsider?.dispose();});
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
 expect((await owner.patch(`/api/trades/${trade.id}`,{data:{accountId:account.id,pnl:'200',version:1}})).status()).toBe(409);
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
test('login, import parity, journal filters, editing, saving and deletion through UI',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/login');await page.getByLabel('Email address').fill(credentials.email);await page.getByLabel('Password',{exact:true}).fill(credentials.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/dashboard/);
 await expect(page.getByText('$6,352.00',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Trading journal',exact:true}).click();await expect(page.getByRole('table')).toBeVisible();
 await page.getByLabel('Filter by result').selectOption('win');await expect(page.getByText('1–11 of 11 operations')).toBeVisible();
 await page.getByLabel('Search operations').fill('GBP/USD');await expect(page.getByText('1–4 of 4 operations')).toBeVisible();
 await page.getByLabel('Search operations').fill('');await page.getByLabel('Filter by result').selectOption('all');
 await page.getByRole('button',{name:'Record operation',exact:true}).first().click();await page.getByLabel('Instrument',{exact:true}).fill('QA/USD');await page.getByLabel('Net result (USD)').fill('125');await page.getByLabel('Risk per trade (%)').fill('1');await page.getByLabel('Planned reward / risk (R)').fill('2');await page.getByRole('button',{name:'Record operation',exact:true}).last().click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByLabel('Search operations').fill('QA/USD');await page.getByText('QA/USD',{exact:true}).click();await page.getByRole('button',{name:'Edit operation',exact:true}).click();await page.getByLabel('Net result (USD)').fill('150');await page.getByRole('button',{name:'Save changes',exact:true}).click();await expect(page.getByText('+$150.00',{exact:true})).toBeVisible();
 await page.reload();await expect(page.getByText('+$150.00',{exact:true})).toBeVisible();await page.getByText('QA/USD',{exact:true}).click();await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Delete operation',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('link',{name:'Calculator',exact:true}).click();await expect(page.getByText('$59.58',{exact:true})).toBeVisible();await page.getByLabel('Cash at risk ($)').fill('60');await expect(page.getByText('$65.00',{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Monte Carlo',exact:true}).click();await expect(page.getByText('Possible account paths')).toBeVisible();await expect(page.locator('.simulation-chart svg')).toBeVisible();
 await page.getByRole('button',{name:'Save',exact:true}).click();await page.getByLabel('Scenario name').fill('Verified simulation');await page.getByRole('button',{name:'Save scenario',exact:true}).click();await expect(page.getByText('Scenario saved to your workspace.')).toBeVisible();
 await page.getByRole('link',{name:'Funded accounts',exact:true}).click();await expect(page.getByText('$104.00',{exact:true})).toBeVisible();await page.getByLabel('Cost per account ($)').fill('30');await expect(page.getByText('$90.00',{exact:true})).toBeVisible();
 expect(errors).toEqual([]);await page.getByRole('button',{name:'Log out'}).click();await expect(page).toHaveURL(/login/);await page.goto('/journal');await expect(page).toHaveURL(/login/);
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
