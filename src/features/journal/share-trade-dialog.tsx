'use client';

import {Check,Copy,Link2,RefreshCcw,ShieldOff} from 'lucide-react';
import {useEffect,useRef,useState} from 'react';

import {Button,ErrorMessage,Modal} from '@/components/ui';
import {api,message} from '@/lib/client';
import {useLanguage} from '@/lib/i18n';

type ShareState={enabled:boolean;url?:string};

export function ShareTradeDialog({tradeId,sequence,open,onOpenChange}:{tradeId:string;sequence:number;open:boolean;onOpenChange:(open:boolean)=>void}){
 const {t}=useLanguage(),[state,setState]=useState<ShareState>({enabled:false}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 const firstLinkRequest=useRef<Promise<ShareState>|null>(null);
 async function enable(){
  setBusy(true);setError('');setCopied(false);
  try{setState(await api<ShareState>(`/api/trades/${tradeId}/share`,{method:'POST'}));}
  catch(err){setError(message(err));}finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!open){firstLinkRequest.current=null;return;}
  let active=true;setBusy(true);setError('');setCopied(false);setState({enabled:false});
  async function load(){
   try{
    const result=await api<ShareState>(`/api/trades/${tradeId}/share`);
    if(!active)return;
    if(result.enabled)setState(result);
    else {firstLinkRequest.current??=api<ShareState>(`/api/trades/${tradeId}/share`,{method:'POST'});const created=await firstLinkRequest.current;if(active)setState(created);}
   }catch(err){if(active)setError(message(err));}finally{if(active)setBusy(false);}
  }
  void load();
  return()=>{active=false;};
 },[open,tradeId]);
 async function copy(){
  if(!state.url)return;
  try{await navigator.clipboard.writeText(state.url);setCopied(true);setError('');}
  catch{setError(t('share.copyError'));}
 }
 async function revoke(){
  setBusy(true);setError('');
  try{await api(`/api/trades/${tradeId}/share`,{method:'DELETE'});setState({enabled:false});setCopied(false);}
  catch(err){setError(message(err));}finally{setBusy(false);}
 }
 return <Modal open={open} onOpenChange={onOpenChange} title={t('share.title')} description={t('share.description').replace('{number}',String(sequence))}>
  <div className="share-dialog-body"><ErrorMessage error={error}/>{busy&&!state.url?<div className="share-dialog-loading" role="status"><Link2 size={20}/><p>{t('share.generating')}</p></div>:state.url?<><label className="field"><span>{t('share.publicUrl')}</span><div className="share-url-row"><input readOnly value={state.url} onFocus={event=>event.currentTarget.select()} aria-label={t('share.publicUrl')}/><Button type="button" variant="secondary" onClick={copy}>{copied?<Check size={15}/>:<Copy size={15}/>} {copied?t('share.copied'):t('share.copy')}</Button></div></label><p className="share-dialog-note"><Link2 size={15}/>{t('share.linkNote')}</p></>:state.enabled?<div className="share-dialog-loading"><Link2 size={20}/><p>{t('share.existing')}</p></div>:!busy&&<div className="share-dialog-loading"><ShieldOff size={20}/><p>{t('share.disabled')}</p></div>}<div className="dialog-actions spread">{state.enabled&&<Button type="button" variant="ghost" disabled={busy} onClick={revoke}><ShieldOff size={15}/>{t('share.disable')}</Button>}<div className="share-dialog-primary"><Button type="button" variant="secondary" disabled={busy} onClick={()=>onOpenChange(false)}>{t('app.cancel')}</Button>{state.enabled&&!state.url&&<Button type="button" loading={busy} onClick={enable}><RefreshCcw size={15}/>{t('share.replace')}</Button>}{!state.enabled&&!busy&&<Button type="button" onClick={enable}><Link2 size={15}/>{t('share.generate')}</Button>}</div></div></div>
 </Modal>;
}
