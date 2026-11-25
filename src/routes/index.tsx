import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays } from "lucide-react";
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
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
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
      <header className="prumo-page-heading">
        <h1>{profile.name ? "Olá, " + profile.name : "Seu painel"}</h1>
        <span><CalendarDays size={15} aria-hidden="true" />
          <time dateTime={month}>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(month + "-15T12:00:00"))}</time>
        </span>
      </header>

      <PendingReviewBanner state={state} />
      <FirstSteps key={getFinanceUser()} state={state} />
      <DashboardHome state={state} month={month} onPay={pay} />
      <div className="prumo-home-activity">
        <WeeklyOverview state={state} />
        <RecentActivity state={state} />
      </div>
    </AppShell>
  );
}
