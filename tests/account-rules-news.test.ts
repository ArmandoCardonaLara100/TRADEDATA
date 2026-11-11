import {describe,expect,it} from 'vitest';
import {accountSchema} from '../src/lib/validation/schemas';
import {normalizeMarketNewsArticle} from '../src/lib/server/market-news';

const base={name:'Evaluation',currency:'USD',initialBalance:'100000',breakEvenBand:'0'};
const phase=(phaseNumber:number,profitTarget:string)=>({phaseNumber,profitTarget,maxLossLimit:'10',dailyLossLimit:'5',drawdownType:'static' as const});

describe('trading account rules',()=>{
 it('keeps every challenge phase independent and sequential',()=>{
  const parsed=accountSchema.parse({...base,accountType:'challenge',currentPhase:2,rules:[phase(1,'8'),phase(2,'5'),phase(3,'4')]});
  expect(parsed.rules.map(rule=>rule.profitTarget)).toEqual(['8','5','4']);
  expect(accountSchema.safeParse({...base,accountType:'challenge',currentPhase:2,rules:[phase(1,'8'),phase(3,'5')]}).success).toBe(false);
 });
 it('requires one funded rule set and no challenge rules for own capital or demo',()=>{
  expect(accountSchema.safeParse({...base,accountType:'funded',currentPhase:null,rules:[{...phase(1,'6'),phaseNumber:null}]}).success).toBe(true);
  expect(accountSchema.safeParse({...base,accountType:'funded',currentPhase:null,rules:[]}).success).toBe(false);
  for(const accountType of ['own_capital','demo'] as const)expect(accountSchema.safeParse({...base,accountType,currentPhase:null,rules:[]}).success).toBe(true);
 });
 it('rejects invalid percentages and a daily loss above the maximum loss',()=>{
  expect(accountSchema.safeParse({...base,accountType:'challenge',currentPhase:1,rules:[{...phase(1,'101')}]}).success).toBe(false);
  expect(accountSchema.safeParse({...base,accountType:'challenge',currentPhase:1,rules:[{...phase(1,'8'),maxLossLimit:'4'}]}).success).toBe(false);
 });
});

describe('FMP market-news normalization',()=>{
 it('normalizes the documented FMP Articles response without rendering HTML',()=>{
  const article=normalizeMarketNewsArticle({title:'Market structure update',date:'2026-11-02 14:00:00',content:'<ul><li><strong>Risk</strong> remains elevated.</li></ul>',tickers:'NYSE:TEST, NASDAQ:DATA',image:'https://portal.financialmodelingprep.com/positions/sample.jpeg',link:'https://financialmodelingprep.com/market-news/sample',author:'FMP Research',site:'Financial Modeling Prep'},'latest');
  expect(article).toMatchObject({title:'Market structure update',publishedAt:'2026-11-02T14:00:00.000Z',description:'Risk remains elevated.',tickers:['TEST','DATA'],source:'Financial Modeling Prep'});
 });
 it('normalizes category feeds and drops unsafe or incomplete records',()=>{
  const article=normalizeMarketNewsArticle({symbol:'EURUSD',publishedDate:'2026-11-02 01:30:00',publisher:'FX Source',title:'Dollar update',image:'https://images.financialmodelingprep.com/news/dollar.jpg',site:'example.com',text:'Summary',url:'https://example.com/article'},'forex');
  expect(article).toMatchObject({category:'forex',tickers:['EURUSD'],source:'example.com'});
  expect(normalizeMarketNewsArticle({title:'Missing URL',publishedDate:'2026-11-02'},'stocks')).toBeNull();
  expect(normalizeMarketNewsArticle({title:'Unsafe',publishedDate:'2026-11-02',url:'javascript:alert(1)'},'stocks')).toBeNull();
  expect(normalizeMarketNewsArticle({title:'Safe article',publishedDate:'2026-11-02',url:'https://example.com',image:'https://tracker.example.com/pixel'},'stocks')?.imageUrl).toBeNull();
 });
});
