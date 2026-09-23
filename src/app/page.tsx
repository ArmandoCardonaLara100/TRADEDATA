import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/server/http';
export const dynamic='force-dynamic';
export default async function Home(){const user=await currentUser();redirect(user?'/dashboard':'/login');}
