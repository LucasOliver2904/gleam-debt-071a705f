import { describe, it, expect } from "vitest";
import { budgetRows, calendarDays, categorySpending, dueDate, financeCsv, monthBills, projection } from "@/lib/planning";
import type { State } from "@/lib/finance";

function fixture(): State {
  return {
    debts: [
      { id: "a", name: "Aluguel", category: "Moradia", type: "fixa", due: 31, payments: { "2027-02": { amount: 800, paid: false } } },
      { id: "b", name: "Internet", category: "Contas da casa", type: "unica", due: 1, payments: { "2027-02": { amount: 60, paid: true } } },
    ],
    txs: [
      { id: "x", date: "2027-02-14", kind: "saida", amount: 150, category: "Moradia", description: '=HYPERLINK("bad")' },
      { id: "y", date: "2027-02-14", kind: "entrada", amount: 100, description: "Presente" },
    ],
    income: { "2027-02": 1900 },
    budgets: { "2027-02": { Moradia: 900, Lazer: 100 } },
  };
}

describe("Planejamento", () => {
  it("limita vencimento 31 ao fim de fevereiro", () => {
    expect(dueDate("2027-02", 31).getDate()).toBe(28);
    expect(dueDate("2028-02", 31).getDate()).toBe(29);
    expect(monthBills(fixture(), "2027-02", new Date(2027, 1, 10)).map((b) => b.day)).toEqual([1, 28]);
  });

  it("cria calendário começando na segunda, com 42 células e hoje destacado", () => {
    const grid = calendarDays("2027-02", new Date(2027, 1, 3));
    expect(grid).toHaveLength(42);
    expect(grid[0]?.key).toBe("2027-02-01");
    expect(grid.find((x) => x.isToday)?.key).toBe("2027-02-03");
  });

  it("soma compromissos e despesas avulsas, mas não as entradas", () => {
    expect(categorySpending(fixture(), "2027-02").get("Moradia")).toBe(950);
    const rows = budgetRows(fixture(), "2027-02");
    expect(rows.find((x) => x.category === "Moradia")).toMatchObject({ spent: 950, budget: 900, remaining: -50, percentage: 106 });
    expect(rows.find((x) => x.category === "Lazer")).toMatchObject({ spent: 0, budget: 100 });
  });

  it("projeta meses e exporta CSV seguro", () => {
    const forecast = projection(fixture(), "2027-02", 2);
    expect(forecast[0]?.balance).toBe(990);
    expect(forecast[1]?.month).toBe("2027-03");
    const csv = financeCsv(fixture(), "2027-02");
    expect(csv).toContain('"\u0027=HYPERLINK');
    expect(csv).toContain("Internet");
    expect(csv).toContain("Pago");
    expect(csv.charCodeAt(0)).toBe(65279);
  });
});
