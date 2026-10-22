import {describe,it,expect} from 'vitest';
import {tradeSchema} from '../src/lib/validation/schemas';
import {localTradeDate} from '../src/lib/trade-date';
import {evidenceExtension,MAX_EVIDENCE_BYTES} from '../src/lib/evidence';
import {aggregateCalendarDays} from '../src/lib/analytics/calendar';
import {generateReportPdf} from '../src/lib/report/pdf';
import type {Trade,TradingAccount} from '../src/types/trading';

const accountId='11111111-1111-4111-8111-111111111111';
const account:TradingAccount={id:accountId,name:'Account A',currency:'USD',initialBalance:'10000',breakEvenBand:'0',sourceSheet:null,baselineBreakEven:false,riskMetric:'planned',createdAt:'2026-10-01'};
function trade(sequence:number,date:string,pnl:string):Trade{return {id:String(sequence),accountId,sequence,date,pnl,symbol:'EUR/USD',riskPercent:null,rewardRisk:null,duration:null,notes:'',feelings:'',evidenceUrl:'',evidencePath:'',strategy:'Breakout',setupGrade:'A+',mindset:'fear',direction:'',session:'',tags:'',sourceRow:null,version:1};}

describe('trade review additions',()=>{
 it('defaults from local calendar fields without converting through UTC',()=>{
  expect(localTradeDate(new Date(2026,9,21,0,5))).toBe('2026-10-21');
  expect(localTradeDate(new Date(2026,9,21,23,55))).toBe('2026-10-21');
 });
 it('validates saved date, grade, mindset and optional note without changing a past date',()=>{
  const parsed=tradeSchema.parse({accountId,date:'2026-10-17',setupGrade:'B+',mindset:'fear',feelings:'Entered too early.'});
  expect(parsed).toMatchObject({date:'2026-10-17',setupGrade:'B+',mindset:'fear',feelings:'Entered too early.'});
  expect(tradeSchema.safeParse({accountId,date:'2026-10-17',setupGrade:'C'}).success).toBe(false);
  expect(tradeSchema.safeParse({accountId,date:'2026-10-17',mindset:'revenge'}).success).toBe(false);
 });
 it('moves a changed Trade Date to the correct calendar day',()=>{
  const record=trade(1,'2026-10-21','25');
  expect(aggregateCalendarDays([record]).has('2026-10-21')).toBe(true);
  expect(aggregateCalendarDays([{...record,date:'2026-10-18'}]).has('2026-10-18')).toBe(true);
 });
 it('rejects MIME spoofing and oversized image policy inputs',()=>{
  const png=new Uint8Array([137,80,78,71,13,10,26,10,1]);
  expect(evidenceExtension('image/png',png)).toBe('png');
  expect(evidenceExtension('image/jpeg',png)).toBeNull();
  expect(MAX_EVIDENCE_BYTES).toBe(4*1024*1024);
 });
 it('generates a real multipage vector PDF with a long journal',async()=>{
  const trades=Array.from({length:80},(_,i)=>trade(i+1,'2026-10-18',String(i%2?'-25':'50')));
  const pdf=await generateReportPdf({account,trades,month:'2026-10',language:'en',generatedAt:new Date('2026-10-21T12:00:00Z')});
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBeGreaterThan(4);
 });
 it('generates all four report sections for an empty Spanish account',async()=>{
  const pdf=await generateReportPdf({account,trades:[],month:'2026-10',language:'es'});
  expect(pdf.subarray(0,5).toString()).toBe('%PDF-');
  expect((pdf.toString('latin1').match(/\/Type \/Page\b/g)||[]).length).toBe(4);
 });
});
