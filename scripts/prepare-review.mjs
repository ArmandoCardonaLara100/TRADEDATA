import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
const base=process.env.TEST_BASE_URL||'http://localhost:3000';
await mkdir('.data',{recursive:true});
let credentials;
try{credentials=JSON.parse(await readFile('.data/review-account.json','utf8'));}catch{credentials={email:`review-${Date.now()}@example.test`,password:randomBytes(24).toString('base64url'),name:'Armando'};}
let response=await fetch(`${base}/api/auth/sign-in/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(credentials)});
if(!response.ok)response=await fetch(`${base}/api/auth/sign-up/email`,{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify(credentials)});
if(!response.ok)throw new Error(`Authentication failed (${response.status}): ${await response.text()}`);
const cookies=response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
await writeFile('.data/review-account.json',JSON.stringify(credentials),{mode:0o600});
if(process.argv[2]){const data=new FormData();data.append('file',new Blob([await readFile(process.argv[2])]),'Trading Web.xlsx');const imported=await fetch(`${base}/api/import`,{method:'POST',headers:{Origin:base,Cookie:cookies},body:data});if(!imported.ok)throw new Error(`Import failed (${imported.status}): ${await imported.text()}`);const result=await imported.json();await fetch(`${base}/api/preferences`,{method:'PATCH',headers:{Origin:base,Cookie:cookies,'Content-Type':'application/json'},body:JSON.stringify({theme:'dark',accountId:result.imported.at(-1).id})});console.log('Source workbook imported into the private review workspace.');}
const workspace=await fetch(`${base}/api/workspace`,{headers:{Cookie:cookies}});const result=await workspace.json();
if(!workspace.ok)throw new Error(JSON.stringify(result));
console.log(JSON.stringify({accounts:result.accounts.length,total:result.analytics?.total,balance:result.analytics?.balance,net:result.analytics?.netProfit,winRate:result.analytics?.winRate}));
