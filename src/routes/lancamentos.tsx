import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Download, FileImage, FilterX, Pencil, Receipt, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/AppShell";
import { ExpenseReviewPanel } from "@/components/ExpenseReviewPanel";
import { TransactionEditor } from "@/components/TransactionEditor";
import { filterTransactions, transactionTotals, transactionsCsv, type TransactionFilter } from "@/lib/transaction-tools";
import { brl, CATEGORIES, currentMonth, localToday, monthLabel, parseMoney, setState, uid, useFinance, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — Prumo" },
      { name: "description", content: "Registre tudo que entra e tudo que sai." },
      { property: "og:title", content: "Lançamentos — Prumo" },
      { property: "og:description", content: "Entradas e saídas do seu dinheiro." },
    ],
  }),
  component: Lancamentos,
});

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Lancamentos() {
  const s = useFinance();
  const [kind, setKind] = useState<Tx["kind"]>("saida");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [period, setPeriod] = useState(currentMonth());
  const [search, setSearch] = useState("");
  const [date, setDate] = useState(() => localToday());
  const [kindFilter, setKindFilter] = useState<TransactionFilter["kind"]>("todos");
  const [categoryFilter, setCategoryFilter] = useState("todas");
  const [order, setOrder] = useState<TransactionFilter["order"]>("newest");
  const [editing, setEditing] = useState<Tx | null>(null);
  const [err, setErr] = useState("");
  if (!s.ready) return <AppShell><div /></AppShell>;

  const add = () => {
    const v = parseMoney(amount);
    if (!desc.trim() || desc.length > 100) return setErr("Informe uma descrição.");
    if (!(v > 0) || v > 1_000_000_000) return setErr("Valor inválido.");
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return setErr("Informe uma data válida.");
    setState((st) => ({ ...st, txs: [{ id: uid(), date, description: desc.trim(), amount: v, kind, category }, ...st.txs] }));
    setDesc(""); setAmount(""); setErr("");
    toast.success(kind === "entrada" ? "Entrada registrada" : "Saída registrada");
  };

  const del = (t: Tx) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    setState((st) => ({ ...st, txs: st.txs.filter((x) => x.id !== t.id) }));
    toast("Lançamento excluído");
  };

  const months = [...new Set(s.txs.map((tx) => tx.date.slice(0, 7)).concat(currentMonth()))].sort().reverse();
  const txs = filterTransactions(s.txs, {
    month: period, query: search, category: categoryFilter, kind: kindFilter, order,
  });
  const totals = transactionTotals(txs);
  const hasFilters = period !== currentMonth() || !!search.trim() || categoryFilter !== "todas" || kindFilter !== "todos" || order !== "newest";
  const resetFilters = () => { setPeriod(currentMonth()); setSearch(""); setCategoryFilter("todas"); setKindFilter("todos"); setOrder("newest"); };
  const exportVisible = () => {
    if (txs.length === 0) { toast.error("Nenhuma movimentação para exportar."); return; }
    const blob = new Blob([transactionsCsv(txs)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "meu-caixa-movimentacoes-" + (period === "todos" ? "todas" : period) + ".csv";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1200);
    toast.success("Histórico filtrado exportado.");
  };
  const categoryTotals = new Map<string, number>();
  txs.filter((t) => t.kind === "saida" && !t.excludedFromTotals).forEach((t) => { const cat = t.category || "Outros"; categoryTotals.set(cat, (categoryTotals.get(cat) || 0) + t.amount); });
  const catRows = [...categoryTotals].sort((a, b) => b[1] - a[1]);
  const tin = totals.income;
  const tout = totals.expenses;

  // agrupar por mês (YYYY-MM), mantendo ordem decrescente
  const groups = new Map<string, Tx[]>();
  for (const t of txs) {
    const k = t.date.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><Receipt size={20} /></span>
        <div>
          <p className="finance-kicker">MOVIMENTAÇÕES / DIA A DIA</p><h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl leading-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Entradas e gastos avulsos — fora das dívidas e do salário. Nos Pix com repasse, só a sua parte entra como receita.</p>
        </div>
        <span className="finance-pill shrink-0"><Receipt size={14}/> {s.txs.length} no histórico</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/extrato" className="inline-flex items-center gap-2 rounded-xl border border-primary/35 bg-primary/12 px-4 py-3 text-xs font-extrabold text-primary transition hover:bg-primary/20"><FileImage size={17}/> Importar prints do extrato</Link>
        <Link to="/pix" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs font-bold text-muted-foreground transition hover:text-primary">Gerenciar Pix recebidos e repasses</Link>
      </div>
      <ExpenseReviewPanel />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Entradas" value={brl(tin)} tone="pos" />
        <Stat label="Saídas" value={brl(tout)} tone="neg" />
        <Stat label="Saldo" value={brl(tin - tout)} tone={tin - tout >= 0 ? "pos" : "neg"} />
      </div>

      <section id="novo-lancamento" className="finance-surface mt-6 rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="mb-1 flex items-center justify-between gap-3">
          <div><p className="finance-kicker">REGISTRO MANUAL</p><h2 className="mt-1 font-display text-lg font-extrabold">Novo lançamento</h2></div>
          <span className="rounded-full bg-primary/12 px-3 py-1.5 text-[11px] font-bold text-primary">Rápido e simples</span>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setKind("entrada")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${kind === "entrada" ? "border-success bg-success/15 text-success" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <ArrowDownLeft size={15} /> Entrada
          </button>
          <button
            onClick={() => setKind("saida")}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${kind === "saida" ? "border-destructive bg-destructive/15 text-destructive" : "border-border text-muted-foreground hover:bg-secondary"}`}
          >
            <ArrowUpRight size={15} /> Saída
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_145px_155px_155px_auto]">
          <input className={input} placeholder="Descrição (ex: Mercado, Freela...)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <input className={input} placeholder="Valor R$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select aria-label="Categoria" className={input} value={category} onChange={(e) => setCategory(e.target.value)}>{CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <button
            onClick={add}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 ${kind === "entrada" ? "bg-success" : "bg-primary"}`}
          >
            Lançar
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      </section>

      <section className="finance-surface mt-6 rounded-3xl border border-border bg-card p-4 sm:p-6" aria-labelledby="history-title">
        <div className="finance-section-head">
          <div>
            <p className="finance-kicker">CONTROLE TOTAL</p>
            <h2 id="history-title" className="mt-1 font-display text-lg font-extrabold sm:text-xl">Seu histórico</h2>
            <p className="mt-1 text-xs text-muted-foreground">{txs.length} resultado(s) · Os totais abaixo respeitam os filtros escolhidos.</p>
          </div>
          <button onClick={exportVisible} type="button" disabled={txs.length === 0} className="inline-flex items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-50">
            <Download size={16}/> Exportar CSV
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar tipo de movimentação">
          {([
            ["todos", "Tudo"],
            ["entrada", "Entradas"],
            ["saida", "Despesas"],
          ] as const).map(([value, label]) => (
            <button key={value} type="button" data-active={kindFilter === value} aria-pressed={kindFilter === value} onClick={() => setKindFilter(value)}
              className="finance-tab inline-flex items-center gap-1.5 text-xs">
              {value === "entrada" ? <ArrowDownLeft size={15}/> : value === "saida" ? <ArrowUpRight size={15}/> : <Receipt size={15}/>}
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <label className="min-w-0">
            <span className="finance-field-label">Buscar descrição, origem ou remetente</span>
            <span className="relative block">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
              <input aria-label="Pesquisar lançamentos" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Mercado, Pix, salário..." className={input + " pl-9"}/>
            </span>
          </label>
          <label className="min-w-0"><span className="finance-field-label">Mês</span>
            <select aria-label="Filtrar mês" className={input} value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="todos">Todos os meses</option>
              {months.map((m) => <option key={m} value={m}>{monthLabel(m, true)}</option>)}
            </select>
          </label>
          <label className="min-w-0"><span className="finance-field-label">Categoria</span>
            <select aria-label="Filtrar categoria" className={input} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="todas">Todas as categorias</option>
              {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>
          <label className="min-w-0"><span className="finance-field-label">Ordem</span>
            <select aria-label="Ordenar lançamentos" className={input} value={order} onChange={(e) => setOrder(e.target.value as TransactionFilter["order"])}>
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
            </select>
          </label>
        </div>
        {hasFilters && <button type="button" onClick={resetFilters} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"><FilterX size={14}/> Limpar filtros</button>}
      </section>

      {catRows.length > 0 && (
        <section className="finance-surface mt-4 rounded-3xl border border-border bg-card p-4 sm:p-5">
          <div className="finance-section-head">
            <h2 className="font-display text-base font-extrabold">Onde você mais gasta</h2>
            <p className="text-xs text-muted-foreground">Gastos contabilizados · Filtro atual</p>
          </div>
          <div className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {catRows.slice(0, 6).map(([cat, value], i) => (
              <div key={cat} className="min-w-0">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold">{cat}</span>
                  <strong className="shrink-0 font-display tabular-nums">{brl(value)}</strong>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                  <div className={"h-full rounded-full " + (i === 0 ? "bg-primary" : i === 1 ? "bg-info" : i === 2 ? "bg-accent" : "bg-success/80")}
                    style={{ width: Math.min(100, Math.round(value / Math.max(catRows[0]?.[1] ?? 1, 0.01) * 100)) + "%" }}/>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {txs.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Receipt size={22} /></span>
          <p className="text-sm font-medium">Nenhum lançamento neste período</p>
          <p className="max-w-xs text-xs text-muted-foreground">Altere os filtros ou registre uma nova movimentação. Nenhum dado foi apagado.</p>
          {hasFilters && <button onClick={resetFilters} className="mt-3 rounded-xl border border-primary/35 px-4 py-2 text-xs font-bold text-primary">Limpar filtros</button>}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {[...groups.entries()].map(([mes, items]) => {
            const mesIn = items.filter((t) => t.kind === "entrada").reduce((a, t) => a + t.amount, 0);
            const mesOut = items.filter((t) => t.kind === "saida" && !t.excludedFromTotals).reduce((a, t) => a + t.amount, 0);
            return (
              <div key={mes}>
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-extrabold uppercase tracking-widest text-foreground">{monthLabel(mes, true)} <span className="ml-1 text-muted-foreground">· {items.length} movimento(s)</span></p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    <span className="text-success">+{brl(mesIn)}</span> · <span className="text-destructive">−{brl(mesOut)}</span>
                  </p>
                </div>
                <ul className="finance-surface divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {items.map((t) => {
                    const entrada = t.kind === "entrada";
                    return (
                      <li key={t.id} className="flex min-w-0 items-center gap-2.5 px-3 py-3 transition hover:bg-secondary/40 sm:gap-3 sm:px-4">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${entrada ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive"}`}>
                          {entrada ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold">{t.description}</p>
                          <p className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")}{t.category ? " · " + t.category : ""}{t.pix ? " · bruto " + brl(t.pix.gross) : ""}{t.statement ? " · Extrato: " + t.statement.source : ""}{t.excludedFromTotals ? " · Não somado (já na fatura/outra despesa)" : ""}</p>
                        </div>
                        <span className={`max-w-[40%] shrink-0 text-right font-display text-xs font-extrabold tabular-nums sm:text-sm ${t.excludedFromTotals ? "text-muted-foreground" : entrada ? "text-success" : "text-destructive"}`}>{t.excludedFromTotals ? "↳" : entrada ? "+" : "−"} {brl(t.amount)}</span>
                        <div className="flex shrink-0 items-center gap-1">
                          {!t.pix && !t.expenseAuto ? (
                            <button type="button" onClick={() => setEditing(t)} aria-label={"Editar " + t.description} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Pencil size={16} /></button>
                          ) : t.pix ? (
                            <Link to="/pix" aria-label={"Editar " + t.description + " em Pix e repasses"} title="Editar em Pix e repasses" className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Pencil size={16}/></Link>
                          ) : (
                            <button type="button" title="Editar em Despesas detectadas" aria-label={"Editar " + t.description + " em Despesas detectadas"} onClick={() => document.getElementById("expense-review-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-primary/10 hover:text-primary"><Pencil size={16}/></button>
                          )}
                          <button type="button" onClick={() => del(t)} aria-label={"Excluir " + t.description} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"><Trash2 size={16} /></button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {editing && <TransactionEditor key={editing.id} transaction={editing} onClose={() => setEditing(null)}/>}
    </AppShell>
  );
}
