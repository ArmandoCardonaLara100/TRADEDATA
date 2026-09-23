import {auth} from '../auth';
import {database} from '../database';
import {headers} from 'next/headers';
import {ZodError} from 'zod';
export class HttpError extends Error {constructor(public status:number,message:string){super(message);}}
export async function currentUser(){await database();const session=await auth().api.getSession({headers:await headers()});return session?.user??null;}
export async function requireUser(){const user=await currentUser();if(!user)throw new HttpError(401,'Sign in to continue.');return user;}
export function verifyOrigin(request:Request){
 const origin=request.headers.get('origin'),allowed=process.env.BETTER_AUTH_URL||'http://localhost:3000';
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
