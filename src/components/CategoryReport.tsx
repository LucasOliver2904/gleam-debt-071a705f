import { useState } from "react";
import { BarChart3, Download, Plus } from "lucide-react";
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
  const [status, setStatus] = useState<"all" | "paid" | "pending">("all");
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
        <div><p className="finance-kicker">ANÁLISE DE GASTOS</p><h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold"><BarChart3 size={20} className="text-primary"/> Relatório por categoria</h2><p className="mt-1 text-xs text-muted-foreground">Veja o que saiu do bolso e o que ainda precisa pagar.</p></div>
        <button type="button" disabled={invalid || !rows.length || hidden} onClick={download} className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-semibold disabled:opacity-40"><Download size={16}/> Exportar CSV</button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold">Categoria<select className={field} value={category} onChange={(e) => setCategory(e.target.value)}><option value="">Todas as categorias</option>{categories.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="text-sm font-semibold">Período<select className={field} value={period} onChange={(e) => setPeriod(e.target.value as Period)}><option value="all">Até agora (tudo)</option><option value="month">Mês específico</option><option value="day">Data específica</option><option value="range">Intervalo de datas</option></select></label>
        {period === "month" && <label className="text-sm font-semibold">Mês<input type="month" className={field} value={month} onChange={(e) => setMonth(e.target.value)}/></label>}
        {period === "day" && <label className="text-sm font-semibold">Data<input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)}/></label>}
        {period === "range" && <><label className="text-sm font-semibold">De<input type="date" className={field} value={from} onChange={(e) => setFrom(e.target.value)}/></label><label className="text-sm font-semibold">Até<input type="date" className={field} value={to} onChange={(e) => setTo(e.target.value)}/></label></>}
      </div>
      {invalid && <p role="alert" className="mt-3 text-sm text-destructive">Informe um período válido.</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {[{ label: "Total gasto / pago", value: result.paid, style: "text-success" }, { label: "Pendente no período", value: result.pending, style: "text-destructive" }, { label: "Total comprometido", value: result.total, style: "text-foreground" }].map((item) => <div key={item.label} className="rounded-xl border border-border bg-background p-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className={"mt-1 font-display text-xl font-extrabold tabular-nums " + item.style}>{brl(item.value)}</p></div>)}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Contas usam a data de vencimento (o dia real do pagamento não é registrado). Gastos avulsos usam a data registrada. Valores já incluídos em faturas e entradas não são somados. O filtro “Até agora” termina hoje.</p>
      {!category && result.groups.length > 0 && <div className="mt-5 space-y-2">
        <h3 className="text-sm font-bold">Comparativo por categoria</h3>
        {result.groups.map((group) => <button key={group.category} type="button" onClick={() => setCategory(group.category)} className="w-full rounded-xl border border-border p-3 text-left hover:border-primary/40"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{group.category}</span><span className="text-sm tabular-nums">{brl(group.paid)} <span className="text-xs text-muted-foreground">pagos · {brl(group.pending)} pendentes</span></span></div>{!hidden && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: Math.min(100, (group.paid + group.pending) / Math.max(result.total, 0.01) * 100) + "%" }}/></div>}</button>)}
      </div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold">Detalhamento</h3><label className="text-xs text-muted-foreground">Situação <select className="rounded-lg border border-input bg-background p-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}><option value="all">Todas</option><option value="paid">Pagos</option><option value="pending">Pendentes</option></select></label></div>
      {rows.length ? <div className="mt-2 max-h-96 overflow-auto rounded-xl border border-border"><table className="w-full min-w-[450px] text-sm"><thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground"><tr><th className="p-2">Data</th><th className="p-2">Descrição</th><th className="p-2">Situação</th><th className="p-2 text-right">Valor</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t border-border"><td className="p-2 whitespace-nowrap">{row.date.split("-").reverse().join("/")}</td><td className="p-2">{row.name}<span className="block text-xs text-muted-foreground">{row.category} · {row.source}</span></td><td className={"p-2 " + (row.paid ? "text-success" : "text-destructive")}>{row.paid ? "Pago" : "Pendente"}</td><td className="p-2 text-right tabular-nums whitespace-nowrap">{brl(row.amount)}</td></tr>)}</tbody></table></div> : <p className="mt-3 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Nenhum lançamento neste filtro.</p>}
      <form onSubmit={addCategory} className="mt-5 border-t border-border pt-4">
        <label className="block text-sm font-semibold">Criar categoria personalizada</label><div className="mt-2 flex flex-wrap gap-2"><input aria-label="Nome da nova categoria" maxLength={80} className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm" placeholder="Nome da categoria" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}/><button type="submit" disabled={!newCategory.trim()} className="inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Plus size={16}/> Adicionar</button></div><p className="mt-1 text-xs text-muted-foreground">As novas categorias aparecem também nos formulários de lançamento.</p>
      </form>
    </section>
  );
}
