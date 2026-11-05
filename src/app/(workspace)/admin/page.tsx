import {notFound} from 'next/navigation';
import {AdminDashboard} from '@/features/admin/admin-dashboard';
import {getAdminDashboard,isFullAdmin} from '@/lib/server/admin';
import {requireUser} from '@/lib/server/http';

export default async function Page(){
 const user=await requireUser();if(!await isFullAdmin(user.id))notFound();
 return <AdminDashboard initial={await getAdminDashboard()}/>;
}
