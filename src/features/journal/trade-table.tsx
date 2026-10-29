'use client';
import {ArrowUpRight} from 'lucide-react';
import {classify} from '@/lib/analytics/journal';
import {signedMoney,number} from '@/lib/format';
import {useLanguage} from '@/lib/i18n';
import type {Trade} from '@/types/trading';

export function TradeTable({trades,band,currency,onSelect,compact=false,showContext=true}:{trades:Trade[];band:string;currency:string;onSelect:(t:Trade)=>void;compact?:boolean;showContext?:boolean}){
 const {t}=useLanguage();
 const outcomeLabel=(outcome:ReturnType<typeof classify>)=>t(outcome==='breakeven'?'journal.breakEven':outcome==='open'?'journal.incomplete':outcome==='win'?'journal.win':'journal.loss');
 return <div className="table-scroll" tabIndex={0} role="region" aria-label={t('journal.tableLabel')}><table><thead><tr><th>{t('journal.operation')}</th><th>{t('journal.instrument')}</th>{!compact&&<th>{t('journal.tradeDate')}</th>}<th>{t('journal.result')}</th><th className="numeric">{t('journal.netPnl')}</th><th className="numeric">{t('journal.plannedR')}</th>{!compact&&showContext&&<th>{t('journal.strategy')}</th>}<th><span className="sr-only">{t('journal.details')}</span></th></tr></thead><tbody>{trades.map(trade=>{const outcome=classify(trade.pnl,band);return <tr key={trade.id}><td className="operation-number">#{String(trade.sequence).padStart(3,'0')}</td><td><button className="instrument-button" onClick={()=>onSelect(trade)}><span className="instrument-icon">{(trade.symbol||'—').slice(0,1)}</span><strong>{trade.symbol||t('journal.unspecified')}</strong></button></td>{!compact&&<td className="muted">{trade.date||t('journal.unspecified')}</td>}<td><span className={`outcome-badge ${outcome}`}><i/>{outcomeLabel(outcome)}</span></td><td className={`numeric table-pnl ${trade.pnl===null?'muted':Number(trade.pnl)>=0?'positive':'negative'}`}>{trade.pnl===null?'—':signedMoney(Number(trade.pnl),currency)}</td><td className="numeric">{trade.rewardRisk===null?'—':`${number(Number(trade.rewardRisk))}R`}</td>{!compact&&showContext&&<td className="muted">{trade.strategy||'—'}</td>}<td><button className="icon-button" onClick={()=>onSelect(trade)} aria-label={t('journal.viewOperation').replace('{number}',String(trade.sequence))}><ArrowUpRight size={16}/></button></td></tr>;})}</tbody></table></div>;
}
