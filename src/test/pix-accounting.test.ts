import { describe, expect, it } from "vitest";
import { financeCsv } from "@/lib/planning";
import { monthSummary, type State } from "@/lib/finance";

describe("Recebimento Pix com repasse", () => {
  const s: State = {
    debts: [],
    income: { "2026-11": 2000 },
    txs: [{
      id: "pix-1", kind: "entrada", date: "2026-11-12", description: "Pix cliente",
      amount: 50, category: "Pix",
      pix: { gross: 500, kept: 50, status: "pendente", source: "manual" },
    }],
  };
  it("registra apenas o valor próprio como receita disponível", () => {
    const resumo = monthSummary(s, "2026-11");
    expect(resumo.income).toBe(2050);
    expect(resumo.balance).toBe(2050);
  });
  it("mantém o bruto e o repasse no relatório sem somar duas vezes", () => {
    const csv = financeCsv(s, "2026-11");
    expect(csv).toContain('"50,00";"500,00";"450,00";"pendente"');
  });
});
