import { describe, expect, it } from "vitest";
import { comparePurchase } from "./purchase-comparison";
import type { State } from "./finance";

const state = { income: { "2026-12": 10, "2027-01": 0 }, debts: [], txs: [] } as unknown as State;

describe("comparação de compras", () => {
  it("distribui centavos e distingue renda zero de renda ausente na virada do ano", () => {
    const result = comparePurchase(state, "2026-12", 9, 10, 3)!;
    expect(result.difference).toBe(100);
    expect(result.rows.map(r => r.installment)).toEqual([334,333,333]);
    expect(result.rows.map(r => r.month)).toEqual(["2026-12","2027-01","2027-02"]);
    expect(result.rows.map(r => r.incomeKnown)).toEqual([true,true,false]);
    expect(result.rows[0]?.cash).toBe(100);
    expect(result.rows[1]?.financed).toBe(-333);
  });
  it("recusa parcela sem valor e aceita preço à vista igual ao parcelado", () => {
    expect(comparePurchase(state, "2026-12", 9, 0.01, 3)).toBeNull();
    expect(comparePurchase(state, "2026-12", 9, 9, 1)?.difference).toBe(0);
  });
});
