import { describe, expect, it } from "vitest";
import { findRelatedNotification, parseFinancialNotification } from "@/lib/notification-events";

describe("Captura de despesas por notificações", () => {
  it("identifica Pix recebido e Pix enviado sem trocar a direção", () => {
    expect(parseFinancialNotification("Sicredi Pix\nVocê recebeu um Pix no valor de R$ 5,00 Lucas Oliveira", "Sicredi X"))
      .toMatchObject({ direction: "entrada", amount: 5, method: "pix" });
    expect(parseFinancialNotification("Feito, Pix enviado\nVocê enviou R$ 5,00 para LUCAS, CPF XXX", "Itaú"))
      .toMatchObject({ direction: "saida", amount: 5, method: "pix", person: "LUCAS" });
  });
  it("aceita compras na carteira e no cartão", () => {
    expect(parseFinancialNotification("Google Wallet\nCompra de R$ 42,90 em Mercado Central", "Carteira do Google"))
      .toMatchObject({ direction: "saida", amount: 42.9, method: "carteira", person: "Mercado Central" });
    expect(parseFinancialNotification("Compra aprovada no cartão no valor de R$ 42,90 em Mercado Central", "Itaú"))
      .toMatchObject({ direction: "saida", amount: 42.9, method: "cartao" });
  });
  it("recusa avisos sem valor e cancelamentos", () => {
    expect(parseFinancialNotification("Compra aprovada! R$ 20,00 e R$ 10,00", "Banco")).toBeNull();
    expect(parseFinancialNotification("Pagamento recusado: R$ 50,00", "Banco")).toBeNull();
    expect(parseFinancialNotification("Pix recebido sem detalhes", "Banco")).toBeNull();
    expect(parseFinancialNotification("Cartão de crédito: fatura disponível de R$ 500,00", "Banco")).toBeNull();
  });
  it("sinaliza possível duplicidade entre Google Wallet e banco sem descartar transações legítimas", () => {
    const wallet = { id: "a", amount: 42.9, receivedAt: "2026-11-12T14:00:00.000Z", direction: "saida" as const, source: "Carteira do Google" };
    expect(findRelatedNotification({ amount: 42.9, receivedAt: "2026-11-12T14:01:00.000Z", direction: "saida", source: "Itaú" }, [wallet])).toBe("a");
    expect(findRelatedNotification({ amount: 42.9, receivedAt: "2026-11-12T14:01:00.000Z", direction: "entrada", source: "Sicredi" }, [wallet])).toBeNull();
    expect(findRelatedNotification({ amount: 43, receivedAt: "2026-11-12T14:01:00.000Z", direction: "saida", source: "Itaú" }, [wallet])).toBeNull();
    expect(findRelatedNotification({ amount: 42.9, receivedAt: "2026-11-12T14:20:00.000Z", direction: "saida", source: "Itaú" }, [wallet])).toBeNull();
  });
});
