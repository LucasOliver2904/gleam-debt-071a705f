import type { State } from "./finance";
import { mergePendingNotifications } from "./notification-merge";

export class SyncConflictError extends Error {
  constructor(public readonly paths: string[]) {
    super("Há alterações diferentes no mesmo registro. Seus dados locais foram preservados.");
    this.name = "SyncConflictError";
  }
}

const MISSING = Symbol("missing");
type Value = unknown | typeof MISSING;
const notificationKeys = new Set(["pixInbox", "expenseInbox", "handledInboxIds"]);
const entityKeys = new Set(["debts", "txs", "savingsGoals"]);
const pixFinancialKeys = new Set(["amount", "kind", "pix"]);
const empty: State = { debts: [], income: {}, txs: [] };

function record(value: Value): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function equal(a: Value, b: Value): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((entry, index) => equal(entry, b[index]));
  }
  if (!record(a) || !record(b)) return false;
  const aKeys = Object.keys(a).filter((key) => a[key] !== undefined);
  const bKeys = Object.keys(b).filter((key) => b[key] !== undefined);
  return (
    aKeys.length === bKeys.length &&
    aKeys.every((key) => Object.prototype.hasOwnProperty.call(b, key) && equal(a[key], b[key]))
  );
}

function field(value: Record<string, unknown>, key: string): Value {
  return Object.prototype.hasOwnProperty.call(value, key) && value[key] !== undefined
    ? value[key]
    : MISSING;
}

/**
 * Only changes since the last acknowledged snapshot may replace remote fields.
 * Concurrent edits to distinct entities/fields are retained; ambiguous edits are
 * reported before any state is written. Inputs are never mutated.
 */
export function mergeFinanceStates(
  base: State | null,
  local: State,
  remote: State,
  resolution?: "local" | "remote",
): State {
  const conflicts: string[] = [];
  function merge(before: Value, here: Value, there: Value, path: string): Value {
    if (equal(here, there)) return here;
    if (equal(here, before)) return there;
    if (equal(there, before)) return here;

    if (Array.isArray(here) && Array.isArray(there) && entityKeys.has(path)) {
      const old = Array.isArray(before) ? before : [];
      const byId = (items: unknown[]) =>
        new Map(items.map((item) => [(item as { id: string }).id, item]));
      const oldItems = byId(old),
        localItems = byId(here),
        remoteItems = byId(there);
      const ids = new Set([...localItems.keys(), ...remoteItems.keys(), ...oldItems.keys()]);
      const result: unknown[] = [];
      for (const id of ids) {
        const value = merge(
          oldItems.has(id) ? oldItems.get(id) : MISSING,
          localItems.has(id) ? localItems.get(id) : MISSING,
          remoteItems.has(id) ? remoteItems.get(id) : MISSING,
          `${path}.${id}`,
        );
        if (value !== MISSING) result.push(value);
      }
      return result;
    }

    if (record(here) && record(there) && (record(before) || before === MISSING)) {
      const old = record(before) ? before : {};
      const keys = new Set([...Object.keys(old), ...Object.keys(here), ...Object.keys(there)]);
      const result: Record<string, unknown> = {};
      let pixFinancial: Record<string, unknown> | undefined;
      if (
        path.startsWith("txs.") &&
        typeof here["id"] === "string" &&
        (old["pix"] !== undefined || here["pix"] !== undefined || there["pix"] !== undefined)
      ) {
        // Amount is the user's retained share of a Pix. Picking individual
        // fields across devices could create kept > gross or amount != kept.
        // Resolve the complete financial group while merging other fields.
        const group = (source: Record<string, unknown>) =>
          Object.fromEntries(
            [...pixFinancialKeys]
              .filter((key) => field(source, key) !== MISSING)
              .map((key) => [key, source[key]]),
          );
        const previous = group(old),
          localGroup = group(here),
          remoteGroup = group(there);
        if (equal(localGroup, remoteGroup)) pixFinancial = localGroup;
        else if (equal(localGroup, previous)) pixFinancial = remoteGroup;
        else if (equal(remoteGroup, previous)) pixFinancial = localGroup;
        else {
          conflicts.push(`${path}.pix`);
          pixFinancial = resolution === "remote" ? remoteGroup : localGroup;
        }
      }
      for (const key of keys) {
        if (!path && notificationKeys.has(key)) continue;
        const value =
          pixFinancial && pixFinancialKeys.has(key)
            ? field(pixFinancial, key)
            : merge(
                field(old, key),
                field(here, key),
                field(there, key),
                path ? `${path}.${key}` : key,
              );
        if (value !== MISSING) {
          Object.defineProperty(result, key, {
            value,
            enumerable: true,
            configurable: true,
            writable: true,
          });
        }
      }
      return result;
    }

    conflicts.push(path);
    return resolution === "remote" ? there : here;
  }

  // Notification queues are append/acknowledge sets, rather than replacements.
  // Keep their merge independent of financial conflicts and device ordering.
  const financial = merge(base ?? empty, local, remote, "") as State;
  if (conflicts.length && !resolution) throw new SyncConflictError(conflicts);
  return mergePendingNotifications(
    {
      ...financial,
      pixInbox: local.pixInbox,
      expenseInbox: local.expenseInbox,
      handledInboxIds: local.handledInboxIds,
    },
    remote,
  );
}
