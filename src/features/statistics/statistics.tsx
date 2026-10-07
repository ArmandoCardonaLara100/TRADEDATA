'use client';

import Link from 'next/link';

import { DrawdownChart, MonthlyChart, PnlChart, SymbolChart } from '@/components/charts';
import { Empty, Metric, PageHeading, Panel } from '@/components/ui';
import { money, number, percent, signedMoney } from '@/lib/format';
import { useWorkspace } from '@/features/workspace/context';

function Stats({ title, rows }: { title: string; rows: [string, string][] }) {
  return <Panel title={title}><dl className="stat-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div style={{ height: 15 }} /></Panel>;
}

export function Statistics() {
  const { account, analytics: a } = useWorkspace();

  if (!account || !a) {
    return <><PageHeading eyebrow="PERFORMANCE ANALYSIS" title="Know your numbers" /><Panel><Empty title="Your statistics start with a journal" description="Create an account or import your workbook to start analyzing your operations." action={<Link href="/dashboard" className="button primary">Open overview</Link>} /></Panel></>;
  }

  const cash = (value: number | null) => money(value, account.currency);
  const band = Number(account.breakEvenBand);
  const reconciliation: [string, string, string][] = [
    ['Account balance', cash(a.balance), 'Starting capital + net result'],
    ['Total net result', cash(a.netProfit), 'Sum of completed results'],
    ['Return', percent(a.roi), 'Net result ÷ starting capital'],
    ['Win Rate', percent(a.winRate * 100), 'Break-even excluded'],
    ['Break-even', String(a.worksheetBreakEvenCount), 'Includes opening baseline row'],
    ['Risk Rate Planned', number(a.worksheetRisk), 'Includes opening baseline row'],
    ['Average duration', a.averageDuration === null ? '—' : `${number(a.averageDuration)} min`, 'Recorded complete and incomplete rows'],
  ];

  return <>
    <PageHeading eyebrow="PERFORMANCE ANALYSIS" title="Know your numbers" description={`${account.name} · Complete account history · ${a.total} closed operations`} />
    <div className="account-context">
      <span className="context-label"><span className="status-dot" />{account.name}</span>
      <span>Complete account history</span>
      <span>{a.total} closed operations</span>
      <span>±{cash(band)} break-even band</span>
    </div>
    <div className="metric-grid">
      <Metric label="Net result" value={signedMoney(a.netProfit, account.currency)} detail={`${percent(a.roi)} return on starting capital`} tone={a.netProfit >= 0 ? 'positive' : 'negative'} />
      <Metric label="Expectancy" value={cash(a.expectancy)} detail="Average net result per closed trade" />
      <Metric label="Average realized R" value={a.averageR === null ? '—' : `${number(a.averageR)}R`} detail="Using recorded fixed-capital risk" />
      <Metric label="Recovery factor" value={number(a.recoveryFactor)} detail="Net result ÷ maximum cash drawdown" />
    </div>
    <div className="stat-grid">
      <Stats title="Trade outcomes" rows={[
        ['Closed operations', String(a.total)],
        ['Incomplete operations', String(a.open)],
        ['Winning trades', String(a.wins)],
        ['Losing trades', String(a.losses)],
        ['Break-even trades', String(a.breakEven)],
        ['Win rate', percent(a.winRate * 100)],
        ['Loss rate', percent(a.lossRate * 100)],
        ['Break-even rate', percent(a.breakEvenRate * 100)],
      ]} />
      <Stats title="Returns & risk" rows={[
        ['Gross positive P&L', cash(a.grossProfit)],
        ['Gross negative P&L', cash(-a.grossLoss)],
        ['Profit factor', number(a.profitFactor)],
        ['Average win', cash(a.averageWin)],
        ['Average loss', cash(a.averageLoss)],
        ['Largest positive result', cash(a.largestWin)],
        ['Largest negative result', cash(a.largestLoss)],
        ['Total realized R', `${number(a.totalR)}R`],
      ]} />
      <Stats title="Consistency & execution" rows={[
        ['Longest winning streak', `${a.maxWinStreak} trades`],
        ['Longest losing streak', `${a.maxLossStreak} trades`],
        ['Average winning streak', number(a.averageWinStreak)],
        ['Average losing streak', number(a.averageLossStreak)],
        ['Average planned R', `${number(a.averagePlannedR)}R`],
        ['Average duration', a.averageDuration === null ? '—' : `${number(a.averageDuration)} min`],
        ['Maximum drawdown', percent(a.maxDrawdown)],
        ['Current drawdown', percent(a.currentDrawdown)],
      ]} />
    </div>
    <div className="two-column">
      <Panel title="Results by operation" description="Every completed result amount."><PnlChart data={a.equity} currency={account.currency} /></Panel>
      <Panel title="Performance by instrument" description="Outcome counts by symbol."><SymbolChart data={a.bySymbol} /></Panel>
    </div>
    <div className="two-column">
      <Panel title="Drawdown" description="Percentage points below peak cumulative return."><DrawdownChart data={a.equity} /><div className="panel-body"><p className="account-cost-note">The workbook measures drawdown against starting capital.</p></div></Panel>
      <Panel title="Monthly profit & loss" description="Only dated operations are grouped.">{a.monthly.length ? <MonthlyChart data={a.monthly} currency={account.currency} /> : <Empty title="Dates bring another perspective" description="The source workbook contains operation numbers, but no dates. Add dates to your trades to see monthly results." />}</Panel>
    </div>
    <Panel className="section-gap" title="Worksheet reconciliation" description="Original worksheet conventions kept separate from trade-only statistics.">
      <div className="panel-body"><table className="statistics-table"><thead><tr><th>Workbook measure</th><th>Value</th><th>Calculation basis</th></tr></thead><tbody>{reconciliation.map(([label, value, basis]) => <tr key={label}><td>{label}</td><td>{value}</td><td>{basis}</td></tr>)}</tbody></table>{account.baselineBreakEven && <p className="disclosure-note">This worksheet counts its explicit opening-balance row as one break-even. That row is excluded from trade counts, outcome charts, expectancy and streaks.</p>}</div>
    </Panel>
    <details className="panel methodology"><summary>How these statistics are calculated</summary><ul>
      <li>Win: result greater than {cash(band)}. Loss: result below {cash(-band)}.</li>
      <li>Win rate excludes break-even trades; P&amp;L and ROI include completed results.</li>
      <li>ROI and cumulative growth use starting capital as the denominator.</li>
      <li>Profit factor divides positive results by the absolute total of negative results.</li>
      <li>Realized R divides result by initial balance × recorded risk fraction.</li>
      <li>Break-even outcomes end both winning and losing streaks.</li>
      <li>A dash means there is no valid denominator or supporting observation.</li>
    </ul></details>
  </>;
}
