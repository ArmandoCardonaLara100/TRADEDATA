'use client';
import {useEffect,useState,type ClipboardEvent,type FormEvent} from 'react';
import {ExternalLink,ImagePlus,LoaderCircle,Pencil,RotateCcw,Trash2,Upload,X} from 'lucide-react';
import {Modal,Button,Field,ErrorMessage} from '@/components/ui';
import {api,message} from '@/lib/client';
import {useWorkspace} from '@/features/workspace/context';
import {useLanguage,type MessageKey} from '@/lib/i18n';
import {D} from '@/lib/calculations/decimal';
import type {Trade} from '@/types/trading';
import {number,signedMoney} from '@/lib/format';
import {classify} from '@/lib/analytics/journal';
import {numericInputValue} from '@/lib/numeric-input';
import {EVIDENCE_SLOTS,MAX_EVIDENCE_BYTES,evidencePathForSlot} from '@/lib/evidence';
import {localTradeDate} from '@/lib/trade-date';
import {EvidenceImage} from './evidence-image';

const imageTypes=['image/png','image/jpeg','image/webp','image/gif'];
const mindsetValues=['euphoria','trust','neutral','fear','fomo','anxiety'] as const;
type UploadStatus='empty'|'selected'|'uploading'|'uploaded'|'error';
type EvidenceSlot={file:File|null;status:UploadStatus;stored:boolean;remove:boolean;error:string};

function initialSlots(trade?:Trade):EvidenceSlot[]{
 return Array.from({length:EVIDENCE_SLOTS},(_,index)=>{const stored=Boolean(trade&&evidencePathForSlot(trade,index+1));return {file:null,status:stored?'uploaded':'empty',stored,remove:false,error:''};});
}

function SelectedImage({file,alt}:{file:File;alt:string}){
 const [src,setSrc]=useState('');
 useEffect(()=>{const url=URL.createObjectURL(file);setSrc(url);return()=>URL.revokeObjectURL(url);},[file]);
 return src?<img className="evidence-selected-image" src={src} alt={alt}/>:null;
}

