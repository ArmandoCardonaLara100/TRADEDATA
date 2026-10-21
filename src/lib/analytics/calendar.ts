import {D} from '@/lib/calculations/decimal';
import type {Trade} from '@/types/trading';

export interface CalendarDay {
  date: string;
  trades: Trade[];
  total: string;
  closed: number;
  state: 'profit' | 'loss' | 'neutral';
}

/** Journal dates are date-only strings; never convert them through a timezone. */
export function aggregateCalendarDays(trades: Trade[]): Map<string, CalendarDay> {
  const days = new Map<string, CalendarDay>();
  for (const trade of trades) {
    if (!trade.date || !/^\d{4}-\d{2}-\d{2}$/.test(trade.date)) continue;
    const day = days.get(trade.date) || {
      date: trade.date,
      trades: [],
      total: '0',
      closed: 0,
      state: 'neutral' as const,
    };
    day.trades.push(trade);
    if (trade.pnl !== null) {
      day.total = new D(day.total).plus(trade.pnl).toString();
      day.closed += 1;
    }
    const net = new D(day.total);
    day.state = net.gt(0) ? 'profit' : net.lt(0) ? 'loss' : 'neutral';
    days.set(trade.date, day);
  }
  return days;
}

export function calendarMonthBounds(month: string) {
  if (!/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const [year, monthNumber] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, monthNumber, 1)).toISOString().slice(0, 10);
  return {start: `${month}-01`, end: next};
}
