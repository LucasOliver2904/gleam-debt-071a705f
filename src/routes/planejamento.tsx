import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight,
  Download, Flag, Minus, PiggyBank, Plus, Sparkles, Target, Trash2, Wallet,
} from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/AppShell";
import {
  CATEGORIES, addMonths, brl, currentMonth, monthLabel, monthSummary,
  parseMoney, setState, uid, useFinance, type SavingsGoal,
} from "@/lib/finance";
import { budgetRows, financeCsv, projection } from "@/lib/planning";

export const Route = createFileRoute("/planejamento")({
  head: () => ({
    meta: [
      { title: "Planejamento, limites e metas — Prumo" },
      { name: "description", content: "Projete os próximos meses, configure limites de gastos e acompanhe suas metas de economia." },
    ],
  }),
  component: Planejamento,
});

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

function GoalCard({ goal }: { goal: SavingsGoal }) {
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [value, setValue] = useState("");
  const progress = Math.round(goal.saved / Math.max(goal.target, 0.01) * 100);
  const remaining = Math.max(0, goal.target - goal.saved);

  function change() {
    const v = parseMoney(value);
    if (!(v > 0) || v > 1e10) {
      toast.error("Informe um valor válido para movimentar a meta.");
      return;
    }
    if (mode === "remove" && v > goal.saved) {
      toast.error("Você não pode retirar mais do que registrou como reservado.");
      return;
    }
    setState((s) => ({
      ...s,
      savingsGoals: (s.savingsGoals ?? []).map((item) => {
        if (item.id !== goal.id) return item;
        return {
          ...item,
          saved: Math.round(
            Math.max(0, item.saved + (mode === "add" ? v : -v)) * 100,
          ) / 100,
        };
      }),
    }));
    setValue("");
    setExpanded(false);
    toast.success("Progresso da meta atualizado.");
  }

  function removeGoal() {
    if (!window.confirm('Excluir a meta "' + goal.name + '"? Os registros de finanças não serão alterados.')) return;
    setState((s) => ({
      ...s,
      savingsGoals: (s.savingsGoals ?? []).filter((item) => item.id !== goal.id),
    }));
    toast.success("Meta excluída.");
  }

  return (
    <article className="finance-surface rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><Flag size={20} /></span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-base font-bold">{goal.name}</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {goal.deadline ? "Objetivo para " + monthLabel(goal.deadline, true) : "Sem prazo definido"}
          </p>
        </div>
        <button type="button" aria-label={"Excluir meta " + goal.name} onClick={removeGoal} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-2">
        <div><p className="text-[11px] text-muted-foreground">Já reservado</p><p className="mt-1 font-display text-xl font-extrabold tabular-nums text-success">{brl(goal.saved)}</p></div>
        <div className="text-right"><p className="text-[11px] text-muted-foreground">Objetivo</p><p className="mt-1 font-display text-base font-bold tabular-nums">{brl(goal.target)}</p></div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.min(progress, 100)} aria-valuemin={0} aria-valuemax={100} aria-label={"Progresso da meta " + goal.name}>
        <div className="h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-all" style={{ width: Math.min(progress, 100) + "%" }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs text-muted-foreground">
        <span>{Math.max(0, progress)}% concluído</span>
        <span>{remaining === 0 ? "Meta atingida!" : "Faltam " + brl(remaining)}</span>
      </div>

      {expanded ? (
        <div className="mt-4 rounded-xl border border-border bg-secondary/25 p-3">
          <p className="mb-2 text-xs font-semibold">Atualizar o valor reservado</p>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setMode("add")} className={"rounded-lg border px-3 py-2 text-xs font-semibold " + (mode === "add" ? "border-primary bg-primary/15 text-primary" : "border-border")}>+ Adicionar</button>
            <button onClick={() => setMode("remove")} className={"rounded-lg border px-3 py-2 text-xs font-semibold " + (mode === "remove" ? "border-primary bg-primary/15 text-primary" : "border-border")}>− Retirar</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <input aria-label="Valor a movimentar na meta" value={value} inputMode="decimal" onChange={(event) => setValue(event.target.value)} placeholder="R$ 0,00" className={input + " min-w-0 flex-1"} />
            <button onClick={change} className="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground"><Check size={17} /></button>
            <button onClick={() => setExpanded(false)} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold">Cancelar</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setMode("add"); setExpanded(true); }} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary hover:bg-primary/20"><Plus size={15} /> Atualizar progresso</button>
      )}
    </article>
  );
}

