import { round2, type State } from "./finance";
import { dueDate, localDayKey } from "./planning";

export type ReportFilter = { category?: string; from?: string; to?: string };
export type ReportEntry = { id: string; date: string; category: string; name: string; amount: number; paid: boolean; source: "Conta" | "Lançamento" };

export function categoryReport(state: State, filter: ReportFilter = {}) {
  const entries: ReportEntry[] = [];
  function include(entry: ReportEntry) {
    if (filter.category && entry.category !== filter.category) return;
    if (filter.from && entry.date < filter.from) return;
    if (filter.to && entry.date > filter.to) return;
    entries.push(entry);
  }
  if (filter.from && filter.to && filter.from > filter.to)
    return { entries, paid: 0, pending: 0, total: 0, groups: [] as { category: string; paid: number; pending: number }[] };
  for (const debt of state.debts) {
    for (const [month, payment] of Object.entries(debt.payments)) {
      include({ id: debt.id + ":" + month, date: localDayKey(dueDate(month, debt.due)), category: debt.category || "Outros", name: debt.name, amount: payment.amount, paid: payment.paid, source: "Conta" });
    }
  }
  for (const tx of state.txs) {
    if (tx.kind !== "saida" || tx.excludedFromTotals) continue;
    include({ id: "tx:" + tx.id, date: tx.date, category: tx.category || "Outros", name: tx.description, amount: tx.amount, paid: true, source: "Lançamento" });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, "pt-BR"));
  const groups = new Map<string, { category: string; paid: number; pending: number }>();
  let paid = 0, pending = 0;
  for (const entry of entries) {
    const group = groups.get(entry.category) ?? { category: entry.category, paid: 0, pending: 0 };
    if (entry.paid) { paid = round2(paid + entry.amount); group.paid = round2(group.paid + entry.amount); }
    else { pending = round2(pending + entry.amount); group.pending = round2(group.pending + entry.amount); }
    groups.set(entry.category, group);
  }
  return { entries, paid, pending, total: round2(paid + pending), groups: [...groups.values()].sort((a, b) => b.paid + b.pending - a.paid - a.pending || a.category.localeCompare(b.category, "pt-BR")) };
}

export function categoryReportCsv(entries: ReportEntry[]) {
  const cell = (value: string) => '"' + (/^[\s]*[=+\-@\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""') + '"';
  return "\uFEFF" + [
    ["Data (vencimento para contas)", "Categoria", "Descrição", "Origem", "Situação", "Valor (R$)"],
    ...entries.map((e) => [e.date, e.category, e.name, e.source, e.paid ? "Pago" : "Pendente", e.amount.toFixed(2).replace(".", ",")]),
  ].map((row) => row.map(cell).join(";")).join("\r\n");
}
