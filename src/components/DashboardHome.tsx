import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Camera, Check, CircleCheck, PenLine, QrCode } from "lucide-react";
import { brl, monthLabel, monthSummary, outstandingDebtBalance, type State } from "@/lib/finance";
import { dashboardBills, dueDescription } from "@/lib/dashboard-home";

type FocusTab = "saldo" | "pagar" | "dividas";

export function DashboardHome({
  state,
  month,
  onPay,
}: {
  state: State;
  month: string;
  onPay: (debtId: string, paymentMonth: string) => void;
}) {
  const [tab, setTab] = useState<FocusTab>("saldo");
  const summary = monthSummary(state, month);
  const debtBalance = outstandingDebtBalance(state);
  const bills = dashboardBills(state);
  const info = {
    saldo: {
      title: "Sobra prevista",
      amount: summary.balance,
      description: "Previsão do mês, não saldo da conta",
      primary: "Entrou",
      primaryValue: summary.income,
      secondary: "Saiu",
      secondaryValue: summary.out,
      to: "/lancamentos" as const,
      cta: "Ver lançamentos",
    },
    pagar: {
      title: "A pagar",
      amount: summary.pending,
      description: "Contas ainda não marcadas como pagas",
      primary: "Contas do mês",
      primaryValue: summary.debts,
      secondary: "Já pagas",
      secondaryValue: summary.paid,
      to: "/agenda" as const,
      cta: "Ver agenda",
    },
    dividas: {
      title: "Dívidas a quitar",
      amount: debtBalance,
      description: "Parcelas restantes, sem contas fixas futuras",
      primary: "A pagar no mês",
      primaryValue: summary.pending,
      secondary: "Já pagas no mês",
      secondaryValue: summary.paid,
      to: "/dividas" as const,
      cta: "Ver dívidas",
    },
  }[tab];

  return (
    <>
      <div className="mt-4 grid min-w-0 items-start gap-4 lg:grid-cols-2" aria-label="Visão rápida das finanças">
        <section className="prumo-balance-card relative isolate min-w-0 overflow-hidden rounded-[1.6rem] px-4 py-4 text-white sm:px-6 sm:py-5" aria-label="Saldo e compromissos financeiros">
          <div role="tablist" aria-label="Indicadores financeiros" className="prumo-balance-tabs grid grid-cols-3 gap-1 rounded-full p-1">
            {([
              ["saldo", "Saldo"],
              ["pagar", "A pagar"],
              ["dividas", "Dívidas"],
            ] as const).map(([value, title]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-controls="prumo-finance-tab-panel"
                onClick={() => setTab(value)}
                className={"prumo-balance-tab min-w-0 rounded-full px-2 py-2.5 text-xs font-extrabold transition-colors sm:text-sm " +
                  (tab === value ? "bg-white text-[#075464] shadow-sm" : "text-white/90 hover:bg-white/10")}
              >{title}</button>
            ))}
          </div>
          <div id="prumo-finance-tab-panel" role="tabpanel" className="relative z-10 mt-6">
            <p className="text-xs font-semibold text-white/90 sm:text-sm">{info.title} · {monthLabel(month)}</p>
            <p className="mt-1 break-words font-display text-[clamp(2.1rem,5vw,3.35rem)] font-extrabold leading-tight tracking-[-0.035em] tabular-nums">
              {brl(info.amount)}
            </p>
            <p className="mt-1 text-xs text-white/80">{info.description}</p>
          </div>
          <div className="relative z-10 mt-5 grid grid-cols-2 gap-4 border-t border-white/20 pt-4">
            <div>
              <p className="text-xs font-semibold text-white/75">{info.primary}</p>
              <p className="mt-0.5 break-words font-display text-base font-extrabold tabular-nums sm:text-lg">{brl(info.primaryValue)}</p>
            </div>
            <div className="border-l border-white/20 pl-4">
              <p className="text-xs font-semibold text-white/75">{info.secondary}</p>
              <p className="mt-0.5 break-words font-display text-base font-extrabold tabular-nums sm:text-lg">{brl(info.secondaryValue)}</p>
            </div>
          </div>
          <Link to={info.to}
            className="relative z-10 mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-extrabold text-[#075464] transition hover:bg-[#e8fbf5]">
            {info.cta} <ArrowRight size={16} />
          </Link>
        </section>

        <section className="prumo-bills-panel finance-surface min-w-0 rounded-[1.6rem] border border-border bg-card p-4 sm:p-5" aria-labelledby="home-bills-title">
          <header className="flex items-center justify-between gap-3">
            <h2 id="home-bills-title" className="font-display text-base font-extrabold sm:text-lg">Contas próximas</h2>
            <Link to="/agenda" className="shrink-0 text-xs font-bold text-primary hover:underline">Ver todas <ArrowRight size={13} className="inline" /></Link>
          </header>

          {bills.length ? (
            <ul className="mt-3 divide-y divide-border/75">
              {bills.map((bill) => {
                const late = bill.daysUntil < 0;
                const soon = bill.daysUntil <= 3;
                return (
                  <li key={bill.debt.id + "-" + bill.month} className="flex min-w-0 items-center gap-2.5 py-3 first:pt-0">
                    <span className={"flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl " +
                      (late ? "bg-destructive/10 text-destructive" : soon ? "bg-accent/12 text-accent" : "bg-secondary text-foreground")}>
                      <span className="font-display text-base font-extrabold leading-none tabular-nums">{bill.date.getDate()}</span>
                      <span className="mt-0.5 text-[10px] font-bold uppercase leading-none">{bill.date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{bill.debt.name}</p>
                      <p className={"mt-0.5 text-[11px] " + (late ? "font-semibold text-destructive" : soon ? "font-semibold text-accent" : "text-muted-foreground")}>{dueDescription(bill.daysUntil)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="max-w-28 text-right font-display text-xs font-extrabold tabular-nums sm:text-sm">{brl(bill.amount)}</span>
                      <button
                        type="button"
                        title="Marcar como paga"
                        aria-label={"Marcar " + bill.debt.name + " como paga"}
                        onClick={() => onPay(bill.debt.id, bill.month)}
                        className="grid h-9 w-9 place-items-center rounded-xl text-success transition hover:bg-success/10 focus-visible:outline-2 focus-visible:outline-success">
                        <Check size={17}/>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="mt-3 flex flex-col items-center rounded-2xl bg-secondary/20 px-4 py-8 text-center">
              <CircleCheck size={27} className="text-success" />
              <p className="mt-2 text-sm font-bold">Tudo em dia!</p>
              <p className="mt-1 text-xs text-muted-foreground">Nenhuma conta aberta nos próximos 45 dias.</p>
            </div>
          )}
        </section>
      </div>

      <section className="mt-5" aria-labelledby="home-quick-title">
        <h2 id="home-quick-title" className="mb-3 font-display text-base font-extrabold sm:text-lg">Acesso rápido</h2>
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          <button type="button" onClick={() => window.dispatchEvent(new Event("prumo:quick-add"))}
            className="prumo-quick-action prumo-quick-action-main prumo-quick-action--compact flex min-w-0 items-center gap-2 rounded-2xl px-3 py-3 text-left transition hover:-translate-y-0.5" aria-label="Abrir novo lançamento">
            <PenLine size={20} className="shrink-0" />
            <strong className="text-[11px] font-extrabold leading-tight sm:text-sm">Lançar</strong>
          </button>
          <Link to="/pix" className="prumo-quick-action prumo-quick-success prumo-quick-action--compact flex min-w-0 items-center gap-2 rounded-2xl px-3 py-3 text-left transition hover:-translate-y-0.5">
            <QrCode size={20} className="shrink-0 text-success" />
            <strong className="text-[11px] font-extrabold leading-tight sm:text-sm">Pix</strong>
          </Link>
          <Link to="/extrato" className="prumo-quick-action prumo-quick-info prumo-quick-action--compact flex min-w-0 items-center gap-2 rounded-2xl px-3 py-3 text-left transition hover:-translate-y-0.5">
            <Camera size={20} className="shrink-0 text-info" />
            <strong className="text-[11px] font-extrabold leading-tight sm:text-sm">Extrato</strong>
          </Link>
        </div>
      </section>
    </>
  );
}
