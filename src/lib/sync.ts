import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { applyRemote, getState, setSyncHandler, uid, type State } from "./finance";
import { mergePendingNotifications } from "./notification-merge";

// Cloudflare Workers bloqueia crypto.randomUUID() durante a avaliação de módulos.
// Geramos a identidade do cliente somente quando a sincronização inicia no navegador.
let clientId: string | null = null;
function getClientId(): string {
  if (!clientId) clientId = uid() + "-" + uid();
  return clientId;
}

/**
 * Protege os registros financeiros: uma falha ao ler o estado remoto NUNCA
 * pode ser interpretada como um usuário sem dados (e sobrescrever o banco).
 */
export async function startSync(userId: string): Promise<() => void> {
  getClientId();
  const { data: row, error } = await supabase
    .from("user_state")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error("Falha ao consultar o estado financeiro: " + error.message);
  if (row?.data) applyRemote(row.data as unknown as State);
  else await push(userId, getState());

  let disposed = false;
  let pending: State | null = null;
  let pushing = false;
  let retries = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const schedule = (delay: number) => {
    clearTimeout(timer);
    if (!disposed) timer = setTimeout(() => void flush(), delay);
  };

  async function flush() {
    if (disposed || pushing || !pending) return;
    pushing = true;
    const snapshot = pending;
    try {
      const merged = await push(userId, snapshot);
      if (pending === snapshot) {
        pending = null;
        // Atualiza apenas se nenhuma edição mais recente tiver ocorrido.
        // Preserve notificações recebidas durante a gravação no servidor.
        if (getState() === snapshot) applyRemote(merged);
      }
      retries = 0;
    } catch (err) {
      retries++;
      console.error("Não foi possível sincronizar. Tentaremos novamente.", err);
    } finally {
      pushing = false;
      if (pending && !disposed) schedule(retries ? Math.min(60000, 2000 * 2 ** Math.min(retries, 5)) : 600);
    }
  }

  setSyncHandler((state) => {
    pending = state;
    schedule(600);
  });

  const channel = supabase
    .channel("state-" + userId)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_state", filter: "user_id=eq." + userId },
      (payload) => {
        const incoming = payload.new as { data?: State; client_id?: string } | undefined;
        // Don't discard an edit that is still queued locally.
        if (!disposed && !pending && incoming?.data && incoming.client_id !== getClientId()) {
          applyRemote(incoming.data);
        }
      },
    )
    .subscribe();

  const onVisible = async () => {
    if (document.visibilityState !== "visible" || disposed) return;
    if (pending) {
      await flush();
      if (pending) return;
    }
    const { data, error: readError } = await supabase
      .from("user_state")
      .select("data, client_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) {
      console.error("Sem conexão para atualizar os dados financeiros.", readError);
      return;
    }
    if (!disposed && data?.data && data.client_id !== getClientId()) {
      applyRemote(data.data as unknown as State);
    }
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    disposed = true;
    clearTimeout(timer);
    pending = null;
    setSyncHandler(null);
    void supabase.removeChannel(channel);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

async function push(userId: string, state: State): Promise<State> {
  // Uma notificação pode chegar via webhook enquanto o usuário edita no app.
  // O upsert antigo sobrescrevia toda a fila sem verificar concorrência.
  for (let attempt = 0; attempt < 6; attempt++) {
    const { data: row, error: readError } = await supabase.from("user_state")
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (readError) throw new Error("Falha ao ler as finanças antes de salvar: " + readError.message);
    if (!row) {
      const { error } = await supabase.from("user_state").upsert({
        user_id: userId, data: state as unknown as Json, client_id: getClientId(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error("Falha ao criar estado financeiro: " + error.message);
      return state;
    }

    const remote = row.data as unknown as State;
    const merged = mergePendingNotifications(state, remote);
    const timestamp = new Date(Math.max(Date.now(), Date.parse(row.updated_at ?? "") + 1 || 0)).toISOString();
    const { data: updated, error } = await supabase.from("user_state").update({
      data: merged as unknown as Json,
      client_id: getClientId(),
      updated_at: timestamp,
    })
      .eq("user_id", userId)
      .eq("updated_at", row.updated_at)
      .select("user_id")
      .maybeSingle();
    if (error) throw new Error("Falha ao salvar as finanças: " + error.message);
    if (updated) return merged;
  }
  throw new Error("O estado financeiro mudou durante o salvamento; vamos tentar novamente.");
}
