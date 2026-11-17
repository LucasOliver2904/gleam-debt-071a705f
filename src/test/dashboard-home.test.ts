import { describe, expect, it } from "vitest";
import { dashboardBills, dueDescription } from "@/lib/dashboard-home";
import type { State } from "@/lib/finance";

const sample: State = {
  income: {},
  txs: [],
  debts: [
    { id:"old", name:"Empréstimo antigo", type:"parcelada", due:10, payments: {"2026-10":{amount:200,paid:false}} },
    { id:"recent", name:"Seguro", type:"fixa", due:15, payments: {"2026-11":{amount:100,paid:false}} },
    { id:"future", name:"Internet", type:"fixa", due:25, payments: {"2026-11":{amount:90,paid:false}} },
    { id:"paid", name:"Pago", type:"unica", due:18, payments: {"2026-11":{amount:40,paid:true}} },
  ],
};

describe("Painel com vencimentos reais", () => {
  it("mostra primeiro atraso mais recente e depois próximos vencimentos, sem incluir pagos", () => {
    const bills = dashboardBills(sample, new Date(2026,10,17));
    expect(bills.map((b)=>b.debt.id)).toEqual(["recent","old","future"]);
    expect(bills[0]?.daysUntil).toBe(-2);
    expect(bills[2]?.daysUntil).toBe(8);
  });
  it("respeita limite da lista sem mudar os pagamentos", () => {
    expect(dashboardBills(sample, new Date(2026,10,17), 2).map((b)=>b.debt.id)).toEqual(["recent","old"]);
    expect(sample.debts[0]?.payments["2026-10"]?.paid).toBe(false);
  });
  it("não esconde todos os próximos vencimentos quando há muitos atrasos", () => {
    const many: State = { ...sample, debts: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: "late" + i,
        name: "Atraso " + i,
        type: "parcelada" as const,
        due: 1,
        payments: { "2026-11": { amount: 100 + i, paid: false } },
      })),
      sample.debts[2]!,
    ] };
    const bills = dashboardBills(many, new Date(2026,10,17), 5);
    expect(bills).toHaveLength(5);
    expect(bills.some((bill) => bill.debt.id === "future")).toBe(true);
  });
  it("explica atrasos, hoje e amanhã claramente", () => {
    expect(dueDescription(-1)).toBe("Atrasada há 1 dia");
    expect(dueDescription(-3)).toBe("Atrasada há 3 dias");
    expect(dueDescription(0)).toBe("Vence hoje");
    expect(dueDescription(1)).toBe("Vence amanhã");
  });
});
