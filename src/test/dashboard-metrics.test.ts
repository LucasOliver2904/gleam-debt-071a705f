import { describe, expect, it } from "vitest";
import { monthSummary, outstandingDebtBalance, type State } from "@/lib/finance";

describe("Indicadores financeiros sem inflar dívidas", () => {
  it("exclui contas fixas futuras do saldo de dívida a quitar, mas inclui no mês", () => {
    const s: State = {
      income: { "2026-11": 3000 },
      txs: [],
      debts: [
        { id: "parcelas", name: "Notebook", type: "parcelada", payments: {
          "2026-10": { amount: 200, paid: true },
          "2026-11": { amount: 200, paid: false },
          "2026-12": { amount: 200, paid: false },
        }},
        { id: "fixo", name: "Internet", type: "fixa", recurring: { amount: 100, start: "2026-11" },
          payments: {
            "2026-11": { amount: 100, paid: false },
            "2026-12": { amount: 100, paid: false },
            "2027-01": { amount: 100, paid: false },
          }},
        { id: "unico", name: "Conserto", type: "unica", payments: {
          "2026-11": { amount: 90, paid: false },
        }},
      ],
    };
    expect(outstandingDebtBalance(s)).toBe(490);
    expect(monthSummary(s, "2026-11").out).toBe(390);
    expect(monthSummary(s, "2026-11").balance).toBe(2610);
  });

  it("fica zerado quando há apenas compromissos fixos", () => {
    const s: State = {
      income: {}, txs: [],
      debts: [{ id: "fixa", type: "fixa", name: "Assinatura", payments: { "2026-11": { amount: 20, paid: false } } }],
    };
    expect(outstandingDebtBalance(s)).toBe(0);
  });
});
