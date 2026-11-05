import {redirect} from 'next/navigation';
import {currentUser} from '@/lib/server/http';
import {getWorkspace} from '@/lib/server/repository';
import {WorkspaceProvider} from '@/features/workspace/context';
import {AppShell} from '@/components/app-shell';
import {isFullAdmin} from '@/lib/server/admin';
export const dynamic='force-dynamic';
export default async function WorkspaceLayout({children}:{children:React.ReactNode}){const user=await currentUser();if(!user)redirect('/login');const [initial,fullAdmin]=await Promise.all([getWorkspace(user.id),isFullAdmin(user.id)]);return <WorkspaceProvider initial={initial}><AppShell user={{name:user.name,email:user.email}} fullAdmin={fullAdmin}>{children}</AppShell></WorkspaceProvider>;}
