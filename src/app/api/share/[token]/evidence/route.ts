import {getSharedEvidence} from '@/lib/server/shared-trade';

export const runtime='nodejs';
type Context={params:Promise<{token:string}>};

export async function GET(request:Request,context:Context){
 const {token}=await context.params,slot=Number(new URL(request.url).searchParams.get('slot'));
 const image=await getSharedEvidence(token,slot);
 if(!image)return Response.json({error:'This shared operation is no longer available.'},{status:404,headers:{'Cache-Control':'private, no-store'}});
 return new Response(image,{headers:{
  'Content-Type':image.type||'application/octet-stream',
  'Cache-Control':'private, no-store, max-age=0',
  'Content-Disposition':'inline',
  'X-Content-Type-Options':'nosniff',
  'X-Robots-Tag':'noindex, nofollow, noarchive, nosnippet',
 }});
}
