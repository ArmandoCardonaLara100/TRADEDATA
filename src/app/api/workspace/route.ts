import {handle,requireUser} from '@/lib/server/http';
import {getWorkspace} from '@/lib/server/repository';
export const GET=(request:Request)=>handle(async()=>{const user=await requireUser();return Response.json(await getWorkspace(user.id,new URL(request.url).searchParams.get('accountId')||undefined),{headers:{'Cache-Control':'private, no-store'}});});
