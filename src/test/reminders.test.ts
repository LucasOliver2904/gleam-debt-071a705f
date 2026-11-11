import { describe, expect, it } from "vitest";
import { notificationCandidates, upcomingBills, reminderConfig } from "@/lib/reminders";
import type { State } from "@/lib/finance";

const state = (paid = false): State => ({
  income: {},
  txs: [],
  debts: [
    { id: "dia-10", name: "Aluguel", type: "fixa", due: 10, payments: { "2026-11": { amount: 900, paid } } },
    { id: "dia-14", name: "Internet", type: "fixa", due: 14, payments: { "2026-11": { amount: 90, paid: false } } },
    { id: "dezembro", name: "Cartão", type: "parcelada", due: 1, payments: { "2026-12": { amount: 450, paid: false } } },
  ],
  reminderConfig: { enabled: true, daysBefore: [0, 3, 7], showDetails: false },
});

describe("Lembretes financeiros", () => {
  it("ordena vencidas e próximas sem contar contas pagas", () => {
    const items = upcomingBills(state(true), 7, new Date(2026, 10, 11));
    expect(items.map((item) => item.debt.id)).toEqual(["dia-14"]);
    expect(items[0]?.daysUntil).toBe(3);
  });

  it("inclui atrasadas e avisos nos dias escolhidos", () => {
    const result = notificationCandidates(state(), new Date(2026, 10, 11));
    expect(result.map((bill) => bill.debt.id)).toEqual(["dia-10", "dia-14"]);
  });

  it("usa o último dia real para contas sem vencimento explícito", () => {
    const s: State = { debts: [{ id: "fev", name: "Sem dia", type: "unica", payments: { "2027-02": { paid: false, amount: 30 } } }], income: {}, txs: [] };
    expect(upcomingBills(s, 60, new Date(2027, 1, 22))[0]?.date.getDate()).toBe(28);
  });

  it("começa com lembretes desativados em contas antigas", () => {
    const s = state();
    delete s.reminderConfig;
    expect(reminderConfig(s).enabled).toBe(false);
  });
});
