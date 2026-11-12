import { describe, expect, it } from "vitest";
import { monthSummary, type State } from "@/lib/finance";
import { categorySpending, financeCsv } from "@/lib/planning";

describe("Compras no cartão sem dupla contagem", () => {
  function build(excludedFromTotals: boolean): State {
    return {
      debts: [{
        id: "bill", name: "Fatura do cartão",
        type: "unica", category: "Cartão",
        payments: { "2026-11": { paid: false, amount: 100 } },
      }],
      income: { "2026-11": 800 },
      txs: [{
        id: "purchase", date: "2026-11-12", description: "Mercado",
        kind: "saida", category: "Mercado", amount: 30,
        excludedFromTotals,
        expenseAuto: { source: "Carteira do Google", method: "carteira", receivedAt: "2026-11-12T10:00:00Z", fingerprint: "hash" },
      }],
    };
  }

  it("não soma outra vez a compra já incluída na fatura", () => {
    const s = build(true);
    expect(monthSummary(s, "2026-11").out).toBe(100);
    expect(categorySpending(s, "2026-11").get("Mercado")).toBeUndefined();
    expect(financeCsv(s, "2026-11")).toContain("Na fatura / não somado");
  });

  it("soma compra que ainda não está contabilizada em outra conta", () => {
    const s = build(false);
    expect(monthSummary(s, "2026-11").out).toBe(130);
    expect(categorySpending(s, "2026-11").get("Mercado")).toBe(30);
  });
});
