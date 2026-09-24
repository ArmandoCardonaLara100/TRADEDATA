import {handle,requireUser,verifyOrigin,HttpError} from '@/lib/server/http';
import {parseWorkbook} from '@/lib/import/workbook';
import {importWorkbook} from '@/lib/server/repository';
export const runtime='nodejs';
export const POST=(request:Request)=>handle(async()=>{
 verifyOrigin(request);await requireUser();
 if(Number(request.headers.get('content-length')||0)>2_100_000)throw new HttpError(413,'Workbook must be smaller than 2 MB.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Choose a workbook.');const chunks:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>2_100_000){await reader.cancel();throw new HttpError(413,'Workbook must be smaller than 2 MB.');}chunks.push(value);}
 const data=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':request.headers.get('content-type')||''}}).formData();
 const file=data.get('file');if(!(file instanceof File)||!file.name.toLowerCase().endsWith('.xlsx'))throw new HttpError(422,'Choose an .xlsx workbook.');
 let parsed:ReturnType<typeof parseWorkbook>;try{parsed=parseWorkbook(new Uint8Array(await file.arrayBuffer()));}catch(error){throw new HttpError(422,error instanceof Error?error.message:'Workbook could not be read.');}
 const imported=await importWorkbook(parsed);
 return Response.json({imported},{status:201});
});
