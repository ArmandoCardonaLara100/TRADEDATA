import {after} from 'next/server';
import {handle,requireUser,verifyOrigin,readJson} from '@/lib/server/http';
import {listTrades,saveTrade} from '@/lib/server/repository';
import {recordAnalyticsEvent} from '@/lib/server/analytics';
export const GET=(request:Request)=>handle(async()=>{const user=await requireUser();return Response.json(await listTrades(user.id,new URL(request.url).searchParams),{headers:{'Cache-Control':'private, no-store'}});});
export const POST=(request:Request)=>handle(async()=>{verifyOrigin(request);const user=await requireUser();const trade=await saveTrade(user.id,await readJson(request));after(()=>recordAnalyticsEvent('trading_journal','trade_created'));return Response.json(trade,{status:201});});
