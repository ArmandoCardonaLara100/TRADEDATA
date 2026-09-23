import { D } from './decimal';
import type { BankrollInput } from '@/types/trading';
export function calculateBankroll(input: BankrollInput){
 const {accounts,accountCost,withdrawals,withdrawalAmount,passRate}=input;
 if([accounts,accountCost,withdrawals,withdrawalAmount,passRate].some(x=>!Number.isFinite(x)||x<0)||!Number.isInteger(accounts)||!Number.isInteger(withdrawals)||passRate>1)throw new Error('Invalid bankroll inputs.');
 const investment=new D(accountCost).times(accounts);
 const funded=new D(accounts).times(passRate).toDecimalPlaces(0).toNumber();
 const net=new D(funded).times(withdrawals).times(withdrawalAmount).minus(investment).toDecimalPlaces(0);
 const payoutPerAccount=new D(withdrawals).times(withdrawalAmount);
 return {investment:investment.toNumber(),funded,net:net.toNumber(),roi:investment.isZero()?null:net.div(investment).toNumber(),realCostPerAccount:funded===0?null:investment.div(funded).toNumber(),total:net.plus(investment).toNumber(),breakEvenFundedAccounts:payoutPerAccount.isZero()?null:investment.div(payoutPerAccount).ceil().toNumber()};
}
