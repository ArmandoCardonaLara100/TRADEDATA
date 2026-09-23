import {handle,requireUser,verifyOrigin,readJson,HttpError} from '@/lib/server/http';
import {saveTrade,removeTrade} from '@/lib/server/repository';
type Context={params:Promise<{id:string}>};
export const PATCH=(request:Request,context:Context)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const {id}=await context.params;return Response.json(await saveTrade(user.id,await readJson(request),id));});
export const DELETE=(request:Request,context:Context)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const {id}=await context.params;const version=Number(new URL(request.url).searchParams.get('version'));if(!Number.isInteger(version)||version<1)throw new HttpError(422,'A record version is required.');await removeTrade(user.id,id,version);return Response.json({ok:true});});
