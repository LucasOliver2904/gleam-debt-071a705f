import { afterEach, describe, expect, it, vi } from "vitest";
import { backupFingerprint, serializeBackup } from "@/lib/backup";
import { readPendingJournals } from "@/lib/sync-journal";
import {
  applyRemote,
  getBackupRecovery,
  getState,
  importBackup,
  setFinanceUser,
  setState,
  setSyncHandler,
  undoBackupRestore,
  type State,
} from "@/lib/finance";

const initial: State = {
  debts: [
    {
      id: "internet",
      name: "Internet",
      type: "fixa",
      recurring: { start: "2026-11", amount: 100 },
      payments: { "2026-11": { amount: 100, paid: false } },
    },
  ],
  income: { "2026-11": 2000 },
  txs: [],
  pixAutomationHash: "pareamento-atual",
  handledInboxIds: ["processado"],
};

afterEach(() => {
  setSyncHandler(null);
  setFinanceUser(null);
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Restauração e recuperação integradas às finanças", () => {
  it("guarda uma cópia durável normalizada e permite recuperar inclusive as edições posteriores", () => {
    setFinanceUser("pessoa-a");
    applyRemote(initial);
    importBackup(serializeBackup({ debts: [], txs: [], income: { "2026-11": 500 } }));
    expect(getState().income["2026-11"]).toBe(500);
    expect(getState().pixAutomationHash).toBe("pareamento-atual");
    expect(getBackupRecovery()?.changedSinceRestore).toBe(false);

    setState((current) => ({
      ...current,
      income: { "2026-11": 600 },
      handledInboxIds: ["processado", "chegou-depois"],
    }));
    expect(getBackupRecovery()?.changedSinceRestore).toBe(true);
    undoBackupRestore(backupFingerprint(getState()));
    expect(getState().income["2026-11"]).toBe(2000);
    expect(getState().debts[0]?.category).toBe("Contas da casa");
    expect(getState().handledInboxIds).toContain("chegou-depois");
    expect(getState().pixAutomationHash).toBe("pareamento-atual");
    expect(getBackupRecovery()?.changedSinceRestore).toBe(false);
    expect(getBackupRecovery()?.before.income["2026-11"]).toBe(600);
    undoBackupRestore(backupFingerprint(getState()));
    expect(getState().income["2026-11"]).toBe(600);
  });

  it("sobrevive à troca de sessão, mas não mostra a cópia de outra conta", () => {
    setFinanceUser("a");
    applyRemote(initial);
    importBackup(serializeBackup({ debts: [], txs: [], income: { "2026-11": 30 } }));
    setFinanceUser(null);
    setFinanceUser("b");
    expect(getBackupRecovery()).toBeNull();
    expect(() => undoBackupRestore(backupFingerprint(getState()))).toThrow(/Nenhuma cópia/);
    setFinanceUser("a");
    expect(getBackupRecovery()?.before.income["2026-11"]).toBe(2000);
    undoBackupRestore(backupFingerprint(getState()));
    expect(getState().income["2026-11"]).toBe(2000);
  });

  it("exige nova confirmação se os dados mudarem depois de abrir a recuperação", () => {
    setFinanceUser("a");
    applyRemote(initial);
    importBackup(serializeBackup({ debts: [], txs: [], income: { "2026-11": 30 } }));
    const confirmed = backupFingerprint(getState());
    setState((current) => ({ ...current, income: { "2026-11": 45 } }));
    expect(() => undoBackupRestore(confirmed)).toThrow(/mudaram/);
    expect(getState().income["2026-11"]).toBe(45);
    expect(getBackupRecovery()?.before.income["2026-11"]).toBe(2000);
  });

  it("não substitui dados sem conseguir armazenar a cópia anterior nem importa conteúdo inválido", () => {
    setFinanceUser("a");
    applyRemote(initial);
    const before = getState();
    const actualSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key.startsWith("prumo-backup-recovery"))
        throw new DOMException("quota", "QuotaExceededError");
      return actualSet.call(this, key, value);
    });
    expect(() => importBackup(serializeBackup({ debts: [], txs: [], income: {} }))).toThrow(
      /cópia de segurança/,
    );
    expect(getState()).toBe(before);
    expect(() => importBackup('{"debts":[null],"txs":[],"income":{}}')).toThrow(/inválidos/);
    expect(getState()).toBe(before);
  });

  it.each(["restaurar", "recuperar"] as const)(
    "preserva memória, cache e fila se guardar a cópia funcionar mas o cache financeiro falhar ao %s",
    (operation) => {
      setFinanceUser("a");
      applyRemote(initial);
      if (operation === "recuperar") {
        importBackup(serializeBackup({ debts: [], txs: [], income: { "2026-11": 30 } }));
      }
      const before = getState();
      const storedBefore = localStorage.getItem("meu-caixa-private-v2:a");
      const recoveryBefore = localStorage.getItem("prumo-backup-recovery-v1:a");
      const journalsBefore = readPendingJournals("a").map(({ data, base }) => ({ data, base }));
      const upload = vi.fn();
      setSyncHandler(upload);
      const actualSet = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
        this: Storage,
        key,
        value,
      ) {
        if (key.startsWith("meu-caixa-private-v2:"))
          throw new DOMException("quota", "QuotaExceededError");
        return actualSet.call(this, key, value);
      });
      const replace = () =>
        operation === "restaurar"
          ? importBackup(serializeBackup({ debts: [], txs: [], income: { "2026-11": 500 } }))
          : undoBackupRestore(backupFingerprint(getState()));
      expect(replace).toThrow(/dados atuais foram mantidos/);
      expect(getState()).toBe(before);
      expect(localStorage.getItem("meu-caixa-private-v2:a")).toBe(storedBefore);
      expect(localStorage.getItem("prumo-backup-recovery-v1:a")).toBe(recoveryBefore);
      expect(readPendingJournals("a").map(({ data, base }) => ({ data, base }))).toEqual(
        journalsBefore,
      );
      expect(upload).not.toHaveBeenCalled();
      // A nova sessão deve recuperar o estado anterior, sem reexecutar a substituição rejeitada.
      setFinanceUser(null);
      setFinanceUser("a");
      expect(getState()).toEqual(before);
    },
  );
});
