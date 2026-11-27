import { addMonths, monthLabel, type Debt, type State, type Tx } from "./finance";
import { dueDate, localDayKey } from "./planning";
import { normalizeStatementText, validStatementDay, type StatementRow } from "./statement-import";

type StatementDebit = Pick<
  StatementRow,
  "date" | "description" | "gross" | "kind" | "excludedFromTotals"
>;
export type BillMatch = {
  debtId: string;
  name: string;
  month: string;
  due: string | null;
  amount: number;
  paid: boolean;
};

export function billDateLabel(bill: BillMatch) {
  return bill.due
    ? "Vencimento em " + bill.due.split("-").reverse().join("/")
    : monthLabel(bill.month, true) + " · sem dia de vencimento";
}

const cents = (value: number) => Math.round(value * 100);
const utcDay = (key: string) => Date.parse(key + "T00:00:00Z") / 86400000;

export function statementBillMatches(row: StatementDebit, debts: readonly Debt[]): BillMatch[] {
  if (
    row.kind !== "saida" ||
    row.excludedFromTotals ||
    !validStatementDay(row.date) ||
    !Number.isFinite(row.gross) ||
    cents(row.gross) <= 0
  )
    return [];
  const month = row.date.slice(0, 7);
  const months = [addMonths(month, -1), month, addMonths(month, 1)];
  const bankDay = utcDay(row.date);
  const words = (text: string) =>
    normalizeStatementText(text)
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  const description = " " + words(row.description) + " ";
  const candidates: { bill: BillMatch; named: boolean; distance: number }[] = [];
  for (const debt of debts) {
    // Uma compra parcelada no cartão é quitada na fatura.
    if (debt.cardId) continue;
    const name = words(debt.name);
    const named = name.length >= 3 && description.includes(" " + name + " ");
    for (const key of months) {
      const payment = debt.payments[key];
      if (!payment || cents(payment.amount) !== cents(row.gross)) continue;
      const due = debt.due ? localDayKey(dueDate(key, debt.due)) : null;
      const distance = due ? Math.abs(utcDay(due) - bankDay) : Infinity;
      if (due ? distance > 7 : key !== month || !named) continue;
      candidates.push({
        bill: { debtId: debt.id, name: debt.name, month: key, due, ...payment },
        named,
        distance,
      });
    }
  }
  return candidates
    .sort(
      (a, b) =>
        Number(b.named) - Number(a.named) ||
        a.distance - b.distance ||
        a.bill.name.localeCompare(b.bill.name, "pt-BR"),
    )
    .map(({ bill }) => bill);
}

export function countedStatementExpense(row: StatementDebit, txs: readonly Tx[]): boolean {
  return (
    row.kind === "saida" &&
    txs.some(
      (tx) =>
        tx.kind === "saida" &&
        !tx.excludedFromTotals &&
        tx.date === row.date &&
        cents(tx.amount) === cents(row.gross) &&
        normalizeStatementText(tx.description) === normalizeStatementText(row.description),
    )
  );
}

/** Revalida a escolha contra o estado que será salvo, inclusive após sincronização em outra aba. */
export function confirmStatementBill(state: State, row: StatementDebit, choice: BillMatch): State {
  const bill = statementBillMatches(row, state.debts).find(
    (item) => item.debtId === choice.debtId && item.month === choice.month,
  );
  if (
    !bill ||
    bill.paid !== choice.paid ||
    bill.name !== choice.name ||
    bill.due !== choice.due ||
    cents(bill.amount) !== cents(choice.amount)
  ) {
    throw new Error("Esta parcela mudou. Confira os dados atualizados antes de continuar.");
  }
  if (bill.paid) return state;
  if (countedStatementExpense(row, state.txs)) {
    throw new Error(
      "Este débito já consta em Lançamentos. Confira o registro antes de dar baixa nesta conta.",
    );
  }
  return {
    ...state,
    debts: state.debts.map((debt) =>
      debt.id === bill.debtId
        ? {
            ...debt,
            payments: {
              ...debt.payments,
              [bill.month]: { ...debt.payments[bill.month]!, paid: true },
            },
          }
        : debt,
    ),
  };
}
