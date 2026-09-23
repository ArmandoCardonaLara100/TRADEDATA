import {AuthForm} from '@/features/auth/auth-form';
import {currentUser} from '@/lib/server/http';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Login(){if(await currentUser())redirect('/dashboard');return <AuthForm/>;}
