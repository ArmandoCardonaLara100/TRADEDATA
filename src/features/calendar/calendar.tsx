'use client';

import {useEffect, useMemo, useState} from 'react';
import Link from 'next/link';
import {CalendarDays, ChevronLeft, ChevronRight, RefreshCw} from 'lucide-react';

import {Button, Empty, ErrorMessage, Modal, PageHeading, Panel} from '@/components/ui';
import {aggregateCalendarDays, type CalendarDay} from '@/lib/analytics/calendar';
import {classify} from '@/lib/analytics/journal';
import {D} from '@/lib/calculations/decimal';
import {api} from '@/lib/client';
import {number, signedMoney} from '@/lib/format';
import {useLanguage, type MessageKey} from '@/lib/i18n';
import {useWorkspace} from '@/features/workspace/context';
import type {Trade} from '@/types/trading';

type CalendarResponse = {trades: Trade[]};
const weekdayKeys:MessageKey[] = [
  'calendar.sun', 'calendar.mon', 'calendar.tue', 'calendar.wed',
  'calendar.thu', 'calendar.fri', 'calendar.sat',
];
const outcomeKeys:Record<ReturnType<typeof classify>,MessageKey> = {
  win:'calendar.win', loss:'calendar.loss', breakeven:'calendar.breakeven', open:'calendar.incomplete',
};

function localMonth() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
}

function shiftMonth(month:string, distance:number) {
  const [year, value] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, value-1+distance, 1));
  return next.toISOString().slice(0,7);
}

function calendarCells(month:string):Array<string|null> {
  if (!month) return [];
  const [year, value] = month.split('-').map(Number);
  const offset = new Date(Date.UTC(year,value-1,1)).getUTCDay();
  const count = new Date(Date.UTC(year,value,0)).getUTCDate();
  return Array.from({length:Math.ceil((offset+count)/7)*7},(_,index) => {
    const day=index-offset+1;
    return day>0&&day<=count?`${month}-${String(day).padStart(2,'0')}`:null;
  });
}

