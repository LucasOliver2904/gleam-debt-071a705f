import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// O adaptador OAuth do Lovable é carregado somente após o clique no navegador.
// Não inicializar o SDK de OAuth durante a avaliação dos módulos no servidor.
import { startSync } from "@/lib/sync";
import { hasFinanceCache, setFinanceUser } from "@/lib/finance";

import { useSyncStatus } from "@/lib/sync-status";
import { AccessLayout, AppOpening } from "@/components/AppOpening";
import { SyncStatus } from "@/components/SyncStatus";
import { DeviceLockGate } from "@/components/DeviceLockGate";

export function AuthGate({ children }: { children: ReactNode }) {
  const syncStatus = useSyncStatus();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [syncedUser, setSyncedUser] = useState<string | null>(null);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) { setFinanceUser(null); return; }
    setFinanceUser(userId);
    let stop: (() => void) | undefined;
    let cancelled = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const connect = async () => {
      try {
        const cleanup = await startSync(userId);
        if (cancelled) cleanup();
        else { stop = cleanup; setSyncedUser(userId); }
      } catch (error) {
        console.error("O Prumo tentará restabelecer a sincronização.", error);
        if (!cancelled) retry = setTimeout(() => void connect(), 15000);
      }
    };
    void connect();
    return () => {
      cancelled = true;
      clearTimeout(retry);
      stop?.();
      setFinanceUser(null);
    };
  }, [userId]);

  if (session === undefined) return <AppOpening />;
  if (!session) return <Login />;
  const loading = syncedUser !== userId || !hasFinanceCache();
  const needsAttention = syncStatus.phase === "error" || syncStatus.phase === "conflict";
  const message = syncStatus.phase === "error"
    ? "Ainda não foi possível carregar seus dados neste aparelho."
    : syncStatus.phase === "conflict" ? "Confira as versões para continuar." : "Carregando seus dados…";
  return (
    <DeviceLockGate key={session.user.id} userId={session.user.id} email={session.user.email}>
      {loading ? <AppOpening message={message} needsAttention={needsAttention}><SyncStatus /></AppOpening> : children}
    </DeviceLockGate>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("Não foi possível entrar. Confira o e-mail e a senha.");
    } catch {
      setMsg("Não foi possível conectar ao serviço de autenticação. Verifique sua internet e tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    setMsg(null);
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) setMsg("Não foi possível entrar com o Google.");
    } catch {
      setMsg("Falha ao iniciar o login Google. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccessLayout labelledBy="login-heading">
      <h1 id="login-heading">Bem-vindo de volta</h1>
      <p className="mb-6 mt-2 text-sm text-muted-foreground">Entre para ver suas contas e movimentações.</p>
      <button type="button" disabled={busy} onClick={() => void google()} className="prumo-login-google">
        <span aria-hidden="true">G</span> Continuar com Google
      </button>
      <div className="prumo-login-divider"><span>ou com e-mail</span></div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="login-email">E-mail</label>
          <input id="login-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" />
        </div>
        <div>
          <label htmlFor="login-password">Senha</label>
          <div className="relative">
            <input id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha" />
            <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} aria-pressed={showPassword} onClick={() => setShowPassword((current) => !current)} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-xl text-muted-foreground hover:text-primary">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {msg && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">{msg}</p>}
        <button type="submit" disabled={busy} className="prumo-login-submit">
          {busy ? "Verificando acesso…" : "Entrar no Prumo"} {!busy && <ArrowRight size={18} />}
        </button>
      </form>
    </AccessLayout>
  );
}
