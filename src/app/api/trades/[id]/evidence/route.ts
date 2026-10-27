import {randomUUID} from 'node:crypto';
import {handle,HttpError,requireUser,verifyOrigin} from '@/lib/server/http';
import {supabaseServer} from '@/lib/supabase/server';
import {check} from '@/lib/server/repository';
import {EVIDENCE_BUCKET,EVIDENCE_SLOTS,MAX_EVIDENCE_BYTES,evidenceExtension,evidencePathForSlot} from '@/lib/evidence';

export const runtime='nodejs';
type Context={params:Promise<{id:string}>};

async function ownedTrade(id:string,userId:string){
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))throw new HttpError(404,'Operation not found.');
  const db=await supabaseServer();
  const {data,error}=await db.from('trades').select('id,evidencePath,additionalEvidencePaths').eq('id',id).eq('user_id',userId).maybeSingle();
  check(error);if(!data)throw new HttpError(404,'Operation not found.');
  return {db,trade:data};
}

function evidenceSlot(request:Request) {
  const value=new URL(request.url).searchParams.get('slot')||'1',slot=Number(value);
  if(!Number.isInteger(slot)||slot<1||slot>EVIDENCE_SLOTS)throw new HttpError(422,'Choose an evidence slot from 1 to 4.');
  return slot;
}

export const GET=(request:Request,context:Context)=>handle(async()=>{
  const user=await requireUser(),{id}=await context.params,{db,trade}=await ownedTrade(id,user.id),slot=evidenceSlot(request),path=evidencePathForSlot(trade,slot);
  if(!path)throw new HttpError(404,'No image is attached to this evidence slot.');
  const {data,error}=await db.storage.from(EVIDENCE_BUCKET).download(path);
  if(error||!data)throw new HttpError(404,'Evidence image not found.');
  return new Response(data,{headers:{'Content-Type':data.type||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
});

export const POST=(request:Request,context:Context)=>handle(async()=>{
  verifyOrigin(request);
  const user=await requireUser(),{id}=await context.params,{db,trade}=await ownedTrade(id,user.id),slot=evidenceSlot(request);
  const form=await request.formData(),file=form.get('image');
  if(!(file instanceof File))throw new HttpError(422,'Select an image to upload.');
  if(file.size<1||file.size>MAX_EVIDENCE_BYTES)throw new HttpError(413,'Use an image smaller than 4 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  const extension=evidenceExtension(file.type,bytes);
  if(!extension)throw new HttpError(422,'Use a valid PNG, JPEG, WebP, or GIF image.');
  const path=`${user.id}/${id}/${slot}-${randomUUID()}.${extension}`;
  const uploaded=await db.storage.from(EVIDENCE_BUCKET).upload(path,bytes,{contentType:file.type,upsert:false});
  if(uploaded.error)throw new HttpError(500,'The image could not be uploaded. Please try again.');
  const update=await db.rpc('set_trade_evidence_path',{p_trade_id:id,p_slot:slot,p_path:path});
  if(update.error){await db.storage.from(EVIDENCE_BUCKET).remove([path]);check(update.error);}
  if(update.data)await db.storage.from(EVIDENCE_BUCKET).remove([update.data]);
  return Response.json({ok:true,slot,path});
});

export const DELETE=(request:Request,context:Context)=>handle(async()=>{
  verifyOrigin(request);
  const user=await requireUser(),{id}=await context.params,{db,trade}=await ownedTrade(id,user.id),slot=evidenceSlot(request),path=evidencePathForSlot(trade,slot);
  if(!path)return Response.json({ok:true,slot});
  const result=await db.rpc('set_trade_evidence_path',{p_trade_id:id,p_slot:slot,p_path:''});
  check(result.error);if(result.data)await db.storage.from(EVIDENCE_BUCKET).remove([result.data]);
  return Response.json({ok:true,slot});
});
