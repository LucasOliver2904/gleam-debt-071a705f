import { Link } from "@tanstack/react-router";
import { LayoutDashboard, CreditCard, ArrowLeftRight, Wallet } from "lucide-react";
import type { ReactNode } from "react";

const nav = [
  { to: "/", label: "Painel", icon: LayoutDashboard },
  { to: "/dividas", label: "Dívidas", icon: CreditCard },
  { to: "/lancamentos", label: "Lançamentos", icon: ArrowLeftRight },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <div className="flex items-center gap-2 font-display text-lg font-bold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground"><Wallet size={18} /></span>
            Meu Caixa
          </div>
          <nav className="flex gap-1 overflow-x-auto">
            {nav.map((n) => (
              <Link key={n.to} to={n.to} activeOptions={{ exact: true }}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                activeProps={{ className: "bg-secondary text-foreground" }}>
                <n.icon size={16} /> <span className="hidden sm:inline">{n.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: "pos" | "neg" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-2 font-display text-2xl font-bold ${tone === "pos" ? "text-success" : tone === "neg" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
