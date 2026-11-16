import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Eye, EyeOff, Fingerprint, LockKeyhole, ReceiptText, ShieldCheck, Sparkles, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
// O adaptador OAuth do Lovable é carregado somente após o clique no navegador.
// Não inicializar o SDK de OAuth durante a avaliação dos módulos no servidor.
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
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-4 py-7 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/10 blur-[120px]"/>
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-info/10 blur-[120px]"/>
      <div className="relative grid w-full max-w-[960px] overflow-hidden rounded-[1.75rem] border border-border bg-card shadow-[0_34px_100px_rgba(0,0,0,0.20)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="finance-hero hidden min-h-[620px] flex-col justify-between border-0 p-10 text-white lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-300 text-slate-950"><Wallet size={24}/></span>
            <div><p className="font-display text-xl font-extrabold tracking-tight">Meu Caixa</p><p className="text-[10px] font-extrabold tracking-[0.18em] text-emerald-200">FINANÇAS PESSOAIS</p></div>
          </div>
          <div className="max-w-sm">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-emerald-200"><Sparkles size={14}/> ORGANIZAÇÃO COMEÇA AQUI</span>
            <h2 className="mt-5 font-display text-[2.7rem] font-extrabold leading-[1.14] tracking-tight">Tudo sob controle.<br/><span className="text-emerald-200">Tudo no seu ritmo.</span></h2>
            <p className="mt-5 text-sm leading-relaxed text-slate-200">Recebimentos Pix, compras, parcelas, vencimentos e metas num só lugar — com clareza, privacidade e um visual feito para o seu dia a dia.</p>
            <div className="mt-8 grid gap-3">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3"><ReceiptText size={19} className="text-emerald-200"/><span className="text-xs font-semibold">Acompanhe entradas e despesas</span></div>
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/8 px-4 py-3"><ShieldCheck size={19} className="text-emerald-200"/><span className="text-xs font-semibold">Confira Pix antes de contabilizar</span></div>
            </div>
          </div>
          <p className="flex items-center gap-2 text-xs text-slate-200"><LockKeyhole size={15} className="text-emerald-200"/> Acesso pessoal · Área privada</p>
        </section>

        <section className="flex min-h-[590px] flex-col justify-center bg-card px-5 py-8 sm:px-9 sm:py-11 lg:px-10">
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3 py-1.5 text-[10px] font-extrabold tracking-[0.14em] text-primary"><Fingerprint size={14}/> ACESSO SEGURO</span>
            <span className="mt-5 flex items-center gap-3 lg:hidden">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground"><Wallet size={22}/></span>
              <span className="font-display text-lg font-extrabold">Meu Caixa</span>
            </span>
            <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Bem-vindo de volta</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Entre na sua conta para consultar suas finanças com segurança.</p>
          </div>

          <button type="button" disabled={busy} onClick={() => void google()} className="inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm font-bold text-foreground transition hover:border-primary/45 hover:bg-secondary disabled:opacity-60">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-card font-display text-sm font-extrabold text-info">G</span>
            Continuar com Google
          </button>

          <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-border"/><span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">ou com e-mail</span><span className="h-px flex-1 bg-border"/></div>

          <form onSubmit={submit} className="space-y-4">
            <label className="block text-xs font-bold text-foreground">E-mail
              <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3.5 text-sm text-foreground"/>
            </label>
            <label className="block text-xs font-bold text-foreground">Senha
              <span className="relative mt-1.5 block">
                <input type={showPassword ? "text" : "password"} autoComplete="current-password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Sua senha de acesso" className="w-full rounded-xl border border-input bg-background px-4 py-3.5 pr-12 text-sm text-foreground"/>
                <button type="button" aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"} onClick={() => setShowPassword((current) => !current)} className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-primary">{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</button>
              </span>
            </label>
            {msg && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs font-semibold leading-relaxed text-destructive">{msg}</p>}
            <button type="submit" disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold text-primary-foreground transition hover:opacity-90 disabled:opacity-60">
              {busy ? "Verificando acesso..." : "Entrar no meu caixa"} {!busy && <ArrowRight size={17}/>}
            </button>
          </form>
          <div className="mt-8 flex items-start gap-2.5 rounded-xl border border-border bg-secondary/25 p-3.5">
            <ShieldCheck size={18} className="mt-0.5 shrink-0 text-primary"/>
            <p className="text-xs leading-relaxed text-muted-foreground">Seu acesso é pessoal. O cadastro público não aparece nesta tela. Proteja também a senha do Google e o desbloqueio do seu celular.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
