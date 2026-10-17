import { Link, useRouterState } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  LayoutDashboard,
  LogOut,
  Settings,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

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
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/60 font-display text-sm font-bold text-primary-foreground shadow-sm">
        MC
      </span>
      {!compact && (
        <span className="font-display text-lg font-bold tracking-tight">Meu Caixa</span>
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

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card/40 backdrop-blur-xl lg:flex">
        <Brand />
        <nav className="flex-1 space-y-0.5 px-3">
          {NAV.map(({ to, label, icon: Icon }) => {
            const on = isActive(path, to);
            return (
              <Link
                key={to}
                to={to}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  on
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span>{label}</span>
                {on && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Lucas</p>
              <p className="truncate text-xs text-muted-foreground">Conta local</p>
            </div>
            <button
              aria-label="Sair"
              className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Coluna principal */}
      <div className="lg:pl-64">
        {/* Top bar — mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/85 px-4 backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/60 font-display text-xs font-bold text-primary-foreground">
              MC
            </span>
            <span className="font-display text-base font-bold">Meu Caixa</span>
          </div>
          <Avatar />
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 lg:px-8 lg:pb-14 lg:pt-8">
          {children}
        </main>
      </div>

      {/* Bottom nav — mobile */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map(({ to, label, icon: Icon }) => {
            const on = isActive(path, to);
            return (
              <Link
                key={to}
                to={to}
                className={`relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition ${
                  on ? "text-primary" : "text-muted-foreground"
                }`}
              >
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
    <div className="group relative overflow-hidden rounded-2xl border border-border bg-card p-4 transition hover:border-primary/30">
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
      <p className={`mt-2 font-display text-2xl font-bold leading-tight tabular-nums ${color}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <span className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/5 opacity-0 transition group-hover:opacity-100" />
    </div>
  );
}