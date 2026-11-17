import type { State } from "./finance";

export type PendingJournal = { key: string; raw: string; data: State; base: State | null };
let instanceId: string | undefined;
const ownEntries = new Map<string, string>();
function instance() {
  return (instanceId ??= crypto.randomUUID());
}
function prefix(userId: string) {
  return "prumo-sync-pending:" + encodeURIComponent(userId) + ":";
}

/** A prepared revision is invisible to other tabs until the cache transaction commits. */
export function preparePendingJournal(
  userId: string,
  data: State,
  base: State | null,
): PendingJournal {
  const key = prefix(userId) + instance() + ":" + crypto.randomUUID();
  const raw = JSON.stringify({ committed: false, data, base });
  localStorage.setItem(key, raw);
  return { key, raw, data, base };
}
export function commitPendingJournal(userId: string, prepared: PendingJournal) {
  // Once committed, this unique revision is immutable. Consumers only delete it.
  localStorage.setItem(
    prepared.key,
    JSON.stringify({ committed: true, data: prepared.data, base: prepared.base }),
  );
  const previousKey = ownEntries.get(userId);
  ownEntries.set(userId, prepared.key);
  if (previousKey) {
    try {
      localStorage.removeItem(previousKey);
    } catch {
      /* an older duplicate is safe to replay */
    }
  }
}
export function abortPreparedJournal(prepared: PendingJournal) {
  localStorage.removeItem(prepared.key);
}
export function clearOwnJournal(userId: string) {
  const key = ownEntries.get(userId);
  if (key) localStorage.removeItem(key);
  ownEntries.delete(userId);
}
export function readPendingJournals(userId: string): PendingJournal[] {
  const entries: PendingJournal[] = [];
  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix(userId))) continue;
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    const parsed = JSON.parse(raw) as { committed?: boolean; data: State; base: State | null };
    if (parsed.committed === false) continue;
    if (
      !parsed.data ||
      !Array.isArray(parsed.data.debts) ||
      !Array.isArray(parsed.data.txs) ||
      !parsed.data.income
    )
      throw new Error("Uma alteração local pendente não pôde ser lida. A cópia foi preservada.");
    entries.push({ key, raw, data: parsed.data, base: parsed.base ?? null });
  }
  return entries;
}
export function acknowledgeJournal(entry: PendingJournal) {
  // A committed revision's key is never reused for a subsequent edit.
  if (localStorage.getItem(entry.key) === entry.raw) localStorage.removeItem(entry.key);
}
