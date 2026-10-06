import {describe,expect,it} from 'vitest';
import {calculateAnalytics,calculateWinningRiskReward} from '../src/lib/analytics/journal';
import type {Trade,TradingAccount} from '../src/types/trading';

const accountId='11111111-1111-4111-8111-111111111111';
function trade(sequence:number,pnl:string|null):Trade{return {id:String(sequence),accountId,sequence,date:null,symbol:'',riskPercent:null,rewardRisk:null,duration:null,pnl,notes:'',feelings:'',evidenceUrl:'',strategy:'',direction:'',session:'',tags:'',sourceRow:null,version:1};}
const trades=(...pnl:(string|null)[])=>pnl.map((value,index)=>trade(index+1,value));

describe('winning-operation Risk/Reward',()=>{
 it('matches the specified example with multiple winners',()=>{
  expect(calculateWinningRiskReward(trades('200','200','200','200'),'10000','0')).toBe(2);
 });
 it('calculates one winning operation',()=>{
  expect(calculateWinningRiskReward(trades('250'),'10000','0')).toBe(2.5);
 });
 it('excludes losses and positive results inside the account break-even band',()=>{
  expect(calculateWinningRiskReward(trades('200','-500','10','100'),'10000','25')).toBe(1.5);
 });
 it('returns no value when every completed operation is a loss',()=>{
  expect(calculateWinningRiskReward(trades('-200','-50'),'10000','0')).toBeNull();
 });
 it('returns no value when there are no operations',()=>{
  expect(calculateWinningRiskReward([],'10000','0')).toBeNull();
 });
 it('returns no value for a zero opening balance',()=>{
  expect(calculateWinningRiskReward(trades('200'),'0','0')).toBeNull();
 });
 it('returns no value for a missing opening balance',()=>{
  expect(calculateWinningRiskReward(trades('200'),undefined,'0')).toBeNull();
 });
 it('publishes the account-specific result through the analytics model',()=>{
  const account={initialBalance:'10000',breakEvenBand:'25',baselineBreakEven:false,riskMetric:'planned'} satisfies Pick<TradingAccount,'initialBalance'|'breakEvenBand'|'baselineBreakEven'|'riskMetric'>;
  expect(calculateAnalytics(trades('200','-900','400'),account).riskReward).toBe(3);
 });
});
