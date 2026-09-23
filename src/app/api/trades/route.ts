import {handle,requireUser,verifyOrigin,readJson} from '@/lib/server/http';
import {listTrades,saveTrade} from '@/lib/server/repository';
export const GET=(request:Request)=>handle(async()=>{const user=await requireUser();return Response.json(await listTrades(user.id,new URL(request.url).searchParams),{headers:{'Cache-Control':'private, no-store'}});});
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();return Response.json(await saveTrade(user.id,await readJson(request)),{status:201});});
