import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, PartyPopper } from "lucide-react";
import { Cell, Pie, PieChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, Stat } from "@/components/AppShell";
import { allMonths, brl, currentMonth, debtRemaining, monthLabel, monthSummary, useFinance, alerts, debtFreeMonth, setState, TYPE_INFO } from "@/lib/finance";

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
  s.debts.forEach((d) => { const p = d.payments[cm]; if (p) cats.set(d.category ?? "Outros", (cats.get(d.category ?? "Outros") ?? 0) + p.amount); });
  const pie = [...cats].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--primary)", "var(--destructive)", "var(--muted-foreground)"];
  const paidPct = now.debts ? Math.round((now.paid / now.debts) * 100) : 0;
  const pay = (id: string, m: string) => setState((st) => ({ ...st, debts: st.debts.map((d) => d.id !== id ? d : { ...d, payments: { ...d.payments, [m]: { ...d.payments[m]!, paid: true } } }) }));
  const top = s.debts.filter((d) => d.type === "parcelada").map((d) => ({ d, r: debtRemaining(d) }))
    .filter((x) => x.r.remaining > 0).sort((a, b) => b.r.remaining - a.r.remaining).slice(0, 6);

  return (
    <AppShell>
      <h1 className="font-display text-2xl md:text-3xl font-bold">Olá, Lucas 👋</h1>
      <p className="mt-1 text-muted-foreground">Resumo de {monthLabel(cm, true)}</p>

      <div className="mt-5 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat label="Total que ainda devo" value={brl(totalRemaining)} tone="neg" />
        <Stat label="A pagar neste mês" value={brl(now.pending)} />
        <Stat label="Entradas do mês" value={brl(now.income)} tone="pos" />
        <Stat label="Sobra do mês" value={brl(now.balance)} tone={now.balance >= 0 ? "pos" : "neg"} />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm"><span>Contas de {monthLabel(cm, true)} pagas</span><b>{paidPct}%</b></div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-success transition-all" style={{ width: `${paidPct}%` }} /></div>
        <p className="mt-2 text-xs text-muted-foreground">{brl(now.paid)} pagos de {brl(now.debts)}{free ? ` · parceladas terminam em ${monthLabel(free, true)}` : ""}</p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold"><CalendarClock size={18} className="text-primary" /> Atenção</h2>
          {al.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-success"><PartyPopper size={16} /> Nada atrasado nem vencendo nos próximos 7 dias.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {al.slice(0, 8).map((a) => (
                <li key={a.d.id + a.m} className="flex items-center gap-3 py-2.5">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-bold ${a.status === "atrasada" ? "bg-destructive text-destructive-foreground" : a.status === "hoje" ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                    {a.status === "atrasada" ? <AlertTriangle size={15} /> : a.d.due ?? "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.d.name}</p>
                    <p className={`text-xs ${a.status === "atrasada" ? "text-destructive" : "text-muted-foreground"}`}>
                      {a.status === "atrasada" ? `Atrasada · ${monthLabel(a.m)}` : a.status === "hoje" ? "Vence hoje" : `Vence dia ${a.d.due}`} · {TYPE_INFO[a.d.type].short}
                    </p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{brl(a.amount)}</span>
                  <button onClick={() => pay(a.d.id, a.m)} className="rounded-lg bg-success/20 px-2.5 py-1.5 text-xs font-semibold text-success hover:bg-success/30">Pagar</button>
                </li>
              ))}
            </ul>
          )}
          {al.length > 8 && <Link to="/dividas" className="mt-2 block text-sm text-primary">+ {al.length - 8} contas</Link>}
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <h2 className="font-display text-lg font-semibold">Gastos do mês por categoria</h2>
          {pie.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Sem contas neste mês.</p> : (
            <div className="mt-2 flex items-center gap-4">
              <div className="h-40 w-40 shrink-0">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={pie} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="100%" stroke="var(--card)" strokeWidth={2}>
                      {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="min-w-0 flex-1 space-y-1.5 text-sm">
                {pie.slice(0, 6).map((c, i) => (
                  <li key={c.name} className="flex items-center gap-2">
                    <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
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
        <h2 className="font-display text-lg font-semibold">Entradas x Saídas</h2>
        <div className="mt-4 h-56 md:h-72">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis width={45} stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="Entradas" fill="var(--success)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Saídas" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <h2 className="font-display text-lg font-semibold">Próximos meses</h2>
          <table className="mt-4 w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr><th className="pb-2">Mês</th><th className="pb-2 text-right">Entra</th><th className="pb-2 text-right">Sai</th><th className="pb-2 text-right">Sobra</th></tr>
            </thead>
            <tbody>
              {future.map((m) => {
                const x = monthSummary(s, m);
                return (
                  <tr key={m} className="border-t border-border">
                    <td className="py-2 font-medium">{monthLabel(m, true)}</td>
                    <td className="py-2 text-right text-success">{brl(x.income)}</td>
                    <td className="py-2 text-right">{brl(x.out)}</td>
                    <td className={`py-2 text-right font-semibold ${x.balance >= 0 ? "text-success" : "text-destructive"}`}>{brl(x.balance)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-border bg-card p-4 md:p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Maiores dívidas restantes</h2>
            <Link to="/dividas" className="text-sm text-primary hover:underline">Ver todas</Link>
          </div>
          <ul className="mt-4 space-y-4">
            {top.map(({ d, r }) => (
              <li key={d.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{d.name}{d.due ? <span className="text-xs text-muted-foreground"> · dia {d.due}</span> : null}</span>
                  <span>{brl(r.remaining)} <span className="text-muted-foreground">· {r.left}x</span></span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${((r.count - r.left) / r.count) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
