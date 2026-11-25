import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  History,
  CalendarDays,
  QrCode,
  Target,
  LayoutDashboard,
  LogOut,
  Plus,
  Moon,
  MoreHorizontal,
  ShieldCheck,
  FileImage,
  BellRing,
  ArrowRight,
  Sun,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";
import { alerts, useFinance } from "@/lib/finance";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { QuickAdd } from "@/components/QuickAdd";
import { SyncStatus } from "@/components/SyncStatus";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NAV = [
  { to: "/", label: "Painel", short: "Início", icon: LayoutDashboard },
  { to: "/dividas", label: "Contas", short: "Contas", icon: Wallet },
  { to: "/historico", label: "Histórico de gastos", short: "Histórico", icon: History },
  { to: "/agenda", label: "Agenda", short: "Agenda", icon: CalendarDays },
  { to: "/pix", label: "Pix e repasses", short: "Pix", icon: QrCode },
  { to: "/lancamentos", label: "Lançamentos", short: "Movimentos", icon: ArrowLeftRight },
  { to: "/extrato", label: "Importar extrato", short: "Extrato", icon: FileImage },
  { to: "/planejamento", label: "Planejamento", short: "Planos", icon: Target },
  { to: "/ajustes", label: "Ajustes", short: "Ajustes", icon: Settings },
] as const;

const MOBILE_ITEMS = NAV.filter((item) => ["/", "/dividas", "/pix", "/lancamentos"].includes(item.to));
const MORE_ITEMS = NAV.filter((item) => ["/historico", "/agenda", "/extrato", "/planejamento", "/ajustes"].includes(item.to));

const isActive = (path: string, to: string) =>
  to === "/" ? path === "/" : path.startsWith(to);

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className={`flex items-center gap-2.5 ${compact ? "" : "px-5 py-5"}`}>
      <img src="/icons/icon.svg?v=5" width={40} height={40} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-md shadow-primary/10" />
      {!compact && (
        <span><span className="block font-display text-lg font-extrabold tracking-tight">Prumo</span><span className="block text-[9px] font-semibold tracking-[0.16em] text-muted-foreground">FINANÇAS PESSOAIS</span></span>
      )}
    </Link>
  );
}

