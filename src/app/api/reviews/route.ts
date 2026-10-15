import {handle,requireUser,verifyOrigin,readJson} from '@/lib/server/http';
import {getReviewWorkspace,submitReview} from '@/lib/server/repository';

export const GET=()=>handle(async()=>{const user=await requireUser();return Response.json(await getReviewWorkspace(user.id),{headers:{'Cache-Control':'private, no-store'}});});
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();return Response.json(await submitReview(user.id,await readJson(request)),{status:201});});
