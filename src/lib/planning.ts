import { addMonths, monthSummary, type Debt, type Payment, type State } from "./finance";

const pad = (n: number) => String(n).padStart(2, "0");

export function localDayKey(date: Date) {
  return [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join("-");
}

export function dueDate(month: string, day?: number) {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index || index < 1 || index > 12) throw new Error("Mês inválido");
  const last = new Date(year, index, 0).getDate();
  const due = day && Number.isInteger(day) ? Math.min(Math.max(1, day), last) : last;
  return new Date(year, index - 1, due);
}

export type MonthBill = {
  debt: Debt;
  payment: Payment;
  month: string;
  date: Date;
  dateKey: string;
  day: number;
  daysUntil: number;
};

export function monthBills(s: State, month: string, today = new Date()): MonthBill[] {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const list: MonthBill[] = [];
  for (const debt of s.debts) {
    const payment = debt.payments[month];
    if (!payment) continue;
    const date = dueDate(month, debt.due);
    const dateKey = localDayKey(date);
    const daysUntil = Math.round(
      (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - todayUtc) / 86400000,
    );
    list.push({ debt, payment, month, date, dateKey, day: date.getDate(), daysUntil });
  }
  return list.sort((a, b) => a.day - b.day || a.debt.name.localeCompare(b.debt.name, "pt-BR"));
}

export type CalendarDay = {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
};

export function calendarDays(month: string, today = new Date()): CalendarDay[] {
  const [year, index] = month.split("-").map(Number);
  if (!year || !index || index < 1 || index > 12) return [];
  const start = new Date(year, index - 1, 1);
  const offset = (start.getDay() + 6) % 7;
  const todayKey = localDayKey(today);
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(year, index - 1, i + 1 - offset);
    const key = localDayKey(date);
    return { key, day: date.getDate(), inMonth: date.getMonth() === index - 1, isToday: key === todayKey };
  });
}

export function categorySpending(s: State, month: string) {
  const totals = new Map<string, number>();
  for (const debt of s.debts) {
    const payment = debt.payments[month];
    if (!payment) continue;
    const name = debt.category ?? "Outros";
    totals.set(name, (totals.get(name) ?? 0) + payment.amount);
  }
  for (const tx of s.txs) {
    if (tx.kind !== "saida" || tx.excludedFromTotals || !tx.date.startsWith(month)) continue;
    const name = tx.category ?? "Outros";
    totals.set(name, (totals.get(name) ?? 0) + tx.amount);
  }
  return totals;
}

export type BudgetRow = {
  category: string;
  budget: number;
  spent: number;
  remaining: number;
  percentage: number;
};

export function budgetRows(s: State, month: string): BudgetRow[] {
  const spending = categorySpending(s, month);
  const limits = s.budgets?.[month] ?? {};
  const categories = new Set([...spending.keys(), ...Object.keys(limits)]);
  return [...categories].map((category) => {
    const budget = Math.max(0, limits[category] ?? 0);
    const spent = spending.get(category) ?? 0;
    return {
      category,
      budget,
      spent,
      remaining: budget - spent,
      percentage: budget > 0 ? Math.round((spent / budget) * 100) : 0,
    };
  }).sort((a, b) => (b.budget > 0 ? 1 : 0) - (a.budget > 0 ? 1 : 0) || b.spent - a.spent);
}

export function projection(s: State, start: string, count = 6) {
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(start, i);
    const summary = monthSummary(s, month);
    return { month, ...summary };
  });
}

export type PurchaseSimulationInput = {
  total: number;
  installments: number;
  firstMonth: string;
};

export type PurchaseSimulationRow = {
  month: string;
  installment: number;
  incomeKnown: boolean;
  current: ReturnType<typeof monthSummary>;
  withPurchase: ReturnType<typeof monthSummary>;
};

