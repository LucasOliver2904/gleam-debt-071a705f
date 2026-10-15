import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { applyRemote, getState, setSyncHandler, uid, type State } from "./finance";

const clientId = uid() + uid();

export async function startSync(userId: string): Promise<() => void> {
  const { data: row } = await supabase.from("user_state").select("data").eq("user_id", userId).maybeSingle();
  if (row?.data) applyRemote(row.data as unknown as State);
  else await push(userId, getState());

  let timer: ReturnType<typeof setTimeout> | undefined;
  setSyncHandler((s) => {
    clearTimeout(timer);
    timer = setTimeout(() => void push(userId, s), 600);
  });

  const channel = supabase
    .channel(`state-${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "user_state", filter: `user_id=eq.${userId}` },
      (payload) => {
        const n = payload.new as { data?: State; client_id?: string } | undefined;
        if (n?.data && n.client_id !== clientId) applyRemote(n.data);
      },
    )
    .subscribe();

  // ao voltar para o app, busca a versão mais recente
  const onVisible = async () => {
    if (document.visibilityState !== "visible") return;
    const { data } = await supabase.from("user_state").select("data, client_id").eq("user_id", userId).maybeSingle();
    if (data?.data && data.client_id !== clientId) applyRemote(data.data as unknown as State);
  };
  document.addEventListener("visibilitychange", onVisible);

  return () => {
    clearTimeout(timer);
    setSyncHandler(null);
    supabase.removeChannel(channel);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

async function push(userId: string, s: State) {
  await supabase.from("user_state").upsert({
    user_id: userId,
    data: s as unknown as Json,
    client_id: clientId,
    updated_at: new Date().toISOString(),
  });
}
