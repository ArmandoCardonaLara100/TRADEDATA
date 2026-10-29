import 'server-only';

import {classify} from '@/lib/analytics/journal';
import {evidencePathForSlot,EVIDENCE_SLOTS} from '@/lib/evidence';
import {supabaseAdmin} from '@/lib/server/supabase-admin';
import {hashShareToken,SHARE_TOKEN_PATTERN} from '@/lib/server/share-token';
import type {SharedTrade} from '@/types/shared-trade';

type SharedLookup={trade:SharedTrade;paths:[string,string,string,string]};

/**
 * Server-only capability lookup. The returned shape is an explicit public
 * allowlist and never contains owner, account, trade, or Storage identifiers.
 */
export async function getSharedTrade(token:string):Promise<SharedLookup|null>{
 if(!SHARE_TOKEN_PATTERN.test(token))return null;
 const db=supabaseAdmin(),hash=hashShareToken(token);
 const share=await db.from('trade_shares').select('trade_id').eq('token_hash',hash).eq('enabled',true).maybeSingle();
 if(share.error)throw share.error;if(!share.data)return null;
 const result=await db.from('trades').select('accountId,sequence,date,symbol,riskPercent,rewardRisk,duration,pnl,notes,feelings,strategy,setupGrade,mindset,direction,session,evidencePath,additionalEvidencePaths').eq('id',share.data.trade_id).maybeSingle();
 if(result.error)throw result.error;if(!result.data)return null;
 const account=await db.from('trading_accounts').select('currency,breakEvenBand').eq('id',result.data.accountId).maybeSingle();
 if(account.error)throw account.error;if(!account.data)return null;
 const row=result.data,paths=Array.from({length:EVIDENCE_SLOTS},(_,index)=>evidencePathForSlot(row,index+1)) as [string,string,string,string];
 return {paths,trade:{
  sequence:row.sequence,date:row.date,symbol:row.symbol,riskPercent:row.riskPercent===null?null:String(row.riskPercent),rewardRisk:row.rewardRisk===null?null:String(row.rewardRisk),duration:row.duration===null?null:Number(row.duration),pnl:row.pnl===null?null:String(row.pnl),notes:row.notes,feelings:row.feelings,strategy:row.strategy,setupGrade:row.setupGrade as SharedTrade['setupGrade'],mindset:row.mindset as SharedTrade['mindset'],direction:row.direction as SharedTrade['direction'],session:row.session,currency:account.data.currency,outcome:classify(row.pnl===null?null:String(row.pnl),String(account.data.breakEvenBand)),evidence:paths.map(Boolean) as [boolean,boolean,boolean,boolean],
 }};
}

export async function getSharedEvidence(token:string,slot:number){
 if(!Number.isInteger(slot)||slot<1||slot>EVIDENCE_SLOTS)return null;
 const shared=await getSharedTrade(token),path=shared?.paths[slot-1];
 if(!path)return null;
 const {data,error}=await supabaseAdmin().storage.from('trade-evidence').download(path);
 if(error||!data)return null;
 return data;
}
