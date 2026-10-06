'use client';
import {useState} from 'react';
import {Button,ErrorMessage,Modal} from '@/components/ui';
import {useLanguage} from '@/lib/i18n';
import type {TradingAccount} from '@/types/trading';
import {useWorkspace} from './context';

export function DeleteAccountDialog({account,open,onOpenChange}:{account:TradingAccount|null;open:boolean;onOpenChange:(value:boolean)=>void}){
 const {deleteAccount,notify}=useWorkspace(),{t}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const close=(value:boolean)=>{if(!busy){setError('');onOpenChange(value);}};
 const remove=async()=>{if(!account||busy)return;setBusy(true);setError('');try{await deleteAccount(account.id);notify(t('app.accountDeleted'));onOpenChange(false);}catch{setError(t('app.deleteAccountError'));}finally{setBusy(false);}};
 return <Modal open={open&&!!account} onOpenChange={close} title={t('app.deleteAccountTitle')} description={`“${account?.name||''}” — ${t('app.deleteAccountDescription')}`}><ErrorMessage error={error}/><div className="dialog-actions"><Button variant="secondary" disabled={busy} onClick={()=>close(false)}>{t('app.cancel')}</Button><Button variant="danger" loading={busy} onClick={remove}>{t('app.deleteAccountAction')}</Button></div></Modal>;
}
