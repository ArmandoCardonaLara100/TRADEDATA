'use client';
import {useState,type FormEvent} from 'react';
import {Upload,FileSpreadsheet} from 'lucide-react';
import {Button,Modal,ErrorMessage} from '@/components/ui';
import {api,message} from '@/lib/client';
import {useLanguage} from '@/lib/i18n';
import {useWorkspace} from './context';
export function ImportDialog({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const {refresh,notify}=useWorkspace(),{t}=useLanguage();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{const data=new FormData(e.currentTarget);const result=await api<{imported:{id:string;name:string;count:number;existing:boolean}[]}>('/api/import',{method:'POST',body:data});const last=result.imported.at(-1)!;await refresh(last.id);notify(result.imported.every(x=>x.existing)?t('import.already'):t('import.success').replace('{count}',String(result.imported.length)));onOpenChange(false);}catch(err){setError(message(err));}finally{setBusy(false);}}
 return <Modal open={open} onOpenChange={onOpenChange} title={t('import.title')} description={t('import.description')}><form onSubmit={submit} className="form-stack"><ErrorMessage error={error}/><label className="upload-zone"><FileSpreadsheet size={32}/><strong>{t('import.choose')}</strong><span>{t('import.limit')}</span><input name="file" type="file" accept=".xlsx" required aria-label={t('import.label')}/></label><div className="info-note"><strong>{t('import.rules')}</strong><p>{t('import.rulesText')}</p><p>{t('import.records')}</p></div><div className="dialog-actions"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>{t('app.cancel')}</Button><Button loading={busy}><Upload size={16}/>{t('import.action')}</Button></div></form></Modal>;
}