function Planejamento() {
  const s = useFinance();
  const [month, setMonth] = useState(currentMonth());
  const [category, setCategory] = useState<string>("Alimentação");
  const [limit, setLimit] = useState("");
  const [newName, setNewName] = useState("");
  const [newTarget, setNewTarget] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [showNewGoal, setShowNewGoal] = useState(false);
  if (!s.ready) return <AppShell><div /></AppShell>;

  const summary = monthSummary(s, month);
  const budgets = budgetRows(s, month);
  const withLimits = budgets.filter((row) => row.budget > 0);
  const limitedTotal = withLimits.reduce((acc, row) => acc + row.budget, 0);
  const limitedSpent = withLimits.reduce((acc, row) => acc + row.spent, 0);
  const overBudget = withLimits.filter((row) => row.spent > row.budget);
  const forecast = projection(s, month).map((row) => ({
    label: monthLabel(row.month),
    Entradas: Math.round(row.income * 100) / 100,
    Despesas: Math.round(row.out * 100) / 100,
  }));
  const goals = s.savingsGoals ?? [];

  function setBudget() {
    const number = parseMoney(limit);
    if (!(number > 0) || number > 1e10) {
      toast.error("Informe um limite maior que zero.");
      return;
    }
    setState((current) => ({
      ...current,
      budgets: {
        ...current.budgets,
        [month]: { ...current.budgets?.[month], [category]: number },
      },
    }));
    setLimit("");
    toast.success("Limite atualizado para " + monthLabel(month, true) + ".");
  }

  function deleteBudget(name: string) {
    setState((current) => {
      const nextMonth = { ...current.budgets?.[month] };
      delete nextMonth[name];
      return {
        ...current,
        budgets: { ...current.budgets, [month]: nextMonth },
      };
    });
    toast.success("Limite removido.");
  }

  function createGoal() {
    const target = parseMoney(newTarget);
    if (!newName.trim() || newName.trim().length > 70) { toast.error("Informe um nome para a meta."); return; }
    if (!(target > 0) || target > 1e10) { toast.error("Informe um valor objetivo válido."); return; }
    const goal: SavingsGoal = {
      id: uid() + uid(),
      name: newName.trim(),
      target,
      saved: 0,
      createdAt: new Date().toISOString(),
      ...(newDeadline ? { deadline: newDeadline } : {}),
    };
    setState((current) => ({
      ...current,
      savingsGoals: [...(current.savingsGoals ?? []), goal],
    }));
    setNewName("");
    setNewTarget("");
    setNewDeadline("");
    setShowNewGoal(false);
    toast.success("Sua nova meta foi criada!");
  }

  function exportCsv() {
    try {
      const csv = financeCsv(s, month);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = "meu-caixa-" + month + ".csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(href), 300);
      toast.success("Relatório exportado!");
    } catch {
      toast.error("Não foi possível gerar o relatório.");
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="finance-kicker">CONTROLE / FUTURO</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Seu planejamento</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Veja o dinheiro que entra, estabeleça limites e transforme objetivos em metas reais.</p>
        </div>
        <button onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-semibold transition hover:border-primary/40"><Download size={16} /> Exportar CSV</button>
      </div>

      <section className="finance-surface mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="finance-kicker">VISÃO DO MÊS</p><h2 className="mt-1 font-display text-xl font-extrabold">{monthLabel(month, true)}</h2></div>
          <div className="flex items-center gap-1.5">
            <button aria-label="Mês anterior" onClick={() => setMonth((old) => addMonths(old, -1))} className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-secondary"><ChevronLeft size={17} /></button>
            <button onClick={() => setMonth(currentMonth())} className="rounded-xl border border-border px-3 py-2.5 text-xs font-semibold hover:bg-secondary">Hoje</button>
            <button aria-label="Próximo mês" onClick={() => setMonth((old) => addMonths(old, 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-border hover:bg-secondary"><ChevronRight size={17} /></button>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Renda prevista" value={brl(summary.income)} tone="pos" icon={Wallet} />
          <Stat label="Despesas previstas" value={brl(summary.out)} tone="neg" icon={ArrowUpRight} />
          <Stat label="Ainda a pagar" value={brl(summary.pending)} icon={CalendarDays} />
          <Stat label="Sobra projetada" value={brl(summary.balance)} tone={summary.balance >= 0 ? "pos" : "neg"} icon={PiggyBank} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Valores calculados a partir da renda informada, das contas e dos lançamentos. A projeção não consulta o saldo bancário.</p>
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="finance-surface rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="finance-kicker">VISÃO PARA FRENTE</p><h2 className="mt-1 font-display text-xl font-extrabold">Próximos 6 meses</h2></div>
            <Link to="/agenda" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Ver agenda <ArrowRight size={14} /></Link>
          </div>
          <div className="mt-5 h-60 sm:h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={forecast} margin={{ top: 8, right: 5, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                <Tooltip formatter={(v: number | string) => brl(Number(v))} contentStyle={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="Entradas" stroke="var(--success)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="Despesas" stroke="var(--destructive)" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <Sparkles size={16} className="mt-0.5 shrink-0 text-primary" />
            Projeções ajudam a evitar novas parcelas em meses que já estão comprometidos. Cadastre sua renda futura em Dívidas para estimativas melhores.
          </div>
        </section>

        <section className="finance-surface rounded-3xl border border-border bg-card p-5 sm:p-6">
          <div className="flex items-center gap-2"><Target size={21} className="text-primary" /><h2 className="font-display text-xl font-extrabold">Limites por categoria</h2></div>
          <p className="mt-2 text-sm text-muted-foreground">Defina quanto pretende gastar em cada categoria neste mês.</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_130px_auto]">
            <select aria-label="Categoria do limite" className={input} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input aria-label="Valor limite da categoria" className={input} value={limit} inputMode="decimal" placeholder="R$ 0,00" onChange={(e) => setLimit(e.target.value)} />
            <button onClick={setBudget} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground"><Plus size={16} /> Salvar</button>
          </div>

          {withLimits.length > 0 ? (
            <div className="mt-5">
              <div className="flex flex-wrap items-end justify-between gap-2 rounded-xl bg-secondary/45 p-3">
                <div><p className="text-[11px] text-muted-foreground">Limites configurados</p><p className="mt-1 font-display text-xl font-extrabold">{brl(limitedTotal)}</p></div>
                <div className="text-right"><p className="text-[11px] text-muted-foreground">Comprometido</p><p className="mt-1 font-display text-lg font-bold">{brl(limitedSpent)}</p></div>
              </div>
              {overBudget.length > 0 && <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{overBudget.length} categoria(s) ultrapassaram o limite planejado.</p>}
              <ul className="mt-4 space-y-4">
                {withLimits.map((row) => {
                  const tooHigh = row.spent > row.budget;
                  return (
                    <li key={row.category}>
                      <div className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold">{row.category}</span>
                        <div className="flex items-center gap-2"><span className={"text-xs tabular-nums " + (tooHigh ? "text-destructive" : "text-muted-foreground")}>{brl(row.spent)} / {brl(row.budget)}</span>
                          <button aria-label={"Remover limite " + row.category} onClick={() => deleteBudget(row.category)} className="rounded-md p-1 text-muted-foreground hover:text-destructive"><Trash2 size={13} /></button>
                        </div>
                      </div>
                      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-secondary">
                        <div className={"h-full rounded-full " + (tooHigh ? "bg-destructive" : row.percentage >= 85 ? "bg-accent" : "bg-primary")} style={{ width: Math.min(100, row.percentage) + "%" }} />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                        <span>{row.percentage}% usado</span><span className={tooHigh ? "text-destructive" : ""}>{tooHigh ? "Acima em " + brl(Math.abs(row.remaining)) : "Restam " + brl(row.remaining)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <div className="mt-5 rounded-xl border border-dashed border-border p-6 text-center"><Target size={24} className="mx-auto text-muted-foreground" /><p className="mt-2 text-sm font-semibold">Nenhum limite definido</p><p className="mt-1 text-xs text-muted-foreground">Comece por alimentação, lazer ou compras.</p></div>}
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Os gastos consideram contas do mês (pagas e pendentes) e saídas avulsas registradas. Não representam débito bancário efetivo.</p>
        </section>
      </div>

      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="finance-kicker">PLANOS / CONQUISTAS</p><h2 className="mt-1 font-display text-xl font-extrabold md:text-2xl">Metas de economia</h2><p className="mt-1 text-sm text-muted-foreground">Acompanhe o quanto você quer reservar para seus objetivos.</p></div>
          <button onClick={() => setShowNewGoal((current) => !current)} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus size={16} /> Criar meta</button>
        </div>
        {showNewGoal && (
          <div className="finance-surface mt-4 rounded-2xl border border-primary/30 bg-card p-4 sm:p-5">
            <h3 className="font-display font-bold">Nova meta</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_160px_160px_auto]">
              <input aria-label="Nome da meta" placeholder="Ex: Viagem, reserva de emergência" maxLength={70} className={input} value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input aria-label="Valor da meta" placeholder="Valor em R$" inputMode="decimal" className={input} value={newTarget} onChange={(e) => setNewTarget(e.target.value)} />
              <input aria-label="Prazo da meta (opcional)" type="month" className={input} value={newDeadline} onChange={(e) => setNewDeadline(e.target.value)} />
              <button onClick={createGoal} className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Check size={16} /> Salvar</button>
            </div>
          </div>
        )}
        {goals.length > 0 ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)}
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/45 p-8 text-center sm:p-12">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent/10 text-accent"><PiggyBank size={27} /></span>
            <p className="mt-3 font-display text-lg font-bold">Todo objetivo começa com uma meta</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">Que tal acompanhar uma reserva de emergência, uma viagem ou o valor para quitar uma dívida?</p>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Metas são acompanhamentos manuais: registrar um valor reservado não movimenta seu dinheiro, não cria lançamentos e não reduz a renda prevista.</p>
      </section>
    </AppShell>
  );
}
