import {describe, expect, it} from 'vitest';
import {aggregateCalendarDays, calendarMonthBounds} from '../src/lib/analytics/calendar';
import type {Trade} from '../src/types/trading';

function trade(sequence:number,date:string|null,pnl:string|null):Trade {
  return {id:String(sequence),accountId:'account',sequence,date,pnl,symbol:'EUR/USD',riskPercent:null,
    rewardRisk:null,duration:null,notes:'',feelings:'',evidenceUrl:'',additionalEvidenceUrls:[],evidencePath:'',additionalEvidencePaths:[],strategy:'',setupGrade:'',mindset:'',direction:'',session:'',tags:'',sourceRow:null,version:1};
}

describe('journal-derived calendar',()=>{
  it('sums every completed operation on a date without rounding cents',()=>{
    const days=aggregateCalendarDays([trade(1,'2026-10-05','100.125'),trade(2,'2026-10-05','-20.025'),trade(3,'2026-10-05',null)]);
    expect(days.get('2026-10-05')).toMatchObject({total:'80.1',closed:2,state:'profit'});
    expect(days.get('2026-10-05')?.trades).toHaveLength(3);
  });
  it('classifies losing, break-even, incomplete-only and absent dates separately',()=>{
    const days=aggregateCalendarDays([
      trade(1,'2026-10-06','-100'),trade(2,'2026-10-06','25'),
      trade(3,'2026-10-07','50'),trade(4,'2026-10-07','-50'),
      trade(5,'2026-10-08',null),trade(6,null,'900'),
    ]);
    expect(days.get('2026-10-06')?.state).toBe('loss');
    expect(days.get('2026-10-07')).toMatchObject({total:'0',state:'neutral',closed:2});
    expect(days.get('2026-10-08')).toMatchObject({total:'0',state:'neutral',closed:0});
    expect(days.has('2026-10-09')).toBe(false);
    expect(days.size).toBe(3);
  });
  it('uses date-only month bounds across December and leap years',()=>{
    expect(calendarMonthBounds('2026-12')).toEqual({start:'2026-12-01',end:'2027-01-01'});
    expect(calendarMonthBounds('2028-02')).toEqual({start:'2028-02-01',end:'2028-03-01'});
    expect(calendarMonthBounds('2026-13')).toBeNull();
  });
});
