import {after} from 'next/server';
import {z} from 'zod';
import {handle,HttpError,readJson,requireUser,verifyOrigin} from '@/lib/server/http';
import {removeStrategy,saveStrategy} from '@/lib/server/repository';
import {recordAnalyticsEvent} from '@/lib/server/analytics';

const idSchema=z.string().uuid();
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const item=await saveStrategy(user.id,await readJson(request));after(()=>recordAnalyticsEvent('trading_journal','strategy_saved'));return Response.json(item,{status:201});});
export const DELETE=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser(),value=new URL(request.url).searchParams.get('id');if(!value)throw new HttpError(422,'Select a saved strategy.');await removeStrategy(user.id,idSchema.parse(value));return Response.json({ok:true});});
