import type { State } from "./finance";

/** Preserva avisos capturados enquanto um celular/desktop salva outras alterações. */
export function mergePendingNotifications(local: State, remote: State): State {
  const handled = [...new Set([...(remote.handledInboxIds ?? []), ...(local.handledInboxIds ?? [])])].slice(-2000);
  const dismissed = new Set(handled);
  const union = <T extends { id: string; receivedAt: string }>(a: T[] = [], b: T[] = []) => {
    const byId = new Map<string, T>();
    for (const entry of [...b, ...a]) if (!dismissed.has(entry.id)) byId.set(entry.id, entry);
    return [...byId.values()].sort((x, y) => y.receivedAt.localeCompare(x.receivedAt));
  };
  return {
    ...local,
    pixInbox: union(local.pixInbox, remote.pixInbox),
    expenseInbox: union(local.expenseInbox, remote.expenseInbox),
    handledInboxIds: handled,
  };
}
