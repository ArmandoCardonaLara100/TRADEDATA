import {betterAuth} from 'better-auth';
import {drizzleAdapter} from 'better-auth/adapters/drizzle';
import {connection} from './database';
import * as schema from './database/schema';
import {randomBytes} from 'node:crypto';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
function authSecret(){
 if(process.env.BETTER_AUTH_SECRET){if(process.env.BETTER_AUTH_SECRET.length<32)throw new Error('BETTER_AUTH_SECRET needs at least 32 characters.');return process.env.BETTER_AUTH_SECRET;}
 if(process.env.NODE_ENV==='production')throw new Error('BETTER_AUTH_SECRET is required in production.');
 const folder=path.join(process.cwd(),'.data'),file=path.join(folder,'auth-secret');mkdirSync(folder,{recursive:true,mode:0o700});
 if(!existsSync(file))writeFileSync(file,randomBytes(48).toString('base64url'),{mode:0o600,flag:'wx'});
 return readFileSync(file,'utf8');
}
let instance:ReturnType<typeof createAuth>|undefined;
function createAuth(){
 const baseURL=process.env.BETTER_AUTH_URL||'http://localhost:3000';
 if(process.env.NODE_ENV==='production'&&(!process.env.BETTER_AUTH_URL||!baseURL.startsWith('https://'))&&process.env.ALLOW_LOCAL_DATABASE!=='1')throw new Error('A trusted HTTPS BETTER_AUTH_URL is required in production.');
 return betterAuth({
  appName:'TRADEDATA',baseURL,secret:authSecret(),trustedOrigins:[baseURL],
  database:drizzleAdapter(connection().db,{provider:'pg',schema}),
  emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128},
  session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
  rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:60,max:5}}},
  advanced:{database:{generateId:()=>crypto.randomUUID()}},
 });
}
export function auth(){return instance??=createAuth();}
