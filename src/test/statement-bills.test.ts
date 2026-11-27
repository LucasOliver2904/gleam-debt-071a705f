import { describe, expect, it } from "vitest";
import { confirmStatementBill, statementBillMatches } from "@/lib/statement-bills";
import { monthSummary, type Debt, type State, type Tx } from "@/lib/finance";
import { categoryReport } from "@/lib/category-report";

const empty: State = { debts: [], income: {}, txs: [] };

describe("Conferência de parcelas pelo extrato", () => {
  const debit = {
    date: "2027-01-02",
    description: "Débito Cooperativa",
    gross: 128.74,
    kind: "saida" as const,
    excludedFromTotals: false,
  };
  const debt: Debt = {
    id: "d1",
    name: "Cooperativa",
    type: "parcelada",
    due: 31,
    category: "Empréstimo",
    payments: {
      "2026-12": { amount: 128.74, paid: false },
      "2027-01": { amount: 128.74, paid: false },
    },
  };
  const other = { ...debt, id: "d2", name: "Internet", due: 2 };
  const state = { ...empty, debts: [other, debt] };
  const registered: Tx = {
    id: "tx",
    date: debit.date,
    description: "DEBITO COOPERATIVA",
    amount: debit.gross,
    kind: "saida",
  };

  it("mostra todas as opções, inclusive em dezembro, priorizando o nome que aparece no extrato", () => {
    expect(statementBillMatches(debit, state.debts).map((b) => [b.debtId, b.due, b.paid])).toEqual([
      ["d1", "2026-12-31", false],
      ["d2", "2027-01-02", false],
    ]);
    expect(statementBillMatches({ ...debit, date: "2027-01-07" }, [debt])).toHaveLength(1);
    expect(statementBillMatches({ ...debit, date: "2027-01-08" }, [debt])).toHaveLength(0);
  });

  it("compara em centavos e ignora entradas, datas inválidas, itens de fatura e saídas excluídas", () => {
    for (const patch of [
      { gross: 128.73 },
      { gross: NaN },
      { kind: "entrada" as const },
      { date: "2027-02-31" },
      { excludedFromTotals: true },
    ]) {
      expect(statementBillMatches({ ...debit, ...patch }, state.debts)).toEqual([]);
    }
    expect(statementBillMatches(debit, [{ ...debt, cardId: "cartao" }])).toEqual([]);
    const feb = { ...debt, payments: { "2028-02": { amount: debit.gross, paid: true } } };
    expect(statementBillMatches({ ...debit, date: "2028-03-01" }, [feb])[0]).toMatchObject({
      due: "2028-02-29",
      paid: true,
    });
  });

  it("sem vencimento exige o nome completo no mesmo mês, sem confundir Luz com Luzia", () => {
    const undated = { ...debt, name: "Luz", due: undefined };
    expect(statementBillMatches({ ...debit, description: "PAGTO LUZ" }, [undated])).toMatchObject([
      { month: "2027-01", due: null },
    ]);
    expect(statementBillMatches({ ...debit, description: "PAGTO LUZIA" }, [undated])).toEqual([]);
  });

  it("dá baixa apenas na parcela escolhida, mantém o total do mês e transfere o valor de pendente para pago", () => {
    const chosen = statementBillMatches(debit, state.debts)[0]!;
    const result = confirmStatementBill(state, debit, chosen);
    expect(result.debts[0]).toBe(other);
    expect(result.debts[1]!.payments).toEqual({
      "2026-12": { amount: 128.74, paid: true },
      "2027-01": { amount: 128.74, paid: false },
    });
    expect(result.txs).toBe(state.txs);
    expect(monthSummary(result, "2026-12").out).toBe(257.48);
    expect(monthSummary(result, "2026-12").balance).toBe(monthSummary(state, "2026-12").balance);
    const report = categoryReport(result, { from: "2026-12-01", to: "2026-12-31" });
    expect(report).toMatchObject({ paid: 128.74, pending: 128.74, total: 257.48 });
    expect(categoryReport(state).paid).toBe(0);
    const repeat = statementBillMatches(debit, result.debts)[0]!;
    expect(repeat.paid).toBe(true);
    expect(confirmStatementBill(result, debit, repeat)).toBe(result);
    expect(() => confirmStatementBill(result, debit, chosen)).toThrow(/mudou/);
  });

  it("revalida conta, parcela e lançamento antes da baixa", () => {
    const chosen = statementBillMatches(debit, state.debts)[0]!;
    for (const debts of [
      [],
      [{ ...debt, name: "Outra conta" }],
      [{ ...debt, due: 28 }],
      [{ ...debt, payments: { "2026-12": { amount: 130, paid: false } } }],
    ]) {
      expect(() => confirmStatementBill({ ...state, debts }, debit, chosen)).toThrow(/mudou/);
    }
    expect(() => confirmStatementBill({ ...state, txs: [registered] }, debit, chosen)).toThrow(
      /já consta/,
    );
    expect(
      confirmStatementBill(
        { ...state, txs: [{ ...registered, excludedFromTotals: true }] },
        debit,
        chosen,
      ).debts[1]!.payments["2026-12"]!.paid,
    ).toBe(true);
  });
});
