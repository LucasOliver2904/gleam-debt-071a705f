import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { startSync } from "@/lib/sync";
import { setFinanceUser } from "@/lib/finance";

export function AuthGate({ children }: { children: ReactNode }) {
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
        console.error("O Meu Caixa tentará restabelecer a sincronização.", error);
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

  if (session === undefined) return <div className="min-h-screen bg-background" />;
  if (!session) return <Login />;
  if (syncedUser !== userId) return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Carregando seus dados com segurança...</div>;
  return <>{children}</>;
}

function Login() {
  const [mode, setMode] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "entrar") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("E-mail ou senha incorretos.");
    } else {
      const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      setMsg(error ? error.message : "Conta criada! Confira seu e-mail para confirmar e depois entre.");
    }
    setBusy(false);
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) setMsg("Não foi possível entrar com Google.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground"><Wallet size={20} /></span>
          <div>
            <h1 className="font-display text-xl font-bold text-foreground">Meu Caixa</h1>
            <p className="text-xs text-muted-foreground">Seus dados sincronizados no celular e computador</p>
          </div>
        </div>
        <button onClick={google} className="w-full rounded-lg border border-border bg-background py-2.5 text-sm font-medium text-foreground hover:bg-muted">
          Continuar com Google
        </button>
        <div className="my-4 text-center text-xs text-muted-foreground">ou</div>
        <form onSubmit={submit} className="space-y-3">
          <input type="email" required placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" />
          <input type="password" required minLength={6} placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground" />
          <button disabled={busy} className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {mode === "entrar" ? "Entrar" : "Criar conta"}
          </button>
        </form>
        {msg && <p className="mt-3 text-center text-sm text-muted-foreground">{msg}</p>}
        <button onClick={() => { setMode(mode === "entrar" ? "criar" : "entrar"); setMsg(null); }} className="mt-4 w-full text-center text-sm text-primary">
          {mode === "entrar" ? "Não tem conta? Criar conta" : "Já tem conta? Entrar"}
        </button>
      </div>
    </div>
  );
}
