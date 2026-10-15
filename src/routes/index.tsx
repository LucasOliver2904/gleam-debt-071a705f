import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, Stat } from "@/components/AppShell";
import { allMonths, brl, currentMonth, debtRemaining, monthLabel, monthSummary, useFinance } from "@/lib/finance";

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
  const top = s.debts.filter((d) => d.type === "parcelada").map((d) => ({ d, r: debtRemaining(d) }))
    .filter((x) => x.r.remaining > 0).sort((a, b) => b.r.remaining - a.r.remaining).slice(0, 6);

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold">Olá, Lucas 👋</h1>
      <p className="mt-1 text-muted-foreground">Resumo de {monthLabel(cm, true)}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total que ainda devo" value={brl(totalRemaining)} tone="neg" />
        <Stat label="A pagar neste mês" value={brl(now.pending)} />
        <Stat label="Entradas do mês" value={brl(now.income)} tone="pos" />
        <Stat label="Sobra do mês" value={brl(now.balance)} tone={now.balance >= 0 ? "pos" : "neg"} />
      </div>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Entradas x Saídas</h2>
        <div className="mt-4 h-72">
          <ResponsiveContainer>
            <BarChart data={chart}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="mes" stroke="var(--muted-foreground)" fontSize={12} />
              <YAxis stroke="var(--muted-foreground)" fontSize={12} />
              <Tooltip formatter={(v: number) => brl(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12 }} />
              <Legend />
              <Bar dataKey="Entradas" fill="var(--success)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Saídas" fill="var(--destructive)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
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

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Maiores dívidas restantes</h2>
            <Link to="/dividas" className="text-sm text-primary hover:underline">Ver todas</Link>
          </div>
          <ul className="mt-4 space-y-4">
            {top.map(({ d, r }) => (
              <li key={d.id}>
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{d.name}</span>
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
