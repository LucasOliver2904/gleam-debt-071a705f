import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Camera,
  Check, ChevronRight, CircleCheck, FileText, PenLine, Plus,
  QrCode, TrendingDown, Wallet,
} from "lucide-react";
import { brl, monthLabel, monthSummary, outstandingDebtBalance, type State } from "@/lib/finance";
import { dashboardBills, dueDescription } from "@/lib/dashboard-home";

type FocusTab = "saldo" | "pagar" | "dividas";

function iconForBill(name: string) {
  return /cart[aã]o|fatura|nubank|cr[eé]dito/i.test(name) ? Wallet
    : /pix|transfer[eê]ncia/i.test(name) ? QrCode
    : FileText;
}

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
  const paidRatio = summary.debts > 0
    ? Math.max(0, Math.min(100, Math.round((summary.paid / summary.debts) * 100)))
    : 0;
  const remainingRatio = summary.income > 0
    ? Math.round(summary.balance / summary.income * 100)
    : null;

  const details = {
    saldo: {
      eyebrow: "Sobra prevista de " + monthLabel(month, true),
      amount: summary.balance,
      hint: summary.income > 0 && summary.balance > 0
        ? `A previsão é guardar ${remainingRatio}% do que entrou.`
        : summary.income > 0
          ? "Revise as despesas: a previsão deste mês não é positiva."
          : "Informe sua renda para visualizar uma previsão mais completa.",
      cta: "Ver movimentações",
      to: "/lancamentos" as const,
    },
    pagar: {
      eyebrow: "Ainda falta pagar em " + monthLabel(month, true),
      amount: summary.pending,
      hint: summary.debts > 0
        ? `${paidRatio}% do valor das contas deste mês já foi marcado como pago.`
        : "Nenhum compromisso cadastrado para este mês.",
      cta: "Ver agenda",
      to: "/agenda" as const,
    },
    dividas: {
      eyebrow: "Dívidas parceladas a quitar",
      amount: debtBalance,
      hint: "Não inclui contas fixas futuras. Valor baseado nas parcelas em aberto.",
      cta: "Ver minhas dívidas",
      to: "/dividas" as const,
    },
  }[tab];

  const quickActions = [
    { to: "/extrato" as const, label: "Foto do extrato", hint: "Ler e conferir", icon: Camera, color: "info" },
    { to: "/pix" as const, label: "Pix e repasses", hint: "Valores seus", icon: QrCode, color: "success" },
    { to: "/lancamentos" as const, label: "Histórico", hint: "Entradas e saídas", icon: FileText, color: "accent" },
  ];

  return (
    <div className="prumo-overview-grid mt-5 grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1.06fr)_minmax(0,0.94fr)]" aria-label="Visão rápida das finanças">
      <div className="min-w-0">
        <section className="prumo-balance-card relative isolate overflow-hidden rounded-[1.8rem] px-5 py-5 text-white sm:px-7 sm:py-6" aria-label="Indicadores financeiros do mês">
          <div role="tablist" aria-label="Selecionar indicador financeiro" className="prumo-balance-tabs grid grid-cols-3 gap-1 rounded-full p-1">
            {([
              ["saldo", "Sobra prevista"],
              ["pagar", "A pagar"],
              ["dividas", "Dívidas"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                aria-controls="prumo-finance-tab-panel"
                onClick={() => setTab(value)}
                className={"prumo-balance-tab min-w-0 rounded-full px-2 py-2.5 text-[11px] font-extrabold transition-colors sm:text-sm " + (tab === value ? "bg-white text-[#075464] shadow-sm" : "text-white/90 hover:bg-white/10")}
              >{label}</button>
            ))}
          </div>

          <div id="prumo-finance-tab-panel" role="tabpanel" className="relative z-10 mt-7 sm:mt-8">
            <p className="text-sm font-semibold text-white/85">{details.eyebrow}</p>
            <p className="mt-2 break-words font-display text-[clamp(2.35rem,5.7vw,3.75rem)] font-extrabold leading-tight tracking-[-0.045em] tabular-nums">
              {brl(details.amount)}
            </p>
            <p className="mt-2 min-h-9 text-xs leading-relaxed text-white/80 sm:min-h-5 sm:text-sm">{details.hint}</p>
          </div>

          <div className="relative z-10 mt-5 grid grid-cols-2 gap-4 border-t border-white/20 pt-5">
            {tab === "saldo" ? (
              <>
                <div><p className="text-xs font-semibold text-white/70">Entradas cadastradas</p><p className="mt-1 break-words font-display text-base font-extrabold tabular-nums sm:text-xl">{brl(summary.income)}</p></div>
                <div className="border-l border-white/20 pl-4"><p className="text-xs font-semibold text-white/70">Despesas previstas</p><p className="mt-1 break-words font-display text-base font-extrabold tabular-nums sm:text-xl">{brl(summary.out)}</p></div>
              </>
            ) : tab === "pagar" ? (
              <>
                <div><p className="text-xs font-semibold text-white/70">Contas do mês</p><p className="mt-1 font-display text-lg font-extrabold tabular-nums">{brl(summary.debts)}</p></div>
                <div className="border-l border-white/20 pl-4"><p className="text-xs font-semibold text-white/70">Já pagas</p><p className="mt-1 font-display text-lg font-extrabold tabular-nums">{brl(summary.paid)}</p></div>
              </>
            ) : (
              <>
                <div><p className="text-xs font-semibold text-white/70">A pagar neste mês</p><p className="mt-1 font-display text-lg font-extrabold tabular-nums">{brl(summary.pending)}</p></div>
                <div className="border-l border-white/20 pl-4"><p className="text-xs font-semibold text-white/70">Parcelas pagas</p><p className="mt-1 font-display text-lg font-extrabold tabular-nums">{paidRatio}%</p></div>
              </>
            )}
          </div>
          {tab === "pagar" && (
            <div className="relative z-10 mt-4 h-2 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidRatio} aria-label="Percentual das contas do mês pagas">
              <div className="h-full rounded-full bg-[#aaf2c0] transition-all" style={{ width: paidRatio + "%" }} />
            </div>
          )}
          <Link to={details.to} className="relative z-10 mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3.5 text-sm font-extrabold text-[#085569] shadow-md transition hover:bg-[#e7fcf7]">
            {details.cta} <ArrowRight size={17}/>
          </Link>
          <p className="relative z-10 mt-3 text-center text-[10px] leading-relaxed text-white/65">Projeção dos dados registrados · não é saldo bancário</p>
        </section>

        <section className="mt-6" aria-labelledby="quick-actions-title">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="finance-kicker">SEU DIA A DIA</p>
              <h2 id="quick-actions-title" className="mt-1 font-display text-lg font-extrabold sm:text-xl">Lançar e consultar</h2>
            </div>
            <Link to="/lancamentos" className="text-xs font-bold text-primary hover:underline">Ver tudo <ArrowRight size={13} className="inline"/></Link>
          </div>
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            <button type="button" onClick={() => window.dispatchEvent(new Event("prumo:quick-add"))}
              className="prumo-quick-action prumo-quick-action-main flex min-w-0 flex-col items-start justify-between gap-4 rounded-2xl px-3 py-4 text-left transition hover:-translate-y-0.5 sm:px-4" aria-label="Abrir novo lançamento rápido">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#116277]/10"><PenLine size={21}/></span>
              <span><strong className="block text-[11px] font-extrabold leading-tight sm:text-sm">Lançamento</strong><span className="mt-0.5 block text-[10px] leading-tight opacity-75 sm:text-xs">Novo</span></span>
            </button>
            {quickActions.map(({ to, label, hint, icon: Icon, color }) => (
              <Link key={to} to={to} className={"prumo-quick-action flex min-w-0 flex-col items-start justify-between gap-4 rounded-2xl px-3 py-4 text-left transition hover:-translate-y-0.5 sm:px-4 prumo-quick-" + color}>
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-current/5"><Icon size={21}/></span>
                <span><strong className="block text-[11px] font-extrabold leading-tight sm:text-sm">{label}</strong><span className="mt-0.5 block text-[10px] font-medium leading-tight opacity-70 sm:text-xs">{hint}</span></span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      <section className="prumo-bills-panel finance-surface min-w-0 rounded-[1.7rem] border border-border bg-card p-4 sm:p-5" aria-labelledby="home-bills-title">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="finance-kicker">O QUE VEM POR AÍ</p>
            <h2 id="home-bills-title" className="mt-1 font-display text-lg font-extrabold sm:text-xl">Contas a acompanhar</h2>
          </div>
          <Link to="/agenda" className="inline-flex items-center gap-1.5 text-xs font-extrabold text-primary hover:underline">Ver todas <ArrowRight size={14}/></Link>
        </header>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Vencimentos registrados, começando pelas contas atrasadas mais recentes.</p>

        {bills.length ? (
          <ul className="mt-5 divide-y divide-border/75">
            {bills.map((bill) => {
              const Icon = iconForBill(bill.debt.name);
              const late = bill.daysUntil < 0;
              const urgent = bill.daysUntil >= 0 && bill.daysUntil <= 3;
              return (
                <li key={bill.debt.id + "-" + bill.month} className="flex min-w-0 items-center gap-3 py-3.5 first:pt-0">
                  <span className={"flex h-[53px] w-[53px] shrink-0 flex-col items-center justify-center rounded-2xl " +
                    (late ? "bg-destructive/10 text-destructive" : urgent ? "bg-accent/12 text-accent" : "bg-secondary text-foreground")}>
                    <span className="font-display text-lg font-extrabold leading-none tabular-nums">{bill.date.getDate()}</span>
                    <span className="mt-1 text-[10px] font-bold uppercase leading-none">{bill.date.toLocaleDateString("pt-BR",{month:"short"}).replace(".","")}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <Icon size={14} className="shrink-0 text-muted-foreground"/>
                      <p className="truncate text-sm font-extrabold">{bill.debt.name}</p>
                    </div>
                    <p className={"mt-1 text-xs font-semibold " + (late ? "text-destructive" : urgent ? "text-accent" : "text-muted-foreground")}>
                      {dueDescription(bill.daysUntil)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{bill.debt.type === "fixa" ? "Conta recorrente" : bill.debt.type === "parcelada" ? "Parcela" : "Pagamento único"}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="whitespace-nowrap font-display text-sm font-extrabold tabular-nums">{brl(bill.amount)}</p>
                    <button type="button" onClick={() => onPay(bill.debt.id, bill.month)} aria-label={"Marcar como paga " + bill.debt.name + " em " + bill.month}
                      className="mt-1 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-extrabold text-success transition hover:bg-success/10"><Check size={14}/> Pagar</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border bg-secondary/15 p-8 text-center">
            <CircleCheck size={28} className="text-success"/>
            <p className="mt-3 text-sm font-bold">Tudo em dia por aqui</p>
            <p className="mt-1 text-xs text-muted-foreground">Sem contas em aberto ou vencendo nos próximos 45 dias.</p>
          </div>
        )}
        <Link to="/dividas" className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-border bg-secondary/35 px-4 py-3 text-xs font-extrabold text-foreground transition hover:bg-secondary">
          Gerenciar minhas contas <ChevronRight size={16}/>
        </Link>
      </section>
    </div>
  );
}
