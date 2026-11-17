import { describe, expect, it } from "vitest";
import { debtRemaining, monthSummary, type Debt, type State } from "@/lib/finance";

describe("Arredondamento em centavos", () => {
  it("não deixa resíduo de ponto flutuante nem -0 no saldo do mês", () => {
    const s: State = {
      income: { "2026-11": 0.3 },
      debts: [],
      txs: [
        { id: "a", date: "2026-11-02", description: "A", amount: 0.1, kind: "saida" },
        { id: "b", date: "2026-11-03", description: "B", amount: 0.2, kind: "saida" },
      ],
    };
    const m = monthSummary(s, "2026-11");
    expect(m.out).toBe(0.3);
    expect(m.balance).toBe(0);
    expect(Object.is(m.balance, -0)).toBe(false);
  });

  it("soma parcelas restantes em centavos exatos", () => {
    const d: Debt = {
      id: "d",
      name: "Teste",
      type: "parcelada",
      payments: {
        "2026-11": { amount: 0.1, paid: false },
        "2026-12": { amount: 0.2, paid: false },
      },
    };
    expect(debtRemaining(d).remaining).toBe(0.3);
  });
});
