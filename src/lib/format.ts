export const money=(value:number|null,currency='USD')=>value===null?'—':new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
export const percent=(value:number|null,digits=2)=>value===null?'—':`${new Intl.NumberFormat('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits}).format(value)}%`;
export const number=(value:number|null,digits=2)=>value===null?'—':new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(value);
export const signedMoney=(value:number,currency='USD')=>`${value>0?'+':''}${money(value,currency)}`;
