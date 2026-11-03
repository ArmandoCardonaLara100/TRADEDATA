import {describe,expect,it} from 'vitest';
import {accountSchema} from '../src/lib/validation/schemas';
import {dateInTimeZone,normalizeEconomicEvent} from '../src/lib/server/economic-calendar';

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

describe('economic calendar normalization',()=>{
 it('allows only high-impact provider events and never invents an Actual value',()=>{
  const event=normalizeEconomicEvent({CalendarId:'397194',Date:'2026-11-02T14:00:00',Country:'United States',Category:'Business Confidence',Event:'ISM Manufacturing PMI',Actual:'',Previous:'54.5',Forecast:'54.2',Importance:3,Currency:''});
  expect(event).toMatchObject({id:'397194',dateUtc:'2026-11-02T14:00:00.000Z',currency:'USD',impact:3,actual:null,previous:'54.5',forecast:'54.2'});
  expect(normalizeEconomicEvent({CalendarId:'1',Date:'2026-11-02T14:00:00',Country:'Canada',Event:'Medium event',Importance:2})).toBeNull();
 });
 it('uses the provider currency when supplied and converts UTC dates by IANA timezone',()=>{
  const event=normalizeEconomicEvent({CalendarId:'2',Date:'2026-11-02T01:30:00Z',Country:'Canada',Event:'Employment Change',Importance:3,Currency:'C$',Actual:'12K'});
  expect(event?.currency).toBe('CAD');
  expect(normalizeEconomicEvent({CalendarId:'3',Date:'2026-11-02T02:30:00Z',Country:'Canada',Event:'Rate Decision',Importance:3,Currency:'$'})?.currency).toBe('CAD');
  expect(dateInTimeZone(event!.dateUtc,'America/Mexico_City')).toBe('2026-11-01');
 });
});
