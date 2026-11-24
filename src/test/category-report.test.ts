import { describe, expect, it } from "vitest";
import { categoryReport, categoryReportCsv } from "@/lib/category-report";
import { categoryOptions, type State } from "@/lib/finance";
const state: State = {
  customCategories: { "Pessoa de teste": true },
  debts: [{ id: "d", name: "Loja", type: "parcelada", category: "Shopee", due: 31, payments: { "2026-02": { amount: 50.25, paid: true }, "2026-03": { amount: 80, paid: false } } }],
  txs: [
    { id: "t", date: "2026-02-28", kind: "saida", category: "Shopee", description: "=teste", amount: 12.5 },
    { id: "dup", date: "2026-02-28", kind: "saida", category: "Shopee", description: "Já na fatura", amount: 50.25, excludedFromTotals: true },
    { id: "income", date: "2026-02-28", kind: "entrada", category: "Shopee", description: "Entrada", amount: 100 },
  ], income: {}
};
describe("Relatório por categoria", () => {
  it("inclui categorias privadas e padrão nos formulários", () => expect(categoryOptions(state)).toEqual(expect.arrayContaining(["Shopee", "Pessoa de teste"])));
  it("separa pago e pendente sem somar duplicatas ou entradas", () => expect(categoryReport(state)).toMatchObject({ paid: 62.75, pending: 80, total: 142.75 }));
  it("filtra por data inclusiva e categoria, respeitando o último dia do mês", () => {
    expect(categoryReport(state, { category: "Shopee", from: "2026-02-28", to: "2026-02-28" })).toMatchObject({ paid: 62.75, pending: 0 });
    expect(categoryReport(state, { category: "Mercado" }).entries).toHaveLength(0);
    expect(categoryReport(state, { from: "2026-03-01", to: "2026-02-28" }).entries).toHaveLength(0);
  });
  it("exporta CSV com proteção contra fórmulas", () => expect(categoryReportCsv(categoryReport(state).entries)).toContain('"\u0027=teste"'));
});
