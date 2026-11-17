import { type State } from "./finance";
import { upcomingBills, type UpcomingBill } from "./reminders";

/**
 * O painel privilegia contas atrasadas mais recentes e, em seguida, os
 * próximos vencimentos. Não altera status de pagamento nem contabilização.
 */
export function dashboardBills(state: State, today = new Date(), limit = 5): UpcomingBill[] {
  const bills = upcomingBills(state, 45, today);
  const overdue = bills.filter((bill) => bill.daysUntil < 0)
    .sort((a, b) => b.daysUntil - a.daysUntil || a.debt.name.localeCompare(b.debt.name, "pt-BR"));
  const upcoming = bills.filter((bill) => bill.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.debt.name.localeCompare(b.debt.name, "pt-BR"));
  return [...overdue, ...upcoming].slice(0, Math.max(0, limit));
}

export function dueDescription(daysUntil: number): string {
  if (daysUntil < 0) return `Atrasada há ${Math.abs(daysUntil)} ${daysUntil === -1 ? "dia" : "dias"}`;
  if (daysUntil === 0) return "Vence hoje";
  if (daysUntil === 1) return "Vence amanhã";
  return `Vence em ${daysUntil} dias`;
}
