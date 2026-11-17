import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { State } from "@/lib/finance";

const backend = vi.hoisted(() => ({
  row: null as { data: State; updated_at: string } | null,
  offline: false,
  beforeRead: null as (() => Promise<void>) | null,
  beforeWrite: null as (() => Promise<void>) | null,
  writes: 0,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => {
      let payload: State | undefined;
      let expectedVersion: string | undefined;
      const query = {
        select: () => query,
        eq: (key: string, value: string) => {
          if (key === "updated_at") expectedVersion = value;
          return query;
        },
        update: (value: { data: State }) => {
          payload = value.data;
          return query;
        },
        insert: async (value: { data: State; updated_at: string }) => {
          if (backend.row) return { error: { code: "23505" } };
          backend.row = { data: structuredClone(value.data), updated_at: value.updated_at };
          backend.writes++;
          return { error: null };
        },
        maybeSingle: async () => {
          if (payload) {
            await backend.beforeWrite?.();
            if (backend.offline) return { data: null, error: new Error("offline") };
            if (!backend.row || backend.row.updated_at !== expectedVersion)
              return { data: null, error: null };
            backend.row = {
              data: structuredClone(payload),
              updated_at: String(Number(backend.row.updated_at) + 1),
            };
            backend.writes++;
            return { data: { user_id: "a" }, error: null };
          }
          await backend.beforeRead?.();
          return backend.offline
            ? { data: null, error: new Error("offline") }
            : { data: structuredClone(backend.row), error: null };
        },
      };
      return query;
    },
    channel: () => {
      const channel = { on: () => channel, subscribe: () => channel };
      return channel;
    },
    removeChannel: vi.fn(),
  },
}));

