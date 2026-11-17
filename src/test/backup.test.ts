import { afterEach, describe, expect, it, vi } from "vitest";
import {
  backupFingerprint,
  parseBackup,
  preserveLiveFields,
  readRecoveryPoint,
  removeRecoveryPoint,
  saveRecoveryPoint,
  serializeBackup,
} from "@/lib/backup";
import type { State } from "@/lib/finance";

function fixture(): State {
  return {
    debts: [
      {
        id: "conta",
        name: "Internet",
        type: "unica",
        due: 10,
        payments: { "2026-11": { amount: 100, paid: false } },
      },
    ],
    txs: [
      {
        id: "compra",
        date: "2026-10-02",
        description: "Mercado",
        amount: 20,
        kind: "saida",
        category: "Mercado",
      },
    ],
    income: { "2026-09": 1500 },
    budgets: { "2026-11": { Mercado: 500 } },
    savingsGoals: [
      {
        id: "meta",
        name: "Reserva",
        target: 1000,
        saved: 50,
        createdAt: "2026-01-01T10:00:00.000Z",
      },
    ],
    reminderConfig: { enabled: false, daysBefore: [0, 3], showDetails: false },
  };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  removeRecoveryPoint("rollback-test");
});

describe("Backups validados e versionados", () => {
  it("aceita o formato antigo e o novo, preservando valores e resumindo o período", () => {
    const state = fixture();
    const legacy = parseBackup(JSON.stringify(state));
    const versioned = parseBackup(serializeBackup(state));
    expect(legacy.state).toEqual(state);
    expect(versioned.state).toEqual(state);
    expect(legacy.summary).toMatchObject({
      debts: 1,
      transactions: 1,
      goals: 1,
      firstMonth: "2026-09",
      lastMonth: "2026-11",
      exportedAt: null,
    });
    expect(versioned.summary.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it.each([
    (state: State) => ({ ...state, txs: [{ ...state.txs[0], date: "2026-02-30" }] }),
    (state: State) => ({ ...state, txs: [{ ...state.txs[0], amount: -1 }] }),
    (state: State) => ({ ...state, income: { "2026-13": 10 } }),
    (state: State) => ({ ...state, debts: [{ ...state.debts[0], due: 32 }] }),
    (state: State) => ({
      ...state,
      debts: [{ ...state.debts[0], payments: { "2026-11": { amount: 20, paid: "sim" } } }],
    }),
    (state: State) => ({ ...state, txs: [state.txs[0], state.txs[0]] }),
    (state: State) => ({
      ...state,
      savingsGoals: [{ ...state.savingsGoals?.[0], createdAt: "ontem" }],
    }),
  ])("rejeita registros inválidos em vez de normalizar silenciosamente (%#)", (change) => {
    expect(() => parseBackup(JSON.stringify(change(fixture())))).toThrow(/inválidos/);
  });

  it("rejeita JSON truncado, versões futuras e valores não finitos", () => {
    expect(() => parseBackup('{"debts":')).toThrow(/JSON/);
    expect(() =>
      parseBackup(
        JSON.stringify({
          format: "prumo",
          version: 2,
          exportedAt: "2026-01-01T00:00:00Z",
          data: fixture(),
        }),
      ),
    ).toThrow(/versão/);
    expect(() => parseBackup('{"debts":[],"txs":[],"income":{"2026-11":1e309}}')).toThrow(
      /inválidos/,
    );
  });

  it("recusa recorrências cujo volume de parcelas tornaria a restauração impraticável", () => {
    const debts = Array.from({ length: 200 }, (_, index) => ({
      id: String(index),
      name: "Conta antiga",
      type: "fixa",
      recurring: { start: "1900-01", amount: 1 },
      payments: {},
    }));
    expect(() => parseBackup(JSON.stringify({ debts, txs: [], income: {} }))).toThrow(/inválidos/);
  });

  it("não exporta pareamento nem transfere filas de notificações entre contas", () => {
    const live: State = {
      ...fixture(),
      pixAutomationHash: "chave-privada",
      pixInbox: [
        {
          id: "aviso",
          date: "2026-11-01",
          receivedAt: "2026-11-01T10:00:00Z",
          gross: 10,
          fingerprint: "abc",
        },
      ],
      expenseInbox: [],
      handledInboxIds: ["tratado"],
    };
    const text = serializeBackup(live);
    expect(text).not.toContain("chave-privada");
    expect(text).not.toContain("pixInbox");
    const imported = parseBackup(
      JSON.stringify({ ...fixture(), pixAutomationHash: "outro-token" }),
    ).state;
    const next = preserveLiveFields(imported, live);
    expect(next.pixAutomationHash).toBe("chave-privada");
    expect(next.pixInbox).toBe(live.pixInbox);
    expect(next.handledInboxIds).toBe(live.handledInboxIds);
  });
});

describe("Cópia anterior por conta", () => {
  it("mantém a recuperação no armazenamento, isolada por usuário, inclusive após nova leitura", () => {
    const before = fixture();
    const restored = { ...before, income: { "2026-11": 400 } };
    saveRecoveryPoint("pessoa-a", before, restored);
    expect(readRecoveryPoint("pessoa-b", restored)).toBeNull();
    expect(readRecoveryPoint("pessoa-a", restored)).toMatchObject({
      before,
      changedSinceRestore: false,
    });
    const current = { ...restored, income: { "2026-11": 450 } };
    expect(readRecoveryPoint("pessoa-a", current)?.changedSinceRestore).toBe(true);
    expect(readRecoveryPoint("pessoa-a", current)?.before.income).toEqual(before.income);
  });

  it("não trata novos avisos ou hash de pareamento como alteração financeira a descartar", () => {
    const before = fixture();
    saveRecoveryPoint("a", before, before);
    const changed = { ...before, pixAutomationHash: "nova-chave", handledInboxIds: ["novo-aviso"] };
    expect(backupFingerprint(changed)).toBe(backupFingerprint(before));
    expect(readRecoveryPoint("a", changed)?.changedSinceRestore).toBe(false);
    expect(localStorage.getItem("prumo-backup-recovery-v1:a")).not.toContain("nova-chave");
  });

  it("recusa continuar sem conseguir guardar a cópia e reporta recuperação corrompida", () => {
    const state = fixture();
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => saveRecoveryPoint("a", state, state)).toThrow(/Libere espaço/);
    set.mockRestore();
    localStorage.setItem("prumo-backup-recovery-v1:a", "incompleto");
    expect(() => readRecoveryPoint("a", state)).toThrow(/não pôde ser lida/);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("bloqueado", "SecurityError");
    });
    expect(() => readRecoveryPoint("a", state)).toThrow(/preservados/);
  });

  it("conserva a recuperação original em memória e avisa se o próprio rollback também falhar", () => {
    const before = fixture();
    const restored = { ...before, income: { "2026-11": 30 } };
    saveRecoveryPoint("rollback-test", before, restored);
    const rollback = saveRecoveryPoint("rollback-test", restored, {
      ...before,
      income: { "2026-11": 100 },
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(rollback).toThrow(/mantida nesta sessão/);
    expect(readRecoveryPoint("rollback-test", restored)).toMatchObject({ before, durable: false });
    vi.restoreAllMocks();
    saveRecoveryPoint("rollback-test", restored, before);
    expect(readRecoveryPoint("rollback-test", before)).toMatchObject({
      before: restored,
      durable: true,
    });
  });
});
