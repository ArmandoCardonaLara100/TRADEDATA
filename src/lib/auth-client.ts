'use client';
import {api} from './client';
type AuthResult={error?:{message:string};requiresConfirmation?:boolean};
async function request(path:string,data?:unknown):Promise<AuthResult>{
 try{return await api<AuthResult>(path,{method:'POST',body:JSON.stringify(data||{})});}
 catch(error){return {error:{message:error instanceof Error?error.message:'Authentication failed.'}};}
}
export const authClient={
 signIn:{email:(data:{email:string;password:string})=>request('/api/auth/sign-in/email',data)},
 signUp:{email:(data:{email:string;password:string;name:string})=>request('/api/auth/sign-up/email',data)},
 signOut:()=>request('/api/auth/sign-out'),
};
