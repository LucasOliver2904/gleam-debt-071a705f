import { createFileRoute, Link } from "@tanstack/react-router";
import { History, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { AppShell } from "@/components/AppShell";
import { DashboardHome } from "@/components/DashboardHome";
import { FirstSteps } from "@/components/FirstSteps";
import {
  PendingReviewBanner,
  RecentActivity,
  WeeklyOverview,
} from "@/components/DashboardActivity";
import { useProfile } from "@/lib/use-profile";
import {
  currentMonth,
  getFinanceUser,
  getState,
  monthLabel,
  setState,
  useFinance,
} from "@/lib/finance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Início — Prumo" },
      { name: "description", content: "Sua visão rápida: saldo previsto, contas, lançamentos e simulador de compras parceladas." },
      { property: "og:title", content: "Início — Prumo" },
      { property: "og:description", content: "Acompanhe seu mês e simule se uma nova compra cabe no seu orçamento." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function DashboardSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando seu resumo financeiro"
      className="space-y-4"
    >
      <Skeleton className="h-7 w-52" />
      <Skeleton className="h-4 w-40" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-3xl" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

function Dashboard() {
  const state = useFinance();
  const profile = useProfile();
  if (!state.ready)
    return (
      <AppShell>
        <DashboardSkeleton />
      </AppShell>
    );

  const month = currentMonth();
  function markPaid(id: string, paymentMonth: string, paid: boolean) {
    setState((current) => ({
      ...current,
      debts: current.debts.map((debt) => {
        const installment = debt.payments[paymentMonth];
        if (debt.id !== id || !installment) return debt;
        return {
          ...debt,
          payments: { ...debt.payments, [paymentMonth]: { ...installment, paid } },
        };
      }),
    }));
  }
  function pay(id: string, paymentMonth: string) {
    const userId = getFinanceUser();
    const payment = getState().debts.find((debt) => debt.id === id)?.payments[paymentMonth];
    if (!userId || !payment || payment.paid) return;
    markPaid(id, paymentMonth, true);
    toast.success("Conta marcada como paga", {
      action: {
        label: "Desfazer",
        onClick: () => {
          if (getFinanceUser() !== userId) return;
          const current = getState().debts.find((debt) => debt.id === id)?.payments[paymentMonth];
          if (!current?.paid || current.amount !== payment.amount) {
            toast.info("Esta conta foi atualizada. Confira o pagamento na agenda.");
            return;
          }
          markPaid(id, paymentMonth, false);
        },
      },
    });
  }

  return (
    <AppShell>
      <header className="mb-1">
        <p className="finance-kicker">PRUMO / INÍCIO</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">
          {profile.name ? "Olá, " + profile.name + " 👋" : "Olá 👋"}
        </h1>
        <p className="mt-1 text-xs capitalize text-muted-foreground sm:text-sm">
          Seu resumo de {monthLabel(month, true)}
        </p>
      </header>

      <PendingReviewBanner state={state} />
      <FirstSteps key={getFinanceUser()} state={state} />
      <DashboardHome state={state} month={month} onPay={pay} />
      <Link to="/historico" className="finance-surface mt-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-card p-4 hover:border-primary"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><History size={22}/></span><span className="min-w-0 flex-1"><span className="block font-display font-bold">Histórico de gastos</span><span className="block text-xs text-muted-foreground">Consulte seus pagamentos por categoria e período</span></span><ArrowRight size={18} className="shrink-0 text-primary"/></Link>
      <WeeklyOverview state={state} />
      <RecentActivity state={state} />
    </AppShell>
  );
}
