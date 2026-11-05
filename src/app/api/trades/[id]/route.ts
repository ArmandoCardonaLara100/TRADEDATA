import {after} from 'next/server';
import {handle,requireUser,verifyOrigin,readJson,HttpError} from '@/lib/server/http';
import {saveTrade,removeTrade,removeEvidenceFiles} from '@/lib/server/repository';
import {recordAnalyticsEvent} from '@/lib/server/analytics';
type Context={params:Promise<{id:string}>};
export const PATCH=(request:Request,context:Context)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const {id}=await context.params;const trade=await saveTrade(user.id,await readJson(request),id);after(()=>recordAnalyticsEvent('trading_journal','trade_updated'));return Response.json(trade);});
export const DELETE=(request:Request,context:Context)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const {id}=await context.params;const version=Number(new URL(request.url).searchParams.get('version'));if(!Number.isInteger(version)||version<1)throw new HttpError(422,'A record version is required.');const paths=await removeTrade(user.id,id,version);after(()=>Promise.all([removeEvidenceFiles(paths),recordAnalyticsEvent('trading_journal','trade_deleted')]));return Response.json({ok:true});});
