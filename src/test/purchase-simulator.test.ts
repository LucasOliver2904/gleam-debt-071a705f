import { describe, expect, it } from "vitest";
import { simulatePurchase, splitInstallments } from "@/lib/planning";
import type { State } from "@/lib/finance";

function fixture(): State {
  return {
    income: { "2026-11": 1000, "2026-12": 1000, "2027-01": 1000 },
    debts: [
      {
        id: "conta",
        name: "Conta existente",
        type: "fixa",
        payments: {
          "2026-11": { amount: 900, paid: false },
          "2026-12": { amount: 900, paid: false },
          "2027-01": { amount: 900, paid: false },
        },
      },
    ],
    txs: [],
  };
}

describe("Simulador Cabe no meu mês?", () => {
  it("distribui todos os centavos sem alterar o total", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
    const amounts = splitInstallments(1000.01, 36);
    expect(amounts).toHaveLength(36);
    expect(Math.round(amounts.reduce((sum, amount) => sum + amount, 0) * 100)).toBe(100001);
  });

  it("projeta todas as parcelas na virada de ano sem modificar os dados reais", () => {
    const state = fixture();
    const before = JSON.stringify(state);
    const result = simulatePurchase(state, { total: 300, installments: 3, firstMonth: "2026-11" });
    expect(result.rows.map((row) => row.month)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(result.rows.map((row) => row.installment)).toEqual([100, 100, 100]);
    expect(result.rows.map((row) => row.current.balance)).toEqual([100, 100, 100]);
    expect(result.rows.map((row) => row.withPurchase.balance)).toEqual([0, 0, 0]);
    expect(result.firstShortage).toBeNull();
    expect(result.missingIncomeMonths).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });

  it("aponta a primeira falta e o mês mais negativo sem esconder saldo já comprometido", () => {
    const state = fixture();
    const result = simulatePurchase(state, { total: 600, installments: 3, firstMonth: "2026-11" });
    expect(result.firstShortage?.month).toBe("2026-11");
    expect(result.firstShortage?.current.balance).toBe(100);
    expect(result.firstShortage?.withPurchase.balance).toBe(-100);
    expect(result.tightest.withPurchase.balance).toBe(-100);
  });

  it("não trata renda ausente como confirmação de que a compra cabe", () => {
    const state = fixture();
    delete state.income["2027-01"];
    const result = simulatePurchase(state, { total: 30, installments: 3, firstMonth: "2026-11" });
    expect(result.missingIncomeMonths).toEqual(["2027-01"]);
    expect(result.rows[2]?.incomeKnown).toBe(false);
    expect(result.rows[2]?.current.balance).toBe(-900);
    expect(result.firstShortage?.month).toBe("2027-01");
  });

  it("aceita renda zero informada e entradas avulsas como informação de renda", () => {
    const state = fixture();
    state.income["2027-01"] = 0;
    state.txs.push({ id: "extra", date: "2027-01-10", description: "Extra", amount: 1000, kind: "entrada" });
    const result = simulatePurchase(state, { total: 30, installments: 3, firstMonth: "2026-11" });
    expect(result.missingIncomeMonths).toEqual([]);
    expect(result.rows[2]?.withPurchase.balance).toBe(90);
  });

  it("rejeita quantidades fora de 1 a 36 e meses inválidos", () => {
    expect(() => splitInstallments(100, 0)).toThrow("entre 1 e 36");
    expect(() => splitInstallments(100, 37)).toThrow("entre 1 e 36");
    expect(() => simulatePurchase(fixture(), { total: 100, installments: 2, firstMonth: "2026-13" })).toThrow("mês válido");
  });
});
