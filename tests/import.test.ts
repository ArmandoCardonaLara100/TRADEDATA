import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {parseWorkbook} from '../src/lib/import/workbook';
import {calculateAnalytics} from '../src/lib/analytics/journal';
import {workbookFixture} from './workbook-fixture';
import type {Trade,TradingAccount} from '../src/types/trading';
describe('workbook ingestion',()=>{
 it('extracts raw journal records with original account conventions',()=>{const data=parseWorkbook(workbookFixture());expect(data.map(d=>d.rows.length)).toEqual([16,38]);expect(data.map(d=>d.breakEvenBand)).toEqual(['25','15']);expect(data[0].rows.filter(r=>r.pnl===null)).toHaveLength(3);expect(data[1].baselineBreakEven).toBe(true);expect(data.flatMap(d=>d.rows).every(r=>r.date===null)).toBe(true);for(const [i,d] of data.entries()){const a=calculateAnalytics(d.rows.map((r,n)=>({...r,id:String(n),sequence:r.sequence!,version:1})) as Trade[],d as unknown as TradingAccount);expect(a.balance).toBe(i?6352:6181.7);}});
 it('rejects malformed and oversized workbooks',()=>{expect(()=>parseWorkbook(new Uint8Array(2_000_001))).toThrow(/smaller/);expect(()=>parseWorkbook(new Uint8Array([1,2,3]))).toThrow();});
 const actual=process.env.SOURCE_WORKBOOK;
 it.skipIf(!actual||!existsSync(actual))('reads the actual supplied workbook without modifying it',()=>{const data=parseWorkbook(readFileSync(actual!));expect(data.map(d=>d.rows.length)).toEqual([16,38]);expect(data[0].rows[1].evidenceUrl).toContain('tradingview.com');});
});
