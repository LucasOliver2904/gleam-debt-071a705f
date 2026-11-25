import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgePercent, Calculator, Camera, Check, ChevronDown, ChevronRight, CircleCheck, History, PenLine, QrCode, Scale } from "lucide-react";
import { brl, monthSummary, outstandingDebtBalance, round2, type State } from "@/lib/finance";
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
  const panelId = useId();
  const summary = monthSummary(state, month);
  const debtBalance = outstandingDebtBalance(state);
  const bills = dashboardBills(state);
  const registeredIncome = round2(state.txs.filter((tx) => tx.kind === "entrada" && tx.date.startsWith(month)).reduce((sum, tx) => sum + tx.amount, 0));
  const registeredExpenses = round2(state.txs.filter((tx) => tx.kind === "saida" && !tx.excludedFromTotals && tx.date.startsWith(month)).reduce((sum, tx) => sum + tx.amount, 0));
  const info = {
    saldo: {
      title: "Sobra prevista",
      amount: summary.balance,
      description: "Estimativa para o fim do mês",
      primary: "Entradas previstas",
      primaryValue: summary.income,
      secondary: "Despesas previstas",
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
      description: "Total das parcelas restantes",
      primary: "A pagar no mês",
      primaryValue: summary.pending,
      secondary: "Já pagas no mês",
      secondaryValue: summary.paid,
      to: "/dividas" as const,
      cta: "Ver dívidas",
    },
  }[tab];

  return (
    <div className="prumo-home-grid">
      <section className="prumo-balance-card" aria-label="Saldo e compromissos financeiros">
        <div role="tablist" aria-label="Indicadores financeiros" className="prumo-balance-tabs">
          {([
            ["saldo", "Previsão"],
            ["pagar", "A pagar"],
            ["dividas", "Dívidas"],
          ] as const).map(([value, title]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={panelId + "-" + value}
              tabIndex={tab === value ? 0 : -1}
              aria-selected={tab === value}
              aria-controls={panelId}
              onClick={() => setTab(value)}
              onKeyDown={(event) => {
                const order: FocusTab[] = ["saldo", "pagar", "dividas"];
                const index = order.indexOf(tab);
                const next = event.key === "ArrowRight" ? order[(index + 1) % 3] : event.key === "ArrowLeft" ? order[(index + 2) % 3] : event.key === "Home" ? order[0] : event.key === "End" ? order[2] : undefined;
                if (!next) return;
                event.preventDefault();
                setTab(next);
                document.getElementById(panelId + "-" + next)?.focus();
              }}
              className="prumo-balance-tab"
            >{title}</button>
          ))}
        </div>
        <div id={panelId} role="tabpanel" aria-labelledby={panelId + "-" + tab} className="prumo-balance-total">
          <h2>{info.title}</h2>
          <p className="prumo-total-value">{brl(info.amount)}</p>
          <p className="prumo-total-caption">{info.description}</p>
        </div>
        <dl className="prumo-balance-breakdown">
          <div><dt>{info.primary}</dt><dd>{brl(info.primaryValue)}</dd></div>
          <div><dt>{info.secondary}</dt><dd>{brl(info.secondaryValue)}</dd></div>
        </dl>
        <div className="prumo-balance-tools">
          <Link to={info.to} className="prumo-balance-link">{info.cta} <ArrowRight size={16} /></Link>
          {tab === "saldo" && <details className="prumo-balance-details">
            <summary><span className="sr-only">Como calculamos esta previsão</span><span aria-hidden="true">Ver cálculo</span> <ChevronDown size={15} aria-hidden="true" /></summary>
            <dl className="space-y-2 border-t border-white/20 py-3 text-xs sm:text-sm">
              {[["Renda base prevista", state.income[month] ?? 0], ["Entradas registradas", registeredIncome], ["Contas do mês (pagas e pendentes)", summary.debts], ["Saídas avulsas registradas", registeredExpenses], ["Contas já marcadas como pagas", summary.paid]].map(([label, value]) => <div key={String(label)} className="flex flex-wrap justify-between gap-2"><dt>{label}</dt><dd className="font-bold tabular-nums">{brl(Number(value))}</dd></div>)}
            </dl>
            <p className="pb-3 text-xs leading-relaxed text-white/85">A renda base e as entradas registradas são somadas. Cadastre na base apenas a renda que não será lançada separadamente. A previsão considera todas as contas do mês e as saídas registradas. O saldo bancário pode ser diferente.</p>
          </details>}
        </div>
      </section>

      <section className="prumo-home-quick" aria-labelledby="home-quick-title">
        <h2 id="home-quick-title">Acesso rápido</h2>
        <div className="prumo-actions">
          <button type="button" onClick={() => window.dispatchEvent(new Event("prumo:quick-add"))} aria-label="Abrir novo lançamento">
            <span><PenLine size={20} /></span>Lançar
          </button>
          <Link to="/pix"><span><QrCode size={20} /></span>Pix</Link>
          <Link to="/extrato"><span><Camera size={20} /></span>Extrato</Link>
          <Link to="/historico" aria-label="Histórico de gastos"><span><History size={20} /></span>Histórico</Link>
        </div>
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
                <li key={bill.debt.id + "-" + bill.month} className="flex min-w-0 items-center gap-2.5 py-3 last:pb-0">
                  <span className={"flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl " +
                    (late ? "bg-destructive/10 text-destructive" : soon ? "bg-warning/12 text-warning" : "bg-secondary text-foreground")}>
                    <span className="font-display text-base font-extrabold leading-none tabular-nums">{bill.date.getDate()}</span>
                    <span className="mt-0.5 text-[10px] font-bold uppercase leading-none">{bill.date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{bill.debt.name}</p>
                    <p className={"mt-0.5 text-[11px] " + (late ? "font-semibold text-destructive" : soon ? "font-semibold text-warning" : "text-muted-foreground")}>{dueDescription(bill.daysUntil)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="max-w-28 text-right font-display text-xs font-extrabold tabular-nums sm:text-sm">{brl(bill.amount)}</span>
                    <button
                      type="button"
                      title="Marcar como paga"
                      aria-label={"Marcar " + bill.debt.name + " como paga"}
                      onClick={() => onPay(bill.debt.id, bill.month)}
                      className="grid h-11 w-11 place-items-center rounded-full text-success transition hover:bg-success/10 focus-visible:outline-2 focus-visible:outline-success">
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

      <section className="prumo-home-sims" aria-labelledby="home-simulators-title">
        <h2 id="home-simulators-title" className="mb-3 font-display text-base font-extrabold sm:text-lg">Simuladores</h2>
        <nav aria-labelledby="home-simulators-title" className="grid overflow-hidden rounded-2xl border border-border bg-card sm:grid-cols-3">
          {([
            ["cabe-no-meu-mes", "Cabe no meu mês?", Calculator],
            ["comparar-compra", "À vista ou parcelado?", Scale],
            ["antecipar-parcelas", "Vale antecipar?", BadgePercent],
          ] as const).map(([hash, label, Icon]) => (
            <Link key={hash} to="/planejamento" hash={hash}
              className="flex min-h-12 min-w-0 items-center gap-2.5 border-b border-border px-3 py-2.5 text-sm font-semibold last:border-0 hover:bg-secondary/45 focus-visible:outline-primary sm:border-b-0 sm:border-r">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={17} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">{label}</span>
              <ChevronRight size={15} aria-hidden="true" className="shrink-0 text-muted-foreground" />
            </Link>
          ))}
        </nav>
      </section>
    </div>
  );
}
