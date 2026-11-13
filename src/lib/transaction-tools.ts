import type { Tx } from "./finance";

export type TransactionFilter = {
  month: string;
  query: string;
  category: string;
  kind: "todos" | Tx["kind"];
  order: "newest" | "oldest";
};

function searchKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function filterTransactions(txs: Tx[], filter: TransactionFilter): Tx[] {
  const q = searchKey(filter.query);
  return txs.filter((tx) => {
    if (filter.month !== "todos" && !tx.date.startsWith(filter.month)) return false;
    if (filter.category !== "todas" && (tx.category || "Outros") !== filter.category) return false;
    if (filter.kind !== "todos" && tx.kind !== filter.kind) return false;
    if (q && !searchKey([tx.description, tx.category || "", tx.pix?.sender || "", tx.expenseAuto?.source || ""].join(" ")).includes(q)) return false;
    return true;
  }).slice().sort((a, b) => filter.order === "newest"
    ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date));
}

export function transactionTotals(txs: Tx[]) {
  const income = txs.filter((tx) => tx.kind === "entrada").reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = txs.filter((tx) => tx.kind === "saida" && !tx.excludedFromTotals)
    .reduce((sum, tx) => sum + tx.amount, 0);
  return { income, expenses, net: income - expenses, count: txs.length };
}

function csvCell(value: string): string {
  // Previne fórmulas no Excel/LibreOffice quando a descrição veio de usuário/notificação.
  const cleaned = /^[\s]*[=+@-]/.test(value) ? "'" + value : value;
  return '"' + cleaned.replace(/"/g, '""').replace(/\r\n|\r|\n/g, " ") + '"';
}

export function transactionsCsv(txs: Tx[]): string {
  const header = ["Data", "Tipo", "Descrição", "Categoria", "Valor (R$)", "Contabilização", "Origem"];
  const rows = txs.map((tx) => [
    tx.date,
    tx.kind === "entrada" ? "Entrada" : "Saída",
    tx.description,
    tx.category || "Outros",
    tx.amount.toFixed(2).replace(".", ","),
    tx.excludedFromTotals ? "Já contabilizado em outra despesa" : "Contabilizado",
    tx.statement ? "Extrato: " + tx.statement.source : tx.pix ? "Pix recebido" : tx.expenseAuto?.source || "Manual",
  ]);
  return "\uFEFF" + [header, ...rows].map((row) => row.map((cell) => csvCell(String(cell))).join(";")).join("\r\n");
}
