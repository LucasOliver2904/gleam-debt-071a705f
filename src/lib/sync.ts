import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { applyRemote, getState, setSyncHandler, uid, type State } from "./finance";

const clientId = uid() + uid();

/**
 * Protege os registros financeiros: uma falha ao ler o estado remoto NUNCA
 * pode ser interpretada como um usuário sem dados (e sobrescrever o banco).
 */
export async function startSync(userId: string): Promise<() => void> {
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
      await push(userId, snapshot);
      if (pending === snapshot) pending = null;
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
        if (!disposed && !pending && incoming?.data && incoming.client_id !== clientId) {
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
    if (!disposed && data?.data && data.client_id !== clientId) {
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

async function push(userId: string, state: State) {
  const { error } = await supabase.from("user_state").upsert({
    user_id: userId,
    data: state as unknown as Json,
    client_id: clientId,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error("Falha ao salvar as finanças no banco: " + error.message);
}
