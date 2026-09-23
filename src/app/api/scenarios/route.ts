import {handle,requireUser,verifyOrigin,readJson,HttpError} from '@/lib/server/http';
import {listScenarios,saveScenario,removeScenario} from '@/lib/server/repository';
export const GET=()=>handle(async()=>{const user=await requireUser();return Response.json(await listScenarios(user.id),{headers:{'Cache-Control':'private, no-store'}});});
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();return Response.json(await saveScenario(user.id,await readJson(request)),{status:201});});
export const DELETE=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const id=new URL(request.url).searchParams.get('id');if(!id)throw new HttpError(422,'Select a scenario.');await removeScenario(user.id,id);return Response.json({ok:true});});
