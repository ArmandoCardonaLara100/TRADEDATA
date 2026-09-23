export type Outcome = 'win' | 'loss' | 'breakeven' | 'open';
export interface Trade {
 id: string; accountId: string; sequence: number; date: string | null;
 symbol: string; riskPercent: string | null; rewardRisk: string | null;
 duration: number | null; pnl: string | null; notes: string; feelings: string;
 evidenceUrl: string; strategy: string; direction: 'long' | 'short' | '';
 session: string; tags: string; sourceRow: number | null; version: number;
}
export interface TradingAccount {
 id: string; name: string; currency: string; initialBalance: string;
 breakEvenBand: string; sourceSheet: string | null; baselineBreakEven: boolean;
 riskMetric: 'planned' | 'average-win'; createdAt: string;
}
export interface SimulationInput {
 winProbability: number; rewardRisk: number; riskPercent: number;
 target: number; maxDrawdown: number; accounts: number; trades: number;
 trailing: boolean; seed: number; initialBalance: number;
}
export type SimulationStatus = 'passed' | 'failed' | 'unresolved';
export interface SimulationPath { values: number[]; status: SimulationStatus; maxDrawdown: number; }
export interface SimulationResult {
 input: SimulationInput; paths: SimulationPath[]; passRate: number; failRate: number;
 unresolvedRate: number; medianReturn: number; meanReturn: number; bestReturn: number;
 worstReturn: number; probabilityProfit: number; maxDrawdown: number;
 endingReturns: number[]; total: number;
}
export interface BankrollInput { accountSize: number; accounts: number; accountCost: number; withdrawals: number; withdrawalAmount: number; passRate: number; }