function formattedDate(date:string, locale:string) {
  return new Intl.DateTimeFormat(locale,{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'})
    .format(new Date(`${date}T12:00:00Z`));
}

export function Calendar() {
  const {account} = useWorkspace();
  const {language,t} = useLanguage();
  const locale = language==='es'?'es-MX':'en-US';
  const [month,setMonth] = useState('');
  const [result,setResult] = useState<{key:string;trades:Trade[]}|null>(null);
  const [selectedDate,setSelectedDate] = useState<string|null>(null);
  const [revision,setRevision] = useState(0);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState('');
  const key = account&&month?`${account.id}:${month}`:'';

  useEffect(()=>setMonth(localMonth()),[]);
  useEffect(()=>setSelectedDate(null),[account?.id]);
  useEffect(()=>{
    const onFocus=()=>setRevision(value=>value+1);
    const onVisible=()=>{if(document.visibilityState==='visible')onFocus();};
    window.addEventListener('focus',onFocus);
    document.addEventListener('visibilitychange',onVisible);
    return ()=>{window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onVisible);};
  },[]);
  useEffect(()=>{
    if(!key||!account)return;
    const controller=new AbortController();
    setLoading(true);setError('');
    api<CalendarResponse>(`/api/calendar?accountId=${encodeURIComponent(account.id)}&month=${month}`,{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted)setResult({key,trades:data.trades});})
      .catch(()=>{if(!controller.signal.aborted)setError(t('calendar.loadError'));})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return ()=>controller.abort();
  },[account,month,key,revision,t]);

  const trades=result?.key===key?result.trades:[];
  const days=useMemo(()=>aggregateCalendarDays(trades),[trades]);
  const cells=useMemo(()=>calendarCells(month),[month]);
  const selected=selectedDate?days.get(selectedDate):undefined;
  const dayList=[...days.values()];
  const monthlyTotal=dayList.reduce((total,day)=>total.plus(day.total),new D(0));
  const closed=dayList.reduce((total,day)=>total+day.closed,0);
  const profitable=dayList.filter(day=>day.state==='profit').length;
  const losing=dayList.filter(day=>day.state==='loss').length;
  const neutral=dayList.filter(day=>day.state==='neutral').length;
  const monthTitle=month?new Intl.DateTimeFormat(locale,{month:'long',year:'numeric',timeZone:'UTC'})
    .format(new Date(`${month}-01T12:00:00Z`)):'';
  const today=new Date();
  const todayKey=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  if(!account)return <><PageHeading eyebrow={t('calendar.eyebrow')} title={t('calendar.title')} description={t('calendar.description')}/><Panel><Empty icon={<CalendarDays size={25}/>} title={t('calendar.noAccount')} description={t('calendar.noAccountText')} action={<Link className="button primary" href="/dashboard">{t('calendar.overview')}</Link>}/></Panel></>;

  const dayAmount=(day:CalendarDay)=>day.closed?signedMoney(Number(day.total),account.currency):t('calendar.noResult');
  return <>
    <PageHeading eyebrow={t('calendar.eyebrow')} title={t('calendar.title')} description={t('calendar.description')}/>
    <div className="account-context calendar-context"><span className="context-label"><span className="status-dot"/>{account.name}</span><span>{account.currency} {t('calendar.account')}</span><span>{t('calendar.datedOnly')}</span></div>
    <div className="calendar-layout">
      <Panel className="calendar-panel">
        <div className="calendar-toolbar">
          <div><span className="eyebrow">{t('calendar.month')}</span><h2>{monthTitle}</h2></div>
          <div className="calendar-controls">
            <button className="icon-button" type="button" aria-label={t('calendar.previous')} disabled={!month||month<='1900-01'} onClick={()=>{setMonth(shiftMonth(month,-1));setSelectedDate(null);}}><ChevronLeft size={18}/></button>
            <label className="calendar-month-input"><span className="sr-only">{t('calendar.chooseMonth')}</span><input type="month" min="1900-01" max="2199-12" value={month} onChange={event=>{if(event.target.value){setMonth(event.target.value);setSelectedDate(null);}}}/></label>
            <button className="icon-button" type="button" aria-label={t('calendar.next')} disabled={!month||month>='2199-12'} onClick={()=>{setMonth(shiftMonth(month,1));setSelectedDate(null);}}><ChevronRight size={18}/></button>
            <Button type="button" variant="ghost" onClick={()=>{setMonth(localMonth());setSelectedDate(null);}}>{t('calendar.today')}</Button>
            <button className="icon-button" type="button" aria-label={t('calendar.refresh')} onClick={()=>setRevision(value=>value+1)}><RefreshCw size={16}/></button>
          </div>
        </div>
        <ErrorMessage error={error}/>
        {loading&&<p className="calendar-loading" role="status">{t('calendar.loading')}</p>}
        <div className="calendar-weekdays">{weekdayKeys.map(key=><span key={key}>{t(key)}</span>)}</div>
        <div className="calendar-grid" aria-label={monthTitle}>
          {cells.map((date,index)=>{
            if(!date)return <div className="calendar-spacer" key={`spacer-${index}`} aria-hidden="true"/>;
            const day=days.get(date);
            const label=`${formattedDate(date,locale)}. ${day?`${day.trades.length} ${t('calendar.operations')}. ${dayAmount(day)}`:t('calendar.noTrades')}`;
            return day?<button type="button" key={date} className={`calendar-day ${day.state}`} aria-label={label} onClick={()=>setSelectedDate(date)}>
              <span className={`calendar-day-number ${date===todayKey?'today':''}`}>{Number(date.slice(-2))}</span>
              <span className="calendar-day-result">{day.closed?dayAmount(day):t('calendar.incomplete')}</span>
              <span className="calendar-day-count">{day.trades.length} {t('calendar.tradesShort')}</span>
            </button>:<div className="calendar-day no-trades" key={date} aria-label={label}><span className={`calendar-day-number ${date===todayKey?'today':''}`}>{Number(date.slice(-2))}</span></div>;
          })}
        </div>
        <div className="calendar-legend"><span><i className="profit"/>{t('calendar.profitable')}</span><span><i className="loss"/>{t('calendar.losing')}</span><span><i className="neutral"/>{t('calendar.breakEven')}</span></div>
      </Panel>
      <Panel className="calendar-summary" title={t('calendar.monthlyOverview')} description={t('calendar.summaryDescription')}>
        <div className="calendar-summary-total"><span>{t('calendar.netResult')}</span><strong className={monthlyTotal.gt(0)?'positive':monthlyTotal.lt(0)?'negative':''}>{signedMoney(monthlyTotal.toNumber(),account.currency)}</strong></div>
        <dl className="calendar-summary-grid">
          <div><dt>{t('calendar.tradingDays')}</dt><dd>{dayList.length}</dd></div>
          <div><dt>{t('calendar.closedTrades')}</dt><dd>{closed}</dd></div>
          <div><dt>{t('calendar.profitableDays')}</dt><dd className="positive">{profitable}</dd></div>
          <div><dt>{t('calendar.losingDays')}</dt><dd className="negative">{losing}</dd></div>
          <div><dt>{t('calendar.breakEvenDays')}</dt><dd>{neutral}</dd></div>
        </dl>
        {!loading&&!dayList.length&&<div className="calendar-summary-empty"><CalendarDays size={20}/><p>{t('calendar.emptyMonth')}</p></div>}
      </Panel>
    </div>
    <Modal open={Boolean(selected)} onOpenChange={open=>{if(!open)setSelectedDate(null);}} title={selected?formattedDate(selected.date,locale):t('calendar.title')} description={selected?`${selected.trades.length} ${t('calendar.operations')}`:undefined}>
      {selected&&<><div className="calendar-dialog-total"><span>{t('calendar.dailyTotal')}</span><strong className={new D(selected.total).gt(0)?'positive':new D(selected.total).lt(0)?'negative':''}>{dayAmount(selected)}</strong></div><div className="calendar-dialog-list">{selected.trades.map(trade=>{
        const outcome=classify(trade.pnl,account.breakEvenBand);
        return <article className="calendar-trade" key={trade.id}>
          <div className="calendar-trade-head"><div><strong>{trade.symbol||t('calendar.unspecified')}</strong><span>#{trade.sequence} · {t(outcomeKeys[outcome])}</span></div><strong className={trade.pnl===null?'':Number(trade.pnl)>=0?'positive':'negative'}>{trade.pnl===null?'—':signedMoney(Number(trade.pnl),account.currency)}</strong></div>
          {(trade.strategy||trade.session||trade.direction)&&<p>{[trade.strategy,trade.session,trade.direction?t(trade.direction==='long'?'calendar.long':'calendar.short'):null].filter(Boolean).join(' · ')}</p>}
          {(trade.riskPercent||trade.rewardRisk||trade.duration!==null)&&<p>{[trade.riskPercent?`${t('calendar.risk')} ${number(Number(trade.riskPercent)*100)}%`:null,trade.rewardRisk?`${t('calendar.plannedR')} ${number(Number(trade.rewardRisk))}R`:null,trade.duration!==null?`${number(trade.duration)} ${t('calendar.minutes')}`:null].filter(Boolean).join(' · ')}</p>}
          {trade.notes&&<p className="calendar-trade-notes">{trade.notes}</p>}
          {trade.evidenceUrl&&<a className="text-link" href={trade.evidenceUrl} target="_blank" rel="noopener noreferrer">{t('calendar.evidence')}</a>}
        </article>;
      })}</div></>}
    </Modal>
  </>;
}
