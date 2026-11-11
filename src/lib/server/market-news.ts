import {z} from 'zod';
import type {MarketNewsArticle,NewsCategory} from '@/types/news';

type NewsData={articles:MarketNewsArticle[];fetchedAt:string;hasMore:boolean};
type CacheEntry=NewsData&{expiresAt:number;staleUntil:number};
type CapabilityEntry={categories:NewsCategory[];expiresAt:number};
type RawRecord=Record<string,unknown>;

const PAGE_SIZE=20;
const FRESH_MS=30*60_000;
const STALE_MS=6*60*60_000;
const CAPABILITY_MS=24*60*60_000;
const ENDPOINTS:Record<NewsCategory,string>={
 latest:'fmp-articles',stocks:'news/stock-latest',forex:'news/forex-latest',crypto:'news/crypto-latest',
};
const rawRecord=z.record(z.string(),z.unknown());
const globalCache=globalThis as typeof globalThis&{
 __tradedataMarketNewsCache?:Map<string,CacheEntry>;
 __tradedataMarketNewsRequests?:Map<string,Promise<NewsData>>;
 __tradedataMarketNewsCapabilities?:CapabilityEntry;
 __tradedataMarketNewsCapabilityRequest?:Promise<NewsCategory[]>;
};
const cache=globalCache.__tradedataMarketNewsCache??=new Map();
const requests=globalCache.__tradedataMarketNewsRequests??=new Map();

const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
function url(value:unknown,image=false){
 const valueText=text(value);if(!valueText)return null;
 try{
  const parsed=new URL(valueText);if(parsed.protocol!=='https:')return null;
  if(image&&!/(^|\.)financialmodelingprep\.com$/i.test(parsed.hostname))return null;
  return parsed.toString();
 }catch{return null;}
}
function published(value:unknown){
 const raw=text(value);if(!raw)return null;
 const date=new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(raw)?raw:`${raw.replace(' ','T')}Z`);
 return Number.isNaN(date.getTime())?null:date.toISOString();
}
function plain(value:unknown){
 const raw=text(value);if(!raw)return '';
 return raw.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ')
  .replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')
  .replace(/\s+/g,' ').trim().slice(0,1200);
}
function tickers(raw:RawRecord){
 const values=[text(raw.tickers),text(raw.symbol)].filter((value):value is string=>Boolean(value));
 return [...new Set(values.flatMap(value=>value.split(/[,\s]+/)).map(value=>value.trim().replace(/^[A-Z]+:/,''))
  .filter(value=>/^[A-Z0-9.\-]{1,20}$/.test(value)).slice(0,12))];
}

export function normalizeMarketNewsArticle(value:unknown,category:NewsCategory,index=0):MarketNewsArticle|null{
 const result=rawRecord.safeParse(value);if(!result.success)return null;const raw=result.data;
 const title=text(raw.title),articleUrl=url(raw.link)||url(raw.url),publishedAt=published(raw.date)||published(raw.publishedDate);
 if(!title||!articleUrl||!publishedAt)return null;
 const source=text(raw.site)||text(raw.publisher)||'Financial Modeling Prep';
 return {
  id:`${category}:${articleUrl}:${index}`,title:title.slice(0,300),description:plain(raw.content)||plain(raw.text),
  publishedAt,source:source.slice(0,120),author:text(raw.author)?.slice(0,120)||null,
  imageUrl:url(raw.image,true),articleUrl,tickers:tickers(raw),category,
 };
}

function providerUrl(category:NewsCategory,page:number,limit=PAGE_SIZE){
 const key=process.env.FMP_API_KEY?.trim();if(!key)throw new Error('FMP_API_KEY is not configured.');
 const query=new URLSearchParams({page:String(page),limit:String(limit),apikey:key});
 return `https://financialmodelingprep.com/stable/${ENDPOINTS[category]}?${query}`;
}
async function providerFetch(category:NewsCategory,page:number,limit=PAGE_SIZE){
 const response=await fetch(providerUrl(category,page,limit),{
  headers:{Accept:'application/json'},signal:AbortSignal.timeout(12_000),next:{revalidate:1800},
 });
 if(!response.ok)throw new Error(`FMP returned ${response.status} for ${category}.`);
 const body:unknown=await response.json();if(!Array.isArray(body))throw new Error(`FMP returned an invalid ${category} response.`);
 return body;
}
async function retrieve(category:NewsCategory,page:number):Promise<NewsData>{
 const body=await providerFetch(category,page),normalized=body.slice(0,PAGE_SIZE)
  .map((item,index)=>normalizeMarketNewsArticle(item,category,index)).filter((item):item is MarketNewsArticle=>Boolean(item));
 const articles=[...new Map(normalized.map(article=>[article.articleUrl,article])).values()];
 if(body.length&&articles.length===0)throw new Error(`FMP ${category} response contained no valid articles.`);
 return {articles,fetchedAt:new Date().toISOString(),hasMore:body.length===PAGE_SIZE};
}
async function probeCapabilities(){
 const now=Date.now(),existing=globalCache.__tradedataMarketNewsCapabilities;
 if(existing&&existing.expiresAt>now)return existing.categories;
 if(globalCache.__tradedataMarketNewsCapabilityRequest)return globalCache.__tradedataMarketNewsCapabilityRequest;
 const pending=(async()=>{
  const optional=await Promise.all((['stocks','forex','crypto'] as const).map(async category=>{
   try{const body=await providerFetch(category,0,1);return Array.isArray(body)?category:null;}catch{return null;}
  }));
  const categories:NewsCategory[]=['latest',...optional.filter((value):value is Exclude<NewsCategory,'latest'>=>Boolean(value))];
  globalCache.__tradedataMarketNewsCapabilities={categories,expiresAt:now+CAPABILITY_MS};return categories;
 })();
 globalCache.__tradedataMarketNewsCapabilityRequest=pending;
 try{return await pending;}finally{globalCache.__tradedataMarketNewsCapabilityRequest=undefined;}
}

export async function marketNews(category:NewsCategory,page:number):Promise<NewsData&{stale:boolean;availableCategories:NewsCategory[]}>{
 const availableCategories=await probeCapabilities();
 if(!availableCategories.includes(category))throw new Error(`FMP category ${category} is not available for this subscription.`);
 const cacheKey=`${category}:${page}`,now=Date.now(),existing=cache.get(cacheKey);
 if(existing&&existing.expiresAt>now)return {...existing,stale:false,availableCategories};
 let pending=requests.get(cacheKey);if(!pending){pending=retrieve(category,page);requests.set(cacheKey,pending);}
 try{
  const data=await pending,entry={...data,expiresAt:now+FRESH_MS,staleUntil:now+STALE_MS};cache.set(cacheKey,entry);
  return {...entry,stale:false,availableCategories};
 }catch(error){if(existing&&existing.staleUntil>now)return {...existing,stale:true,availableCategories};throw error;}
 finally{requests.delete(cacheKey);}
}
