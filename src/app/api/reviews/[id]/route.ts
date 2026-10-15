import {handle,requireUser,verifyOrigin,readJson} from '@/lib/server/http';
import {moderateReview,removeReview} from '@/lib/server/repository';

type Context={params:Promise<{id:string}>};
export const PATCH=(request:Request,context:Context)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const {id}=await context.params;return Response.json(await moderateReview(user.id,id,await readJson(request)));});
export const DELETE=(request:Request,context:Context)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const {id}=await context.params;await removeReview(user.id,id);return Response.json({ok:true});});
