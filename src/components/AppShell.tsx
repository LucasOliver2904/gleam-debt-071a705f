import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  LayoutDashboard,
  LogOut,
  Plus,
  Moon,
  Sun,
  Settings,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { CATEGORIES, localToday, parseMoney, setState, uid, type Tx } from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";

const NAV = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/dividas", label: "Dívidas", icon: Wallet },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
] as const;

const isActive = (path: string, to: string) =>
  to === "/" ? path === "/" : path.startsWith(to);

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${compact ? "" : "px-5 py-5"}`}>
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md shadow-primary/10">
        <Wallet size={20} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span><span className="block font-display text-lg font-extrabold tracking-tight">Meu Caixa</span><span className="block text-[9px] font-semibold tracking-[0.16em] text-muted-foreground">FINANÇAS PESSOAIS</span></span>
      )}
    </Link>
  );
}

function Avatar() {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-full bg-secondary text-sm font-semibold ring-1 ring-border">
      L
    </span>
  );
}

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function QuickAdd({ onClose }: { onClose: () => void }) {
  const [kind, setKind] = useState<Tx["kind"]>("saida");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [date, setDate] = useState(() => localToday());
  const [err, setErr] = useState("");

  const submit = () => {
    const v = parseMoney(amount);
    if (!desc.trim() || desc.length > 100) return setErr("Informe uma descrição.");
    if (!(v > 0)) return setErr("Valor inválido.");
    setState((st) => ({ ...st, txs: [{ id: uid(), date, description: desc.trim(), amount: v, kind, category }, ...st.txs] }));
    toast.success(kind === "entrada" ? "Entrada registrada" : "Saída registrada");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Novo lançamento</h2>
          <button onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
            <X size={18} />
          </button>
        </div>
        
        <div className="mt-5 space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setKind("entrada")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${kind === "entrada" ? "border-success bg-success/15 text-success" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              <ArrowDownLeft size={15} /> Entrada
            </button>
            <button onClick={() => setKind("saida")} className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${kind === "saida" ? "border-destructive bg-destructive/15 text-destructive" : "border-border text-muted-foreground hover:bg-secondary"}`}>
              <ArrowUpRight size={15} /> Saída
            </button>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Valor</label>
            <div className="relative mt-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
              <input autoFocus className={input + " pl-10 text-lg font-semibold"} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Descrição</label>
            <input className={input + " mt-1"} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ex: Mercado, Uber..." />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground">Data</label>
            <input className={input + " mt-1"} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div><label className="block text-sm text-muted-foreground">Categoria</label><select className={input + " mt-1"} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          
          <button onClick={submit} className={`w-full rounded-xl py-3.5 font-semibold text-primary-foreground transition hover:opacity-90 ${kind === "entrada" ? "bg-success" : "bg-primary"}`}>
            Lançar {kind === "entrada" ? "Entrada" : "Saída"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(localStorage.getItem("meu-caixa-theme") === "light" ? "light" : "dark");
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("meu-caixa-theme", next);
    document.documentElement.dataset.theme = next;
  };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Não foi possível sair. Tente novamente.");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="finance-nav fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border backdrop-blur-xl lg:flex">
        <Brand />
        <nav className="flex-1 space-y-1 px-3 pt-6"><p className="mb-3 px-3 text-[10px] font-bold tracking-[0.16em] text-muted-foreground">ESPAÇO DE TRABALHO</p>
          {NAV.map(({ to, label, icon: Icon }) => {
            const on = isActive(path, to);
            return (
              <Link key={to} to={to} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${on ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
                {on && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <button onClick={toggleTheme} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}{theme === "dark" ? "Modo claro" : "Modo escuro"}</button>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Lucas</p>
              <p className="truncate text-xs text-muted-foreground">Seu espaço financeiro</p>
            </div>
            <button aria-label="Sair da conta" onClick={() => void signOut()} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 text-primary-foreground"><Wallet size={17} /></span>
            <span className="font-display text-base font-bold">Meu Caixa</span>
          </div>
          <div className="flex items-center gap-2"><button onClick={toggleTheme} aria-label="Alternar tema" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button><Avatar /></div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 lg:px-8 lg:pb-14 lg:pt-8">
          {children}
        </main>
      </div>

      {/* FAB */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 hover:shadow-primary/40 active:scale-95 lg:bottom-8 lg:right-8 lg:h-16 lg:w-16"
        aria-label="Novo lançamento rápido"
      >
        <Plus size={24} className="lg:size-8" />
      </button>

      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 shadow-[0_-8px_30px_rgba(0,0,0,0.07)] backdrop-blur-xl lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const on = isActive(path, to);
            return (
              <Link key={to} to={to} className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${on ? "text-primary" : "text-muted-foreground"}`}>
                {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-primary" />}
                <Icon size={20} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function Stat({
  label,
  value,
  tone,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg";
  icon?: LucideIcon;
  hint?: string;
}) {
  const color =
    tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : "text-foreground";
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-[0_10px_30px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg md:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span
            className={`grid h-8 w-8 place-items-center rounded-lg ${
              tone === "pos"
                ? "bg-success/15 text-success"
                : tone === "neg"
                ? "bg-destructive/15 text-destructive"
                : "bg-secondary text-muted-foreground"
            }`}
          >
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className={`mt-3 font-display text-xl font-extrabold leading-tight tracking-tight tabular-nums sm:text-2xl ${color}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}
