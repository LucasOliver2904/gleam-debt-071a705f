import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  QrCode,
  Target,
  PartyPopper,
  PiggyBank,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell, Stat } from "@/components/AppShell";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/lib/use-profile";
import { FinancialBriefing } from "@/components/FinancialBriefing";
import { PendingReviewBanner, RecentActivity } from "@/components/DashboardActivity";
import { FileImage } from "lucide-react";
import {
  alerts,
  addMonths,
  brl,
  currentMonth,
  debtFreeMonth,
  debtRemaining,
  outstandingDebtBalance,
  monthLabel,
  monthSummary,
  setState,
  TYPE_INFO,
  useFinance,
} from "@/lib/finance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Prumo" },
      { name: "description", content: "Veja quanto falta pagar das suas dívidas, mês a mês." },
      { property: "og:title", content: "Painel — Prumo" },
      { property: "og:description", content: "Controle de dívidas, parcelas, entradas e saídas." },
    ],
  }),
  component: Dashboard,
});

function SectionTitle({
  icon,
  children,
  right,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary">
          {icon}
        </span>
        {children}
      </h2>
      {right}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Carregando painel financeiro" className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-56 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  );
}

function Dashboard() {
  const s = useFinance();
  const profile = useProfile();
  if (!s.ready) return <AppShell><DashboardSkeleton /></AppShell>;
  const cm = currentMonth();
  const now = monthSummary(s, cm);
  const totalRemaining = outstandingDebtBalance(s);
  const future = Array.from({ length: 6 }, (_, index) => addMonths(cm, index));
  const chart = Array.from({ length: 9 }, (_, index) => addMonths(cm, index - 3)).map((m) => {
    const x = monthSummary(s, m);
    return { mes: monthLabel(m), Entradas: +x.income.toFixed(2), Saídas: +x.out.toFixed(2) };
  });
  const al = alerts(s);
  const free = debtFreeMonth(s);
  const cats = new Map<string, number>();
  s.debts.forEach((d) => {
    const p = d.payments[cm];
    if (p) cats.set(d.category ?? "Outros", (cats.get(d.category ?? "Outros") ?? 0) + p.amount);
  });
  s.txs.filter((tx) => tx.kind === "saida" && !tx.excludedFromTotals && tx.date.startsWith(cm)).forEach((tx) => {
    const cat = tx.category || "Outros";
    cats.set(cat, (cats.get(cat) ?? 0) + tx.amount);
  });
  const pie = [...cats].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const COLORS = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--primary)",
    "var(--destructive)",
    "var(--muted-foreground)",
  ];
  const paidPct = now.debts ? Math.round((now.paid / now.debts) * 100) : 0;
  const setPaid = (id: string, m: string, paid: boolean) => {
    setState((state) => ({
      ...state,
      debts: state.debts.map((debt) => {
        const payment = debt.payments[m];
        if (debt.id !== id || !payment) return debt;
        return { ...debt, payments: { ...debt.payments, [m]: { ...payment, paid } } };
      }),
    }));
  };
  const pay = (id: string, m: string) => {
    setPaid(id, m, true);
    toast.success("Conta marcada como paga", {
      action: { label: "Desfazer", onClick: () => setPaid(id, m, false) },
    });
  };
  
  const top = s.debts
    .filter((d) => d.type === "parcelada")
    .map((d) => ({ d, r: debtRemaining(d) }))
    .filter((x) => x.r.remaining > 0)
    .sort((a, b) => b.r.remaining - a.r.remaining)
    .slice(0, 6);

  const endingDebts = s.debts.filter(d => d.type === "parcelada" && debtRemaining(d).left === 1 && debtRemaining(d).remaining > 0);

  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="finance-kicker">PRUMO / VISÃO GERAL</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">{profile.name ? `Olá, ${profile.name} 👋` : "Olá 👋"}</h1>
          <p className="mt-1 text-sm capitalize text-muted-foreground">
            {hoje} · Resumo de {monthLabel(cm, true)}
          </p>
        </div>
        <Link
          to="/dividas"
          className="hidden items-center gap-1.5 rounded-xl border border-border px-3.5 py-2 text-sm font-medium transition hover:bg-secondary md:inline-flex"
        >
          Ver dívidas <ArrowRight size={14} />
        </Link>
      </div>

      <section className="finance-hero mt-6 overflow-hidden rounded-3xl px-5 py-7 text-white sm:px-7 sm:py-8 md:px-9 md:py-10" aria-label="Resumo financeiro do mês">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-white/8 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.15em] text-emerald-200">
              <Sparkles size={13}/> FINANÇAS EM FOCO · {monthLabel(cm, true)}
            </span>
            <p className="mt-5 text-sm font-semibold tracking-wide text-slate-200">Sua sobra prevista para o mês</p>
            <h2 className={"mt-1 break-words font-display text-[clamp(2.25rem,5vw,3.8rem)] font-extrabold leading-tight tracking-tight tabular-nums " + (now.balance >= 0 ? "text-white" : "text-rose-200")}>{brl(now.balance)}</h2>
            <p className="mt-3 max-w-lg text-xs leading-relaxed text-slate-200 sm:text-sm">
              {now.income > 0
                ? "Estimativa a partir da sua renda e dos compromissos cadastrados. Não representa o saldo da sua conta bancária."
                : "Cadastre sua renda para ter uma previsão mais útil. Seus compromissos e movimentações continuam disponíveis abaixo."}
            </p>
          </div>
          <div className="min-w-0 w-full rounded-2xl border border-white/15 bg-white/8 p-4 backdrop-blur-sm lg:w-[285px] lg:shrink-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.11em] text-slate-200">Parcelas deste mês</span>
              <span className="font-display text-lg font-extrabold text-emerald-200">{paidPct}%</span>
            </div>
            <div role="progressbar" aria-label="Percentual das contas do mês já pagas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paidPct} className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-300" style={{ width: paidPct + "%" }}/>
            </div>
            <p className="mt-2 text-[11px] text-slate-200">{brl(now.paid)} pagos · {brl(now.pending)} pendentes</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link to="/agenda" className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-300 px-2.5 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-200">Ver agenda <ArrowRight size={14}/></Link>
              <Link to="/lancamentos" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-2.5 py-2.5 text-xs font-bold text-white transition hover:bg-white/20">Movimentações</Link>
            </div>
          </div>
        </div>
      </section>

      <PendingReviewBanner state={s} />

      <div className="mt-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat
          label="Dívidas a quitar"
          value={brl(totalRemaining)}
          tone={totalRemaining > 0 ? "neg" : "pos"}
          icon={TrendingDown}
          hint="Sem contar fixas futuras"
        />
        <Stat
          label="A pagar neste mês"
          value={brl(now.pending)}
          icon={CalendarDays}
        />
        <Stat
          label="Entradas minhas"
          value={brl(now.income)}
          tone="pos"
          icon={ArrowDownLeft}
        />
        <Stat
          label="Despesas do mês"
          value={brl(now.out)}
          tone="neg"
          icon={PiggyBank}
          hint="Contas previstas + saídas"
        />
      </div>

      {endingDebts.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/6 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/20 text-accent"><PartyPopper size={20} /></span>
            <div>
              <p className="font-semibold text-accent">Você está quase lá!</p>
              <p className="text-sm text-muted-foreground">
                {endingDebts.length === 1 ? "1 conta" : `${endingDebts.length} contas`} na última parcela: {endingDebts.map(d => d.name).join(", ")}
              </p>
            </div>
          </div>
          <Link to="/dividas" className="shrink-0 text-sm font-medium text-amber-600 hover:underline dark:text-amber-400">Ver contas</Link>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2.5 rounded-2xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-success/15 text-success">
          <Sparkles size={16} />
        </span>
        <span>{free ? `Suas dívidas parceladas terminam em ${monthLabel(free, true)}.` : "Você está livre de dívidas parceladas 🎉"}</span>
      </div>

      <FinancialBriefing state={s} />
      <Link to="/extrato" className="finance-feature mt-5 flex items-center gap-4 rounded-2xl p-4 sm:p-5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-info/15 text-info"><FileImage size={24}/></span>
        <span className="min-w-0 flex-1"><strong className="block font-display text-sm font-extrabold sm:text-base">Tem prints do extrato bancário?</strong><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Envie suas capturas, confira data, pessoa, valor e tipo de movimentação antes de lançar.</span></span>
        <ArrowRight size={19} className="shrink-0 text-primary"/>
      </Link>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Link to="/agenda" className="finance-feature group flex items-center gap-4 rounded-2xl p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><CalendarDays size={22} /></span>
          <span className="min-w-0 flex-1"><b className="block font-display text-base">Agenda de vencimentos</b><span className="mt-0.5 block text-xs text-muted-foreground">Veja cada dia e marque contas como pagas.</span></span>
          <ArrowRight size={18} className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
        <Link to="/pix" className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-success/15 text-success"><QrCode size={22} /></span>
          <span className="min-w-0 flex-1"><b className="block font-display text-base">Pix e repasses</b><span className="mt-0.5 block text-xs text-muted-foreground">Separe o valor recebido do dinheiro que é seu.</span></span>
          <ArrowRight size={18} className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
        <Link to="/planejamento" className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent/15 text-accent"><Target size={22} /></span>
          <span className="min-w-0 flex-1"><b className="block font-display text-base">Planejamento e metas</b><span className="mt-0.5 block text-xs text-muted-foreground">Limites de gastos, previsões e objetivos.</span></span>
          <ArrowRight size={18} className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-primary" />
        </Link>
      </div>

      <RecentActivity state={s} />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="finance-surface rounded-2xl border border-border bg-card p-4 md:p-5">
          <SectionTitle icon={<CalendarClock size={16} />}>Atenção</SectionTitle>
          {al.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-success/40 bg-success/5 py-8 text-center">
              <PartyPopper className="text-success" size={26} />
              <p className="text-sm font-semibold text-success">Tudo em dia!</p>
              <p className="text-xs text-muted-foreground">
                Nada atrasado nem vencendo nos próximos 7 dias.
              </p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {al.slice(0, 8).map((a) => (
                <li key={a.d.id + a.m} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                      a.status === "atrasada"
                        ? "bg-destructive text-destructive-foreground"
                        : a.status === "hoje"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary"
                    }`}
                  >
                    {a.status === "atrasada" ? <AlertTriangle size={15} /> : a.d.due ?? "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.d.name}</p>
                    <p
                      className={`text-xs ${
                        a.status === "atrasada" ? "text-destructive" : "text-muted-foreground"
                      }`}
                    >
                      {a.status === "atrasada"
                        ? `Atrasada · ${monthLabel(a.m)}`
                        : a.status === "hoje"
                        ? "Vence hoje"
                        : `Vence dia ${a.d.due}`}{" "}
                      · {TYPE_INFO[a.d.type].short}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{brl(a.amount)}</span>
                  <button
                    onClick={() => pay(a.d.id, a.m)}
                    className="rounded-lg bg-success/20 px-2.5 py-1.5 text-xs font-semibold text-success transition hover:bg-success/30"
                  >
                    Pagar
                  </button>
                </li>
              ))}
            </ul>
          )}
          {al.length > 8 && (
            <Link
              to="/dividas"
              className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              + {al.length - 8} contas <ArrowRight size={12} />
            </Link>
          )}
        </section>

        <section className="finance-surface rounded-2xl border border-border bg-card p-4 md:p-5">
          <SectionTitle icon={<TrendingUp size={16} />}>Compromissos por categoria</SectionTitle>
          {pie.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">Sem contas neste mês.</p>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <div className="h-44 w-44 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="60%"
                      outerRadius="100%"
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {pie.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => brl(v)}
                      contentStyle={{
                        background: "var(--card)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="w-full min-w-0 flex-1 space-y-2 text-sm">
                {pie.slice(0, 6).map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <i
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: COLORS[i % COLORS.length] }}
                    />
                    <span className="flex-1 truncate">{c.name}</span>
                    <span className="tabular-nums text-muted-foreground">{brl(c.value)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="finance-surface mt-6 rounded-2xl border border-border bg-card p-4 md:p-5">
        <SectionTitle icon={<ArrowLeftRight size={16} />}>Entradas x despesas previstas</SectionTitle>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Comparativo dos últimos 3 meses e dos próximos 5, incluindo compromissos cadastrados.</p>
        <div className="mt-4 h-56 md:h-72">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis width={45} stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip
                formatter={(v: number) => brl(v)}
                contentStyle={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: 12,
                }}
              />
              <Legend />
              <Bar dataKey="Entradas" fill="var(--success)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Saídas" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="finance-surface rounded-2xl border border-border bg-card p-4 md:p-5">
          <SectionTitle icon={<CalendarClock size={16} />}>Próximos meses</SectionTitle>
          <p className="mt-1 text-xs text-muted-foreground">Previsão baseada nas contas e na renda informadas.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="pb-2">Mês</th>
                  <th className="pb-2 text-right">Entra</th>
                  <th className="pb-2 text-right">Sai</th>
                  <th className="pb-2 text-right">Sobra</th>
                </tr>
              </thead>
              <tbody>
                {future.map((m) => {
                  const x = monthSummary(s, m);
                  return (
                    <tr key={m} className="border-t border-border">
                      <td className="py-2 font-medium">{monthLabel(m, true)}</td>
                      <td className="py-2 text-right tabular-nums text-success">{brl(x.income)}</td>
                      <td className="py-2 text-right tabular-nums">{brl(x.out)}</td>
                      <td
                        className={`py-2 text-right font-semibold tabular-nums ${
                          x.balance >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {brl(x.balance)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="finance-surface rounded-2xl border border-border bg-card p-4 md:p-5">
          <SectionTitle
            icon={<Wallet size={16} />}
            right={
              <Link to="/dividas" className="text-sm text-primary hover:underline">
                Ver todas
              </Link>
            }
          >
            Maiores dívidas restantes
          </SectionTitle>
          {top.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-6 text-center"><p className="text-sm font-bold text-success">Nenhuma parcela em aberto</p><p className="mt-1 text-xs text-muted-foreground">Se você cadastrar uma dívida parcelada, a evolução dela aparecerá aqui.</p></div>
          ) : <ul className="mt-4 space-y-4">
            {top.map(({ d, r }) => {
              const pct = Math.round(((r.count - r.left) / Math.max(r.count, 1)) * 100);
              const isLast = r.left === 1;
              return (
                <li key={d.id}>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      {d.name}
                      {isLast && <span className="rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">Última</span>}
                      {d.due ? (
                        <span className="text-xs text-muted-foreground"> · dia {d.due}</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">
                      {brl(r.remaining)}{" "}
                      <span className="text-muted-foreground">· {r.left}x</span>
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isLast ? "bg-amber-500" : "bg-gradient-to-r from-primary/70 to-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-9 text-right text-[11px] tabular-nums text-muted-foreground">
                      {pct}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>}
        </section>
      </div>
    </AppShell>
  );
}