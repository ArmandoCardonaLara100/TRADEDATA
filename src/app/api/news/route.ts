import {z} from 'zod';
import {handle,HttpError,requireUser} from '@/lib/server/http';
import {marketNews} from '@/lib/server/market-news';
import type {MarketNewsResponse} from '@/types/news';

const querySchema=z.object({category:z.enum(['latest','stocks','forex','crypto']).default('latest'),page:z.coerce.number().int().min(0).max(100).default(0)});
export const runtime='nodejs';
export const GET=(request:Request)=>handle(async()=>{
 await requireUser();
 const params=new URL(request.url).searchParams;
 let query:z.infer<typeof querySchema>;
 try{query=querySchema.parse({category:params.get('category')||undefined,page:params.get('page')||undefined});}
 catch(error){if(error instanceof z.ZodError)throw new HttpError(422,'Choose a valid news category and page.');throw error;}
 try{
  const data=await marketNews(query.category,query.page);
  const payload:MarketNewsResponse={articles:data.articles,category:query.category,availableCategories:data.availableCategories,status:data.stale?'stale':'ok',checkedAt:new Date().toISOString(),fetchedAt:data.fetchedAt,page:query.page,hasMore:data.hasMore};
  return Response.json(payload,{headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){
  console.error('Market news request failed:',error instanceof Error?error.message:'Unknown error');
  throw new HttpError(503,'Market news is temporarily unavailable.');
 }
});
