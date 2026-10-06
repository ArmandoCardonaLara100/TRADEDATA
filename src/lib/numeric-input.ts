import {D} from './calculations/decimal';

/** Formats an editable decimal without padding or binary floating-point noise. */
export function numericInputValue(value:string|number|null|undefined,scale=1){
 if(value===null||value===undefined||value===''||(typeof value==='number'&&!Number.isFinite(value)))return '';
 try {
  const result=new D(value).times(scale);
  return result.isFinite()?(result.isZero()?'0':result.toFixed()):'';
 } catch {
  return '';
 }
}

export function numericInputNumber(value:string,scale=1){
 if(value.trim()===''||value==='-'||value==='.'||value==='-.')return Number.NaN;
 try {return new D(value).div(scale).toNumber();} catch {return Number.NaN;}
}
