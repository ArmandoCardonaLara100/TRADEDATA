import {describe,expect,it} from 'vitest';
import {tradeResultPercent} from '../src/lib/calculations/trade-return';

describe('operation result as a percentage of initial capital',()=>{
 it('uses the net result and initial capital, including commissions',()=>{
  expect(tradeResultPercent('125','1000')).toBe('12.5');
  expect(tradeResultPercent('-60','6000')).toBe('-1');
  expect(tradeResultPercent('0','6000')).toBe('0');
 });
 it('leaves incomplete trades and invalid capital without a value',()=>{
  expect(tradeResultPercent(null,'6000')).toBeNull();
  expect(tradeResultPercent('100','0')).toBeNull();
  expect(tradeResultPercent('100','invalid')).toBeNull();
 });
});
