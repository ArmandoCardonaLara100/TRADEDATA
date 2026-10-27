export const EVIDENCE_BUCKET = 'trade-evidence';
export const EVIDENCE_SLOTS = 4;
// Below Vercel Functions' 4.5 MB request/response ceiling, including multipart overhead.
export const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

export type EvidencePaths={evidencePath?:string|null;additionalEvidencePaths?:string[]|null};

export function evidencePathForSlot(trade:EvidencePaths,slot:number) {
  return slot===1?trade.evidencePath||'':trade.additionalEvidencePaths?.[slot-2]||'';
}

export function replaceEvidencePath(trade:EvidencePaths,slot:number,path:string) {
  if(slot===1)return {evidencePath:path};
  const additional=Array.from({length:EVIDENCE_SLOTS-1},(_,index)=>trade.additionalEvidencePaths?.[index]||'');
  additional[slot-2]=path;
  return {additionalEvidencePaths:additional};
}

export function allEvidencePaths(trade:EvidencePaths) {
  return [trade.evidencePath||'',...(trade.additionalEvidencePaths||[])].filter(Boolean);
}

const signatures: Record<string,{extension:string;valid:(bytes:Uint8Array)=>boolean}> = {
  'image/png': {extension:'png',valid:b=>b.length>=8&&[137,80,78,71,13,10,26,10].every((v,i)=>b[i]===v)},
  'image/jpeg': {extension:'jpg',valid:b=>b.length>=4&&b[0]===255&&b[1]===216&&b[2]===255},
  'image/webp': {extension:'webp',valid:b=>b.length>=12&&String.fromCharCode(...b.slice(0,4))==='RIFF'&&String.fromCharCode(...b.slice(8,12))==='WEBP'},
  'image/gif': {extension:'gif',valid:b=>b.length>=6&&['GIF87a','GIF89a'].includes(String.fromCharCode(...b.slice(0,6)))},
};

export function evidenceExtension(type:string, bytes:Uint8Array) {
  const signature=signatures[type];
  return signature?.valid(bytes)?signature.extension:null;
}
