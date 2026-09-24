import {AuthForm} from '@/features/auth/auth-form';
import {currentUser} from '@/lib/server/http';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login({searchParams}:{searchParams:Promise<{confirmation?:string}>}){if(await currentUser())redirect('/dashboard');const params=await searchParams;return <AuthForm initialError={params.confirmation==='failed'?'The confirmation link could not be completed. Try signing in if your email is already confirmed.':''}/>;}
