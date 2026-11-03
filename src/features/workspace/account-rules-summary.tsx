'use client';
import {Flag,ShieldAlert,Target} from 'lucide-react';
import {Panel} from '@/components/ui';
import {number,percent} from '@/lib/format';
import {useLanguage,type MessageKey} from '@/lib/i18n';
import type {AccountType,TradingAccount} from '@/types/trading';

export const accountTypeKey=(type:AccountType|null)=>type?`account.type.${type}` as MessageKey:'account.type.unclassified' as MessageKey;
export const activeAccountRule=(account:TradingAccount)=>account.accountType==='challenge'?account.rules.find(rule=>rule.phaseNumber===account.currentPhase)||null:account.accountType==='funded'?account.rules.find(rule=>rule.phaseNumber===null)||null:null;

export function AccountRulesSummary({account,roi}:{account:TradingAccount;roi:number}){
 const {t}=useLanguage(),rule=activeAccountRule(account);
 if(!account.accountType)return <Panel className="account-rules-panel" title={t('account.rulesTitle')}><div className="panel-body"><p className="info-note">{t('account.noConfiguration')}</p></div></Panel>;
 if(!rule)return null;
 const target=Number(rule.profitTarget),progress=target>0?Math.max(0,Math.min(100,roi/target*100)):0;
 return <Panel className="account-rules-panel" title={t('account.rulesTitle')} description={t('account.rulesDescription')}><div className="account-rule-summary"><div className="account-rule-stage"><span>{t(accountTypeKey(account.accountType))}</span>{account.accountType==='challenge'&&<strong>{t('account.phase')} {account.currentPhase}</strong>}</div><div className="account-rule-progress"><div><span>{t('account.progress')}</span><strong>{percent(roi)} / {percent(target)}</strong></div><div className="progress-track" role="progressbar" aria-label={t('account.progress')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{width:`${progress}%`}}/></div></div><dl><div><dt><Target size={15}/>{t(account.accountType==='funded'?'account.profit':'account.profitTarget')}</dt><dd>{percent(target)}</dd></div><div><dt><ShieldAlert size={15}/>{t('account.maxLossLimit')}</dt><dd>{percent(Number(rule.maxLossLimit))}</dd></div><div><dt><ShieldAlert size={15}/>{t('account.dailyLossLimit')}</dt><dd>{percent(Number(rule.dailyLossLimit))}</dd></div><div><dt><Flag size={15}/>{t('account.drawdownType')}</dt><dd>{t(`account.drawdown.${rule.drawdownType}` as MessageKey)}</dd></div></dl></div></Panel>;
}
