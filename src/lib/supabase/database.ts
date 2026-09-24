import type {Database as Generated} from './types';
type Account=Generated['public']['Tables']['trading_accounts'];
type DecimalInputs<T>={[K in keyof T]:K extends 'initialBalance'|'breakEvenBand'?T[K]|string:T[K]};
// Postgres accepts exact numeric strings. Generated types describe JSON numbers;
// widen only numeric writes so values are never rounded through JS Number.
export type Database=Omit<Generated,'public'>&{public:Omit<Generated['public'],'Tables'>&{
 Tables:Omit<Generated['public']['Tables'],'trading_accounts'>&{
  trading_accounts:Omit<Account,'Insert'|'Update'>&{
   Insert:DecimalInputs<Account['Insert']>;
   Update:DecimalInputs<Account['Update']>;
  };
 };
}};
