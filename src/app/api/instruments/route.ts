import {after} from 'next/server';
import {z} from 'zod';
import {handle,HttpError,readJson,requireUser,verifyOrigin} from '@/lib/server/http';
import {removeInstrument,saveInstrument} from '@/lib/server/repository';
import {recordAnalyticsEvent} from '@/lib/server/analytics';

const idSchema=z.string().uuid();
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const item=await saveInstrument(user.id,await readJson(request));after(()=>recordAnalyticsEvent('trading_journal','instrument_saved'));return Response.json(item,{status:201});});
export const PATCH=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser(),id=idSchema.parse(new URL(request.url).searchParams.get('id'));return Response.json(await saveInstrument(user.id,await readJson(request),id));});
export const DELETE=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser(),value=new URL(request.url).searchParams.get('id');if(!value)throw new HttpError(422,'Select a saved instrument.');await removeInstrument(user.id,idSchema.parse(value));return Response.json({ok:true});});
