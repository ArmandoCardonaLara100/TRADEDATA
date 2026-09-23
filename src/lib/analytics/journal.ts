import { D, mean, ratio, sum } from '../calculations/decimal';
import type { Outcome, Trade, TradingAccount } from '@/types/trading';

export function classify(pnl: string | number | null, band: string | number): Outcome {
 if (pnl === null) return 'open';
 const p = new D(pnl), b = new D(band);
 return p.gt(b) ? 'win' : p.lt(b.negated()) ? 'loss' : 'breakeven';
}

/** H/I/J use initial capital, not peak equity. See docs/IMPLEMENTATION.md. */
export function calculateAnalytics(trades: Trade[], account: Pick<TradingAccount,'initialBalance'|'breakEvenBand'|'baselineBreakEven'|'riskMetric'>) {
 const initial = new D(account.initialBalance);
 if (!initial.isFinite() || initial.lte(0)) throw new Error('Initial balance must be positive.');
 const ordered = [...trades].sort((a,b)=>a.sequence-b.sequence);
 const completed = ordered.filter(t=>t.pnl !== null);
 const wins = completed.filter(t=>classify(t.pnl,account.breakEvenBand)==='win');
 const losses = completed.filter(t=>classify(t.pnl,account.breakEvenBand)==='loss');
 const breakEven = completed.filter(t=>classify(t.pnl,account.breakEvenBand)==='breakeven');
 const totalOf = (ts: Trade[]) => sum(ts.map(t=>t.pnl!)).toNumber();
 const net = sum(completed.map(t=>t.pnl!));
 let cumulative = new D(0), peak = new D(0), maxDrawdown = new D(0);
 const equity = [{sequence:0, label:'Start', balance:initial.toNumber(), pnl:0, growth:0, drawdown:0, date:null as string|null}];
 for (const trade of completed) {
  cumulative = cumulative.plus(trade.pnl!);
  peak = D.max(peak, cumulative);
  const drawdown = cumulative.minus(peak).div(initial).times(100);
  maxDrawdown = D.min(maxDrawdown,drawdown);
  equity.push({sequence:trade.sequence,label:`#${trade.sequence}`,balance:initial.plus(cumulative).toNumber(),pnl:Number(trade.pnl),growth:cumulative.div(initial).times(100).toNumber(),drawdown:drawdown.toNumber(),date:trade.date});
 }
 const positive = completed.filter(t=>new D(t.pnl!).gt(0));
 const negative = completed.filter(t=>new D(t.pnl!).lt(0));
 const grossProfit = totalOf(positive), grossLoss = Math.abs(totalOf(negative));
 const realizedR = completed.flatMap(t=>t.riskPercent && new D(t.riskPercent).gt(0) ? [new D(t.pnl!).div(initial.times(t.riskPercent)).toNumber()] : []);
 let currentWin=0,currentLoss=0,maxWin=0,maxLoss=0;
 const winStreaks:number[]=[],lossStreaks:number[]=[];
 for(const trade of completed) {
  const outcome=classify(trade.pnl,account.breakEvenBand);
  if(outcome==='win'){if(currentLoss)lossStreaks.push(currentLoss);currentLoss=0;maxWin=Math.max(maxWin,++currentWin);}
  else if(outcome==='loss'){if(currentWin)winStreaks.push(currentWin);currentWin=0;maxLoss=Math.max(maxLoss,++currentLoss);}
  else {if(currentWin)winStreaks.push(currentWin);if(currentLoss)lossStreaks.push(currentLoss);currentWin=0;currentLoss=0;}
 }
 if(currentWin)winStreaks.push(currentWin);if(currentLoss)lossStreaks.push(currentLoss);
 const grouped = new Map<string,{symbol:string;win:number;loss:number;breakeven:number;net:number;count:number}>();
 const monthly = new Map<string,{month:string;profit:number;loss:number;net:number}>();
 for(const t of completed){
  const key=t.symbol||'Unspecified',outcome=classify(t.pnl,account.breakEvenBand) as 'win'|'loss'|'breakeven';
  const group=grouped.get(key)||{symbol:key,win:0,loss:0,breakeven:0,net:0,count:0};
  group[outcome]++;group.count++;group.net=new D(group.net).plus(t.pnl!).toNumber();grouped.set(key,group);
  if(t.date){const month=t.date.slice(0,7),m=monthly.get(month)||{month,profit:0,loss:0,net:0}; const p=Number(t.pnl);m.profit=new D(m.profit).plus(Math.max(p,0)).toNumber();m.loss=new D(m.loss).plus(Math.min(p,0)).toNumber();m.net=new D(m.net).plus(p).toNumber();monthly.set(month,m);}
 }
 const averageWin=mean(wins.map(t=>t.pnl!));
 const worksheetBreakEvenCount=breakEven.length+(account.baselineBreakEven?1:0);
 return {
  total:completed.length,open:ordered.length-completed.length,wins:wins.length,losses:losses.length,breakEven:breakEven.length,
  winRate:wins.length+losses.length ? wins.length/(wins.length+losses.length) : 0,
  lossRate:completed.length?losses.length/completed.length:0,breakEvenRate:completed.length?breakEven.length/completed.length:0,
  netProfit:net.toNumber(),balance:initial.plus(net).toNumber(),roi:net.div(initial).times(100).toNumber(),
  winTotal:totalOf(wins),lossTotal:totalOf(losses),breakEvenTotal:totalOf(breakEven),
  averageWin,averageLoss:mean(losses.map(t=>t.pnl!)),averageBreakEven:mean(breakEven.map(t=>t.pnl!)),
  averagePlannedR:mean(ordered.flatMap(t=>t.rewardRisk===null?[]:[t.rewardRisk])),
  averageDuration:mean(ordered.flatMap(t=>t.duration===null?[]:[t.duration])),
  worksheetRisk:account.riskMetric==='average-win'?(averageWin===null?null:ratio(averageWin,60)):mean(ordered.flatMap(t=>t.rewardRisk===null?[]:[t.rewardRisk])),
  worksheetBreakEvenCount,worksheetBreakEvenAverage:ratio(totalOf(breakEven),worksheetBreakEvenCount),
  grossProfit,grossLoss,profitFactor:ratio(grossProfit,grossLoss),expectancy:ratio(net.toNumber(),completed.length),
  largestWin:positive.length?Math.max(...positive.map(t=>Number(t.pnl))):null,
  largestLoss:negative.length?Math.min(...negative.map(t=>Number(t.pnl))):null,
  averageR:mean(realizedR),totalR:sum(realizedR).toNumber(),maxDrawdown:maxDrawdown.toNumber(),
  currentDrawdown:equity.at(-1)!.drawdown,recoveryFactor:ratio(net.toNumber(),maxDrawdown.abs().div(100).times(initial).toNumber()),
  maxWinStreak:maxWin,maxLossStreak:maxLoss,averageWinStreak:mean(winStreaks),averageLossStreak:mean(lossStreaks),
  equity,bySymbol:[...grouped.values()],monthly:[...monthly.values()].sort((a,b)=>a.month.localeCompare(b.month)),
  undated:completed.filter(t=>!t.date).length,
 };
}
export type Analytics=ReturnType<typeof calculateAnalytics>;
