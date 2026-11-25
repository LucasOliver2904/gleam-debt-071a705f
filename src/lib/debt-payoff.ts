import { currentMonth, monthSummary, type Debt, type State } from "./finance";
import { hasIncomeInformation } from "./planning";

export function openInstallments(debt: Debt) {
  if (debt.type === "fixa") return [];
  return Object.entries(debt.payments)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([month, payment], index) => {
      const cents = Math.round(payment.amount * 100);
      return !payment.paid && Number.isSafeInteger(cents) && cents > 0
        ? [{ month, number: index + 1, cents }]
        : [];
    });
}

/** The quote replaces exactly the selected payments. Existing records are read only. */
export function simulatePayoff(
  state: State,
  debtId: string,
  months: ReadonlySet<string>,
  quoteCents: number,
  paymentMonth = currentMonth(),
) {
  const debt = state.debts.find((item) => item.id === debtId);
  if (!debt || !months.size || !Number.isSafeInteger(quoteCents) || quoteCents < 0) return null;
  const selected = openInstallments(debt).filter((item) => months.has(item.month));
  if (selected.length !== months.size) return null;
  const scheduledCents = selected.reduce((total, item) => total + item.cents, 0);
  if (!Number.isSafeInteger(scheduledCents)) return null;

  // Older unpaid installments count toward the offer, but the monthly forecast
  // already assigned them to their original months. Never credit them again today.
  const releasedByMonth = new Map([[paymentMonth, 0]]);
  for (const item of selected) {
    if (item.month >= paymentMonth) releasedByMonth.set(item.month, item.cents);
  }
  const rows = Array.from(releasedByMonth, ([month, releasedCents]) => {
    const changeCents = releasedCents - (month === paymentMonth ? quoteCents : 0);
    const beforeCents = hasIncomeInformation(state, month)
      ? Math.round(monthSummary(state, month).balance * 100)
      : null;
    return {
      month,
      changeCents,
      beforeCents,
      afterCents: beforeCents === null ? null : beforeCents + changeCents,
    };
  });
  return { scheduledCents, savingsCents: scheduledCents - quoteCents, rows };
}