function Avatar({ initial }: { initial: string }) {
  return (
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-sm font-extrabold text-primary ring-1 ring-primary/25" aria-hidden="true">
      {initial}
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const finances = useFinance();
  const profile = useProfile();
  const overdue = finances.ready ? alerts(finances).filter((item) => item.status === "atrasada").length : 0;
  const pixWaiting = finances.ready ? (finances.pixInbox?.length ?? 0) : 0;
  const expensesWaiting = finances.ready ? (finances.expenseInbox?.length ?? 0) : 0;
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  useEffect(() => {
    setTheme(localStorage.getItem("meu-caixa-theme") === "light" ? "light" : "dark");
  }, []);
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset["theme"] = next;
    try { localStorage.setItem("meu-caixa-theme", next); }
    catch { toast("Tema aplicado nesta sessão. Não foi possível salvar a preferência no aparelho."); }
  };
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error("Não foi possível sair. Tente novamente.");
  };
  useEffect(() => { setMoreOpen(false); }, [path]);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) setMoreOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);
  useEffect(() => {
    const openQuickAdd = () => setQuickAddOpen(true);
    window.addEventListener("prumo:quick-add", openQuickAdd);
    return () => window.removeEventListener("prumo:quick-add", openQuickAdd);
  }, []);

  return (
    <div className="finance-page-accent min-h-screen bg-background text-foreground">
      <aside className="finance-nav fixed inset-y-0 left-0 z-40 hidden w-[266px] flex-col border-r border-sidebar-border backdrop-blur-xl lg:flex">
        <Brand />
        <nav aria-label="Menu principal" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pt-7"><p className="mb-4 px-3 text-[10px] font-extrabold tracking-[0.19em] text-muted-foreground">MEU ESPAÇO</p>
          {NAV.map(({ to, label, icon: Icon }) => {
            const on = isActive(path, to);
            return (
              <Link key={to} to={to} data-active={on} aria-current={on ? "page" : undefined} className={`finance-nav-item group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${on ? "text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
                {to === "/agenda" && overdue > 0 && <span aria-label={overdue + " contas atrasadas"} className="ml-auto rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-extrabold text-destructive">{overdue > 99 ? "99+" : overdue}</span>}
                {to === "/lancamentos" && expensesWaiting > 0 && <span aria-label={expensesWaiting + " gastos aguardando conferência"} className="ml-auto rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-extrabold text-warning">{expensesWaiting > 99 ? "99+" : expensesWaiting}</span>}
                {to === "/pix" && pixWaiting > 0 && <span aria-label={pixWaiting + " Pix aguardando conferência"} className="ml-auto rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-extrabold text-warning">{pixWaiting > 99 ? "99+" : pixWaiting}</span>}
                {on && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
            <ShieldCheck size={17} className="shrink-0 text-primary" />
            <span className="text-[11px] leading-relaxed text-muted-foreground"><b className="block text-foreground">Área pessoal</b>Finanças sob seu controle</span>
          </div>
          <PrivacyToggle />
          <button onClick={toggleTheme} className="mb-2 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground">{theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}{theme === "dark" ? "Modo claro" : "Modo escuro"}</button>
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar initial={profile.initial} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile.name ?? "Minha conta"}</p>
              <p className="truncate text-xs text-muted-foreground">Seu espaço financeiro</p>
            </div>
            <button aria-label="Sair da conta" onClick={() => void signOut()} className="grid h-11 w-11 place-items-center rounded-xl text-muted-foreground transition hover:bg-secondary hover:text-foreground">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 lg:pl-[266px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl lg:hidden">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Prumo, voltar ao painel">
            <img src="/icons/icon.svg?v=5" width={40} height={40} alt="" aria-hidden="true" className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-lg shadow-primary/15" />
            <span><span className="block font-display text-base font-extrabold leading-tight tracking-tight">Prumo</span><span className="block text-[9px] font-bold tracking-[0.16em] text-muted-foreground">CONTROLE PESSOAL</span></span>
          </Link>
          <div className="flex items-center gap-1.5">
            <Link to="/historico" aria-label="Abrir histórico de gastos" className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-primary"><History size={19}/></Link>
            <PrivacyToggle compact />
            <Link to="/agenda" aria-label={overdue > 0 ? `${overdue} contas atrasadas. Ver agenda` : "Abrir agenda"} className="relative grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-primary">
              <BellRing size={18} />
              {overdue > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border border-background bg-destructive" />}
            </Link>
            <button type="button" onClick={toggleTheme} aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"} className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-primary">{theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}</button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1300px] px-4 pb-36 pt-5 sm:px-6 lg:px-9 lg:pb-16 lg:pt-9">
          <div className="mb-4"><SyncStatus /></div>
          {children}
        </main>
      </div>

      {/* Evita duplicar o botão Lançar na tela inicial. */}
      {path !== "/" && <button
        onClick={() => setQuickAddOpen(true)}
        className="finance-floating-action fixed bottom-[calc(6.4rem+env(safe-area-inset-bottom))] right-4 z-40 grid h-13 w-13 place-items-center rounded-2xl bg-primary text-primary-foreground transition hover:scale-105 active:scale-95 lg:bottom-8 lg:right-8 lg:h-16 lg:w-16"
        aria-label="Novo lançamento rápido"
      >
        <Plus size={24} className="lg:size-8" />
      </button>}

      {quickAddOpen && <QuickAdd onClose={() => setQuickAddOpen(false)} />}

      {moreOpen && (
        <Dialog open onOpenChange={setMoreOpen}>
          <DialogContent className="bottom-[calc(5.9rem+env(safe-area-inset-bottom))] left-3 right-3 top-auto max-h-[calc(100dvh-8rem)] overflow-y-auto w-auto max-w-none translate-x-0 translate-y-0 rounded-2xl border-border bg-card p-4 lg:hidden">
            <DialogHeader><p className="finance-kicker">NAVEGAÇÃO</p><DialogTitle className="font-display text-lg font-bold">Mais do Prumo</DialogTitle><DialogDescription className="sr-only">Acesse histórico de gastos, agenda, extrato, planejamento e ajustes.</DialogDescription></DialogHeader>
            <div className="mt-3 grid gap-2">
              {MORE_ITEMS.map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} onClick={() => setMoreOpen(false)} className="flex items-center gap-3 rounded-2xl border border-border bg-secondary/30 px-3 py-3 text-sm font-semibold transition hover:border-primary/40 hover:bg-primary/5">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/12 text-primary"><Icon size={19}/></span><span className="flex-1">{label}</span>
                  {to === "/agenda" && overdue > 0 && <span className="rounded-full bg-destructive/15 px-2 py-1 text-[11px] text-destructive">{overdue} atrasada(s)</span>}
                  <ArrowRight size={16} className="text-muted-foreground"/>
                </Link>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => { toggleTheme(); setMoreOpen(false); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-3 py-3 text-xs font-bold text-muted-foreground">{theme === "dark" ? <Sun size={16}/> : <Moon size={16}/>} {theme === "dark" ? "Modo claro" : "Modo escuro"}</button>
              <button onClick={() => void signOut()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-destructive/25 px-3 py-3 text-xs font-bold text-destructive"><LogOut size={16}/> Sair da conta</button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <nav aria-label="Navegação rápida" className="finance-bottom-nav fixed bottom-[calc(0.7rem+env(safe-area-inset-bottom))] left-3 right-3 z-30 rounded-[1.6rem] border border-border p-1.5 backdrop-blur-xl lg:hidden">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {MOBILE_ITEMS.map(({ to, short, icon: Icon }) => {
            const on = isActive(path, to);
            return (
              <Link key={to} to={to} aria-label={short} aria-current={on ? "page" : undefined} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition ${on ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
                {on && <span className="absolute top-0 h-[3px] w-9 rounded-b-full bg-primary" />}
                <span className={`relative grid h-8 w-11 place-items-center rounded-xl ${on ? "bg-primary text-primary-foreground shadow-md shadow-primary/25" : ""}`}>
                  <Icon size={20} strokeWidth={on ? 2.5 : 2} />
                  {to === "/pix" && pixWaiting > 0 && <i className="absolute right-1 top-0 h-2.5 w-2.5 rounded-full border border-card bg-warning" />}
                  {to === "/lancamentos" && expensesWaiting > 0 && <i className="absolute right-1 top-0 h-2.5 w-2.5 rounded-full border border-card bg-warning" />}
                </span>
                <span className="max-w-full truncate px-0.5 tracking-tight">{short}</span>
              </Link>
            );
          })}
          <button onClick={() => setMoreOpen((current) => !current)} aria-label="Mais opções" aria-expanded={moreOpen} className={`relative flex min-h-[60px] flex-col items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition ${moreOpen || MORE_ITEMS.some((item) => isActive(path, item.to)) ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {(moreOpen || MORE_ITEMS.some((item) => isActive(path, item.to))) && <span className="absolute top-0 h-[3px] w-9 rounded-b-full bg-primary" />}
            <span className={`relative grid h-8 w-11 place-items-center rounded-xl ${moreOpen ? "bg-primary text-primary-foreground" : ""}`}><MoreHorizontal size={23}/>{overdue > 0 && <i className="absolute right-1 top-0 h-2.5 w-2.5 rounded-full border border-card bg-destructive" />}</span>
            <span>Mais</span>
          </button>
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
  const color = tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : "text-foreground";
  const iconTone = tone === "pos" ? "bg-success/12 text-success" : tone === "neg" ? "bg-destructive/12 text-destructive" : "bg-info/12 text-info";
  return (
    <article data-tone={tone ?? "default"} className="finance-stat-card group min-w-0 overflow-hidden px-4 pb-5 pt-5 sm:px-5 sm:pb-6">
      <div className="flex min-h-8 items-start justify-between gap-2">
        <p className="max-w-[80%] text-[10px] font-extrabold uppercase leading-relaxed tracking-[0.12em] text-muted-foreground sm:text-[11px]">{label}</p>
        {Icon && <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${iconTone}`}><Icon size={17} strokeWidth={2.2}/></span>}
      </div>
      <p className={`mt-3 min-w-0 break-words font-display text-[clamp(1.08rem,2.1vw,1.75rem)] font-extrabold leading-tight tracking-tight tabular-nums ${color}`}>{value}</p>
      {hint && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </article>
  );
}
