import { round2, type State } from "./finance";
import { upcomingBills } from "./reminders";

/** Vencimentos de hoje até sete dias à frente; atrasos ficam em outro total. */
export function weeklyOverview(state: State, today = new Date()) {
  const bills = upcomingBills(state, 7, today);
  const upcoming = bills.filter((bill) => bill.daysUntil >= 0);
  const overdue = bills.filter((bill) => bill.daysUntil < 0);
  const sum = (items: typeof bills) =>
    round2(items.reduce((total, bill) => total + bill.amount, 0));

  return {
    upcomingCount: upcoming.length,
    upcomingAmount: sum(upcoming),
    overdueCount: overdue.length,
    overdueAmount: sum(overdue),
  };
}