export function TradeDialog({open,onOpenChange,trade,onPersisted,onSaved}:{open:boolean;onOpenChange:(v:boolean)=>void;trade?:Trade;onPersisted?:()=>void|Promise<void>;onSaved?:()=>void|Promise<void>}){
 const {account,refresh,notify}=useWorkspace(),{t}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[slots,setSlots]=useState<EvidenceSlot[]>(()=>initialSlots(trade)),[persistedTrade,setPersistedTrade]=useState<Trade|undefined>(trade);
 const record=persistedTrade||trade;
 const updateSlot=(index:number,patch:Partial<EvidenceSlot>)=>setSlots(current=>current.map((slot,i)=>i===index?{...slot,...patch}:slot));
 function chooseImage(index:number,file:File|undefined){
  if(!file)return;
  if(!imageTypes.includes(file.type)){updateSlot(index,{file:null,status:'error',error:t('journal.evidenceTypeError')});return;}
  if(file.size>MAX_EVIDENCE_BYTES){updateSlot(index,{file:null,status:'error',error:t('journal.evidenceSizeError')});return;}
  updateSlot(index,{file,status:'selected',remove:false,error:''});setError('');
 }
 function pasteImage(index:number,event:ClipboardEvent<HTMLElement>){
  const file=[...event.clipboardData.items].find(item=>item.type.startsWith('image/'))?.getAsFile();
  if(file){event.preventDefault();chooseImage(index,file);}
 }
 function removeImage(index:number){
  const slot=slots[index];
  if(slot.file){updateSlot(index,{file:null,status:slot.stored?'uploaded':'empty',remove:false,error:''});return;}
  updateSlot(index,{file:null,status:'empty',stored:false,remove:slot.stored,error:''});
 }
 async function persistSlot(index:number,tradeId:string){
  const slot=slots[index];
  if(!slot.file&&!slot.remove)return true;
  updateSlot(index,{status:'uploading',error:''});
  try{
   if(slot.file){const form=new FormData();form.set('image',slot.file);await api(`/api/trades/${tradeId}/evidence?slot=${index+1}`,{method:'POST',body:form});updateSlot(index,{file:null,status:'uploaded',stored:true,remove:false,error:''});}
   else{await api(`/api/trades/${tradeId}/evidence?slot=${index+1}`,{method:'DELETE'});updateSlot(index,{status:'empty',stored:false,remove:false,error:''});}
   return true;
  }catch(err){updateSlot(index,{status:'error',error:message(err)});return false;}
 }
 async function retrySlot(index:number){
  if(!record)return;
  const ok=await persistSlot(index,record.id);await refresh();await onPersisted?.();
  if(ok){setError('');notify(t('journal.imageUploaded'));}
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!account)return;setBusy(true);setError('');
  const data=Object.fromEntries(new FormData(e.currentTarget));
  try{
   data.evidenceUrl=String(data.evidenceUrl||'').trim();data.direction=record?.direction||'';data.tags=record?.tags||'';
   const risk=data.riskPercent?new D(String(data.riskPercent)).div(100).toString():null;
   const additionalEvidenceUrls=[2,3,4].map(index=>String(data[`evidenceLink${index}`]||'').trim());
   for(const index of [2,3,4])delete data[`evidenceLink${index}`];
   const saved=await api<Trade>(record?`/api/trades/${record.id}`:'/api/trades',{method:record?'PATCH':'POST',body:JSON.stringify({...data,additionalEvidenceUrls,accountId:account.id,riskPercent:risk,version:record?.version})});
   setPersistedTrade(saved);
   const results=await Promise.all(slots.map((_,index)=>persistSlot(index,saved.id)));
   await refresh();await onPersisted?.();
   if(results.some(ok=>!ok)){const copy=t('journal.savedImageError');setError(copy);notify(copy);return;}
   notify(record?t('journal.updated'):t('journal.recorded'));await onSaved?.();onOpenChange(false);
  }catch(err){setError(message(err));}finally{setBusy(false);}
 }
 const hasEvidence=Boolean(record?.evidencePath||record?.additionalEvidencePaths?.some(Boolean)||record?.evidenceUrl||record?.additionalEvidenceUrls?.some(Boolean));
 return <Modal open={open} onOpenChange={onOpenChange} title={record?t('journal.editTitle').replace('{number}',String(record.sequence)):t('journal.recordTitle')} description={t('journal.formDescription')} wide>
  <form onSubmit={submit} className="form-stack">
   <ErrorMessage error={error}/>
   <div className="form-grid">
    <Field label={t('journal.instrument')}><input name="symbol" placeholder="EUR/USD" maxLength={30} defaultValue={record?.symbol||''}/></Field>
    <Field label={t('journal.tradeDate')} hint={t('journal.tradeDateHint')}><input name="date" type="date" defaultValue={record?record.date||'':localTradeDate()}/></Field>
    <Field label={`${t('journal.netResult')} (${account?.currency||'USD'})`} hint={t('journal.netResultHint')}><input name="pnl" type="number" step="0.00000001" max="1000000000000" min="-1000000000000" placeholder="e.g. 120.00 or -60.00" defaultValue={numericInputValue(record?.pnl)}/></Field>
    <Field label={t('journal.riskPercent')}><input name="riskPercent" type="number" min="0" max="100" step="0.000001" placeholder="1.00" defaultValue={record?.riskPercent?numericInputValue(record.riskPercent,100):''}/></Field>
    <Field label={t('journal.plannedR')}><input name="rewardRisk" type="number" min="0" max="1000" step="0.00000001" placeholder="2.50" defaultValue={numericInputValue(record?.rewardRisk)}/></Field>
    <Field label={t('journal.duration')}><input name="duration" type="number" min="0" max="10000000" step="0.01" placeholder="30" defaultValue={numericInputValue(record?.duration)}/></Field>
   </div>
   <details className="form-details" open={Boolean(record?.notes||record?.strategy||record?.mindset||hasEvidence)}>
    <summary>{t('journal.context')}</summary>
    <div className="form-grid context-grid">
     <Field label={t('journal.strategy')}><input name="strategy" maxLength={80} defaultValue={record?.strategy||''} placeholder={t('journal.strategyPlaceholder')}/></Field>
     <Field label={t('journal.grade')}><select name="setupGrade" defaultValue={record?.setupGrade||''}><option value="">{t('journal.unspecified')}</option>{['A+','A','B+','B'].map(grade=><option key={grade} value={grade}>{grade}</option>)}</select></Field>
     <Field label={t('journal.session')}><select name="session" defaultValue={record?.session||''}><option value="">{t('journal.unspecified')}</option>{['Asia','London','New York','Other'].map(x=><option key={x}>{x}</option>)}</select></Field>
    </div>
    <Field label={t('journal.analysis')}><textarea name="notes" rows={3} maxLength={10000} placeholder={t('journal.analysisPlaceholder')} defaultValue={record?.notes||''}/></Field>
    <Field label={t('journal.mindset')}><select name="mindset" defaultValue={record?.mindset||''}><option value="">{t('journal.unspecified')}</option>{mindsetValues.map(value=><option key={value} value={value}>{t(`journal.mindset.${value}`)}</option>)}</select></Field>
    <Field label={t('journal.mindsetNote')}><textarea name="feelings" rows={3} maxLength={5000} placeholder={t('journal.mindsetPlaceholder')} defaultValue={record?.feelings||''}/></Field>
    <section className="evidence-section" aria-labelledby="evidence-heading">
     <div className="evidence-heading"><div><h3 id="evidence-heading">{t('journal.evidenceTitle')}</h3><p>{t('journal.evidenceDescription')}</p></div><span>{t('journal.evidenceOptional')}</span></div>
     <div className="evidence-grid">
      {slots.map((slot,index)=>{const storedSrc=record&&slot.stored?`/api/trades/${record.id}/evidence?slot=${index+1}`:'';return <article className={`evidence-slot is-${slot.status}`} key={index} tabIndex={0} aria-label={`${t('journal.evidencePaste')}${index?` ${index+1}`:''}`} onPaste={event=>pasteImage(index,event)}>
       <div className="evidence-slot-heading"><strong>{t('journal.evidenceSlot')} {index+1}</strong><span className={`evidence-status ${slot.status}`} role="status">{slot.status==='empty'&&slot.remove?t('journal.statusRemoved'):t(`journal.status.${slot.status}` as MessageKey)}</span></div>
       <div className="evidence-media">
        {slot.status==='uploaded'&&storedSrc?<EvidenceImage src={storedSrc} alt={`${t('journal.evidencePreview')} ${index+1}`} openLabel={`${t('journal.openPreview')} ${index+1}`} closeLabel={t('journal.closePreview')}/>:slot.file?<SelectedImage file={slot.file} alt={`${t('journal.selectedPreview')} ${index+1}`}/>:<div className="evidence-empty"><ImagePlus size={20}/><span>{t('journal.imageOrLink')}</span></div>}
        {slot.status==='uploading'&&<div className="evidence-progress" aria-label={t('journal.status.uploading')}><LoaderCircle size={22} className="spin"/></div>}
       </div>
       <div className="evidence-slot-actions">
        <label className="button secondary evidence-picker"><Upload size={14}/>{slot.stored||slot.file?t('journal.replaceImage'):t('journal.chooseImage')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={slot.status==='uploading'} aria-label={`${t('journal.chooseImage')} ${index+1}`} onChange={event=>{chooseImage(index,event.target.files?.[0]);event.target.value='';}}/></label>
        {(slot.file||slot.stored||slot.remove)&&<Button type="button" variant="ghost" disabled={slot.status==='uploading'} onClick={()=>removeImage(index)}><X size={14}/>{t('journal.removeImage')}</Button>}
        {slot.status==='error'&&record&&(slot.file||slot.remove)&&<Button type="button" variant="ghost" onClick={()=>void retrySlot(index)}><RotateCcw size={14}/>{t('journal.retryUpload')}</Button>}
       </div>
       {slot.error&&<p className="evidence-slot-error" role="alert">{slot.error}</p>}
       <Field label={`${t('journal.evidenceLink')} ${index+1}`}><input name={index===0?'evidenceUrl':`evidenceLink${index+1}`} type="url" maxLength={2048} placeholder="https://www.tradingview.com/x/…" defaultValue={index===0?record?.evidenceUrl||'':record?.additionalEvidenceUrls?.[index-1]||''}/></Field>
      </article>;})}
     </div>
     <small className="evidence-hint">{t('journal.evidenceHint')}</small>
    </section>
   </details>
   <div className="dialog-actions"><Button type="button" variant="secondary" disabled={busy} onClick={()=>onOpenChange(false)}>{t('app.cancel')}</Button><Button loading={busy}>{record?t('journal.saveChanges'):t('action.record')}</Button></div>
  </form>
 </Modal>;
}

