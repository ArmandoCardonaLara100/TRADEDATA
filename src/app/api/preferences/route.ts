import {handle,requireUser,verifyOrigin,readJson} from '@/lib/server/http';
import {savePreferences} from '@/lib/server/repository';
import {z} from 'zod';
export const PATCH=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const {theme,accountId}=z.object({theme:z.enum(['light','dark','system']),accountId:z.string().uuid().nullable()}).parse(await readJson(request));await savePreferences(user.id,theme,accountId);return Response.json({ok:true});});
