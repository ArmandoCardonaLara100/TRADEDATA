import {handle,requireUser,verifyOrigin,HttpError} from '@/lib/server/http';
import {parseWorkbook} from '@/lib/import/workbook';
import {database} from '@/lib/database';
import {tradingAccounts,trades} from '@/lib/database/schema';
import {and,eq} from 'drizzle-orm';
export const runtime='nodejs';
export const POST=(request:Request)=>handle(async()=>{
 verifyOrigin(request);const user=await requireUser();
 if(Number(request.headers.get('content-length')||0)>2_100_000)throw new HttpError(413,'Workbook must be smaller than 2 MB.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Choose a workbook.');const chunks:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2_100_000){await reader.cancel();throw new HttpError(413,'Workbook must be smaller than 2 MB.');}chunks.push(value);}
 const data=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
 const file=data.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))throw new HttpError(422,'Choose an .xlsx workbook.');
 let parsed:ReturnType<typeof parseWorkbook>;try{parsed=parseWorkbook(new Uint8Array(await file.arrayBuffer()));}catch(error){throw new HttpError(422,error instanceof Error?error.message:'Workbook could not be read.');}
 const db=await database();
 const imported=await db.transaction(async tx=>{const results:{id:string;name:string;count:number;existing:boolean}[]=[];
  for(const sheet of parsed){
   const existing=await tx.select().from(tradingAccounts).where(and(eq(tradingAccounts.userId,user.id),eq(tradingAccounts.sourceHash,sheet.sourceHash),eq(tradingAccounts.sourceSheet,sheet.sourceSheet)));
   if(existing.length){results.push({id:existing[0].id,name:existing[0].name,count:sheet.rows.length,existing:true});continue;}
   const {rows,...account}=sheet;const id=crypto.randomUUID();
   await tx.insert(tradingAccounts).values({...account,id,userId:user.id,currency:'USD',lastSequence:Math.max(0,...rows.map(r=>r.sequence||0))});
   if(rows.length)await tx.insert(trades).values(rows.map(({version,...r})=>({...r,id:crypto.randomUUID(),userId:user.id,accountId:id,sequence:r.sequence!,duration:r.duration===null?null:String(r.duration)})));
   results.push({id,name:sheet.name,count:rows.length,existing:false});
  }return results;
 });
 return Response.json({imported},{status:201});
});
