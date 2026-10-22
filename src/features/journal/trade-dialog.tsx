'use client';
import {useEffect,useState,type ClipboardEvent,type FormEvent} from 'react';
import {ExternalLink,ImagePlus,Pencil,Trash2} from 'lucide-react';
import {Modal,Button,Field,ErrorMessage} from '@/components/ui';
import {api,message} from '@/lib/client';
import {useWorkspace} from '@/features/workspace/context';
import {useLanguage} from '@/lib/i18n';
import {D} from '@/lib/calculations/decimal';
import type {Trade} from '@/types/trading';
import {money,number,signedMoney} from '@/lib/format';
import {classify} from '@/lib/analytics/journal';
import {numericInputValue} from '@/lib/numeric-input';
import {MAX_EVIDENCE_BYTES} from '@/lib/evidence';
import {localTradeDate} from '@/lib/trade-date';

const imageTypes=['image/png','image/jpeg','image/webp','image/gif'];
const mindsetValues=['euphoria','trust','neutral','fear','fomo','anxiety'] as const;

export function TradeDialog({open,onOpenChange,trade,onSaved}:{open:boolean;onOpenChange:(v:boolean)=>void;trade?:Trade;onSaved?:()=>void|Promise<void>}){
 const {account,refresh,notify}=useWorkspace(),{t}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[image,setImage]=useState<File|null>(null),[removeImage,setRemoveImage]=useState(false),[preview,setPreview]=useState('');
 useEffect(()=>{if(!image){return;}const url=URL.createObjectURL(image);setPreview(url);return ()=>{URL.revokeObjectURL(url);setPreview('');};},[image]);
 function chooseImage(file:File|undefined){
  if(!file)return;
  if(!imageTypes.includes(file.type)){setError(t('journal.evidenceTypeError'));return;}
  if(file.size>MAX_EVIDENCE_BYTES){setError(t('journal.evidenceSizeError'));return;}
  setImage(file);setRemoveImage(false);setError('');
 }
 function pasteImage(event:ClipboardEvent<HTMLDivElement>){
  const file=[...event.clipboardData.items].find(item=>item.type.startsWith('image/'))?.getAsFile();
  if(file){event.preventDefault();chooseImage(file);}
 }
 async function submit(e:FormEvent<HTMLFormElement>){
  e.preventDefault();if(!account)return;setBusy(true);setError('');
  const data=Object.fromEntries(new FormData(e.currentTarget));
  try{
   const risk=data.riskPercent?new D(String(data.riskPercent)).div(100).toString():null;
   const saved=await api<Trade>(trade?`/api/trades/${trade.id}`:'/api/trades',{method:trade?'PATCH':'POST',body:JSON.stringify({...data,accountId:account.id,riskPercent:risk,version:trade?.version})});
   let imageError=false;
   if(image){
    const form=new FormData();form.set('image',image);
    try{await api(`/api/trades/${saved.id}/evidence`,{method:'POST',body:form});}catch{imageError=true;}
   }else if(removeImage&&trade?.evidencePath){
    try{await api(`/api/trades/${saved.id}/evidence`,{method:'DELETE'});}catch{imageError=true;}
   }
   await refresh();
   notify(imageError?t('journal.savedImageError'):trade?t('journal.updated'):t('journal.recorded'));
   await onSaved?.();onOpenChange(false);
  }catch(err){setError(message(err));}finally{setBusy(false);}
 }
 const showingStored=Boolean(trade?.evidencePath&&!image&&!removeImage);
 return <Modal open={open} onOpenChange={onOpenChange} title={trade?t('journal.editTitle').replace('{number}',String(trade.sequence)):t('journal.recordTitle')} description={t('journal.formDescription')} wide>
  <form onSubmit={submit} className="form-stack">
   <ErrorMessage error={error}/>
   <div className="form-grid">
    <Field label={t('journal.instrument')}><input name="symbol" placeholder="EUR/USD" maxLength={30} defaultValue={trade?.symbol||''}/></Field>
    <Field label={t('journal.tradeDate')} hint={t('journal.tradeDateHint')}><input name="date" type="date" defaultValue={trade?trade.date||'':localTradeDate()}/></Field>
    <Field label={`${t('journal.netResult')} (${account?.currency||'USD'})`} hint={t('journal.netResultHint')}><input name="pnl" type="number" step="0.00000001" max="1000000000000" min="-1000000000000" placeholder="e.g. 120.00 or -60.00" defaultValue={numericInputValue(trade?.pnl)}/></Field>
    <Field label={t('journal.riskPercent')}><input name="riskPercent" type="number" min="0" max="100" step="0.000001" placeholder="1.00" defaultValue={trade?.riskPercent?numericInputValue(trade.riskPercent,100):''}/></Field>
    <Field label={t('journal.plannedR')}><input name="rewardRisk" type="number" min="0" max="1000" step="0.00000001" placeholder="2.50" defaultValue={numericInputValue(trade?.rewardRisk)}/></Field>
    <Field label={t('journal.duration')}><input name="duration" type="number" min="0" max="10000000" step="0.01" placeholder="30" defaultValue={numericInputValue(trade?.duration)}/></Field>
   </div>
   <details className="form-details" open={!!(trade?.notes||trade?.strategy||trade?.mindset||trade?.evidencePath)}>
    <summary>{t('journal.context')}</summary>
    <div className="form-grid">
     <Field label={t('journal.direction')}><select name="direction" defaultValue={trade?.direction||''}><option value="">{t('journal.unspecified')}</option><option value="long">Long</option><option value="short">Short</option></select></Field>
     <Field label={t('journal.strategy')}><input name="strategy" maxLength={80} defaultValue={trade?.strategy||''} placeholder={t('journal.strategyPlaceholder')}/></Field>
     <Field label={t('journal.grade')}><select name="setupGrade" defaultValue={trade?.setupGrade||''}><option value="">{t('journal.unspecified')}</option>{['A+','A','B+','B'].map(grade=><option key={grade} value={grade}>{grade}</option>)}</select></Field>
     <Field label={t('journal.session')}><select name="session" defaultValue={trade?.session||''}><option value="">{t('journal.unspecified')}</option>{['Asia','London','New York','Other'].map(x=><option key={x}>{x}</option>)}</select></Field>
     <Field label={t('journal.tags')}><input name="tags" maxLength={250} placeholder="Trend, liquidity, reversal" defaultValue={trade?.tags||''}/></Field>
     <Field label={t('journal.mindset')}><select name="mindset" defaultValue={trade?.mindset||''}><option value="">{t('journal.unspecified')}</option>{mindsetValues.map(value=><option key={value} value={value}>{t(`journal.mindset.${value}`)}</option>)}</select></Field>
    </div>
    <Field label={t('journal.analysis')}><textarea name="notes" rows={3} maxLength={10000} placeholder={t('journal.analysisPlaceholder')} defaultValue={trade?.notes||''}/></Field>
    <Field label={t('journal.mindsetNote')}><textarea name="feelings" rows={3} maxLength={5000} placeholder={t('journal.mindsetPlaceholder')} defaultValue={trade?.feelings||''}/></Field>
    <div className="evidence-field"><span className="field-title">{t('journal.evidenceImage')}</span>
     <div className="evidence-dropzone" tabIndex={0} onPaste={pasteImage} aria-label={t('journal.evidencePaste')}>
      <ImagePlus size={18}/><span>{t('journal.evidencePaste')}</span>
      <label className="button secondary evidence-picker">{t('journal.chooseImage')}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{chooseImage(e.target.files?.[0]);e.target.value='';}}/></label>
     </div>
     {(preview||showingStored)&&<div className="evidence-preview"><img src={preview||`/api/trades/${trade!.id}/evidence`} alt={t('journal.evidencePreview')}/><Button type="button" variant="ghost" onClick={()=>{setImage(null);setRemoveImage(true);}}>{t('journal.removeImage')}</Button></div>}
     <small>{t('journal.evidenceHint')}</small>
    </div>
    <Field label={t('journal.evidenceLink')} hint={t('journal.evidenceLinkHint')}><input name="evidenceUrl" type="url" placeholder="https://www.tradingview.com/x/…" defaultValue={trade?.evidenceUrl||''}/></Field>
   </details>
   <div className="dialog-actions"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>{t('app.cancel')}</Button><Button loading={busy}>{trade?t('journal.saveChanges'):t('action.record')}</Button></div>
  </form>
 </Modal>;
}

