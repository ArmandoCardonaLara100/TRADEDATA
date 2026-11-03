'use client';
import {useState,type FormEvent} from 'react';
import {Button,Modal,Field,ErrorMessage} from '@/components/ui';
import {api,message} from '@/lib/client';
import {useWorkspace} from './context';
import type {AccountRule,AccountType,TradingAccount} from '@/types/trading';
import {numericInputValue} from '@/lib/numeric-input';
import {useLanguage,type MessageKey} from '@/lib/i18n';

const accountTypes:AccountType[]=['challenge','funded','own_capital','demo'];
const emptyRule=(phaseNumber:number|null):AccountRule=>({phaseNumber,profitTarget:'',maxLossLimit:'',dailyLossLimit:'',drawdownType:'static'});
function sourceRule(account:TradingAccount|undefined,index:number,kind:'challenge'|'funded'){
 const expectedPhase=kind==='challenge'?index+1:null;
 return account?.rules.find(rule=>rule.phaseNumber===expectedPhase)||emptyRule(expectedPhase);
}
function AccountRuleFields({account,index,kind}:{account?:TradingAccount;index:number;kind:'challenge'|'funded'}){
 const {t}=useLanguage(),rule=sourceRule(account,index,kind),prefix=kind==='challenge'?`rule-${index}`:'rule-funded';
 return <div className="account-rule-card"><div className="account-rule-heading"><strong>{kind==='challenge'?`${t('account.phase')} ${index+1}`:t('account.fundedRules')}</strong><span>{t('account.percentRules')}</span></div><div className="account-rule-grid"><Field label={t((kind==='challenge'?'account.profitTarget':'account.profit') as MessageKey)}><input name={`${prefix}-profitTarget`} type="number" required min="0.01" max="100" step="0.01" defaultValue={numericInputValue(rule.profitTarget)}/></Field><Field label={t('account.maxLossLimit')}><input name={`${prefix}-maxLossLimit`} type="number" required min="0.01" max="100" step="0.01" defaultValue={numericInputValue(rule.maxLossLimit)}/></Field><Field label={t('account.dailyLossLimit')}><input name={`${prefix}-dailyLossLimit`} type="number" required min="0.01" max="100" step="0.01" defaultValue={numericInputValue(rule.dailyLossLimit)}/></Field><Field label={t('account.drawdownType')}><select name={`${prefix}-drawdownType`} defaultValue={rule.drawdownType}><option value="static">{t('account.drawdown.static')}</option><option value="trailing">{t('account.drawdown.trailing')}</option></select></Field></div></div>;
}

