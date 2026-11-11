import { describe, expect, it } from "vitest";
import { parseMoney } from "@/lib/finance";
describe("Leitura de valores brasileiros", () => {
  it("aceita centavos e milhares", () => {
    expect(parseMoney("1.234,56")).toBe(1234.56);
    expect(parseMoney("R$ 8.500,00")).toBe(8500);
  });
  it("rejeita entradas inválidas", () => {
    expect(parseMoney("25")).toBe(25);
    expect(Number.isNaN(parseMoney("abc"))).toBe(true);
    expect(Number.isNaN(parseMoney("-5"))).toBe(true);
  });
});