import { applyRemote, getState, getSyncRecord, setFinanceUser, setState } from "@/lib/finance";
import { startSync } from "@/lib/sync";
import {
  readPendingJournals,
  preparePendingJournal,
  commitPendingJournal,
  acknowledgeJournal,
} from "@/lib/sync-journal";
import { getSyncStatus, resolveSyncConflict, retrySync } from "@/lib/sync-status";
const empty = (): State => ({ debts: [], income: {}, txs: [] });
const tx = (id: string, amount = 10) => ({
  id,
  date: "2026-11-10",
  description: id,
  amount,
  kind: "saida" as const,
});
let stop: (() => void) | undefined;
const tick = async (ms = 1) => {
  await vi.advanceTimersByTimeAsync(ms);
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  setFinanceUser(null);
  setFinanceUser("a");
  backend.row = { data: empty(), updated_at: "1" };
  backend.offline = false;
  backend.beforeRead = null;
  backend.beforeWrite = null;
  backend.writes = 0;
});
afterEach(() => {
  stop?.();
  stop = undefined;
  setFinanceUser(null);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Sincronização durável", () => {
  it("preserva edição offline após reload e combina com novidades de outro aparelho", async () => {
    applyRemote(empty());
    setState((state) => ({ ...state, txs: [tx("local")] }));
    setFinanceUser(null);
    setFinanceUser("a");
    expect(getSyncRecord().pending).toBe(true);
    backend.row!.data.txs.push(tx("remote"));
    backend.offline = true;
    stop = await startSync("a");
    await tick();
    expect(getSyncStatus().phase).toBe("error");
    expect(getState().txs.map((entry) => entry.id)).toEqual(["local"]);
    backend.offline = false;
    retrySync();
    await tick();
    expect(new Set(backend.row!.data.txs.map((entry) => entry.id))).toEqual(
      new Set(["local", "remote"]),
    );
    expect(getSyncRecord().pending).toBe(false);
    expect(getSyncStatus().phase).toBe("synced");
  });

  it("não perde edição feita enquanto o snapshot anterior é enviado", async () => {
    applyRemote(empty());
    setState((state) => ({ ...state, txs: [tx("primeiro")] }));
    let release!: () => void;
    backend.beforeWrite = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    stop = await startSync("a");
    await tick();
    setState((state) => ({ ...state, txs: [tx("segundo"), ...state.txs] }));
    backend.beforeWrite = null;
    release();
    await tick();
    expect(getSyncRecord().pending).toBe(true);
    expect(getState().txs).toHaveLength(2);
    await tick(601);
    expect(backend.row!.data.txs).toHaveLength(2);
    expect(getSyncRecord().pending).toBe(false);
  });

  it("ignora resposta antiga após trocar de conta", async () => {
    let release!: () => void;
    backend.beforeRead = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    stop = await startSync("a");
    await tick();
    setFinanceUser("b");
    setState((state) => ({ ...state, income: { "2026-11": 99 } }));
    backend.beforeRead = null;
    release();
    await tick();
    expect(getState().income).toEqual({ "2026-11": 99 });
    expect(getSyncStatus().userId).toBe("b");
    expect(backend.writes).toBe(0);
  });

  it("preserva ambos os estados em conflito e só aplica escolha após guardar recuperação", async () => {
    const base = { ...empty(), txs: [tx("mercado", 10)] };
    applyRemote(base);
    setState((state) => ({ ...state, txs: [tx("mercado", 20), tx("local-novo")] }));
    backend.row!.data = { ...empty(), txs: [tx("mercado", 30), tx("remote-novo")] };
    stop = await startSync("a");
    await tick();
    expect(getSyncStatus().phase).toBe("conflict");
    expect(backend.row!.data.txs[0]!.amount).toBe(30);
    expect(getState().txs[0]!.amount).toBe(20);
    resolveSyncConflict("remote");
    await tick();
    expect(getSyncStatus().phase).toBe("synced");
    expect(getState().txs.find((entry) => entry.id === "mercado")!.amount).toBe(30);
    expect(getState().txs).toHaveLength(3);
    expect(localStorage.getItem("prumo-sync-recovery:a")).toContain('"amount":20');
  });

  it("recupera alterações de duas abas offline mesmo se o cache comum foi sobrescrito", async () => {
    const base = empty();
    const fromA = { ...base, txs: [tx("aba-a")] };
    const fromB = { ...base, txs: [tx("aba-b")] };
    localStorage.setItem("prumo-sync-pending:a:aba-a", JSON.stringify({ data: fromA, base }));
    localStorage.setItem("prumo-sync-pending:a:aba-b", JSON.stringify({ data: fromB, base }));
    localStorage.setItem(
      "meu-caixa-private-v2:a",
      JSON.stringify({ syncVersion: 1, data: fromB, base, pending: true }),
    );
    setFinanceUser(null);
    setFinanceUser("a");
    stop = await startSync("a");
    await tick(1300);
    expect(new Set(getState().txs.map((entry) => entry.id))).toEqual(new Set(["aba-a", "aba-b"]));
    expect(backend.row!.data.txs).toHaveLength(2);
    expect(localStorage.getItem("prumo-sync-pending:a:aba-a")).toBeNull();
    expect(localStorage.getItem("prumo-sync-pending:a:aba-b")).toBeNull();
    expect(getSyncStatus().phase).toBe("synced");
  });

  it("não apaga snapshot mais novo gravado pela outra aba durante envio", async () => {
    applyRemote(empty());
    const old = { ...empty(), txs: [tx("aba-a")] };
    const key = "prumo-sync-pending:a:outra-aba";
    localStorage.setItem(key, JSON.stringify({ data: old, base: empty() }));
    let release!: () => void;
    backend.beforeWrite = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    stop = await startSync("a");
    await tick();
    const newer = { ...old, txs: [tx("aba-a"), tx("novo-da-outra-aba")] };
    localStorage.setItem(key, JSON.stringify({ data: newer, base: empty() }));
    backend.beforeWrite = null;
    release();
    await tick();
    expect(localStorage.getItem(key)).toContain("novo-da-outra-aba");
    await tick(601);
    expect(backend.row!.data.txs).toHaveLength(2);
  });

  it("reverte substituição que exige persistência se cache falha depois do journal", () => {
    applyRemote({ ...empty(), income: { "2026-11": 50 } });
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "meu-caixa-private-v2:a") throw new Error("quota");
      return original.call(this, key, value);
    });
    expect(() =>
      setState(() => ({ ...empty(), income: { "2026-11": 999 } }), { requireDurable: true }),
    ).toThrow();
    expect(getState().income).toEqual({ "2026-11": 50 });
    expect(getSyncRecord().pending).toBe(false);
    expect(
      Object.keys(localStorage).filter((key) => key.startsWith("prumo-sync-pending:a:")),
    ).toHaveLength(0);
    setFinanceUser(null);
    setFinanceUser("a");
    expect(getState().income).toEqual({ "2026-11": 50 });
  });

  it("não publica a substituição para outra aba antes de concluir o cache", () => {
    applyRemote(empty());
    setState((state) => ({ ...state, txs: [tx("anterior")] }));
    const previous = readPendingJournals("a");
    const original = Storage.prototype.setItem;
    let observed: string[] = [];
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === "meu-caixa-private-v2:a") {
        observed = readPendingJournals("a").flatMap((entry) =>
          entry.data.txs.map((item) => item.id),
        );
        throw new Error("quota");
      }
      return original.call(this, key, value);
    });
    expect(() =>
      setState(() => ({ ...empty(), txs: [tx("restauração-rejeitada")] }), {
        requireDurable: true,
      }),
    ).toThrow();
    expect(observed).toEqual(["anterior"]);
    expect(readPendingJournals("a")).toEqual(previous);
    expect(getState().txs[0]!.id).toBe("anterior");
  });

  it("usa revisões imutáveis para que ack antigo nunca remova edição nova", () => {
    const first = preparePendingJournal("a", { ...empty(), txs: [tx("primeiro")] }, empty());
    expect(readPendingJournals("a")).toHaveLength(0);
    commitPendingJournal("a", first);
    const captured = readPendingJournals("a")[0]!;
    const second = preparePendingJournal("a", { ...empty(), txs: [tx("segundo")] }, empty());
    commitPendingJournal("a", second);
    expect(first.key).not.toBe(second.key);
    acknowledgeJournal(captured);
    expect(readPendingJournals("a")[0]!.data.txs[0]!.id).toBe("segundo");
  });

  it("encerra replay de journal cujo snapshot ganha normalização", async () => {
    applyRemote(empty());
    const raw = {
      ...empty(),
      debts: [
        {
          id: "internet",
          name: "Internet (10)",
          type: "unica" as const,
          payments: { "2026-11": { amount: 90, paid: false } },
        },
      ],
    };
    localStorage.setItem(
      "prumo-sync-pending:a:legado",
      JSON.stringify({ data: raw, base: empty() }),
    );
    stop = await startSync("a");
    await tick(1800);
    expect(getState().debts[0]!.name).toBe("Internet");
    expect(readPendingJournals("a")).toHaveLength(0);
    expect(backend.writes).toBe(1);
    expect(getSyncStatus().phase).toBe("synced");
  });

  it("mantém alterações em memória e avisa quando a escrita local falha", () => {
    applyRemote(empty());
    const oldEnvelope = localStorage.getItem("meu-caixa-private-v2:a");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setState((state) => ({ ...state, txs: [tx("não-durável")] }));
    expect(getSyncRecord().pending).toBe(true);
    expect(getSyncRecord().durable).toBe(false);
    expect(getSyncStatus().phase).toBe("error");
    expect(getSyncStatus().message).toContain("Mantenha o app aberto");
    expect(getState().txs).toHaveLength(1);
    expect(localStorage.getItem("meu-caixa-private-v2:a")).toBe(oldEnvelope);
  });
});
