import { D } from './decimal';
/** Source: Calculators!B5,D5. The multiplier and commission are broker-specific. */
export function eurusd(pips:number,cash:number){
 if(!Number.isFinite(pips)||!Number.isFinite(cash)||pips<=0||cash<0)return null;
 const lots=new D(cash).div(new D(pips).times(100));
 return {lots:lots.toNumber(),cash,total:lots.times(5).plus(cash).toNumber(),fees:lots.times(5).toNumber()};
}
/** Source: Calculators!H5,I5. */
export function xauusd(pips:number,lots:number){
 if(!Number.isFinite(pips)||!Number.isFinite(lots)||pips<0||lots<0)return null;
 const cash=new D(pips).times(100).times(lots),fees=new D(lots).times('3.32');
 return {lots,cash:cash.toNumber(),total:cash.plus(fees).toNumber(),fees:fees.toNumber()};
}
