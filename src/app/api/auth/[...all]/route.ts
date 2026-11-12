import {supabaseServer} from '@/lib/supabase/server';
import {handle,verifyOrigin,readJson,HttpError} from '@/lib/server/http';
import {z} from 'zod';
import {appUrl} from '@/lib/server/app-url';
import {ensureProfile} from '@/lib/supabase/profile';
export const runtime='nodejs';
const credentials=z.object({email:z.email().max(254),password:z.string().min(1).max(128),name:z.string().trim().min(1).max(80).optional()});
export const POST=(request:Request)=>handle(async()=>{
 verifyOrigin(request);
 const client=await supabaseServer(),path=new URL(request.url).pathname;
 if(path==='/api/auth/sign-out'){
  const {error}=await client.auth.signOut({scope:'local'});
  if(error)throw new HttpError(503,'Could not sign out. Please try again.');
  return Response.json({});
 }
 if(path==='/api/auth/sign-in/google'){
  const callback=new URL('/auth/callback',appUrl());
  callback.searchParams.set('flow','google');
  const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:callback.href}});
  if(error||!data.url)throw new HttpError(503,'Google sign-in could not be started. Please try again.');
  return Response.json({url:data.url});
 }
 if(!['/api/auth/sign-in/email','/api/auth/sign-up/email'].includes(path))throw new HttpError(404,'Authentication route not found.');
 const data=credentials.parse(await readJson(request));
 if(path==='/api/auth/sign-up/email'){
  if(data.password.length<12||!data.name)throw new HttpError(422,'Enter your name and a password of at least 12 characters.');
  const {data:result,error}=await client.auth.signUp({email:data.email,password:data.password,options:{
   data:{name:data.name},emailRedirectTo:new URL('/auth/callback',appUrl()).href,
  }});
  if(error){
   if(error.code==='over_email_send_rate_limit')throw new HttpError(429,'A confirmation email was requested too recently. Check your inbox or wait before trying again.','AUTH_EMAIL_RATE_LIMIT');
   if(error.status===429)throw new HttpError(429,'Too many authentication attempts. Wait a moment before trying again.','AUTH_RATE_LIMIT');
   throw new HttpError(400,'Registration could not be completed. Check your details and try again.','AUTH_REGISTRATION_FAILED');
  }
  if(result.session && result.user)await ensureProfile(client,result.user);
  return Response.json({requiresConfirmation:!result.session});
 }
 const {data:session,error}=await client.auth.signInWithPassword({email:data.email,password:data.password});
 if(error){
  if(error.status===429)throw new HttpError(429,'Too many sign-in attempts. Wait a moment before trying again.','AUTH_RATE_LIMIT');
  if(error.code==='email_not_confirmed')throw new HttpError(401,'Confirm your email before signing in.','AUTH_EMAIL_NOT_CONFIRMED');
  throw new HttpError(401,'Unable to sign in. Check your email and password.','AUTH_INVALID_CREDENTIALS');
 }
 await ensureProfile(client,session.user);
 return Response.json({});
});
