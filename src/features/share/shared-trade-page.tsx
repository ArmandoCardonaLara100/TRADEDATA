'use client';

import {ArrowLeft,ShieldCheck} from 'lucide-react';

import {Brand} from '@/components/app-shell';
import {LanguageSelect,ThemeSelect} from '@/components/preference-controls';
import {EvidenceImage} from '@/features/journal/evidence-image';
import {number,signedMoney} from '@/lib/format';
import {useLanguage,type MessageKey} from '@/lib/i18n';
import type {SharedTrade} from '@/types/shared-trade';

function value(value:string|number|null|undefined,suffix=''){return value===null||value===undefined||value===''?'—':`${value}${suffix}`;}

export function SharedTradePage({token,trade}:{token:string;trade:SharedTrade|null}){
 const {t}=useLanguage();
 if(!trade)return <main className="share-page share-unavailable"><header className="share-public-header"><a className="share-home" href="https://tradingdata.tech/" aria-label={t('share.back')}><ArrowLeft size={17}/><Brand themeAware/></a><div><LanguageSelect compact/><ThemeSelect compact/></div></header><section className="share-unavailable-card"><ShieldCheck size={25}/><span className="eyebrow">TRADEDATA / SHARE</span><h1>{t('share.unavailable')}</h1><p>{t('share.unavailableText')}</p><a className="button primary" href="https://tradingdata.tech/">{t('share.back')}</a></section></main>;
 const resultLabel=trade.outcome==='breakeven'?t('share.breakEven'):trade.outcome==='open'?t('share.incomplete'):trade.outcome==='win'?t('share.win'):t('share.loss');
 const metrics:[[string,string],[string,string],[string,string],[string,string],[string,string],[string,string],[string,string],[string,string]]=[
  [t('journal.riskPercent'),trade.riskPercent?`${number(Number(trade.riskPercent)*100)}%`:'—'],
  [t('journal.plannedR'),trade.rewardRisk?`${number(Number(trade.rewardRisk))}R`:'—'],
  [t('journal.duration'),trade.duration===null?'—':`${number(trade.duration)} min`],
  [t('journal.strategy'),value(trade.strategy)],
  [t('journal.grade'),value(trade.setupGrade)],
  [t('journal.mindset'),trade.mindset?t(`journal.mindset.${trade.mindset}` as MessageKey):'—'],
  [t('journal.direction'),trade.direction?t(`share.${trade.direction}` as MessageKey):'—'],
  [t('journal.session'),value(trade.session)],
 ];
 return <main className="share-page"><header className="share-public-header"><a className="share-home" href="https://tradingdata.tech/" aria-label={t('share.back')}><ArrowLeft size={17}/><Brand themeAware/></a><div><LanguageSelect compact/><ThemeSelect compact/></div></header><article className="shared-trade-card"><header className="shared-trade-heading"><div><span className="eyebrow">{t('share.readOnly')}</span><h1>{t('journal.operation')} #{trade.sequence}</h1><p>{trade.symbol||t('journal.unspecified')} · {trade.date||t('journal.noDate')}</p></div><ShieldCheck size={21} aria-label={t('share.secure')}/></header><div className="shared-trade-result"><span className={`outcome-badge ${trade.outcome}`}>{resultLabel}</span><strong className={trade.pnl===null?'muted':Number(trade.pnl)>=0?'positive':'negative'}>{trade.pnl===null?t('journal.awaitingResult'):signedMoney(Number(trade.pnl),trade.currency)}</strong></div><dl className="shared-trade-metrics">{metrics.map(([label,display])=><div key={label}><dt>{label}</dt><dd>{display}</dd></div>)}</dl>{trade.notes&&<section className="shared-trade-notes"><h2>{t('journal.analysis')}</h2><p>{trade.notes}</p></section>}{trade.feelings&&<section className="shared-trade-notes"><h2>{t('journal.mindsetNote')}</h2><p>{trade.feelings}</p></section>}{trade.evidence.some(Boolean)&&<section className="shared-trade-evidence"><div><span className="eyebrow">{t('share.visualRecord')}</span><h2>{t('journal.evidenceTitle')}</h2></div><div className="trade-evidence-grid">{trade.evidence.map((present,index)=>present&&<div className="trade-evidence-slot" key={index}><strong>{t('journal.evidenceSlot')} {index+1}</strong><EvidenceImage src={`/api/share/${token}/evidence?slot=${index+1}`} alt={`${t('journal.evidencePreview')} ${index+1}`} openLabel={`${t('journal.openPreview')} ${index+1}`} closeLabel={t('journal.closePreview')}/></div>)}</div></section>}<footer className="shared-trade-footer"><ShieldCheck size={15}/><span>{t('share.privacy')}</span></footer></article></main>;
}
