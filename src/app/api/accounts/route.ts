import {handle,requireUser,verifyOrigin,readJson} from '@/lib/server/http';
import {createAccount} from '@/lib/server/repository';
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();return Response.json(await createAccount(user.id,await readJson(request)),{status:201});});