export function TradeDetails({trade,onClose,onChanged}:{trade:Trade|null;onClose:()=>void;onChanged?:()=>void|Promise<void>}){
 const {account,refresh,notify}=useWorkspace(),{t}=useLanguage();const [editing,setEditing]=useState(false),[deleting,setDeleting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');if(!trade||!account)return null;
 const outcome=classify(trade.pnl,account.breakEvenBand),paths=Array.from({length:EVIDENCE_SLOTS},(_,index)=>evidencePathForSlot(trade,index+1)),links=[trade.evidenceUrl,...(trade.additionalEvidenceUrls||[])],tradeId=trade.id,tradeVersion=trade.version;
 async function remove(){setBusy(true);setError('');try{await api(`/api/trades/${tradeId}?version=${tradeVersion}`,{method:'DELETE'});await refresh();await onChanged?.();notify(t('journal.deleted'));setDeleting(false);onClose();}catch(e){setError(message(e));}finally{setBusy(false);}}
 return <><Modal open={!editing&&!deleting} onOpenChange={v=>{if(!v)onClose();}} title={`${t('journal.operation')} #${trade.sequence}`} description={`${trade.symbol||t('journal.unspecified')} · ${trade.date||t('journal.noDate')}`} wide>
  <div className="trade-detail-result"><span className={`outcome-badge ${outcome}`}>{outcome==='breakeven'?'Break-even':outcome==='open'?'Incomplete':outcome==='win'?'Win':'Loss'}</span><strong className={Number(trade.pnl)>=0?'positive':'negative'}>{trade.pnl===null?t('journal.awaitingResult'):signedMoney(Number(trade.pnl),account.currency)}</strong></div>
  <dl className="details-grid">{[[t('journal.riskPercent'),trade.riskPercent?`${number(Number(trade.riskPercent)*100)}%`:'—'],[t('journal.plannedR'),trade.rewardRisk?`${number(Number(trade.rewardRisk))}R`:'—'],[t('journal.duration'),trade.duration===null?'—':`${number(trade.duration)} min`],[t('journal.strategy'),trade.strategy||'—'],[t('journal.grade'),trade.setupGrade||'—'],[t('journal.mindset'),trade.mindset?t(`journal.mindset.${trade.mindset}`):'—'],[t('journal.direction'),trade.direction||'—'],[t('journal.session'),trade.session||'—']].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  {trade.notes&&<div className="detail-notes"><h3>{t('journal.analysis')}</h3><p>{trade.notes}</p></div>}{trade.feelings&&<div className="detail-notes"><h3>{t('journal.mindsetNote')}</h3><p>{trade.feelings}</p></div>}{trade.tags&&<p className="muted">{t('journal.tags')}: {trade.tags}</p>}
  {(paths.some(Boolean)||links.some(Boolean))&&<section className="trade-evidence"><h3>{t('journal.evidenceTitle')}</h3><div className="trade-evidence-grid">{paths.map((path,index)=>(path||links[index])&&<div className="trade-evidence-slot" key={index}><strong>{t('journal.evidenceSlot')} {index+1}</strong>{path&&<EvidenceImage src={`/api/trades/${trade.id}/evidence?slot=${index+1}`} alt={`${t('journal.evidencePreview')} ${index+1}`} openLabel={`${t('journal.openPreview')} ${index+1}`} closeLabel={t('journal.closePreview')}/>} {links[index]&&<a href={links[index]} target="_blank" rel="noopener noreferrer" className="text-link" aria-label={`${t('journal.openEvidence')} ${index+1}`}>{t('journal.openEvidence')}<ExternalLink size={15}/></a>}</div>)}</div></section>}
  {trade.sourceRow&&<p className="source-caption">Imported from {account.sourceSheet}, row {trade.sourceRow}. Operation order is preserved.</p>}
  <div className="dialog-actions spread"><Button variant="ghost" onClick={()=>setDeleting(true)}><Trash2 size={15}/>{t('journal.delete')}</Button><Button onClick={()=>setEditing(true)}><Pencil size={15}/>{t('journal.edit')}</Button></div>
 </Modal><TradeDialog key={`${trade.id}-${trade.version}`} open={editing} onOpenChange={setEditing} trade={trade} onPersisted={onChanged} onSaved={onClose}/><Modal open={deleting} onOpenChange={setDeleting} title={t('journal.deleteTitle')} description={t('journal.deleteDescription').replace('{number}',String(trade.sequence))}><ErrorMessage error={error}/><div className="dialog-actions"><Button variant="secondary" onClick={()=>setDeleting(false)}>{t('journal.keep')}</Button><Button variant="danger" loading={busy} onClick={remove}>{t('journal.delete')}</Button></div></Modal></>;
}
