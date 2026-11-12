import { describe, expect, it } from "vitest";
import { mergePendingNotifications } from "@/lib/notification-merge";
import type { State, ExpenseInboxItem, PixInboxItem } from "@/lib/finance";

const expense: ExpenseInboxItem = {
  id: "wallet", amount: 42, date: "2026-11-12", receivedAt: "2026-11-12T10:20:00.000Z",
  source: "Carteira do Google", method: "carteira", fingerprint: "a",
};
const received: PixInboxItem = {
  id: "pix", gross: 500, date: "2026-11-12", receivedAt: "2026-11-12T10:00:00.000Z",
  fingerprint: "b",
};
const empty = (): State => ({ debts: [], txs: [], income: {} });

describe("Sincronização das notificações financeiras", () => {
  it("não apaga avisos que chegaram no servidor enquanto o usuário editava o app", () => {
    const remote: State = { ...empty(), expenseInbox: [expense], pixInbox: [received] };
    const local: State = { ...empty(), savingsGoals: [] };
    const merged = mergePendingNotifications(local, remote);
    expect(merged.expenseInbox).toEqual([expense]);
    expect(merged.pixInbox).toEqual([received]);
    expect(merged.savingsGoals).toEqual([]);
  });
  it("não ressuscita avisos já conferidos ou ignorados", () => {
    const remote: State = { ...empty(), expenseInbox: [expense], pixInbox: [received] };
    const local: State = { ...empty(), handledInboxIds: ["wallet", "pix"] };
    const merged = mergePendingNotifications(local, remote);
    expect(merged.expenseInbox).toEqual([]);
    expect(merged.pixInbox).toEqual([]);
  });
  it("mantém IDs únicos mesmo quando ambos dispositivos receberam o mesmo aviso", () => {
    const remote: State = { ...empty(), expenseInbox: [expense] };
    const local: State = { ...empty(), expenseInbox: [expense] };
    expect(mergePendingNotifications(local, remote).expenseInbox).toHaveLength(1);
  });
});
