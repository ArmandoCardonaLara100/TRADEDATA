import type {Outcome} from './trading';

export interface SharedTrade {
 sequence:number;
 date:string|null;
 symbol:string;
 riskPercent:string|null;
 rewardRisk:string|null;
 duration:number|null;
 pnl:string|null;
 notes:string;
 feelings:string;
 strategy:string;
 setupGrade:''|'A+'|'A'|'B+'|'B';
 mindset:''|'euphoria'|'trust'|'neutral'|'fear'|'fomo'|'anxiety';
 direction:'long'|'short'|'';
 session:string;
 currency:string;
 outcome:Outcome;
 evidence:[boolean,boolean,boolean,boolean];
}
