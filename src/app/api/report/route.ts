import {handle,HttpError,requireUser} from '@/lib/server/http';
import {ownedAccount,listTrades} from '@/lib/server/repository';
import {calendarMonthBounds} from '@/lib/analytics/calendar';
import {generateReportPdf} from '@/lib/report/pdf';

export const runtime='nodejs';
export const GET=(request:Request)=>handle(async()=>{
 const user=await requireUser(),params=new URL(request.url).searchParams;
 const accountId=params.get('accountId')||'',requestedMonth=params.get('month');
 if(requestedMonth&&!calendarMonthBounds(requestedMonth))throw new HttpError(422,'Choose a valid report month.');
 const account=await ownedAccount(user.id,accountId);
 const result=await listTrades(user.id,new URLSearchParams({accountId,sort:'sequence',direction:'asc',export:'1',report:'1'}));
 const latestDate=result.trades.reduce<string|null>((latest,trade)=>trade.date&&(!latest||trade.date>latest)?trade.date:latest,null);
 const month=requestedMonth||latestDate?.slice(0,7)||new Date().toISOString().slice(0,7);
 // Large histories use journal pages in the PDF, rather than truncating data.
 const pdf=await generateReportPdf({account,trades:result.trades,month,language:params.get('lang')==='es'?'es':'en'});
 return new Response(new Uint8Array(pdf),{headers:{
  'Content-Type':'application/pdf',
  'Content-Disposition':`attachment; filename="tradedata-report-${month}.pdf"`,
  'Content-Length':String(pdf.length),
  'Cache-Control':'private, no-store',
  'X-Content-Type-Options':'nosniff',
 }});
});
