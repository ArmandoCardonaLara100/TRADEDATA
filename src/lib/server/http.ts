import {supabaseServer} from '../supabase/server';
import {cache} from 'react';
import {appUrl} from './app-url';
import {ZodError} from 'zod';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export const currentUser=cache(async()=>{
 const client=await supabaseServer();
 const {data,error}=await client.auth.getUser();
 if(error){if(error.name==='AuthSessionMissingError'||error.status===401||error.status===403)return null;throw new Error('Authentication service unavailable.');}
 if(!data.user)return null;
 const user=data.user;
 return {id:user.id,email:user.email||'',name:String(user.user_metadata?.name||user.email?.split('@')[0]||'Trader')};
});
export async function requireUser(){const user=await currentUser();if(!user)throw new HttpError(401,'Sign in to continue.');return user;}
export function verifyOrigin(request:Request){
 const origin=request.headers.get('origin'),allowed=appUrl();
 if(!origin||origin!==new URL(allowed).origin)throw new HttpError(403,'This request came from an untrusted origin.');
}
export async function readJson(request:Request){if(Number(request.headers.get('content-length')||0)>100000)throw new HttpError(413,'Request is too large.');const text=await request.text();if(text.length>100000)throw new HttpError(413,'Request is too large.');try{return JSON.parse(text);}catch{throw new HttpError(400,'Invalid JSON.');}}
export function errorResponse(error:unknown){
 if(error instanceof HttpError)return Response.json({error:error.message},{status:error.status});
 if(error instanceof ZodError)return Response.json({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join(' '),issues:error.issues},{status:422});
 console.error('TRADEDATA request failed',error instanceof Error?error.message:'Unknown failure');
 return Response.json({error:'The request could not be completed. Your changes were not saved. Try again.'},{status:500});
}
export async function handle(work:()=>Promise<Response>){try{return await work();}catch(error){return errorResponse(error);}}
