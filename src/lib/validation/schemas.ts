import { z } from 'zod';
const decimal = (min:number,max:number)=>z.union([z.string().trim().min(1).regex(/^-?\d+(\.\d{1,8})?$/,'Use a number with up to 8 decimal places.'),z.number().finite()]).transform(String).refine(v=>Number.isFinite(Number(v))&&Number(v)>=min&&Number(v)<=max,`Must be between ${min} and ${max}.`);
const nullableDecimal=(min:number,max:number)=>z.preprocess(v=>v===''||v===undefined?null:v,decimal(min,max).nullable());
const optionalText=(max:number)=>z.string().trim().max(max).default('');
const evidenceLink=z.union([z.literal(''),z.url().max(2048).refine(v=>['https:','http:'].includes(new URL(v).protocol),'Use an HTTP or HTTPS link.')]);
const accountRuleSchema=z.object({
 phaseNumber:z.number().int().min(1).max(20).nullable(),
 profitTarget:decimal(0.01,100),maxLossLimit:decimal(0.01,100),dailyLossLimit:decimal(0.01,100),
 drawdownType:z.enum(['static','trailing']),
}).refine(rule=>Number(rule.dailyLossLimit)<=Number(rule.maxLossLimit),{path:['dailyLossLimit'],message:'Daily loss cannot exceed the maximum loss limit.'});
export const accountIdentitySchema=z.object({
 name:z.string().trim().min(1).max(80),currency:z.enum(['USD','EUR','GBP','MXN']).default('USD'),
 initialBalance:decimal(0.01,1e12),breakEvenBand:decimal(0,1e9).default('15'),
});
export const accountSchema=accountIdentitySchema.extend({
 accountType:z.enum(['challenge','funded','own_capital','demo']),
 currentPhase:z.number().int().min(1).max(20).nullable().default(null),rules:z.array(accountRuleSchema).max(20).default([]),
}).superRefine((account,context)=>{
 if(account.accountType==='challenge'){
  if(!account.rules.length)context.addIssue({code:'custom',path:['rules'],message:'Add at least one challenge phase.'});
  if(account.currentPhase===null||account.currentPhase>account.rules.length)context.addIssue({code:'custom',path:['currentPhase'],message:'Choose a valid current phase.'});
  account.rules.forEach((rule,index)=>{if(rule.phaseNumber!==index+1)context.addIssue({code:'custom',path:['rules',index,'phaseNumber'],message:'Challenge phases must be sequential.'});});
 }else if(account.accountType==='funded'){
  if(account.rules.length!==1||account.rules[0]?.phaseNumber!==null)context.addIssue({code:'custom',path:['rules'],message:'Funded accounts require one rule set.'});
  if(account.currentPhase!==null)context.addIssue({code:'custom',path:['currentPhase'],message:'Funded accounts do not have challenge phases.'});
 }else if(account.rules.length||account.currentPhase!==null)context.addIssue({code:'custom',path:['rules'],message:'Rules do not apply to this account type.'});
});
export const tradeSchema=z.object({
 accountId:z.string().uuid(),sequence:z.number().int().min(1).max(1e7).optional(),
 date:z.preprocess(v=>v===''||v===undefined?null:v,z.iso.date().nullable()),
 tradeTime:z.preprocess(v=>v===''||v===undefined?null:v,z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/).nullable()),
 symbol:optionalText(30),riskPercent:nullableDecimal(0,1),rewardRisk:nullableDecimal(0,1000),
 duration:z.preprocess(v=>v===''||v===undefined?null:v,z.coerce.number().min(0).max(1e7).nullable()),
 grossPnl:nullableDecimal(-1e12,1e12),pnl:nullableDecimal(-1e12,1e12).optional(),commission:z.preprocess(v=>v===''||v===undefined?0:v,decimal(-1e12,1e12)).transform(value=>{const absolute=value.startsWith('-')?value.slice(1):value;return /^0(?:\.0+)?$/.test(absolute)?'0':`-${absolute}`;}),notes:optionalText(10000),feelings:optionalText(5000),
 evidenceUrl:evidenceLink.default(''),additionalEvidenceUrls:z.array(evidenceLink).max(3).optional(),
 strategy:optionalText(80),setupGrade:z.enum(['','A+','A','B+','B']).default(''),
 mindset:z.enum(['','euphoria','trust','neutral','fear','fomo','anxiety']).default(''),
 direction:z.enum(['long','short','']).default(''),session:optionalText(40),tags:optionalText(250),version:z.number().int().positive().optional(),
});
export const simulationSchema=z.object({winProbability:z.number().min(0).max(1),rewardRisk:z.number().positive().max(100),riskPercent:z.number().min(.000001).max(1),target:z.number().positive().max(10),maxDrawdown:z.number().positive().max(1),accounts:z.number().int().min(1).max(1000),trades:z.number().int().min(1).max(2000),trailing:z.boolean(),seed:z.number().int().min(0).max(4294967295),initialBalance:z.number().positive().max(1e12)});
export const bankrollSchema=z.object({accountSize:z.number().positive().max(1e12),accounts:z.number().int().min(0).max(100000),accountCost:z.number().min(0).max(1e9),withdrawals:z.number().int().min(0).max(10000),withdrawalAmount:z.number().min(0).max(1e9),passRate:z.number().min(0).max(1)});
export const scenarioSchema=z.discriminatedUnion('kind',[
 z.object({name:z.string().trim().min(1).max(80),kind:z.literal('simulation'),input:simulationSchema}),
 z.object({name:z.string().trim().min(1).max(80),kind:z.literal('bankroll'),input:bankrollSchema}),
]);
export const reviewSubmissionSchema=z.object({reviewText:z.string().trim().min(3,'Write at least 3 characters.').max(1600,'Keep your review under 1,600 characters.')});
export const reviewModerationSchema=z.object({action:z.enum(['approve','reject'])});
