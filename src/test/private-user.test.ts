import { afterEach, describe, expect, it } from "vitest";
import {
  applyRemote, exportBackup, getState, importBackup,
  setFinanceUser, setState,
} from "@/lib/finance";

afterEach(() => {
  setFinanceUser(null);
  localStorage.clear();
});

describe("Isolamento de dados financeiros por login", () => {
  it("não reutiliza o cache de outra conta ao alternar login", () => {
    setFinanceUser("usuario-1");
    setState((current) => ({ ...current, income: { "2026-11": 500 } }));
    expect(getState().income["2026-11"]).toBe(500);

    setFinanceUser("usuario-2");
    expect(getState().income["2026-11"]).toBeUndefined();
    setState((current) => ({ ...current, income: { "2026-11": 70 } }));
    expect(getState().income["2026-11"]).toBe(70);

    setFinanceUser("usuario-1");
    expect(getState().income["2026-11"]).toBe(500);
    setFinanceUser(null);
    expect(getState().income["2026-11"]).toBeUndefined();
  });
  it("preserva o legado em outra chave sem migrar de usuário para usuário", () => {
    localStorage.setItem("minhas-financas-v1", JSON.stringify({
      debts: [], txs: [], income: { "2026-11": 7000 },
    }));
    setFinanceUser("novo-login");
    expect(getState().income["2026-11"]).toBeUndefined();
  });
  it("não exporta nem restaura a chave de automação de outro backup", () => {
    setFinanceUser("usuario-1");
    applyRemote({ debts: [], txs: [], income: { "2026-11": 20 }, pixAutomationHash: "minha-chave" });
    expect(exportBackup()).not.toContain("minha-chave");
    importBackup(JSON.stringify({
      debts: [], txs: [], income: { "2026-11": 30 }, pixAutomationHash: "token-antigo",
    }));
    expect(getState().pixAutomationHash).toBe("minha-chave");
    expect(getState().income["2026-11"]).toBe(30);
  });
});
