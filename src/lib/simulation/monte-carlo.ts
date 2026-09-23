import { D } from '../calculations/decimal';
import { simulationSchema } from '../validation/schemas';
import type { SimulationInput, SimulationPath, SimulationResult, SimulationStatus } from '@/types/trading';
export const defaultSimulation:SimulationInput={winProbability:.35,rewardRisk:2,riskPercent:.005,target:.08,maxDrawdown:.1,accounts:100,trades:100,trailing:false,seed:20260922,initialBalance:6000};
export function seededRandom(seed:number){let state=seed>>>0;return ()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function classifyPath(value:number,peak:number,input:Pick<SimulationInput,'target'|'trailing'|'maxDrawdown'>):SimulationStatus{
 if(new D(value).gte(input.target))return 'passed';
 const floor=input.trailing?new D(peak).minus(input.maxDrawdown):new D(input.maxDrawdown).negated();
 return new D(value).lte(floor)?'failed':'unresolved';
}
export function simulatePath(input:SimulationInput,random:()=>number):SimulationPath{
 let value=0,peak=0,maxDrawdown=0; const values=[0];let status:SimulationStatus='unresolved';
 const win=new D(input.rewardRisk).times(input.riskPercent),loss=new D(input.riskPercent).negated();
 for(let i=0;i<input.trades;i++){
  if(classifyPath(value,peak,input)!=='unresolved')break;
  value=new D(value).plus(random()<input.winProbability?win:loss).toDecimalPlaces(6).toNumber();
  peak=Math.max(peak,value);maxDrawdown=Math.max(maxDrawdown,new D(peak).minus(value).toNumber());
  values.push(value);status=classifyPath(value,peak,input);
 }
 return {values,status,maxDrawdown};
}
export function runMonteCarlo(raw:SimulationInput,onProgress?:(progress:number)=>void):SimulationResult{
 const input=simulationSchema.parse(raw),random=seededRandom(input.seed),paths:SimulationPath[]=[],endingReturns:number[]=[];
 let passed=0,failed=0,positive=0,maxDrawdown=0,total=new D(0);
 for(let i=0;i<input.accounts;i++){
  const path=simulatePath(input,random),end=path.values.at(-1)!;
  if(i<60)paths.push(path);
  endingReturns.push(end);total=total.plus(end);if(end>0)positive++;
  if(path.status==='passed')passed++;if(path.status==='failed')failed++;
  maxDrawdown=Math.max(maxDrawdown,path.maxDrawdown);
  if(i%25===0)onProgress?.((i+1)/input.accounts);
 }
 endingReturns.sort((a,b)=>a-b);const middle=Math.floor(input.accounts/2);
 return {input,paths,passRate:passed/input.accounts,failRate:failed/input.accounts,unresolvedRate:(input.accounts-passed-failed)/input.accounts,medianReturn:input.accounts%2?endingReturns[middle]:new D(endingReturns[middle-1]).plus(endingReturns[middle]).div(2).toNumber(),meanReturn:total.div(input.accounts).toNumber(),bestReturn:endingReturns.at(-1)!,worstReturn:endingReturns[0],probabilityProfit:positive/input.accounts,maxDrawdown,endingReturns,total:input.accounts};
}
