import { describe, expect, it } from "vitest";
import { openInstallments, simulatePayoff } from "@/lib/debt-payoff";
import { parseBrlCents, type Debt, type State } from "@/lib/finance";

const debt: Debt = {
  id: "loan",
  name: "Empréstimo de teste",
  type: "parcelada",
  payments: {
    "2027-02": { amount: 250.07, paid: false },
    "2026-09": { amount: 175.01, paid: false },
    "2027-01": { amount: 100.06, paid: false },
    "2026-10": { amount: 200, paid: true },
    "2026-12": { amount: 250.03, paid: false },
  },
};
const state: State = {
  debts: [debt],
  income: { "2026-12": 1000, "2027-02": 0 },
  txs: [
    { id: "expense", date: "2026-12-03", amount: 50, description: "Despesa", kind: "saida" },
    {
      id: "card",
      date: "2026-12-04",
      amount: 90,
      description: "Já na fatura",
      kind: "saida",
      excludedFromTotals: true,
    },
  ],
};
const now = "2026-12";

describe("antecipação de parcelas", () => {
  it("ordena por mês e mantém a numeração original ao excluir parcelas pagas", () => {
    expect(openInstallments(debt).map((item) => [item.month, item.number])).toEqual([
      ["2026-09", 1],
      ["2026-12", 3],
      ["2027-01", 4],
      ["2027-02", 5],
    ]);
    expect(openInstallments({ ...debt, type: "fixa" })).toEqual([]);
  });

  it("substitui só as parcelas selecionadas, desconta a proposta uma vez e preserva o histórico", () => {
    const previous = structuredClone(state);
    const months = new Set(["2026-12", "2027-02"]);
    const simulation = simulatePayoff(state, debt.id, months, 45000, now)!;
    expect(simulation.scheduledCents).toBe(50010);
    expect(simulation.savingsCents).toBe(5010);
    expect(simulation.rows).toEqual([
      { month: "2026-12", changeCents: -19997, beforeCents: 69997, afterCents: 50000 },
      { month: "2027-02", changeCents: 25007, beforeCents: -25007, afterCents: 0 },
    ]);
    expect(state).toEqual(previous);
  });

  it("inclui vencidas na comparação e não devolve valores de meses anteriores no caixa atual", () => {
    const result = simulatePayoff(state, debt.id, new Set(["2026-09", "2027-01"]), 25000, now)!;
    expect(result.scheduledCents).toBe(27507);
    expect(result.savingsCents).toBe(2507);
    expect(result.rows).toEqual([
      { month: now, changeCents: -25000, beforeCents: 69997, afterCents: 44997 },
      { month: "2027-01", changeCents: 10006, beforeCents: null, afterCents: null },
    ]);
  });

  it("distingue desconto, custo igual e acréscimo, inclusive quando falta renda", () => {
    const months = new Set(["2027-02"]);
    expect(simulatePayoff(state, debt.id, months, 0, now)?.savingsCents).toBe(25007);
    expect(simulatePayoff(state, debt.id, months, 25007, now)?.savingsCents).toBe(0);
    const result = simulatePayoff({ ...state, income: {} }, debt.id, months, 30000, now)!;
    expect(result.savingsCents).toBe(-4993);
    expect(result.rows.every((row) => row.afterCents === null)).toBe(true);
  });

  it("ignora propostas inválidas ou cuja seleção deixou de estar em aberto", () => {
    for (const months of [[], ["2026-10"], ["2026-12", "2028-01"]]) {
      expect(simulatePayoff(state, debt.id, new Set(months), 10000, now)).toBeNull();
    }
    for (const cents of [-1, 999.5, Infinity, NaN]) {
      expect(simulatePayoff(state, debt.id, new Set(["2026-12"]), cents, now)).toBeNull();
    }
  });
});

describe("valor de uma proposta em reais", () => {
  it("reconhece agrupamento em milhares e centavos explícitos", () => {
    expect(["R$ 1.250,90", "1.250", "1250.90", "0,01", "10,5", "0"].map(parseBrlCents)).toEqual([
      125090, 125000, 125090, 1, 1050, 0,
    ]);
  });
  it("não confunde ausência de proposta, valores ambíguos ou malformados com zero", () => {
    for (const text of [
      "",
      "R$",
      "1e4",
      "-5",
      "12,345",
      "1.23.45",
      "1,23,45",
      "9007199254740992",
    ]) {
      expect(parseBrlCents(text)).toBeNull();
    }
  });
});