export function AccountDialog({open,onOpenChange,account}:{open:boolean;onOpenChange:(v:boolean)=>void;account?:TradingAccount}){
 const {refresh,select,notify}=useWorkspace(),{t}=useLanguage();
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const [accountType,setAccountType]=useState<AccountType|''>(account?.accountType||'');
 const [phaseCount,setPhaseCount]=useState(Math.max(1,account?.accountType==='challenge'?account.rules.length:1));
 const [currentPhase,setCurrentPhase]=useState(account?.currentPhase||1);

 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setError('');
  const form=new FormData(event.currentTarget),rules:AccountRule[]=[];
  if(accountType==='challenge')for(let index=0;index<phaseCount;index++)rules.push({
   phaseNumber:index+1,profitTarget:String(form.get(`rule-${index}-profitTarget`)||''),maxLossLimit:String(form.get(`rule-${index}-maxLossLimit`)||''),dailyLossLimit:String(form.get(`rule-${index}-dailyLossLimit`)||''),drawdownType:String(form.get(`rule-${index}-drawdownType`)||'static') as AccountRule['drawdownType'],
  });
  if(accountType==='funded')rules.push({
   phaseNumber:null,profitTarget:String(form.get('rule-funded-profitTarget')||''),maxLossLimit:String(form.get('rule-funded-maxLossLimit')||''),dailyLossLimit:String(form.get('rule-funded-dailyLossLimit')||''),drawdownType:String(form.get('rule-funded-drawdownType')||'static') as AccountRule['drawdownType'],
  });
  if(rules.some(rule=>Number(rule.dailyLossLimit)>Number(rule.maxLossLimit))){setError(t('account.dailyMaxValidation'));setBusy(false);return;}
  const data={name:form.get('name'),initialBalance:form.get('initialBalance'),currency:form.get('currency'),breakEvenBand:form.get('breakEvenBand'),accountType,currentPhase:accountType==='challenge'?currentPhase:null,rules};
  try{const saved=await api<TradingAccount>(account?`/api/accounts/${account.id}`:'/api/accounts',{method:account?'PATCH':'POST',body:JSON.stringify(data)});if(account)await refresh(saved.id);else await select(saved.id);notify(t(account?'account.updated':'account.created'));onOpenChange(false);}catch(cause){setError(message(cause));}finally{setBusy(false);}
 }
 return <Modal open={open} onOpenChange={onOpenChange} title={t(account?'account.editTitle':'account.newTitle')} description={t('account.description')} wide><form onSubmit={submit} className="form-stack"><ErrorMessage error={error}/><div className="form-grid"><Field label={t('account.name')}><input name="name" required maxLength={80} placeholder={t('account.namePlaceholder')} defaultValue={account?.name}/></Field><Field label={t('account.type')}><select required value={accountType} onChange={event=>setAccountType(event.target.value as AccountType)}><option value="" disabled>{t('account.typePlaceholder')}</option>{accountTypes.map(type=><option key={type} value={type}>{t(`account.type.${type}` as MessageKey)}</option>)}</select></Field><Field label={t('account.initialBalance')}><input name="initialBalance" type="number" required min="0.01" max="1000000000000" step="0.01" defaultValue={numericInputValue(account?.initialBalance||'6000')}/></Field><Field label={t('account.currency')}><select name="currency" defaultValue={account?.currency||'USD'}>{['USD','EUR','GBP','MXN'].map(currency=><option key={currency}>{currency}</option>)}</select></Field></div><Field label={t('account.breakEvenBand')} hint={t('account.breakEvenHint')}><input name="breakEvenBand" type="number" required min="0" max="1000000000" step="0.01" defaultValue={numericInputValue(account?.breakEvenBand||'15')}/></Field>{accountType==='challenge'&&<div className="account-rules-section"><div className="account-rules-controls"><Field label={t('account.numberOfPhases')} hint={t('account.numberOfPhasesHint')}><input type="number" required min="1" max="20" step="1" value={phaseCount} onChange={event=>{const count=Math.max(1,Math.min(20,Number(event.target.value)||1));setPhaseCount(count);setCurrentPhase(value=>Math.min(value,count));}}/></Field><Field label={t('account.currentPhase')}><select value={currentPhase} onChange={event=>setCurrentPhase(Number(event.target.value))}>{Array.from({length:phaseCount},(_,index)=><option key={index+1} value={index+1}>{t('account.phase')} {index+1}</option>)}</select></Field></div><div className="account-rules-list">{Array.from({length:phaseCount},(_,index)=><AccountRuleFields account={account} key={index} index={index} kind="challenge"/>)}</div></div>}{accountType==='funded'&&<div className="account-rules-section"><AccountRuleFields account={account} index={0} kind="funded"/></div>}{(accountType==='own_capital'||accountType==='demo')&&<p className="info-note">{t('account.noRulesNeeded')}</p>}{account&&<><p className="info-note">{t('account.recalculation')}</p><p className="info-note">{t('account.changeTypeWarning')}</p></>}<div className="dialog-actions"><Button type="button" variant="secondary" onClick={()=>onOpenChange(false)}>{t('app.cancel')}</Button><Button loading={busy}>{t(account?'account.save':'account.create')}</Button></div></form></Modal>;
}
