import { describe, expect, it } from "vitest";
import type { Debt, State, Tx } from "@/lib/finance";
import { mergeFinanceStates, SyncConflictError } from "@/lib/sync-merge";

const tx = (id: string, amount = 20): Tx => ({
  id,
  amount,
  kind: "saida",
  date: "2026-11-17",
  description: id,
});
const debt: Debt = {
  id: "internet",
  name: "Internet",
  type: "unica",
  payments: { "2026-11": { amount: 90, paid: false } },
};
const state = (patch: Partial<State> = {}): State => ({ debts: [], income: {}, txs: [], ...patch });

describe("Mesclagem financeira entre aparelhos", () => {
  it("preserva lançamentos adicionados em dois aparelhos e a ordem local", () => {
    const base = state({ txs: [tx("original")] });
    const local = state({ txs: [tx("mercado"), tx("original")] });
    const remote = state({ txs: [tx("transporte"), tx("original")] });
    expect(mergeFinanceStates(base, local, remote).txs.map((item) => item.id)).toEqual([
      "mercado",
      "original",
      "transporte",
    ]);
    expect(local.txs).toHaveLength(2);
    expect(remote.txs).toHaveLength(2);
  });

  it("combina edição de campos independentes da mesma conta", () => {
    const base = state({ debts: [debt] });
    const local = state({ debts: [{ ...debt, name: "Internet residencial" }] });
    const remote = state({
      debts: [{ ...debt, payments: { "2026-11": { amount: 90, paid: true } } }],
    });
    expect(mergeFinanceStates(base, local, remote).debts[0]).toEqual({
      ...debt,
      name: "Internet residencial",
      payments: { "2026-11": { amount: 90, paid: true } },
    });
  });

  it("combina mudanças em meses de renda distintos sem recuperar valores antigos", () => {
    const base = state({ income: { "2026-10": 1000, "2026-11": 1000 } });
    const local = state({ income: { "2026-10": 1000, "2026-11": 1200 } });
    const remote = state({ income: { "2026-10": 1100, "2026-11": 1000 } });
    expect(mergeFinanceStates(base, local, remote).income).toEqual({
      "2026-10": 1100,
      "2026-11": 1200,
    });
  });

  it("preserva exclusão quando o outro aparelho não mudou o registro", () => {
    const base = state({ txs: [tx("a"), tx("b")] });
    const local = state({ txs: [tx("b")] });
    expect(mergeFinanceStates(base, local, base).txs).toEqual([tx("b")]);
    expect(mergeFinanceStates(base, base, local).txs).toEqual([tx("b")]);
  });

  it("bloqueia exclusão concorrente com edição, sem descartar silenciosamente nenhuma", () => {
    const base = state({ txs: [tx("a")] });
    const local = state();
    const remote = state({ txs: [tx("a", 30)] });
    expect(() => mergeFinanceStates(base, local, remote)).toThrow(SyncConflictError);
    expect(() => mergeFinanceStates(base, remote, local)).toThrow(SyncConflictError);
    expect(remote.txs[0]?.amount).toBe(30);
  });

  it("informa o campo de um lançamento alterado com valores diferentes", () => {
    const base = state({ txs: [tx("a")] });
    try {
      mergeFinanceStates(base, state({ txs: [tx("a", 30)] }), state({ txs: [tx("a", 40)] }));
      throw new Error("Conflito não detectado");
    } catch (error) {
      expect(error).toBeInstanceOf(SyncConflictError);
      expect((error as SyncConflictError).paths).toEqual(["txs.a.amount"]);
    }
  });

  it("aceita a mesma alteração nos dois aparelhos", () => {
    const updated = state({ txs: [tx("a", 30)] });
    expect(mergeFinanceStates(state({ txs: [tx("a")] }), updated, updated).txs).toEqual(
      updated.txs,
    );
  });

  it("mantém novos registros independentes quando não existe base conhecida", () => {
    const result = mergeFinanceStates(null, state({ txs: [tx("a")] }), state({ txs: [tx("b")] }));
    expect(result.txs.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("não escolhe arbitrariamente entre valores sem base conhecida", () => {
    expect(() =>
      mergeFinanceStates(
        null,
        state({ income: { "2026-11": 500 } }),
        state({ income: { "2026-11": 700 } }),
      ),
    ).toThrow(SyncConflictError);
  });

  it("não ressuscita notificações dispensadas e mantém novas notificações remotas", () => {
    const inbox = {
      id: "pix-1",
      gross: 50,
      date: "2026-11-17",
      receivedAt: "2026-11-17T10:00:00Z",
      fingerprint: "fp1",
    };
    const newInbox = {
      ...inbox,
      id: "pix-2",
      fingerprint: "fp2",
      receivedAt: "2026-11-17T11:00:00Z",
    };
    const base = state({ pixInbox: [inbox] });
    const local = state({ pixInbox: [], handledInboxIds: [inbox.id], txs: [tx("entrada")] });
    const remote = state({ pixInbox: [newInbox, inbox] });
    const merged = mergeFinanceStates(base, local, remote);
    expect(merged.pixInbox).toEqual([newInbox]);
    expect(merged.handledInboxIds).toContain(inbox.id);
    expect(merged.txs).toEqual(local.txs);
  });

  it("mescla metas por id e preserva ajustes em campos distintos", () => {
    const goal = {
      id: "viagem",
      name: "Viagem",
      target: 2000,
      saved: 100,
      createdAt: "2026-11-17",
    };
    const base = state({ savingsGoals: [goal] });
    const local = state({ savingsGoals: [{ ...goal, saved: 200 }] });
    const remote = state({ savingsGoals: [{ ...goal, target: 3000 }] });
    expect(mergeFinanceStates(base, local, remote).savingsGoals).toEqual([
      { ...goal, saved: 200, target: 3000 },
    ]);
  });

  it.each(["local", "remote"] as const)(
    "resolve somente o valor conflitante usando %s",
    (resolution) => {
      const base = state({ txs: [tx("compartilhado")] });
      const local = state({
        txs: [tx("compartilhado", 30), tx("só-local")],
        income: { "2026-11": 500 },
      });
      const remote = state({
        txs: [tx("compartilhado", 40), tx("só-remoto")],
        budgets: { "2026-11": { Mercado: 200 } },
      });
      const result = mergeFinanceStates(base, local, remote, resolution);
      expect(result.txs).toContainEqual(tx("compartilhado", resolution === "local" ? 30 : 40));
      expect(result.txs).toContainEqual(tx("só-local"));
      expect(result.txs).toContainEqual(tx("só-remoto"));
      expect(result.income).toEqual(local.income);
      expect(result.budgets).toEqual(remote.budgets);
    },
  );

  it("permite confirmar exclusão ou edição sem descartar outras inclusões", () => {
    const base = state({ txs: [tx("a")] });
    const local = state({ txs: [tx("local")] });
    const remote = state({ txs: [tx("a", 30), tx("remoto")] });
    expect(mergeFinanceStates(base, local, remote, "local").txs).toEqual([
      tx("local"),
      tx("remoto"),
    ]);
    expect(mergeFinanceStates(base, local, remote, "remote").txs).toEqual([
      tx("local"),
      tx("a", 30),
      tx("remoto"),
    ]);
  });

  it("bloqueia alterações Pix que combinadas tornariam o valor retido maior que o recebido", () => {
    const original: Tx = {
      ...tx("pix", 50),
      kind: "entrada",
      pix: { gross: 100, kept: 50, status: "pendente", source: "manual" },
    };
    const base = state({ txs: [original] });
    const local = state({
      txs: [
        { ...original, pix: { ...original.pix!, gross: 60 }, description: "Editado no celular" },
      ],
    });
    const remote = state({
      txs: [{ ...original, amount: 80, pix: { ...original.pix!, kept: 80 }, category: "Pessoas" }],
    });
    expect(() => mergeFinanceStates(base, local, remote)).toThrow(SyncConflictError);
    for (const resolution of ["local", "remote"] as const) {
      const merged = mergeFinanceStates(base, local, remote, resolution).txs[0]!;
      const chosen = (resolution === "local" ? local : remote).txs[0]!;
      expect(merged.pix).toEqual(chosen.pix);
      expect(merged.amount).toBe(chosen.amount);
      expect(merged.kind).toBe(chosen.kind);
      expect(merged.pix!.kept).toBeLessThanOrEqual(merged.pix!.gross);
      expect(merged.amount).toBe(merged.pix!.kept);
      expect(merged.description).toBe("Editado no celular");
      expect(merged.category).toBe("Pessoas");
    }
  });

  it("combina alteração financeira Pix de um aparelho com descrição do outro", () => {
    const original: Tx = {
      ...tx("pix", 50),
      kind: "entrada",
      pix: { gross: 100, kept: 50, status: "pendente", source: "manual" },
    };
    const base = state({ txs: [original] });
    const local = state({
      txs: [{ ...original, amount: 80, pix: { ...original.pix!, kept: 80 } }],
    });
    const remote = state({ txs: [{ ...original, description: "Novo nome" }] });
    const merged = mergeFinanceStates(base, local, remote).txs[0]!;
    expect(merged.amount).toBe(80);
    expect(merged.pix!.kept).toBe(80);
    expect(merged.description).toBe("Novo nome");
  });
});
