import { describe, it, expect } from "vitest";
import { parsePixNotification, pixAllocation } from "@/lib/pix";

describe("Conciliação de Pix", () => {
  it("divide recebimento bruto e receita própria", () => {
    expect(pixAllocation("500,00", "50,00")).toEqual({ gross: 500, kept: 50, toPassOn: 450 });
    expect(pixAllocation("1.234,56", "0")).toEqual({ gross: 1234.56, kept: 0, toPassOn: 1234.56 });
  });
  it("impede valor próprio acima do bruto ou negativo", () => {
    expect(pixAllocation("500", "550")).toBeNull();
    expect(pixAllocation("500", "-5")).toBeNull();
    expect(pixAllocation("abc", "50")).toBeNull();
  });
  it("interpreta texto de recebimento como rascunho", () => {
    expect(parsePixNotification("Você recebeu um Pix de R$ 500,00 de Maria")).toMatchObject({ gross: 500 });
    expect(parsePixNotification("Pix recebido! Valor: R$ 1.234,56")).toEqual({ gross: 1234.56 });
  });
  it("não confunde Pix enviado com dinheiro recebido", () => {
    expect(parsePixNotification("Pix enviado de R$ 500,00 para Maria")).toBeNull();
    expect(parsePixNotification("Você enviou um Pix de R$ 55,00")).toBeNull();
    expect(parsePixNotification("Sua conta foi debitada em R$ 20,00")).toBeNull();
  });
});
