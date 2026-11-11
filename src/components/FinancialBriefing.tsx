import { Link } from "@tanstack/react-router";
import { AlertCircle, ArrowRight, BellRing, CalendarCheck2, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { brl, currentMonth, monthSummary, type State } from "@/lib/finance";
import { reminderConfig, upcomingBills } from "@/lib/reminders";

export function FinancialBriefing({ state }: { state: State }) {
  const month = monthSummary(state, currentMonth());
  const bills = upcomingBills(state, 30);
  const late = bills.filter((bill) => bill.daysUntil < 0);
  const thisWeek = bills.filter((bill) => bill.daysUntil >= 0 && bill.daysUntil <= 7);
  const inThirtyDays = bills.filter((bill) => bill.daysUntil >= 0);
  const nextBill = inThirtyDays[0] ?? null;
  const lateAmount = late.reduce((sum, item) => sum + item.amount, 0);
  const weekAmount = thisWeek.reduce((sum, item) => sum + item.amount, 0);
  const thirtyAmount = inThirtyDays.reduce((sum, item) => sum + item.amount, 0);
  const ratio = month.income > 0 ? Math.round(month.out / month.income * 100) : null;
  const hasNotifications = reminderConfig(state).enabled;

  return (
    <section className="mt-6 space-y-4" aria-label="Orientações para suas finanças">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="finance-kicker">SEU ASSISTENTE FINANCEIRO</p>
          <h2 className="mt-1 font-display text-xl font-bold md:text-2xl">O que merece sua atenção</h2>
        </div>
        <Link to="/ajustes" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
          Ajustar lembretes <ArrowRight size={14} />
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <article className="finance-insight-card">
          <div className="flex items-center justify-between gap-2">
            <span className="finance-insight-label">Em atraso</span>
            <span className={late.length ? "text-destructive" : "text-success"}>{late.length ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}</span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums">{brl(lateAmount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{late.length ? late.length + " cobrança(s) aguardando pagamento" : "Nenhum vencimento atrasado"}</p>
        </article>

        <article className="finance-insight-card">
          <div className="flex items-center justify-between gap-2">
            <span className="finance-insight-label">Próximos 7 dias</span>
            <span className="text-primary"><Clock3 size={20} /></span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums">{brl(weekAmount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{thisWeek.length ? thisWeek.length + " conta(s) se aproximando" : "Sem vencimentos nesta semana"}</p>
        </article>

        <article className="finance-insight-card">
          <div className="flex items-center justify-between gap-2">
            <span className="finance-insight-label">Reserva para 30 dias</span>
            <span className="text-accent"><CalendarCheck2 size={20} /></span>
          </div>
          <p className="mt-3 font-display text-2xl font-bold tabular-nums">{brl(thirtyAmount)}</p>
          <p className="mt-1 text-xs text-muted-foreground">Valor das contas ainda não pagas que vencem em até 30 dias</p>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.3fr_1fr]">
        <div className="finance-insight-card flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
              <ShieldCheck size={20} />
            </span>
            <div>
              <h3 className="font-display text-base font-bold">Leitura do seu orçamento</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {ratio === null
                  ? "Cadastre sua renda mensal para comparar suas despesas previstas com o que entra."
                  : ratio > 100
                    ? "As despesas previstas ultrapassam a renda registrada neste mês. Revise os pagamentos e priorize os essenciais."
                    : ratio >= 80
                      ? "Seus compromissos já ocupam uma parte grande da renda prevista. Vale evitar novas parcelas agora."
                      : "As despesas previstas estão dentro da renda cadastrada. Continue acompanhando os gastos do mês."}
              </p>
              {nextBill && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Próximo vencimento: <strong className="text-foreground">{nextBill.debt.name}</strong> · {nextBill.date.toLocaleDateString("pt-BR")} · {brl(nextBill.amount)}
                </p>
              )}
            </div>
          </div>
          <div className="shrink-0 rounded-xl bg-secondary px-4 py-3 text-center">
            <p className="font-display text-2xl font-bold tabular-nums">{ratio === null ? "—" : ratio + "%"}</p>
            <p className="text-[11px] text-muted-foreground">renda comprometida*</p>
          </div>
        </div>
        <div className="finance-insight-card flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent">
            <BellRing size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-bold">{hasNotifications ? "Lembretes configurados" : "Evite esquecer pagamentos"}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {hasNotifications
                ? "Os avisos do navegador são conferidos quando o aplicativo está aberto."
                : "Ative avisos de vencimento no navegador e escolha quando quer ser lembrado."}
            </p>
          </div>
          <Link to="/ajustes" aria-label="Configurar lembretes" className="shrink-0 rounded-lg bg-primary/15 p-2 text-primary hover:bg-primary/25"><ArrowRight size={18} /></Link>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">* Projeção baseada nas entradas e despesas cadastradas; não representa o saldo bancário em tempo real.</p>
    </section>
  );
}
