import {AuthForm} from '@/features/auth/auth-form';
import {currentUser} from '@/lib/server/http';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{confirmation?:string;authError?:string}>}){if(await currentUser())redirect('/dashboard');const params=await searchParams;const errorKey=params.authError==='oauth'?'auth.googleError':params.authError==='confirmation'||params.confirmation==='failed'?'auth.confirmationError':undefined;return <AuthForm initialErrorKey={errorKey}/>;}
