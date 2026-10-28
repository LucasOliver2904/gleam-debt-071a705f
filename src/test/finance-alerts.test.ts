import { afterEach, describe, expect, it, vi } from "vitest";
import { alerts, type Debt, type State } from "@/lib/finance";

function account(id: string, month: string, due: number | undefined, paid = false): Debt {
  return { id, name: id, type: "unica", due, payments: { [month]: { amount: 100, paid } } };
}

function check(date: string, debts: Debt[]) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(`${date}T12:00:00`));
  const state: State = { debts, income: {}, txs: [] };
  return alerts(state).map(({ d, m, status }) => ({ id: d.id, m, status }));
}

afterEach(() => vi.useRealTimers());

describe("Alertas de vencimento", () => {
  it("inclui 01/11 nos próximos sete dias a partir de 28/10", () => {
    expect(check("2026-10-28", [account("novembro", "2026-11", 1)]))
      .toEqual([{ id: "novembro", m: "2026-11", status: "breve" }]);
  });

  it("inclui o sétimo dia e exclui o oitavo", () => {
    expect(check("2026-10-28", [account("limite", "2026-11", 4), account("fora", "2026-11", 5)]))
      .toEqual([{ id: "limite", m: "2026-11", status: "breve" }]);
  });

  it("inclui a virada do ano", () => {
    expect(check("2026-12-28", [account("janeiro", "2027-01", 1)]))
      .toEqual([{ id: "janeiro", m: "2027-01", status: "breve" }]);
  });

  it("mantém atrasadas e vencimentos de hoje e ignora contas pagas", () => {
    expect(check("2026-10-28", [account("hoje", "2026-10", 28), account("antiga", "2026-09", 1), account("paga", "2026-11", 1, true)]))
      .toEqual([{ id: "antiga", m: "2026-09", status: "atrasada" }, { id: "hoje", m: "2026-10", status: "hoje" }]);
  });

  it("usa o último dia real do mês para vencimentos sem dia ou dia 31", () => {
    expect(check("2026-02-28", [account("sem-dia", "2026-02", undefined), account("dia31", "2026-02", 31)]))
      .toEqual([{ id: "dia31", m: "2026-02", status: "hoje" }, { id: "sem-dia", m: "2026-02", status: "hoje" }]);
  });
});