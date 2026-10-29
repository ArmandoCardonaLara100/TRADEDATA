import {handle,HttpError,requireUser,verifyOrigin} from '@/lib/server/http';
import {appUrl} from '@/lib/server/app-url';
import {createShareToken} from '@/lib/server/share-token';
import {supabaseServer} from '@/lib/supabase/server';
import {check} from '@/lib/server/repository';

export const runtime='nodejs';
type Context={params:Promise<{id:string}>};

async function ownedTrade(id:string,userId:string){
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(404,'Operation not found.');
 const db=await supabaseServer(),trade=await db.from('trades').select('id').eq('id',id).eq('user_id',userId).maybeSingle();
 check(trade.error);if(!trade.data)throw new HttpError(404,'Operation not found.');
 return db;
}

export const GET=(_request:Request,context:Context)=>handle(async()=>{
 const user=await requireUser(),{id}=await context.params,db=await ownedTrade(id,user.id);
 const share=await db.from('trade_shares').select('enabled').eq('trade_id',id).eq('user_id',user.id).maybeSingle();
 check(share.error);
 return Response.json({enabled:Boolean(share.data?.enabled)},{headers:{'Cache-Control':'private, no-store'}});
});

export const POST=(request:Request,context:Context)=>handle(async()=>{
 verifyOrigin(request);
 const user=await requireUser(),{id}=await context.params,db=await ownedTrade(id,user.id),{token,hash}=createShareToken(),now=new Date().toISOString();
 const share=await db.from('trade_shares').upsert({trade_id:id,user_id:user.id,token_hash:hash,enabled:true,updated_at:now},{onConflict:'trade_id'}).select('enabled').single();
 check(share.error);
 const url=new URL(`/share/${token}`,appUrl()).toString();
 return Response.json({enabled:true,url},{status:201,headers:{'Cache-Control':'private, no-store'}});
});

export const DELETE=(request:Request,context:Context)=>handle(async()=>{
 verifyOrigin(request);
 const user=await requireUser(),{id}=await context.params,db=await ownedTrade(id,user.id);
 const share=await db.from('trade_shares').update({enabled:false,updated_at:new Date().toISOString()}).eq('trade_id',id).eq('user_id',user.id);
 check(share.error);
 return Response.json({enabled:false},{headers:{'Cache-Control':'private, no-store'}});
});
