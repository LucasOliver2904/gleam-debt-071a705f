import { describe, expect, it } from "vitest";
import {
  digestAutomationKey, fingerprintNotification, generateAutomationKey, parseIncomingPixNotification,
} from "@/lib/pix-bridge";

describe("Automação de notificações Pix", () => {
  it("gera chave imprevisível de 256 bits e usa hash, nunca a chave no estado", async () => {
    const key = generateAutomationKey();
    expect(key).toMatch(/^[a-f0-9]{64}$/);
    const hash = await digestAutomationKey(key);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(key);
    await expect(digestAutomationKey("abc")).rejects.toThrow();
  });
  it("aceita recebimento com valor e remetente", () => {
    expect(parseIncomingPixNotification("Pix recebido! Você recebeu R$ 500,00 de Fulano")).toMatchObject({ gross: 500, sender: "Fulano" });
    expect(parseIncomingPixNotification("Você recebeu 500 de Fulano. Pix recebido")).toMatchObject({ gross: 500, sender: "Fulano" });
    expect(parseIncomingPixNotification("Pix enviado! Você enviou R$ 200,00")).toBeNull();
  });
  it("detecta notificações de texto repetido", async () => {
    const a = await fingerprintNotification("Pix recebido! R$ 500,00", "Banco");
    const b = await fingerprintNotification("PIX   recebido! R$ 500,00", "banco");
    expect(a).toBe(b);
  });
});
