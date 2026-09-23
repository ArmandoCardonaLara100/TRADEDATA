import Decimal from 'decimal.js';
export const D = Decimal.clone({ precision: 32, rounding: Decimal.ROUND_HALF_UP });
export const sum = (values: (number | string)[]) => values.reduce<Decimal>((a,b) => a.plus(b), new D(0));
export const mean = (values: (number | string)[]) => values.length ? sum(values).div(values.length).toNumber() : null;
export const ratio = (a: number | string, b: number | string) => new D(b).isZero() ? null : new D(a).div(b).toNumber();
