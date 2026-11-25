import { useState } from "react";
import { Download, Plus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { brl, categoryOptions, currentMonth, localToday, setState, type State } from "@/lib/finance";
import { useMoneyPrivacy } from "@/lib/money-privacy";
import { categoryReport, categoryReportCsv } from "@/lib/category-report";
import { dueDate, localDayKey } from "@/lib/planning";

const field = "mt-1 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
type Period = "all" | "month" | "day" | "range";

export function CategoryReport({ state }: { state: State }) {
  const [period, setPeriod] = useState<Period>("all");
  const [category, setCategory] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [date, setDate] = useState(localToday);
  const [from, setFrom] = useState(() => currentMonth() + "-01");
  const [to, setTo] = useState(localToday);
  const [status, setStatus] = useState<"all" | "paid" | "pending">("paid");
  const [newCategory, setNewCategory] = useState("");
  const hidden = useMoneyPrivacy();
  const categories = categoryOptions(state);
  const bounds = period === "all" ? { to: localToday() } : period === "month" && month ? { from: month + "-01", to: localDayKey(dueDate(month)) } : period === "day" && date ? { from: date, to: date } : period === "range" ? { from, to } : {};
  const invalid = (period === "month" && !month) || (period === "day" && !date) || (period === "range" && (!from || !to || from > to));
  const result = categoryReport(state, invalid ? { from: "9999-12-31", to: "1900-01-01" } : { ...bounds, category: category || undefined });
  const rows = result.entries.filter((row) => status === "all" || (status === "paid" ? row.paid : !row.paid));
  function addCategory(event: React.FormEvent) {
    event.preventDefault();
    const name = newCategory.trim();
    if (!name || name.length > 80) return;
    const existing = categories.find((c) => c.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"));
    if (existing) { setCategory(existing); setNewCategory(""); return; }
    setState((s) => ({ ...s, customCategories: { ...s.customCategories, [name]: true } }));
    setCategory(name);
    setNewCategory("");
    toast.success("Categoria adicionada.");
  }
  function download() {
    const url = URL.createObjectURL(new Blob([categoryReportCsv(rows)], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "prumo-relatorio-categorias.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section aria-label="Relatório por categoria" className="finance-surface mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold"><SlidersHorizontal size={18} aria-hidden="true" className="text-primary" />Filtros</h2>
        <button type="button" disabled={invalid || !rows.length || hidden} onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40"><Download size={16}/> Exportar CSV</button>
      </div>
      <fieldset className="prumo-report-period">
        <legend>Período</legend>
        <div>
          {([
            ["all", "Até agora", "Até agora (tudo)"],
            ["month", "Mês", "Mês específico"],
            ["day", "Data", "Data específica"],
            ["range", "Intervalo", "Intervalo de datas"],
          ] as const).map(([value, label, accessibleLabel]) => (
            <label key={value}>
              <input type="radio" name="periodo-do-relatorio" value={value} checked={period === value}
                onChange={() => setPeriod(value)} aria-label={accessibleLabel} className="sr-only" />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label htmlFor="relatorio-categoria" className="block text-sm font-semibold">Categoria</label>
          <select id="relatorio-categoria" className={field} value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">Todas as categorias</option>
            {categories.map((option) => <option key={option}>{option}</option>)}
          </select>
        </div>
        {period === "month" && <label className="text-sm font-semibold">Mês<input type="month" className={field} value={month} onChange={(e) => setMonth(e.target.value)}/></label>}
        {period === "day" && <label className="text-sm font-semibold">Data<input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)}/></label>}
        {period === "range" && <><label className="text-sm font-semibold">De<input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)}/></label><label className="text-sm font-semibold">Até<input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)}/></label></>}
      </div>
      <details className="prumo-report-help">
        <summary>Criar categoria</summary>
        <form onSubmit={addCategory} className="max-w-md rounded-xl border border-border p-3">
          <label htmlFor="nova-categoria" className="block text-sm font-semibold text-foreground">Nome da nova categoria</label>
          <div className="mt-2 flex flex-wrap gap-2">
            <input id="nova-categoria" maxLength={80} className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} />
            <button type="submit" disabled={!newCategory.trim()} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Plus size={16} />Adicionar</button>
          </div>
          <p className="mt-2">A categoria fica na sua conta e aparece também ao lançar gastos e dívidas.</p>
        </form>
      </details>
      {invalid && <p role="alert" className="mt-3 text-sm text-destructive">Informe um período válido.</p>}
      <dl className="prumo-report-totals">
        <div><dt>Total gasto / pago</dt><dd>{brl(result.paid)}</dd></div>
        <div><dt>Pendente no período</dt><dd>{brl(result.pending)}</dd></div>
        <div><dt>Total comprometido</dt><dd>{brl(result.total)}</dd></div>
      </dl>
      <details className="prumo-report-help">
        <summary>Quais datas entram no relatório?</summary>
        <p>Para contas e parcelas, usamos o vencimento. Para gastos avulsos, usamos a data do lançamento. Compras já incluídas em faturas e entradas ficam fora da soma. “Até agora” inclui os registros até hoje.</p>
      </details>
      {!category && result.groups.length > 0 && <div className="mt-5 space-y-2">
        <h3 className="text-sm font-bold">Comparativo por categoria</h3>
        {result.groups.map((group) => <button key={group.category} type="button" onClick={() => setCategory(group.category)} className="w-full rounded-xl border border-border p-3 text-left hover:border-primary/40"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{group.category}</span><span className="text-sm tabular-nums">{brl(group.paid)} <span className="text-xs text-muted-foreground">pagos · {brl(group.pending)} pendentes</span></span></div>{!hidden && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: Math.min(100, (group.paid + group.pending) / Math.max(result.total, 0.01) * 100) + "%" }}/></div>}</button>)}
      </div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold">Detalhamento</h3>
        <div className="flex items-center gap-2">
          <label htmlFor="relatorio-situacao" className="text-xs text-muted-foreground">Situação</label>
          <select id="relatorio-situacao" className="rounded-lg border border-input bg-background p-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}>
            <option value="all">Todas</option><option value="paid">Pagos</option><option value="pending">Pendentes</option>
          </select>
        </div>
      </div>
      {rows.length ? <div className="mt-2 space-y-2 sm:hidden">{rows.map((row) => <article key={row.id} className="rounded-xl border border-border p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="break-words text-sm font-semibold">{row.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.category} · {row.date.split("-").reverse().join("/")}</p></div><div className="shrink-0 text-right"><p className="text-sm font-bold tabular-nums">{brl(row.amount)}</p><p className={"mt-1 text-xs " + (row.paid ? "text-success" : "text-destructive")}>{row.paid ? "Pago" : "Pendente"}</p></div></div></article>)}</div> : null}
      {rows.length ? <div className="mt-2 hidden max-h-[65vh] overflow-auto rounded-xl border border-border sm:block"><table className="w-full min-w-[450px] text-sm"><thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2">Situação</th><th className="p-2 text-right">Valor</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-2 whitespace-nowrap">{row.date.split("-").reverse().join("/")}</td><td className="p-2">{row.name}<span className="block text-xs text-muted-foreground">{row.category} · {row.source}</span></td><td className={"p-2 " + (row.paid ? "text-success" : "text-destructive")}>{row.paid ? "Pago" : "Pendente"}</td><td className="p-2 text-right tabular-nums whitespace-nowrap">{brl(row.amount)}</td></tr>)}</tbody></table></div> : <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhum lançamento neste filtro.</p>}

    </section>
  );
}
