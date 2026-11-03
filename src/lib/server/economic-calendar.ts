import type {EconomicEvent} from '@/types/news';

export type ProviderEvent={CalendarId?:unknown;Date?:unknown;Country?:unknown;Category?:unknown;Event?:unknown;Actual?:unknown;Previous?:unknown;Forecast?:unknown;Importance?:unknown;Currency?:unknown;Reference?:unknown;LastUpdate?:unknown};
type CalendarData={events:EconomicEvent[];fetchedAt:string;providerUpdatedAt:string|null};
type CacheEntry=CalendarData&{expiresAt:number;staleUntil:number};

const COUNTRY_META:Record<string,{code:string;currency:string}>={
 'united states':{code:'US',currency:'USD'},'euro area':{code:'EU',currency:'EUR'},'eurozone':{code:'EU',currency:'EUR'},
 'united kingdom':{code:'GB',currency:'GBP'},japan:{code:'JP',currency:'JPY'},canada:{code:'CA',currency:'CAD'},
 australia:{code:'AU',currency:'AUD'},switzerland:{code:'CH',currency:'CHF'},china:{code:'CN',currency:'CNY'},
 'new zealand':{code:'NZ',currency:'NZD'},sweden:{code:'SE',currency:'SEK'},norway:{code:'NO',currency:'NOK'},
 mexico:{code:'MX',currency:'MXN'},brazil:{code:'BR',currency:'BRL'},'south korea':{code:'KR',currency:'KRW'},
 india:{code:'IN',currency:'INR'},singapore:{code:'SG',currency:'SGD'},
};
const CURRENCY_SYMBOLS:Record<string,string>={'US$':'USD','€':'EUR','£':'GBP','C$':'CAD','A$':'AUD','NZ$':'NZD','CN¥':'CNY','R$':'BRL','CHF':'CHF','₹':'INR','₩':'KRW'};
const globalCache=globalThis as typeof globalThis&{__tradedataCalendarCache?:Map<string,CacheEntry>;__tradedataCalendarRequests?:Map<string,Promise<CalendarData>>};
const cache=globalCache.__tradedataCalendarCache??=new Map();
const requests=globalCache.__tradedataCalendarRequests??=new Map();

const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
function utc(value:string|null){if(!value)return null;const normalized=/[zZ]|[+-]\d\d:?\d\d$/.test(value)?value:`${value}Z`,date=new Date(normalized);return Number.isNaN(date.getTime())?null:date.toISOString();}
function currency(value:string|null,country:string){
 if(value){const normalized=value.trim(),upper=normalized.toUpperCase();if(/^[A-Z]{3}$/.test(upper))return upper;if(CURRENCY_SYMBOLS[normalized])return CURRENCY_SYMBOLS[normalized];}
 return COUNTRY_META[country.toLowerCase()]?.currency||'OTHER';
}
export function normalizeEconomicEvent(raw:ProviderEvent):EconomicEvent|null{
 const id=text(raw.CalendarId),dateUtc=utc(text(raw.Date)),event=text(raw.Event),country=text(raw.Country),importance=Number(raw.Importance);
 if(!id||!dateUtc||!event||!country||importance!==3)return null;
 const meta=COUNTRY_META[country.toLowerCase()];
 return {id,dateUtc,event,category:text(raw.Category)||event,country,countryCode:meta?.code||null,currency:currency(text(raw.Currency),country),impact:3,previous:text(raw.Previous),forecast:text(raw.Forecast),actual:text(raw.Actual),reference:text(raw.Reference),providerUpdatedAt:utc(text(raw.LastUpdate))};
}
async function retrieve(start:string,end:string):Promise<CalendarData>{
 const key=process.env.TRADING_ECONOMICS_API_KEY;
 if(!key)throw new Error('Economic calendar provider is not configured.');
 const url=`https://api.tradingeconomics.com/calendar/country/All/${start}/${end}?importance=3&f=json`;
 const response=await fetch(url,{headers:{Accept:'application/json',Authorization:key},cache:'no-store',signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new Error(`Economic calendar provider returned ${response.status}.`);
 const body:unknown=await response.json();
 if(!Array.isArray(body))throw new Error('Economic calendar provider returned an invalid response.');
 const events=body.slice(0,1000).map(item=>normalizeEconomicEvent(item as ProviderEvent)).filter((item):item is EconomicEvent=>Boolean(item)).sort((a,b)=>a.dateUtc.localeCompare(b.dateUtc)||a.id.localeCompare(b.id));
 const fetchedAt=new Date().toISOString(),providerUpdatedAt=events.reduce<string|null>((latest,event)=>event.providerUpdatedAt&&(!latest||event.providerUpdatedAt>latest)?event.providerUpdatedAt:latest,null);
 return {events,fetchedAt,providerUpdatedAt};
}
export async function economicCalendar(start:string,end:string):Promise<CalendarData&{stale:boolean}>{
 const cacheKey=`${start}:${end}`,now=Date.now(),existing=cache.get(cacheKey);
 if(existing&&existing.expiresAt>now)return {...existing,stale:false};
 let pending=requests.get(cacheKey);
 if(!pending){pending=retrieve(start,end);requests.set(cacheKey,pending);}
 try{
  const data=await pending,entry={...data,expiresAt:now+5*60_000,staleUntil:now+60*60_000};cache.set(cacheKey,entry);return {...entry,stale:false};
 }catch(error){if(existing&&existing.staleUntil>now)return {...existing,stale:true};throw error;}
 finally{requests.delete(cacheKey);}
}
export function dateInTimeZone(value:string,timeZone:string){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
 const part=(type:Intl.DateTimeFormatPartTypes)=>parts.find(item=>item.type===type)?.value||'';
 return `${part('year')}-${part('month')}-${part('day')}`;
}
