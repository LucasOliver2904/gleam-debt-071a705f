import { type Tx } from "./finance";

export type QuickEntryShortcut = Pick<Tx, "description" | "category" | "kind">;

const DEFAULT_SHORTCUTS: QuickEntryShortcut[] = [
  { description: "Mercado", category: "Mercado", kind: "saida" },
  { description: "Transporte", category: "Transporte", kind: "saida" },
];

function shortcutKey(shortcut: QuickEntryShortcut) {
  return `${shortcut.kind}:${shortcut.description.trim().toLocaleLowerCase("pt-BR")}`;
}

/** Shortcuts copy only the editable fields; every use creates a new manual entry. */
export function quickEntryShortcuts(txs: Tx[]): QuickEntryShortcut[] {
  const grouped = new Map<
    string,
    { shortcut: QuickEntryShortcut; count: number; latest: string }
  >();
  for (const tx of txs) {
    const description = tx.description.trim();
    if (!description || description.length > 100) continue;
    const shortcut: QuickEntryShortcut = {
      description,
      kind: tx.kind,
      category: tx.category?.trim() || "Outros",
    };
    const key = shortcutKey(shortcut);
    const previous = grouped.get(key);
    if (!previous) grouped.set(key, { shortcut, count: 1, latest: tx.date });
    else {
      previous.count++;
      if (tx.date > previous.latest) {
        previous.latest = tx.date;
        previous.shortcut = shortcut;
      }
    }
  }
  const common = [...grouped.values()]
    .filter((item) => item.count >= 2)
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))
    .slice(0, 4)
    .map((item) => item.shortcut);
  const unique = new Map<string, QuickEntryShortcut>();
  for (const shortcut of [...common, ...DEFAULT_SHORTCUTS]) {
    if (!unique.has(shortcutKey(shortcut))) unique.set(shortcutKey(shortcut), shortcut);
  }
  return [...unique.values()].slice(0, 6);
}

/** Be conservative: do not delete an entry changed after it was created. */
export function isUnchangedQuickEntry(current: Tx, created: Tx) {
  const keys = Object.keys(current).sort();
  return (
    JSON.stringify(keys) === JSON.stringify(Object.keys(created).sort()) &&
    keys.every((key) => current[key as keyof Tx] === created[key as keyof Tx])
  );
}
