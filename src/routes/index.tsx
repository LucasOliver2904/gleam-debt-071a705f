import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
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
import {
  alerts,
  allMonths,
  brl,
  currentMonth,
  debtFreeMonth,
  debtRemaining,
  monthLabel,
  monthSummary,
  setState,
  TYPE_INFO,
  useFinance,
} from "@/lib/finance";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel — Meu Caixa" },
      { name: "description", content: "Veja quanto falta pagar das suas dívidas, mês a mês." },
      { property: "og:title", content: "Painel — Meu Caixa" },
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

function Dashboard() {
  const s = useFinance();
  if (!s.ready) return <AppShell><div /></AppShell>;
  const months = allMonths(s);
  const cm = currentMonth();
  const now = monthSummary(s, cm);
  const totalRemaining = s.debts.reduce((a, d) => a + debtRemaining(d).remaining, 0);
  const future = months.filter((m) => m >= cm);
  const chart = months.map((m) => {
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
  const pay = (id: string, m: string) =>
    setState((st) => ({
      ...st,
      debts: st.debts.map((d) =>
        d.id !== id
          ? d
          : { ...d, payments: { ...d.payments, [m]: { ...d.payments[m]!, paid: true } } },
      ),
    }));
  
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
          <h1 className="font-display text-2xl font-bold md:text-3xl">Olá, Lucas 👋</h1>
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

      <div className="mt-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat
          label="Total que ainda devo"
          value={brl(totalRemaining)}
          tone="neg"
          icon={TrendingDown}
        />
        <Stat
          label="A pagar neste mês"
          value={brl(now.pending)}
          icon={CalendarDays}
        />
        <Stat
          label="Entradas do mês"
          value={brl(now.income)}
          tone="pos"
          icon={ArrowDownLeft}
        />
        <Stat
          label="Sobra do mês"
          value={brl(now.balance)}
          tone={now.balance >= 0 ? "pos" : "neg"}
          icon={PiggyBank}
        />
      </div>

      {endingDebts.length > 0 && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-500/20 text-amber-500"><PartyPopper size={20} /></span>
            <div>
              <p className="font-semibold text-amber-600 dark:text-amber-400">Você está quase lá!</p>
              <p className="text-sm text-muted-foreground">
                {endingDebts.length === 1 ? "1 conta" : `${endingDebts.length} contas`} na última parcela: {endingDebts.map(d => d.name).join(", ")}
              </p>
            </div>
          </div>
          <Link to="/dividas" className="shrink-0 text-sm font-medium text-amber-600 hover:underline dark:text-amber-400">Ver contas</Link>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-success/15 text-success">
              <Sparkles size={16} />
            </span>
            <span className="font-medium">Contas de {monthLabel(cm, true)}</span>
          </div>
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold tabular-nums text-success">
            {paidPct}%
          </span>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-success/70 to-success transition-all duration-500"
            style={{ width: `${paidPct}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {brl(now.paid)} pagos de {brl(now.debts)}
          {free
            ? ` · parceladas terminam em ${monthLabel(free, true)}`
            : " · você está livre de parceladas 🎉"}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
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

        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <SectionTitle icon={<TrendingUp size={16} />}>Gastos por categoria</SectionTitle>
          {pie.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border py-10 text-center">
              <p className="text-sm text-muted-foreground">Sem contas neste mês.</p>
            </div>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              <div className="h-40 w-40 shrink-0">
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
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
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

      <section className="mt-6 rounded-2xl border border-border bg-card p-4 md:p-5">
        <SectionTitle icon={<ArrowLeftRight size={16} />}>Entradas x Saídas</SectionTitle>
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
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <SectionTitle icon={<CalendarClock size={16} />}>Próximos meses</SectionTitle>
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

        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
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
          <ul className="mt-4 space-y-4">
            {top.map(({ d, r }) => {
              const pct = Math.round(((r.count - r.left) / r.count) * 100);
              const isLast = r.left === 1;
              return (
                <li key={d.id}>
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium">
                      {d.name}
                      {isLast && <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">Última</span>}
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
          </ul>
        </section>
      </div>
    </AppShell>
  );
}