export function splitInstallments(total: number, installments: number) {
  if (!Number.isFinite(total) || total <= 0 || total > 1e10) {
    throw new Error("Informe um valor total maior que zero e dentro do limite permitido.");
  }
  if (!Number.isInteger(installments) || installments < 1 || installments > 36) {
    throw new Error("Escolha entre 1 e 36 parcelas.");
  }
  const totalCents = Math.round(total * 100);
  if (totalCents < 1) throw new Error("Informe um valor total de pelo menos um centavo.");
  if (totalCents < installments) throw new Error("Cada parcela precisa valer pelo menos um centavo.");
  const base = Math.floor(totalCents / installments);
  const extraCents = totalCents % installments;
  return Array.from({ length: installments }, (_, index) =>
    (base + (index < extraCents ? 1 : 0)) / 100,
  );
}

export function hasIncomeInformation(s: State, month: string) {
  return Object.hasOwn(s.income, month) || s.txs.some(
    (tx) => tx.kind === "entrada" && tx.date.startsWith(month),
  );
}

/** Cria uma cópia somente em memória: nenhuma conta ou lançamento real é alterado. */
export function simulatePurchase(s: State, input: PurchaseSimulationInput) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.firstMonth) || Number(input.firstMonth.slice(0, 4)) < 1000) {
    throw new Error("Escolha um primeiro mês válido.");
  }
  const amounts = splitInstallments(input.total, input.installments);
  const payments = Object.fromEntries(amounts.map((amount, index) => [
    addMonths(input.firstMonth, index),
    { amount, paid: false },
  ]));
  const temporaryDebt: Debt = {
    id: "__simulacao_cabe_no_meu_mes__",
    name: "Simulação temporária",
    type: "parcelada",
    payments,
  };
  const currentRows = projection(s, input.firstMonth, input.installments);
  const purchaseRows = projection({ ...s, debts: [...s.debts, temporaryDebt] }, input.firstMonth, input.installments);
  const rows: PurchaseSimulationRow[] = currentRows.map((current, index) => ({
    month: current.month,
    installment: amounts[index]!,
    incomeKnown: hasIncomeInformation(s, current.month),
    current,
    withPurchase: purchaseRows[index]!,
  }));
  const knownRows = rows.filter(row => row.incomeKnown);
  const tightest = knownRows.reduce<PurchaseSimulationRow | null>(
    (lowest, row) => !lowest || row.withPurchase.balance < lowest.withPurchase.balance ? row : lowest,
    null,
  );
  const firstShortage = knownRows.find(row => row.withPurchase.balance < 0) ?? null;
  const missingIncomeMonths = rows.filter((row) => !row.incomeKnown).map((row) => row.month);
  return { amounts, rows, tightest, firstShortage, missingIncomeMonths };
}

function csvCell(value: string | number) {
  const v = String(value);
  // Never interpret a user-supplied description as a formula in spreadsheet software.
  const safe = /^[\s]*[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return '"' + safe.replace(/"/g, '""') + '"';
}

export function financeCsv(s: State, month: string) {
  const rows: (string | number)[][] = [
    ["Data", "Origem", "Descrição", "Categoria", "Tipo", "Status", "Valor próprio (R$)", "Pix bruto (R$)", "Repasse Pix (R$)", "Situação do repasse"],
  ];
  for (const bill of monthBills(s, month)) {
    rows.push([
      bill.dateKey, "Conta", bill.debt.name, bill.debt.category ?? "Outros",
      bill.debt.type, bill.payment.paid ? "Pago" : "Pendente", bill.payment.amount.toFixed(2).replace(".", ","), "", "", "",
    ]);
  }
  for (const tx of s.txs.filter((tx) => tx.date.startsWith(month))) {
    rows.push([
      tx.date, "Lançamento", tx.description, tx.category ?? "Outros",
      tx.kind === "entrada" ? "Entrada" : "Saída", tx.excludedFromTotals ? "Na fatura / não somado" : "Registrado", tx.amount.toFixed(2).replace(".", ","),
      tx.pix ? tx.pix.gross.toFixed(2).replace(".", ",") : "",
      tx.pix ? Math.max(0, tx.pix.gross - tx.pix.kept).toFixed(2).replace(".", ",") : "",
      tx.pix?.status ?? "",
    ]);
  }
  return "\uFEFF" + rows.map((row) => row.map(csvCell).join(";")).join("\r\n");
}
