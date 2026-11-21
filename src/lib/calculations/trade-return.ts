import {D} from './decimal';

/** Signed operation result as a percentage of the account's initial capital. */
export function tradeResultPercent(netResult:string|number|null|undefined,initialCapital:string|number|null|undefined):string|null {
 if(netResult===null||netResult===undefined||initialCapital===null||initialCapital===undefined)return null;
 try{
  const result=new D(netResult),capital=new D(initialCapital);
  if(!result.isFinite()||!capital.isFinite()||capital.lte(0))return null;
  return result.div(capital).times(100).toString();
 }catch{return null;}
}
