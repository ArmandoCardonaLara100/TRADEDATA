'use client';
import {api,ApiError} from './client';
type AuthResult={error?:{message:string;code?:string};requiresConfirmation?:boolean;url?:string};
async function request(path:string,data?:unknown):Promise<AuthResult>{
 try{return await api<AuthResult>(path,{method:'POST',body:JSON.stringify(data||{})});}
 catch(error){return {error:{message:error instanceof Error?error.message:'Authentication failed.',code:error instanceof ApiError?error.code:undefined}};}
}
export const authClient={
 signIn:{
  email:(data:{email:string;password:string})=>request('/api/auth/sign-in/email',data),
  google:()=>request('/api/auth/sign-in/google'),
 },
 signUp:{email:(data:{email:string;password:string;name:string})=>request('/api/auth/sign-up/email',data)},
 signOut:()=>request('/api/auth/sign-out'),
};
