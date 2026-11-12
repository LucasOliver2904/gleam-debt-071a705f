import { createFileRoute } from "@tanstack/react-router";
import type { Json } from "@/integrations/supabase/types";
import type { PixInboxItem, State } from "@/lib/finance";
import { digestAutomationKey, fingerprintNotification, parseIncomingPixNotification } from "@/lib/pix-bridge";

const noCache = { "Cache-Control": "no-store" };
const response = (data: object, status = 200) => Response.json(data, { status, headers: noCache });

type StateRecord = {
  user_id: string;
  data: Json;
  updated_at: string;
};

async function lookupByKey(key: string) {
  const digest = await digestAutomationKey(key);
  // A credencial privilegiada fica exclusivamente no processo servidor.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("user_state")
    .select("user_id,data,updated_at")
    .contains("data", { pixAutomationHash: digest })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as StateRecord | null;
}

export const Route = createFileRoute("/api/pix-notificacao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Validação sem criar lançamentos, para o botão "Testar conexão".
        const token = request.headers.get("x-meucaixa-token") ?? "";
        if (!/^[a-f0-9]{64}$/i.test(token)) return response({ ok: false }, 401);
        try {
          const owner = await lookupByKey(token);
          return owner ? response({ ok: true }) : response({ ok: false }, 401);
        } catch {
          return response({ ok: false, reason: "temporarily_unavailable" }, 503);
        }
      },
      POST: async ({ request }) => {
        const token = request.headers.get("x-meucaixa-token") ?? "";
        if (!/^[a-f0-9]{64}$/i.test(token)) return response({ ok: false }, 401);
        if (Number(request.headers.get("content-length") ?? "0") > 4200) {
          return response({ ok: false, reason: "too_large" }, 413);
        }
        let raw: string;
        try {
          raw = await request.text();
        } catch {
          return response({ ok: false, reason: "bad_body" }, 400);
        }
        const parsed = parseIncomingPixNotification(raw);
        if (!parsed) return response({ ok: false, reason: "not_incoming_pix" }, 422);
        const bank = (request.headers.get("x-meucaixa-banco") ?? "").trim().slice(0, 60);
        const fingerprint = await fingerprintNotification(raw, bank);
        try {
          const initial = await lookupByKey(token);
          if (!initial) return response({ ok: false }, 401);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Leitura + gravação condicional pela versão evita sobrescrever mudanças
          // entre duas notificações concorrentes do mesmo dispositivo.
          for (let attempt = 0; attempt < 5; attempt++) {
            const { data: row, error: readError } = await supabaseAdmin.from("user_state")
              .select("user_id,data,updated_at")
              .eq("user_id", initial.user_id)
              .single();
            if (readError || !row?.data) throw readError ?? new Error("Estado ausente");
            const state = row.data as unknown as State;
            // Permite revogar o token imediatamente no site.
            if (state.pixAutomationHash !== await digestAutomationKey(token)) {
              return response({ ok: false }, 401);
            }
            if (!Array.isArray(state.debts) || !Array.isArray(state.txs) || !state.income) {
              throw new Error("Estado financeiro inesperado");
            }
            const inbox = Array.isArray(state.pixInbox) ? state.pixInbox : [];
            const now = new Date();
            // Bancos atualizam a mesma notificação; evita duplicações em até 2 min.
            // Dois Pix reais idênticos dentro dessa janela exigem conferência manual.
            const duplicate = inbox.some((item) =>
              item.fingerprint === fingerprint &&
              now.getTime() - new Date(item.receivedAt).getTime() < 120_000
            ) || state.txs.some((item) =>
              item.pix?.fingerprint === fingerprint &&
              item.pix.receivedAt &&
              now.getTime() - new Date(item.pix.receivedAt).getTime() < 120_000
            );
            if (duplicate) return response({ ok: true, duplicate: true });
            if (inbox.length >= 1000) return response({ ok: false, reason: "inbox_full" }, 429);
            const day = new Intl.DateTimeFormat("sv-SE", {
              timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
            }).format(now);
            const draft: PixInboxItem = {
              id: crypto.randomUUID(),
              date: day,
              receivedAt: now.toISOString(),
              gross: parsed.gross,
              fingerprint,
              ...(parsed.sender ? { sender: parsed.sender.slice(0, 100) } : {}),
              ...(bank ? { bank } : {}),
            };
            const next: State = { ...state, pixInbox: [draft, ...inbox] };
            const { data: updated, error: updateError } = await supabaseAdmin.from("user_state")
              .update({
                data: next as unknown as Json,
                updated_at: now.toISOString(),
                client_id: "pix-webhook",
              })
              .eq("user_id", row.user_id)
              .eq("updated_at", row.updated_at)
              .select("user_id")
              .maybeSingle();
            if (updateError) throw updateError;
            if (updated) return response({ ok: true, queued: true }, 202);
          }
          return response({ ok: false, reason: "retry" }, 503);
        } catch (error) {
          console.error("Falha ao registrar Pix recebido:", error instanceof Error ? error.message : "erro");
          return response({ ok: false, reason: "temporarily_unavailable" }, 503);
        }
      },
    },
  },
});
