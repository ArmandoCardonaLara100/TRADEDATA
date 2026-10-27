'use client';
import {useState,type FormEvent} from 'react';
import {Button,Modal,Field,ErrorMessage} from '@/components/ui';
import {api,message} from '@/lib/client';
import {useWorkspace} from './context';
import type {TradingAccount} from '@/types/trading';
import {numericInputValue} from '@/lib/numeric-input';
import {useLanguage} from '@/lib/i18n';
export function AccountDialog({open,onOpenChange,account}:{open:boolean;onOpenChange:(v:boolean)=>void;account?:TradingAccount}){
 const {refresh,notify}=useWorkspace(),{t}=useLanguage();const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setError('');const data=Object.fromEntries(new FormData(event.currentTarget));try{const saved=await api<TradingAccount>(account?`/api/accounts/${account.id}`:'/api/accounts',{method:account?'PATCH':'POST',body:JSON.stringify(data)});await refresh(saved.id);notify(t(account?'account.updated':'account.created'));onOpenChange(false);}catch(e){setError(message(e));}finally{setBusy(false);}}
 return <Modal open={open} onOpenChange={onOpenChange} title={t(account?'account.editTitle':'account.newTitle')} description={t('account.description')}><form onSubmit={submit} className="form-stack"><ErrorMessage error={error}/><Field label={t('account.name')}><input name="name" required maxLength={80} placeholder={t('account.namePlaceholder')} defaultValue={account?.name}/></Field><div className="form-grid"><Field label={t('account.initialBalance')}><input name="initialBalance" type="number" required min="0.01" max="1000000000000" step="0.01" defaultValue={numericInputValue(account?.initialBalance||'6000')}/></Field><Field label={t('account.currency')}><select name="currency" defaultValue={account?.currency||'USD'}>{['USD','EUR','GBP','MXN'].map(c=><option key={c}>{c}</option>)}</select></Field></div><Field label={t('account.breakEvenBand')} hint={t('account.breakEvenHint')}><input name="breakEvenBand" type="number" required min="0" max="1000000000" step="0.01" defaultValue={numericInputValue(account?.breakEvenBand||'15')}/></Field>{account&&<p className="info-note">{t('account.recalculation')}</p>}<div className="dialog-actions"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>{t('app.cancel')}</Button><Button loading={busy}>{t(account?'account.save':'account.create')}</Button></div></form></Modal>;
}
