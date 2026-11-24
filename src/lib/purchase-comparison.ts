import { addMonths, monthSummary, type State } from "@/lib/finance";

export function comparePurchase(state: State, start: string, cash: number, financed: number, count: number) {
  const cents = Math.round(financed * 100);
  const cashCents = Math.round(cash * 100);
  if (!Number.isSafeInteger(cents) || !Number.isSafeInteger(cashCents) ||
      !Number.isInteger(count) || count < 1 || count > 36 || cents < count || cashCents <= 0 ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(start)) return null;
  const rows = Array.from({length: count}, (_, i) => {
    const month = addMonths(start, i);
    const summary = monthSummary(state, month);
    const base = Math.round(summary.balance * 100);
    const installment = Math.floor(cents / count) + (i < cents % count ? 1 : 0);
    return {month, incomeKnown: Object.prototype.hasOwnProperty.call(state.income, month) || summary.income > 0,
      base, installment, cash: base - (i === 0 ? cashCents : 0), financed: base - installment};
  });
  return { rows, difference: cents - cashCents };
}
