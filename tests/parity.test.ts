import {describe,it,expect} from 'vitest';
import fixture from './fixtures/workbook.json' with {type:'json'};
import {calculateAnalytics,classify} from '../src/lib/analytics/journal';
import {eurusd,xauusd} from '../src/lib/calculations/calculator';
import {calculateBankroll} from '../src/lib/calculations/bankroll';
import {simulatePath,runMonteCarlo,defaultSimulation} from '../src/lib/simulation/monte-carlo';
import {accountSchema,tradeSchema,simulationSchema} from '../src/lib/validation/schemas';
import type {Trade,TradingAccount,SimulationInput} from '../src/types/trading';
function model(index:number){const f=fixture.journals[index];return {account:{initialBalance:String(f.initialBalance),breakEvenBand:String(f.threshold),baselineBreakEven:f.baselineBreakEven,riskMetric:index?'average-win':'planned'} as TradingAccount,trades:f.rows.map(r=>({id:String(r.sequence),sequence:r.sequence,symbol:r.symbol||'',riskPercent:String(r.riskPercent),rewardRisk:String(r.rewardRisk),duration:r.duration,pnl:r.pnl===null?null:String(r.pnl),date:null})) as Trade[]};}
describe('cached spreadsheet parity',()=>{
 for(const index of [0,1])it(fixture.journals[index].sheet,()=>{
  const {account,trades}=model(index),a=calculateAnalytics(trades,account),e=fixture.journals[index].expected as unknown as Record<string,number>;
  const mapping=index?{balance:'Q5',roi:'R5',netProfit:'S5',winRate:'T5',worksheetRisk:'U5',averageDuration:'V5',wins:'M106',losses:'N106',worksheetBreakEvenCount:'O106',winTotal:'M107',lossTotal:'N107',breakEvenTotal:'O107',averageWin:'M108',averageLoss:'N108',worksheetBreakEvenAverage:'O108'}:{balance:'S5',roi:'T5',netProfit:'U5',winRate:'V5',worksheetRisk:'W5',averageDuration:'X5',wins:'O26',losses:'P26',worksheetBreakEvenCount:'Q26',winTotal:'O27',lossTotal:'P27',breakEvenTotal:'Q27',averageWin:'O28',averageLoss:'P28',worksheetBreakEvenAverage:'Q28'};
  for(const [metric,cell] of Object.entries(mapping))expect(a[metric as keyof typeof a],cell).toBeCloseTo(e[cell],6);
  expect(a.total).toBe(index?38:13);expect(a.open).toBe(index?0:3);
  for(const row of fixture.journals[index].rows.filter(r=>r.pnl!==null)){
   const point=a.equity.find(p=>p.sequence===row.sequence)!;
   expect(point.growth,`I${row.sequence+5}`).toBeCloseTo(row.growth,6);
   expect(point.drawdown,`J${row.sequence+5}`).toBeCloseTo(row.drawdown,6);
  }
 });
 it('replays every cached Monte Carlo path and verifies terminal classification',()=>{
  const input={...defaultSimulation,...fixture.monteCarlo.input} as SimulationInput;
  const counts={passed:0,failed:0,unresolved:0};
  for(const source of fixture.monteCarlo.paths){let i=1;
   const result=simulatePath(input,()=>source.values[i]>source.values[i++-1]?0:.999999);
   expect(result.values).toEqual(source.values);
   expect(result.status).toBe(({Pasa:'passed',Revienta:'failed','Sin resolver':'unresolved'} as Record<string,string>)[source.status]);counts[result.status]++;
  }
  expect(counts.passed/input.accounts).toBe(fixture.monteCarlo.expected.F4);
  expect(counts.failed/input.accounts).toBe(fixture.monteCarlo.expected.F5);
  expect(counts.unresolved/input.accounts).toBe(fixture.monteCarlo.expected.F6);
 });
 it('matches all bankroll cached outputs',()=>{
  const b=calculateBankroll({accountSize:6000,accounts:5,accountCost:27.2,withdrawals:1,withdrawalAmount:120,passRate:.33}),e=fixture.monteCarlo.expected;
  expect(b.investment).toBe(e.F15);expect(b.roi).toBeCloseTo(e.F16,9);expect(b.net).toBe(e.F17);expect(b.realCostPerAccount).toBe(e.F18);expect(b.total).toBe(e.F19);expect(b.funded).toBe(e.F20);
 });
 it('matches EURUSD calculator cached cells and XAUUSD formula',()=>{
  expect(eurusd(.6,55)?.lots).toBeCloseTo(.9166666667,9);expect(eurusd(.6,55)?.total).toBeCloseTo(59.58333333,7);
  expect(xauusd(0,0)).toEqual({lots:0,cash:0,total:0,fees:0});expect(xauusd(2,.5)).toEqual({lots:.5,cash:100,total:101.66,fees:1.66});
 });
});
describe('edge cases and explicit conventions',()=>{
 it('keeps inclusive break-even boundaries and missing outcomes distinct',()=>{expect(classify(25,25)).toBe('breakeven');expect(classify(-25,25)).toBe('breakeven');expect(classify(25.0001,25)).toBe('win');expect(classify(-25.0001,25)).toBe('loss');expect(classify(null,25)).toBe('open');});
 it('handles empty/zero denominators and decimal money',()=>{const {account,trades}=model(0);const a=calculateAnalytics([],account);expect(a.balance).toBe(6000);expect(a.profitFactor).toBeNull();expect(a.expectancy).toBeNull();expect(a.maxDrawdown).toBe(0);expect(calculateAnalytics([{...trades[0],pnl:'0.1'},{...trades[0],sequence:2,pnl:'0.2'}],account).netProfit).toBe(.3);expect(eurusd(0,55)).toBeNull();expect(eurusd(Infinity,55)).toBeNull();});
 it('measures drawdown relative to starting capital',()=>{const {account,trades}=model(0);const a=calculateAnalytics([{...trades[0],pnl:'600'},{...trades[0],sequence:2,pnl:'-300'}],account);expect(a.maxDrawdown).toBe(-5);expect(a.roi).toBe(5);});
 it('stops at exact target and drawdown boundaries',()=>{const input={...defaultSimulation,target:.02,riskPercent:.01,rewardRisk:2,maxDrawdown:.01};expect(simulatePath(input,()=>0).values).toEqual([0,.02]);expect(simulatePath(input,()=>1).values).toEqual([0,-.01]);});
 it('uses trailing peak and keeps unresolved accounts',()=>{let i=0;const p=simulatePath({...defaultSimulation,trades:3,target:1,riskPercent:.01,maxDrawdown:.01,trailing:true},()=>[0,1,0][i++]);expect(p.values).toEqual([0,.02,.01]);expect(p.status).toBe('failed');expect(simulatePath({...defaultSimulation,trades:1},()=>0).status).toBe('unresolved');});
 it('reproduces seeded runs and respects input bounds',()=>{expect(runMonteCarlo(defaultSimulation)).toEqual(runMonteCarlo(defaultSimulation));expect(simulationSchema.safeParse({...defaultSimulation,accounts:100000}).success).toBe(false);expect(simulationSchema.safeParse({...defaultSimulation,winProbability:1.1}).success).toBe(false);});
 it('uses Excel rounding and handles no funded accounts',()=>{const b=calculateBankroll({accountSize:6000,accounts:5,accountCost:27.2,withdrawals:1,withdrawalAmount:120,passRate:.1});expect(b.funded).toBe(1);expect(calculateBankroll({accountSize:6000,accounts:5,accountCost:0,withdrawals:0,withdrawalAmount:0,passRate:0}).roi).toBeNull();});
 it('rejects invalid numeric inputs and unsafe evidence links',()=>{expect(accountSchema.safeParse({name:'x',initialBalance:'NaN',breakEvenBand:'15'}).success).toBe(false);expect(tradeSchema.safeParse({accountId:crypto.randomUUID(),pnl:'Infinity'}).success).toBe(false);expect(tradeSchema.safeParse({accountId:crypto.randomUUID(),evidenceUrl:'javascript:alert(1)'}).success).toBe(false);});
});
