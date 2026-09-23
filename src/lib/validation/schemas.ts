import { z } from 'zod';
const decimal = (min:number,max:number)=>z.union([z.string().trim().min(1).regex(/^-?\d+(\.\d{1,8})?$/,'Use a number with up to 8 decimal places.'),z.number().finite()]).transform(String).refine(v=>Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max,`Must be between ${min} and ${max}.`);
const nullableDecimal=(min:number,max:number)=>z.preprocess(v=>v===''||v===undefined?null:v,decimal(min,max).nullable());
const optionalText=(max:number)=>z.string().trim().max(max).default('');
export const accountSchema=z.object({name:z.string().trim().min(1).max(80),currency:z.enum(['USD','EUR','GBP','MXN']).default('USD'),initialBalance:decimal(0.01,1e12),breakEvenBand:decimal(0,1e9).default('15')});
export const tradeSchema=z.object({
 accountId:z.string().uuid(),sequence:z.number().int().min(1).max(1e7).optional(),
 date:z.preprocess(v=>v===''||v===undefined?null:v,z.iso.date().nullable()),
 symbol:optionalText(30),riskPercent:nullableDecimal(0,1),rewardRisk:nullableDecimal(0,1000),
 duration:z.preprocess(v=>v===''||v===undefined?null:v,z.coerce.number().min(0).max(1e7).nullable()),
 pnl:nullableDecimal(-1e12,1e12),notes:optionalText(10000),feelings:optionalText(5000),
 evidenceUrl:z.union([z.literal(''),z.url().refine(v=>new URL(v).protocol==='https:','Use an HTTPS link.')]).default(''),
 strategy:optionalText(80),direction:z.enum(['long','short','']).default(''),session:optionalText(40),tags:optionalText(250),version:z.number().int().positive().optional(),
});
export const simulationSchema=z.object({winProbability:z.number().min(0).max(1),rewardRisk:z.number().positive().max(100),riskPercent:z.number().min(.000001).max(1),target:z.number().positive().max(10),maxDrawdown:z.number().positive().max(1),accounts:z.number().int().min(1).max(1000),trades:z.number().int().min(1).max(2000),trailing:z.boolean(),seed:z.number().int().min(0).max(4294967295),initialBalance:z.number().positive().max(1e12)});
export const bankrollSchema=z.object({accountSize:z.number().positive().max(1e12),accounts:z.number().int().min(0).max(100000),accountCost:z.number().min(0).max(1e9),withdrawals:z.number().int().min(0).max(10000),withdrawalAmount:z.number().min(0).max(1e9),passRate:z.number().min(0).max(1)});
export const scenarioSchema=z.discriminatedUnion('kind',[
 z.object({name:z.string().trim().min(1).max(80),kind:z.literal('simulation'),input:simulationSchema}),
 z.object({name:z.string().trim().min(1).max(80),kind:z.literal('bankroll'),input:bankrollSchema}),
]);
