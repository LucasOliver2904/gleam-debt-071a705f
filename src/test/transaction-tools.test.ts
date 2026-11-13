import { describe, expect, it } from "vitest";
import { filterTransactions, transactionTotals, transactionsCsv, type TransactionFilter } from "@/lib/transaction-tools";
import type { Tx } from "@/lib/finance";

const txs: Tx[] = [
  { id: "1", date: "2026-11-05", description: "Mercado São José", amount: 90.5, kind: "saida", category: "Mercado" },
  { id: "2", date: "2026-11-06", description: "Salário", amount: 2000, kind: "entrada", category: "Outros" },
  { id: "3", date: "2026-10-20", description: "=IMPORTXML(A1)", amount: 30, kind: "saida", category: "Compras", excludedFromTotals: true },
];

const base: TransactionFilter = { month: "todos", category: "todas", query: "", kind: "todos", order: "newest" };

describe("Filtros e exportação de movimentações", () => {
  it("busca ignorando acentos e respeita tipo e mês", () => {
    expect(filterTransactions(txs, { ...base, query: "sao jose" }).map((tx) => tx.id)).toEqual(["1"]);
    expect(filterTransactions(txs, { ...base, kind: "entrada", month: "2026-11" }).map((tx) => tx.id)).toEqual(["2"]);
    expect(filterTransactions(txs, { ...base, kind: "saida", category: "Compras" }).map((tx) => tx.id)).toEqual(["3"]);
  });
  it("ordena sem alterar a lista original", () => {
    expect(filterTransactions(txs, { ...base, order: "oldest" }).map((tx) => tx.id)).toEqual(["3", "1", "2"]);
    expect(txs[0]?.id).toBe("1");
  });
  it("não soma compras já incluídas em outra despesa", () => {
    expect(transactionTotals(txs)).toEqual({ income: 2000, expenses: 90.5, net: 1909.5, count: 3 });
  });
  it("exporta CSV legível, delimitado e sem interpretar descrições como fórmulas", () => {
    const csv = transactionsCsv(txs);
    expect(csv).toContain("Descrição");
    expect(csv).toContain("\"'=IMPORTXML(A1)\"");
    expect(csv).toContain('"90,50"');
    expect(csv).toContain("Já contabilizado em outra despesa");
  });
});
