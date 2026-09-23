import {unzipSync,strFromU8} from 'fflate';
import {XMLParser} from 'fast-xml-parser';
import {tradeSchema,accountSchema} from '../validation/schemas';
import {createHash} from 'node:crypto';
import {z} from 'zod';
type Node=Record<string,unknown>;
const object=(x:unknown)=>(x&&typeof x==='object'?x:{}) as Node;
const array=(x:unknown):unknown[]=>x===undefined?[]:Array.isArray(x)?x:[x];
const text=(x:unknown):string=>x===undefined?'':typeof x==='object'?text(object(x)['#text']):String(x);
export interface WorkbookImport {name:string;initialBalance:string;breakEvenBand:string;baselineBreakEven:boolean;riskMetric:'planned'|'average-win';sourceSheet:string;sourceHash:string;rows:(z.infer<typeof tradeSchema>&{sourceRow:number})[];}
/** Reads supported journal templates only. Never evaluates uploaded formulas. */
export function parseWorkbook(buffer:Uint8Array):WorkbookImport[]{
 if(buffer.byteLength>2_000_000)throw new Error('Workbook must be smaller than 2 MB.');
 let expanded=0,entries=0;
 const files=unzipSync(buffer,{filter:file=>{entries++;expanded+=file.originalSize;if(entries>500||expanded>32_000_000||file.originalSize>12_000_000)throw new Error('The expanded workbook is too large.');return /^(xl\/(workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|worksheets\/sheet\d+.xml))$/.test(file.name);}});
 const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false,processEntities:true});
 const xml=(name:string)=>{if(!files[name])return {};const content=strFromU8(files[name]);if(/<!DOCTYPE|<!ENTITY/i.test(content))throw new Error('XML entity declarations are not supported.');return object(parser.parse(content));};
 const shared=array(object(xml('xl/sharedStrings.xml').sst).si).map(s=>{const n=object(s);return n.t!==undefined?text(n.t):array(n.r).map(r=>text(object(r).t)).join('');});
 const relationships=new Map(array(object(xml('xl/_rels/workbook.xml.rels').Relationships).Relationship).map(r=>{const n=object(r);return [text(n['@_Id']),text(n['@_Target'])];}));
 const sheets=array(object(object(xml('xl/workbook.xml').workbook).sheets).sheet);const result:WorkbookImport[]=[];const hash=createHash('sha256').update(buffer).digest('hex');
 for(const raw of sheets){const sheet=object(raw),name=text(sheet['@_name']);if(!['SEPTIEMBRE 2026','AGOSTO-DICIEMBRE 2026'].includes(name))continue;
  const target=relationships.get(text(sheet['@_r:id']))||'';if(!/^\/?(?:xl\/)?worksheets\/sheet\d+.xml$/.test(target))throw new Error('Invalid worksheet relationship.');
  const sheetPath=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:`xl/${target}`;
  const cells=new Map<string,unknown>();let cellCount=0;
  for(const row of array(object(object(xml(sheetPath).worksheet).sheetData).row))for(const cell of array(object(row).c)){const c=object(cell);if(++cellCount>100000)throw new Error('Worksheet is too large.');const ref=text(c['@_r']),type=text(c['@_t']),v=c.v;
   if(type==='s')cells.set(ref,shared[Number(v)]??'');else if(type==='inlineStr')cells.set(ref,text(object(c.is).t));else if(type==='e')cells.set(ref,null);else if(v!==undefined&&v!=='')cells.set(ref,type==='str'?text(v):Number.isFinite(Number(v))?Number(v):text(v));
  }
  if(!String(cells.get('G4')).includes('Resultado'))throw new Error(`${name}: unrecognized journal columns.`);
  const initial=cells.get('B5');if(typeof initial!=='number'||initial<=0)throw new Error(`${name}: missing initial balance in B5.`);
  const isSeptember=name==='SEPTIEMBRE 2026';
  const info:WorkbookImport={name:isSeptember?'September 2026':'August–December 2026',initialBalance:String(initial),breakEvenBand:isSeptember?'25':'15',baselineBreakEven:cells.get('G5')===0,riskMetric:isSeptember?'planned':'average-win',sourceSheet:name,sourceHash:hash,rows:[]};
  accountSchema.parse(info);
  const end=isSeptember?25:105;
  for(let r=6;r<=end;r++){
   const get=(c:string)=>cells.get(`${c}${r}`);if(!['C','D','E','F','G','K','L'].some(c=>{if(!isSeptember&&(c==='K'||c==='L'))return false;return get(c)!==undefined;}))continue;
   const numeric=(c:string)=>typeof get(c)==='number'?String(get(c)):null;
   const notes=isSeptember?text(get('K')):'',match=notes.match(/https:\/\/[^\s]+/);
   const record=tradeSchema.parse({accountId:'00000000-0000-4000-8000-000000000000',sequence:r-5,date:null,symbol:text(get('C')),riskPercent:numeric('D'),rewardRisk:numeric('E'),duration:numeric('F'),pnl:numeric('G'),notes,feelings:isSeptember?text(get('L')):'',evidenceUrl:match?.[0]||''});
   info.rows.push({...record,sourceRow:r});
  }
  result.push(info);
 }
 if(!result.length)throw new Error('No supported journal sheets found. Use the Trading Web workbook with its original worksheet names.');
 return result;
}
