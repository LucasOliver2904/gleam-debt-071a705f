import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  AlertCircle, ArrowRight, CalendarClock, Check, CheckCheck, ChevronLeft,
  ChevronRight, Clock3, CreditCard, RotateCcw, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/AppShell";
import { addMonths, brl, currentMonth, monthLabel, setState, useFinance } from "@/lib/finance";
import { calendarDays, monthBills, type MonthBill } from "@/lib/planning";

export const Route = createFileRoute("/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda de vencimentos — Meu Caixa" },
      { name: "description", content: "Calendário de contas e vencimentos com marcação de pagamentos." },
    ],
  }),
  component: AgendaPage,
});

const weekdays = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function dueStatus(bill: MonthBill) {
  if (bill.payment.paid) return { text: "Pago", className: "bg-success/15 text-success", icon: Check };
  if (bill.daysUntil < 0) return { text: "Atrasada", className: "bg-destructive/15 text-destructive", icon: AlertCircle };
  if (bill.daysUntil === 0) return { text: "Vence hoje", className: "bg-accent/15 text-accent", icon: Clock3 };
  return { text: bill.daysUntil === 1 ? "Amanhã" : "Dia " + bill.day, className: "bg-secondary text-muted-foreground", icon: Clock3 };
}

function AgendaPage() {
  const s = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [day, setDay] = useState<string | null>(null);
  if (!s.ready) return <AppShell><div /></AppShell>;

  const bills = monthBills(s, month);
  const visible = day ? bills.filter((bill) => bill.dateKey === day) : bills;
  const calendar = calendarDays(month);
  const amount = bills.reduce((sum, bill) => sum + bill.payment.amount, 0);
  const open = bills.filter((bill) => !bill.payment.paid);
  const pending = open.reduce((sum, bill) => sum + bill.payment.amount, 0);
  const overdue = open.filter((bill) => bill.daysUntil < 0);
  const paid = bills.length - open.length;
  const paidPercentage = bills.length ? Math.round(paid / bills.length * 100) : 0;
  const byDay = new Map<string, MonthBill[]>();
  for (const bill of bills) byDay.set(bill.dateKey, [...(byDay.get(bill.dateKey) ?? []), bill]);

  function navigate(n: number) {
    setMonth((m) => addMonths(m, n));
    setDay(null);
  }

  function togglePayment(bill: MonthBill) {
    setState((current) => ({
      ...current,
      debts: current.debts.map((debt) => {
        if (debt.id !== bill.debt.id || !debt.payments[bill.month]) return debt;
        return {
          ...debt,
          payments: {
            ...debt.payments,
            [bill.month]: { ...debt.payments[bill.month]!, paid: !debt.payments[bill.month]!.paid },
          },
        };
      }),
    }));
    toast.success(bill.payment.paid ? "Pagamento voltou para pendente" : "Pagamento registrado!");
  }

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="finance-kicker">CONTAS / CALENDÁRIO</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Sua agenda financeira</h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">Visualize quando cada conta vence e marque os pagamentos sem sair daqui.</p>
        </div>
        <Link to="/dividas" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-primary/40">
          Gerenciar contas <ArrowRight size={15} />
        </Link>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contas no mês" value={String(bills.length)} icon={CalendarClock} hint={monthLabel(month, true)} />
        <Stat label="Ainda a pagar" value={brl(pending)} tone={pending > 0 ? "neg" : "pos"} icon={Wallet} />
        <Stat label="Pagamentos feitos" value={String(paid)} tone="pos" icon={CheckCheck} hint={amount > 0 ? brl(amount - pending) + " pagos" : "Sem contas cadastradas"} />
        <Stat label="Vencidas" value={String(overdue.length)} tone={overdue.length ? "neg" : "pos"} icon={AlertCircle} />
      </div>

      <section className="finance-surface mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5" aria-label="Progresso dos pagamentos do mês">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2"><CheckCheck size={18} className="text-success"/><span className="font-bold">Pagamentos em dia</span></div>
          <span className="font-display text-base font-extrabold tabular-nums text-success">{paidPercentage}%</span>
        </div>
        <div role="progressbar" aria-label="Percentual de contas pagas" aria-valuenow={paidPercentage} aria-valuemin={0} aria-valuemax={100} className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-500" style={{ width: paidPercentage + "%" }}/>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{paid} de {bills.length} conta(s) quitadas em {monthLabel(month, true)}. Toque em uma data para filtrar os vencimentos.</p>
      </section>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-[1.12fr_1fr]">
        <section className="finance-surface overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="finance-kicker">ESCOLHA UM DIA</p>
              <h2 className="mt-1 font-display text-xl font-extrabold">{monthLabel(month, true)}</h2>
            </div>
            <div className="flex items-center gap-1.5">
              <button aria-label="Mês anterior" onClick={() => navigate(-1)} className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground hover:bg-secondary"><ChevronLeft size={18} /></button>
              <button onClick={() => { setMonth(currentMonth()); setDay(null); }} className="rounded-xl border border-border px-3 py-2.5 text-xs font-semibold hover:bg-secondary">Hoje</button>
              <button aria-label="Próximo mês" onClick={() => navigate(1)} className="grid h-10 w-10 place-items-center rounded-xl border border-border text-foreground hover:bg-secondary"><ChevronRight size={18} /></button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-7 gap-1.5 text-center">
            {weekdays.map((item) => <span key={item} className="pb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{item}</span>)}
            {calendar.map((cell) => {
              const events = byDay.get(cell.key) ?? [];
              const hasOpen = events.some((event) => !event.payment.paid);
              const hasOverdue = events.some((event) => !event.payment.paid && event.daysUntil < 0);
              const selected = cell.key === day;
              return (
                <button
                  key={cell.key}
                  type="button"
                  disabled={!cell.inMonth}
                  aria-label={cell.inMonth ? "Dia " + cell.day + ": " + events.length + " conta(s)" : undefined}
                  aria-pressed={selected}
                  onClick={() => setDay((current) => current === cell.key ? null : cell.key)}
                  className={
                    "relative flex aspect-square min-h-10 flex-col items-center justify-center rounded-xl border text-sm font-semibold transition " +
                    (selected ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/15 " :
                      cell.inMonth ? "border-border/50 bg-secondary/25 hover:border-primary/45 hover:bg-secondary " :
                        "border-transparent text-muted-foreground/25 ") +
                    (cell.isToday && !selected ? "ring-2 ring-primary/45 " : "")
                  }
                >
                  {cell.day}
                  {events.length > 0 && cell.inMonth &&
                    <span className={"absolute bottom-1.5 h-1.5 w-1.5 rounded-full " +
                      (selected ? "bg-primary-foreground" : hasOverdue ? "bg-destructive" : hasOpen ? "bg-accent" : "bg-success")} />
                  }
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-destructive" /> Em atraso</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-accent" /> A pagar</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-success" /> Pago</span>
            </div>
            {day && <button className="text-xs font-semibold text-primary hover:underline" onClick={() => setDay(null)}>Ver o mês inteiro</button>}
          </div>
        </section>

        <section className="finance-surface overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="finance-kicker">SEUS VENCIMENTOS</p>
              <h2 className="mt-1 font-display text-xl font-extrabold">{day ? "Dia " + Number(day.slice(-2)) : "Todas as contas"}</h2>
            </div>
            <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-bold">{visible.length} conta(s)</span>
          </div>
          {visible.length === 0 ? (
            <div className="mt-6 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-5 py-12 text-center">
              <CheckCheck size={28} className="text-success" />
              <p className="font-semibold">Nenhuma conta para este dia</p>
              <p className="text-xs text-muted-foreground">Escolha outro dia ou cadastre uma conta na aba Dívidas.</p>
              <Link to="/dividas" className="mt-2 text-sm font-semibold text-primary hover:underline">Ir para Dívidas</Link>
            </div>
          ) : (
            <ul className="mt-5 max-h-[570px] space-y-2 overflow-y-auto pr-1">
              {visible.map((bill) => {
                const status = dueStatus(bill);
                const Icon = status.icon;
                return (
                  <li key={bill.debt.id + bill.month} className="flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3 transition hover:border-primary/30 hover:bg-secondary/25">
                    <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-bold " +
                      (bill.payment.paid ? "bg-success/15 text-success" :
                        bill.daysUntil < 0 ? "bg-destructive/15 text-destructive" : "bg-secondary text-foreground")}>
                      <span className="text-center"><span className="block text-[9px] uppercase">dia</span><span className="text-base">{bill.day}</span></span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{bill.debt.name}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{bill.debt.category ?? "Outros"} · {bill.date.toLocaleDateString("pt-BR")}</p>
                      <span className={"mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold " + status.className}>
                        <Icon size={11} />{status.text}
                      </span>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-extrabold tabular-nums">{brl(bill.payment.amount)}</p>
                      <button onClick={() => togglePayment(bill)}
                        aria-label={bill.payment.paid ? "Reabrir " + bill.debt.name : "Marcar " + bill.debt.name + " como paga"}
                        className={"mt-2 inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition " +
                          (bill.payment.paid ? "bg-secondary text-muted-foreground hover:bg-secondary/70" : "bg-success/15 text-success hover:bg-success/25")}>
                        {bill.payment.paid ? <RotateCcw size={12} /> : <Check size={12} />}
                        {bill.payment.paid ? "Reabrir" : "Paguei"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="mt-5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <CreditCard size={16} className="mr-2 inline text-primary" />
            Sem dia informado? O app considera o último dia válido do mês. Você pode alterar o vencimento em <Link to="/dividas" className="font-semibold text-primary hover:underline">Dívidas</Link>.
          </div>
        </section>
      </div>
    </AppShell>
  );
}
