import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  applyRemote,
  applySyncRebase,
  getFinanceUser,
  getState,
  getSyncRecord,
  setSyncHandler,
  uid,
  normalizeFinanceState,
  brl,
  monthLabel,
  type State,
} from "./finance";
import { mergeFinanceStates, SyncConflictError } from "./sync-merge";
import { acknowledgeJournal, readPendingJournals, type PendingJournal } from "./sync-journal";
import { registerSyncActions, setSyncStatus } from "./sync-status";

let clientId: string | null = null;
function getClientId() {
  return (clientId ??= uid() + "-" + uid());
}

/** Durable queue metadata is written atomically with each local edit by finance.ts. */
export async function startSync(userId: string): Promise<() => void> {
  let disposed = false;
  let busy = false;
  let rerunRequested = false;
  let retries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let conflictRemote: State | null = null;
  let replayingJournal: PendingJournal | null = null;
  let conflictSnapshot: string | null = null;
  let resolution: { choice: "local" | "remote"; remote: string } | null = null;
  const active = () => !disposed && getFinanceUser() === userId;
  const schedule = (delay: number) => {
    clearTimeout(timer);
    if (active()) timer = setTimeout(() => void run(), delay);
  };

  async function push(snapshot: State, base: State | null): Promise<State> {
    for (let attempt = 0; attempt < 6 && active(); attempt++) {
      const { data: row, error: readError } = await supabase
        .from("user_state")
        .select("data, updated_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (!active()) throw new Error("Sessão alterada");
      if (readError) throw new Error("Não foi possível consultar a cópia na nuvem.");
      if (!row) {
        // insert, not upsert: a concurrent first save must never be replaced blindly.
        const { error } = await supabase.from("user_state").insert({
          user_id: userId,
          data: snapshot as unknown as Json,
          client_id: getClientId(),
          updated_at: new Date().toISOString(),
        });
        if (!error) return snapshot;
        if (error.code === "23505") continue;
        throw new Error("Não foi possível criar a cópia na nuvem.");
      }
      const remote = row.data as unknown as State;
      conflictRemote = remote;
      // A user's conflict choice only applies to the exact remote version they reviewed.
      if (resolution && resolution.remote !== JSON.stringify(remote)) {
        resolution = null;
        throw new SyncConflictError(["A versão da nuvem mudou novamente"]);
      }
      const merged = mergeFinanceStates(base, snapshot, remote, resolution?.choice);
      const timestamp = new Date(
        Math.max(Date.now(), Date.parse(row.updated_at ?? "") + 1 || 0),
      ).toISOString();
      const { data: updated, error } = await supabase
        .from("user_state")
        .update({
          data: merged as unknown as Json,
          client_id: getClientId(),
          updated_at: timestamp,
        })
        .eq("user_id", userId)
        .eq("updated_at", row.updated_at)
        .select("user_id")
        .maybeSingle();
      if (!active()) throw new Error("Sessão alterada");
      if (error) throw new Error("Não foi possível salvar na nuvem.");
      if (updated) return merged;
    }
    throw new Error("Os dados mudaram durante o envio. Tente novamente.");
  }

  async function run() {
    if (!active()) return;
    if (busy) {
      rerunRequested = true;
      return;
    }
    busy = true;
    clearTimeout(timer);
    setSyncStatus(userId, "syncing");
    try {
      let initial = getSyncRecord();
      // Recover snapshots from closed or offline tabs before considering the cache clean.
      const journals = readPendingJournals(userId);
      if (!initial.pending && journals[0]) {
        replayingJournal = journals[0];
        applySyncRebase(journals[0].data, journals[0].base);
        initial = getSyncRecord();
      }
      if (initial.pending) {
        const snapshot = initial.data;
        const matchingJournals = readPendingJournals(userId).filter(
          (entry) =>
            JSON.stringify(normalizeFinanceState(entry.data)) === JSON.stringify(snapshot) &&
            JSON.stringify(entry.base) === JSON.stringify(initial.base),
        );
        const merged = await push(snapshot, initial.base);
        if (!active()) return;
        // The uploaded revision is durable remotely even if rebasing a newer edit conflicts.
        for (const entry of matchingJournals) acknowledgeJournal(entry);
        if (replayingJournal) {
          acknowledgeJournal(replayingJournal);
          replayingJournal = null;
        }
        const latest = getState();
        if (latest === snapshot) applyRemote(merged);
        else {
          // Keep edits made during the request; merge only changes after its snapshot.
          try {
            applySyncRebase(mergeFinanceStates(snapshot, latest, merged), merged);
          } catch (error) {
            applySyncRebase(latest, snapshot);
            conflictRemote = merged;
            throw error;
          }
        }
        resolution = null;
      } else {
        const { data: row, error } = await supabase
          .from("user_state")
          .select("data")
          .eq("user_id", userId)
          .maybeSingle();
        if (!active()) return;
        if (error) throw new Error("Não foi possível consultar seus dados. Verifique a conexão.");
        // A local edit may have happened while the initial read was waiting.
        if (getSyncRecord().pending) {
          schedule(0);
          return;
        }
        if (row?.data) applyRemote(row.data as unknown as State);
        else {
          const snapshot = getState();
          const merged = await push(snapshot, null);
          if (!active()) return;
          if (getState() === snapshot) applyRemote(merged);
          else applySyncRebase(mergeFinanceStates(snapshot, getState(), merged), merged);
        }
      }
      if (!active()) return;
      retries = 0;
      const record = getSyncRecord();
      if (!record.durable)
        setSyncStatus(
          userId,
          "error",
          "A cópia na nuvem foi salva, mas o armazenamento deste aparelho está indisponível.",
        );
      else
        setSyncStatus(
          userId,
          record.pending || readPendingJournals(userId).length ? "local" : "synced",
        );
      if (record.pending || readPendingJournals(userId).length) schedule(600);
    } catch (error) {
      if (!active()) return;
      if (error instanceof SyncConflictError) {
        resolution = null;
        conflictSnapshot = JSON.stringify(getState());
        const readPath = (data: State, path: string): unknown =>
          path
            .split(".")
            .reduce<unknown>(
              (value, part) =>
                Array.isArray(value)
                  ? value.find((entry: { id?: string }) => entry.id === part)
                  : value && typeof value === "object"
                    ? (value as Record<string, unknown>)[part]
                    : undefined,
              data,
            );
        const format = (value: unknown, path: string) => {
          if (value === undefined) return "Removido";
          if (typeof value === "boolean") return value ? "Sim" : "Não";
          if (typeof value === "number") return brl(value);
          if (value && typeof value === "object") {
            const item = value as { name?: string; description?: string; amount?: number };
            return [
              item.name ?? item.description ?? "Registro",
              item.amount === undefined ? "" : brl(item.amount),
            ]
              .filter(Boolean)
              .join(" · ");
          }
          return String(value);
        };
        const labels: Record<string, string> = {
          amount: "Valor",
          paid: "Pago",
          description: "Descrição",
          name: "Nome",
          date: "Data",
          due: "Vencimento",
          category: "Categoria",
          saved: "Reservado",
          target: "Objetivo",
        };
        const fieldLabel = (path: string) => {
          const [collection, id, ...parts] = path.split(".");
          if (collection === "income") return "Renda · " + monthLabel(id ?? "");
          const source =
            collection === "debts"
              ? getState().debts
              : collection === "txs"
                ? getState().txs
                : collection === "savingsGoals"
                  ? getState().savingsGoals
                  : undefined;
          const remoteSource = conflictRemote
            ? collection === "debts"
              ? conflictRemote.debts
              : collection === "txs"
                ? conflictRemote.txs
                : collection === "savingsGoals"
                  ? conflictRemote.savingsGoals
                  : undefined
            : undefined;
          const item = [...(source ?? []), ...(remoteSource ?? [])].find(
            (entry) => entry.id === id,
          ) as { name?: string; description?: string } | undefined;
          const detail = parts
            .map((part) => labels[part] ?? (/^\d{4}-\d{2}$/.test(part) ? monthLabel(part) : part))
            .join(" · ");
          return [
            item?.name ??
              item?.description ??
              { reminderConfig: "Lembretes", budgets: "Orçamentos" }[collection ?? ""] ??
              "Registro",
            detail,
          ]
            .filter(Boolean)
            .join(" · ");
        };
        const fields = error.paths
          .filter((path) => !path.includes("pixAutomationHash"))
          .map((path) => ({
            field: fieldLabel(path),
            local: format(readPath(getState(), path), path),
            remote: format(conflictRemote ? readPath(conflictRemote, path) : undefined, path),
          }));
        setSyncStatus(
          userId,
          "conflict",
          "Há alterações diferentes nos mesmos registros. Escolha qual versão manter nesses campos; os demais serão combinados.",
          fields,
        );
      } else {
        retries++;
        setSyncStatus(
          userId,
          "error",
          error instanceof Error ? error.message : "Não foi possível sincronizar.",
        );
        schedule(Math.min(60000, 2000 * 2 ** Math.min(retries, 5)));
      }
    } finally {
      busy = false;
      if (rerunRequested && active()) {
        rerunRequested = false;
        schedule(0);
      }
    }
  }

  setSyncHandler(() => {
    if (active()) {
      resolution = null;
      schedule(600);
    }
  });
  registerSyncActions(userId, {
    retry: () => {
      resolution = null;
      schedule(0);
    },
    resolve: (choice) => {
      if (!active() || !conflictRemote || busy) return;
      if (conflictSnapshot !== JSON.stringify(getState())) {
        schedule(0);
        return;
      }
      try {
        // Keep both copies before the user-authorized conflict resolution.
        const key = "prumo-sync-recovery:" + userId;
        const previous = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[];
        localStorage.setItem(
          key,
          JSON.stringify([
            ...previous.slice(-2),
            {
              savedAt: new Date().toISOString(),
              local: getState(),
              remote: conflictRemote,
            },
          ]),
        );
      } catch {
        setSyncStatus(
          userId,
          "conflict",
          "Não foi possível guardar as cópias de recuperação. Libere espaço neste aparelho antes de resolver o conflito.",
        );
        return;
      }
      resolution = { choice, remote: JSON.stringify(conflictRemote) };
      schedule(0);
    },
  });
  const channel = supabase
    .channel("state-" + userId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_state", filter: "user_id=eq." + userId },
      (payload) => {
        const incoming = payload.new as { client_id?: string } | undefined;
        if (incoming?.client_id !== getClientId()) schedule(0);
      },
    )
    .subscribe();
  const onVisible = () => {
    if (document.visibilityState === "visible") schedule(0);
  };
  const onOnline = () => schedule(0);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onOnline);
  const onStorage = (event: StorageEvent) => {
    if (event.key?.startsWith("prumo-sync-pending:" + encodeURIComponent(userId) + ":"))
      schedule(0);
  };
  window.addEventListener("storage", onStorage);
  schedule(0);
  return () => {
    disposed = true;
    clearTimeout(timer);
    if (getFinanceUser() === userId) {
      setSyncHandler(null);
      registerSyncActions(userId, null);
    }
    void supabase.removeChannel(channel);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("storage", onStorage);
  };
}
