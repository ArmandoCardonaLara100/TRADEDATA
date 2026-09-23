'use client';
import {useState,type FormEvent} from 'react';
import {Upload,FileSpreadsheet} from 'lucide-react';
import {Button,Modal,ErrorMessage} from '@/components/ui';
import {api,message} from '@/lib/client';
import {useWorkspace} from './context';
export function ImportDialog({open,onOpenChange}:{open:boolean;onOpenChange:(v:boolean)=>void}){
 const {refresh,notify}=useWorkspace();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');try{const data=new FormData(e.currentTarget);const result=await api<{imported:{id:string;name:string;count:number;existing:boolean}[]}>('/api/import',{method:'POST',body:data});const last=result.imported.at(-1)!;await refresh(last.id);notify(result.imported.every(x=>x.existing)?'This workbook is already imported. Your existing records were kept.':`${result.imported.length} separate histories imported. Dates remain unspecified.`);onOpenChange(false);}catch(err){setError(message(err));}finally{setBusy(false);}}
 return <Modal open={open} onOpenChange={onOpenChange} title="Import your workbook" description="Bring your Trading Web journal into your private workspace."><form onSubmit={submit} className="form-stack"><ErrorMessage error={error}/><label className="upload-zone"><FileSpreadsheet size={32}/><strong>Choose Trading Web.xlsx</strong><span>Excel workbook · up to 2 MB</span><input name="file" type="file" accept=".xlsx" required aria-label="Trading workbook"/></label><div className="info-note"><strong>Your original rules stay intact.</strong><p>September and the longer history become separate accounts to avoid counting overlapping trades twice. Break-even bands stay at ±25 and ±15. Missing results stay incomplete.</p><p>Only journal records are imported. Calculator and simulation modules reproduce the workbook’s formulas.</p></div><div className="dialog-actions"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>Cancel</Button><Button loading={busy}><Upload size={16}/>Import workbook</Button></div></form></Modal>;
}