export function TradeDetails({trade,onClose,onChanged}:{trade:Trade|null;onClose:()=>void;onChanged?:()=>void|Promise<void>}){
 const {account,refresh,notify}=useWorkspace(),{t}=useLanguage();const [editing,setEditing]=useState(false),[deleting,setDeleting]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');if(!trade||!account)return null;
 const outcome=classify(trade.pnl,account.breakEvenBand);
 async function remove(){if(!trade)return;setBusy(true);setError('');try{await api(`/api/trades/${trade.id}?version=${trade.version}`,{method:'DELETE'});await refresh();await onChanged?.();notify(t('journal.deleted'));setDeleting(false);onClose();}catch(e){setError(message(e));}finally{setBusy(false);}}
 return <><Modal open={!editing&&!deleting} onOpenChange={v=>{if(!v)onClose();}} title={`${t('journal.operation')} #${trade.sequence}`} description={`${trade.symbol||t('journal.unspecified')} · ${trade.date||t('journal.noDate')}`} wide>
  <div className="trade-detail-result"><span className={`outcome-badge ${outcome}`}>{outcome==='breakeven'?'Break-even':outcome==='open'?'Incomplete':outcome==='win'?'Win':'Loss'}</span><strong className={Number(trade.pnl)>=0?'positive':'negative'}>{trade.pnl===null?t('journal.awaitingResult'):signedMoney(Number(trade.pnl),account.currency)}</strong></div>
  <dl className="details-grid">{[[t('journal.riskPercent'),trade.riskPercent?`${number(Number(trade.riskPercent)*100)}%`:'—'],[t('journal.plannedR'),trade.rewardRisk?`${number(Number(trade.rewardRisk))}R`:'—'],[t('journal.duration'),trade.duration===null?'—':`${number(trade.duration)} min`],[t('journal.strategy'),trade.strategy||'—'],[t('journal.grade'),trade.setupGrade||'—'],[t('journal.mindset'),trade.mindset?t(`journal.mindset.${trade.mindset}`):'—'],[t('journal.direction'),trade.direction||'—'],[t('journal.session'),trade.session||'—']].map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
  {trade.notes&&<div className="detail-notes"><h3>{t('journal.analysis')}</h3><p>{trade.notes}</p></div>}{trade.feelings&&<div className="detail-notes"><h3>{t('journal.mindsetNote')}</h3><p>{trade.feelings}</p></div>}{trade.tags&&<p className="muted">{t('journal.tags')}: {trade.tags}</p>}
  {trade.evidencePath&&<div className="evidence-preview"><img src={`/api/trades/${trade.id}/evidence`} alt={t('journal.evidencePreview')}/></div>}
  {trade.evidenceUrl&&<a href={trade.evidenceUrl} target="_blank" rel="noopener noreferrer" className="text-link">{t('journal.openEvidence')}<ExternalLink size={15}/></a>}
  {trade.sourceRow&&<p className="source-caption">Imported from {account.sourceSheet}, row {trade.sourceRow}. Operation order is preserved.</p>}
  <div className="dialog-actions spread"><Button variant="ghost" onClick={()=>setDeleting(true)}><Trash2 size={15}/>{t('journal.delete')}</Button><Button onClick={()=>setEditing(true)}><Pencil size={15}/>{t('journal.edit')}</Button></div>
 </Modal><TradeDialog key={`${trade.id}-${trade.version}`} open={editing} onOpenChange={setEditing} trade={trade} onSaved={async()=>{await onChanged?.();onClose();}}/><Modal open={deleting} onOpenChange={setDeleting} title={t('journal.deleteTitle')} description={t('journal.deleteDescription').replace('{number}',String(trade.sequence))}><ErrorMessage error={error}/><div className="dialog-actions"><Button variant="secondary" onClick={()=>setDeleting(false)}>{t('journal.keep')}</Button><Button variant="danger" loading={busy} onClick={remove}>{t('journal.delete')}</Button></div></Modal></>;
}
