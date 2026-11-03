import {z} from 'zod';
import {handle,HttpError,requireUser} from '@/lib/server/http';
import {dateInTimeZone,economicCalendar} from '@/lib/server/economic-calendar';
import type {EconomicCalendarResponse} from '@/types/news';

const querySchema=z.object({date:z.iso.date(),timezone:z.string().min(1).max(100)});
const shift=(date:string,days:number)=>{const value=new Date(`${date}T12:00:00Z`);value.setUTCDate(value.getUTCDate()+days);return value.toISOString().slice(0,10);};
export const runtime='nodejs';
export const GET=(request:Request)=>handle(async()=>{
 await requireUser();
 const params=new URL(request.url).searchParams;
 let query:z.infer<typeof querySchema>;
 try{
  query=querySchema.parse({date:params.get('date'),timezone:params.get('timezone')});
  new Intl.DateTimeFormat('en-US',{timeZone:query.timezone}).format(new Date());
 }catch(error){
  if(error instanceof z.ZodError||error instanceof RangeError)throw new HttpError(422,'Choose a valid date and timezone.');
  throw error;
 }
 try{
  const calendar=await economicCalendar(shift(query.date,-1),shift(query.date,1));
  const payload:EconomicCalendarResponse={events:calendar.events.filter(event=>dateInTimeZone(event.dateUtc,query.timezone)===query.date),status:calendar.stale?'stale':'ok',timezone:query.timezone,checkedAt:new Date().toISOString(),fetchedAt:calendar.fetchedAt,providerUpdatedAt:calendar.providerUpdatedAt};
  return Response.json(payload,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){
  console.error('Economic calendar request failed:',error instanceof Error?error.message:'Unknown error');
  throw new HttpError(503,'Economic calendar data is temporarily unavailable.');
 }
});
