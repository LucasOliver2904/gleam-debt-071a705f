import { setMoneyHidden, useMoneyPrivacy } from "@/lib/money-privacy";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrivateEditor } from "@/components/PrivateEditor";
import { confirmAction } from "@/lib/confirm-action";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CalendarCheck, CalendarClock, Layers, Pencil, Plus, Repeat, RotateCcw, Search, Trash2, Wallet, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/AppShell";
import { addMonths, allMonths, brl, currentMonth, debtRemaining, monthLabel, monthSummary, setState, skipMonth, uid, useFinance, useCategories, TYPE_INFO, outstandingDebtBalance, type Debt, type DebtType } from "@/lib/finance";

export const Route = createFileRoute("/dividas")({
  head: () => ({
    meta: [
      { title: "Contas e parcelas — Prumo" },
      { name: "description", content: "Todas as suas dívidas, parcelas e contas fixas mês a mês." },
      { property: "og:title", content: "Contas e parcelas — Prumo" },
      { property: "og:description", content: "Planilha de dívidas com parcelas pagas e pendentes." },
    ],
  }),
  component: Dividas,
});

function togglePaid(id: string, m: string) {
  setState((s) => ({ ...s, debts: s.debts.map((d) => {
    const p = d.payments[m];
    return d.id !== id || !p ? d : { ...d, payments: { ...d.payments, [m]: { amount: p.amount, paid: !p.paid } } };
  }) }));
}

function Dividas() {
  const s = useFinance();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [q, setQ] = useState("");
  if (!s.ready) return <AppShell><div /></AppShell>;
  const months = allMonths(s);
  const cm = currentMonth();
  const summary = monthSummary(s, cm);
  const totalRemaining = outstandingDebtBalance(s);
  const waiting = s.debts.filter((debt) => debt.payments[cm] && !debt.payments[cm]!.paid).length;
  const settled = s.debts.filter((debt) => debt.payments[cm]?.paid).length;

  const Section = ({ type, title }: { type: DebtType; title: string }) => (
    <>
      <tr><td colSpan={months.length + 3} className="bg-secondary px-3 py-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</td></tr>
      {s.debts.filter((d) => d.type === type && d.name.toLowerCase().includes(q.toLowerCase())).map((d) => <Row key={d.id} d={d} months={months} cm={cm} onEdit={() => setEditing(d)} />)}
    </>
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="finance-kicker">SEUS COMPROMISSOS</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Contas e parcelas</h1>
          <p className="mt-1 hidden md:block text-sm text-muted-foreground">Clique numa parcela para marcar como paga / pendente. Clique na renda base prevista para editar.</p>
        </div>
        <div className="flex flex-wrap gap-2"><Link to="/historico" className="rounded-xl border border-primary/40 bg-primary/5 px-4 py-2.5 text-sm font-semibold text-primary">Histórico por categoria</Link><button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus size={16} /> Nova conta</button></div>
      </div>
      <div className="mt-6 hidden grid-cols-2 gap-3 md:grid lg:grid-cols-4">
        <Stat label="Parcelas em aberto" value={brl(totalRemaining)} tone={totalRemaining > 0 ? "neg" : "pos"} icon={Wallet} hint="Não inclui contas fixas futuras"/>
        <Stat label="A pagar neste mês" value={brl(summary.pending)} tone={summary.pending > 0 ? "neg" : "pos"} icon={CalendarClock}/>
        <Stat label="Contas pendentes" value={String(waiting)} tone={waiting > 0 ? "neg" : "pos"} icon={CalendarCheck}/>
        <Stat label="Contas pagas no mês" value={String(settled)} tone="pos" icon={ShieldCheck}/>
      </div>
      <div className="relative mt-5 hidden md:block md:max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar conta..." className="w-full rounded-xl border border-input bg-card py-2 pl-9 pr-3 text-sm outline-none focus:border-primary" />
      </div>

      {s.debts.length === 0 && <div className="mt-5 flex flex-col items-center rounded-3xl border border-dashed border-primary/35 bg-primary/5 p-7 text-center sm:p-10"><span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Wallet size={22}/></span><p className="mt-3 font-display text-lg font-extrabold">Comece organizando suas contas</p><p className="mt-1 max-w-md text-sm text-muted-foreground">Cadastre uma parcela, assinatura ou compromisso recorrente. Seu painel e sua agenda passam a mostrar os próximos vencimentos.</p><button onClick={() => setOpen(true)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground"><Plus size={16}/> Cadastrar primeira conta</button></div>}
      <MobileList onEdit={setEditing} />
      <div className="finance-surface mt-6 hidden md:block overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="bg-secondary/45 text-left text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-card px-3 py-3">Conta</th>
              {months.map((m) => <th key={m} className={`px-2 py-3 text-right ${m === cm ? "text-primary" : ""}`}>{monthLabel(m)}</th>)}
              <th className="px-3 py-3 text-right">Resta</th><th />
            </tr>
          </thead>
          <tbody>
            <Section type="parcelada" title="Parceladas" />
            <Section type="fixa" title="Fixas (todo mês)" />
            <Section type="unica" title="Só um mês" />
            <TxsSection months={months} q={q} />
            <SummaryRow label="Soma total" months={months} get={(m) => monthSummary(s, m).out} />
            <tr className="border-t border-border font-semibold">
              <td className="sticky left-0 bg-card px-3 py-2">Salário / entradas</td>
              {months.map((m) => (
                <td key={m} className="px-1 py-1 text-right">
                  <IncomeCell m={m} value={s.income[m] ?? 0} />
                </td>
              ))}
              <td colSpan={2} />
            </tr>
            <SummaryRow label="Sobra" months={months} get={(m) => monthSummary(s, m).balance} colored />
          </tbody>
        </table>
      </div>
      <div className="mt-3 hidden md:flex gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-success" /> Pago / Entrada</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-destructive" /> Pendente / Saída</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-accent" /> Última parcela</span>
      </div>
      {open && <NewDebt onClose={() => setOpen(false)} />}
      {editing && <EditDebt debt={editing} onClose={() => setEditing(null)} />}
    </AppShell>
  );
}

function TxsSection({ months, q }: { months: string[]; q: string }) {
  const s = useFinance();
  const txs = s.txs
    .filter((t) => t.description.toLowerCase().includes(q.toLowerCase()))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  if (txs.length === 0) return null;
  return (
    <>
      <tr><td colSpan={months.length + 3} className="bg-secondary px-3 py-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Lançamentos avulsos</td></tr>
      {txs.map((t) => {
        const tm = t.date.slice(0, 7);
        const entrada = t.kind === "entrada";
        return (
          <tr key={t.id} className="border-t border-border">
            <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap">
              <span>{t.description}</span>
              <span className="text-xs text-muted-foreground"> · {t.date.split("-").reverse().join("/")} · {entrada ? "Entrada" : "Saída"}{t.excludedFromTotals ? " · já contabilizado na fatura" : ""}</span>
            </td>
            {months.map((m) => (
              <td key={m} className="p-0.5">
                {m === tm ? (
                  <div className={`w-full rounded-md px-2 py-1.5 text-right tabular-nums ${t.excludedFromTotals ? "bg-secondary/70 text-muted-foreground" : entrada ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                    {t.excludedFromTotals ? "↳" : entrada ? "+" : "−"} {brl(t.amount)}
                  </div>
                ) : <div className="h-8" />}
              </td>
            ))}
            <td />
            <td className="pr-2">
              <button aria-label={"Excluir " + t.description} onClick={async () => await confirmAction(`Excluir "${t.description}"?`) && setState((st) => ({ ...st, txs: st.txs.filter((x) => x.id !== t.id) }))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function Row({ d, months, cm, onEdit }: { d: Debt; months: string[]; cm: string; onEdit: () => void }) {
  const r = debtRemaining(d);
  const isLast = d.type === "parcelada" && r.left === 1 && r.remaining > 0;
  const isAlmost = d.type === "parcelada" && r.left === 2 && r.remaining > 0;

  return (
    <tr className="border-t border-border">
      <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap">
        <button onClick={onEdit} className="group inline-flex items-center gap-1.5 hover:text-primary">
          {d.name} <Pencil size={12} className="text-muted-foreground group-hover:text-primary" />
        </button>
        {isLast && (
          <span className="ml-2 rounded bg-accent/20 px-1.5 py-0.5 text-[10px] font-bold text-accent">Última</span>
        )}
        {isAlmost && (
          <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">Falta 2</span>
        )}
        <span className="text-xs text-muted-foreground"> {d.due ? `· dia ${d.due} ` : ""}{d.type === "parcelada" ? `(${r.count}x)` : ""}</span>
      </td>
      {months.map((m) => {
        const p = d.payments[m];
        return (
          <td key={m} className="p-0.5">
            {p ? (
              <button onClick={() => togglePaid(d.id, m)} title={p.paid ? "Pago — clique para pendente. Clique direito para remover o mês" : "Pendente — clique para pagar. Clique direito para remover o mês"}
                onContextMenu={async (e) => { e.preventDefault(); if (await confirmAction(`Remover ${monthLabel(m, true)} de "${d.name}"?`)) skipMonth(d.id, m); }}
                className={`w-full rounded-md px-2 py-1.5 text-right tabular-nums transition hover:opacity-80 ${p.paid ? "bg-success/20 text-success" : m < cm ? "bg-destructive text-destructive-foreground" : "bg-destructive/20 text-destructive"}`}>
                {brl(p.amount)}
              </button>
            ) : <div className="h-8" />}
          </td>
        );
      })}
      <td className="px-3 text-right font-semibold tabular-nums">
        {d.type === "fixa" ? (
          <span className="text-xs font-normal text-muted-foreground">{brl(d.recurring?.amount ?? 0)}/mês</span>
        ) : r.remaining ? (
          <span className={isLast ? "text-amber-600 dark:text-amber-400" : ""}>{brl(r.remaining)}</span>
        ) : (
          <span className="text-success">Quitada</span>
        )}
      </td>
      <td className="pr-2">
        <button aria-label={"Excluir " + d.name} onClick={async () => await confirmAction(`Excluir "${d.name}"?`) && setState((s) => ({ ...s, debts: s.debts.filter((x) => x.id !== d.id) }))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
      </td>
    </tr>
  );
}

function SummaryRow({ label, months, get, colored }: { label: string; months: string[]; get: (m: string) => number; colored?: boolean }) {
  return (
    <tr className="border-t-2 border-border font-semibold">
      <td className="sticky left-0 bg-card px-3 py-2">{label}</td>
      {months.map((m) => { const v = get(m); return <td key={m} className={`px-2 py-2 text-right tabular-nums ${colored ? (v >= 0 ? "text-success" : "text-destructive") : ""}`}>{brl(v)}</td>; })}
      <td colSpan={2} />
    </tr>
  );
}

function IncomeCell({ m, value }: { m: string; value: number }) {
  const [edit, setEdit] = useState(false);
  const hidden = useMoneyPrivacy();
  if (!edit || hidden) return <button aria-label={(hidden ? "Mostrar valores para editar renda de " : "Editar renda prevista de ") + monthLabel(m, true)} onClick={() => { if (hidden) setMoneyHidden(false); setEdit(true); }} className="w-full rounded-md px-1 py-1.5 text-right tabular-nums hover:bg-secondary">{brl(value)}</button>;
  return (
    <input autoFocus type="number" step="0.01" defaultValue={value} className="w-24 rounded-md border border-input bg-background px-1 py-1 text-right"
      onBlur={(e) => { const v = parseFloat(e.target.value) || 0; setState((s) => ({ ...s, income: { ...s.income, [m]: v } })); setEdit(false); }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );
}

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
const num = (v: string) => (v.includes(",") ? parseFloat(v.replace(/\./g, "").replace(",", ".")) : parseFloat(v)) || 0;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] bg-card p-5 sm:p-6">
        <DialogHeader><DialogTitle className="font-display text-xl font-bold">{title}</DialogTitle><DialogDescription>Confira os dados da conta antes de salvar.</DialogDescription></DialogHeader>
        <div className="mt-5 space-y-4">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

function TypePicker({ value, onChange }: { value: DebtType; onChange: (t: DebtType) => void }) {
  const icons = { parcelada: Layers, fixa: Repeat, unica: CalendarCheck } as const;
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(TYPE_INFO) as DebtType[]).map((t) => {
        const I = icons[t];
        const on = value === t;
        return (
          <button key={t} type="button" onClick={() => onChange(t)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${on ? "border-primary bg-primary/15" : "border-border hover:bg-secondary"}`}>
            <I size={18} className={on ? "text-primary" : "text-muted-foreground"} />
            <span className={`text-sm font-semibold ${on ? "text-primary" : ""}`}>{TYPE_INFO[t].short}</span>
            <span className="text-[11px] leading-tight text-muted-foreground">{TYPE_INFO[t].desc}</span>
          </button>
        );
      })}
    </div>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const categories = useCategories();
  return (
    <label className="block text-sm">Categoria
      <select className={input + " mt-1"} value={value} onChange={(e) => onChange(e.target.value)}>
        {categories.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    </label>
  );
}

function NewDebt({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DebtType>("parcelada");
  const [category, setCategory] = useState<string>("Outros");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState<"parcela" | "total">("parcela");
  const [n, setN] = useState("2");
  const [start, setStart] = useState(currentMonth());
  const [end, setEnd] = useState("");
  const [paidCount, setPaidCount] = useState("0");
  const [paidNow, setPaidNow] = useState(false);
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");

  const v = num(amount);
  const count = parseInt(n) || 0;
  const per = type === "parcelada" && mode === "total" && count ? Math.round((v / count) * 100) / 100 : v;

  const submit = () => {
    if (!name.trim() || name.length > 80) return setErr("Informe um nome (até 80 caracteres).");
    if (!(v > 0)) return setErr("Informe um valor válido.");
    const dd = parseInt(due);
    const base = { id: uid(), name: name.trim(), type, category, note: note.trim() || undefined, due: dd >= 1 && dd <= 31 ? dd : undefined };
    const payments: Debt["payments"] = {};
    let debt: Debt;
    if (type === "parcelada") {
      if (!(count >= 1 && count <= 240)) return setErr("Parcelas entre 1 e 240.");
      const pc = Math.min(parseInt(paidCount) || 0, count);
      for (let i = 0; i < count; i++) payments[addMonths(start, i)] = { amount: per, paid: i < pc };
      debt = { ...base, payments };
    } else if (type === "unica") {
      payments[start] = { amount: v, paid: paidNow };
      debt = { ...base, payments };
    } else {
      if (end && end < start) return setErr("O mês final precisa ser depois do inicial.");
      payments[start] = { amount: v, paid: paidNow };
      debt = { ...base, payments, recurring: { amount: v, start, end: end || undefined } };
    }
    setState((s) => ({ ...s, debts: [...s.debts, debt] }));
    toast.success(`"${base.name}" adicionada`);
    onClose();
  };

  return (
    <Sheet title="Nova conta" onClose={onClose}>
      <TypePicker value={type} onChange={setType} />
      <label className="block text-sm">Nome<input autoFocus className={input + " mt-1"} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder={type === "fixa" ? "Ex: Netflix, Aluguel" : type === "unica" ? "Ex: IPVA, Conserto" : "Ex: Shopee, Celular"} /></label>
      <div className="grid grid-cols-2 gap-3">
        <CategorySelect value={category} onChange={setCategory} />
        <label className="block text-sm">Dia do vencimento<input className={input + " mt-1"} type="number" inputMode="numeric" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} placeholder="Ex: 10" /></label>
      </div>

      {type === "parcelada" && (
        <div className="grid grid-cols-2 rounded-xl bg-secondary p-1 text-sm">
          {(["parcela", "total"] as const).map((x) => (
            <button key={x} type="button" onClick={() => setMode(x)} className={`rounded-lg py-1.5 ${mode === x ? "bg-card font-semibold" : "text-muted-foreground"}`}>{x === "parcela" ? "Valor da parcela" : "Valor total"}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">{type === "fixa" ? "Valor mensal (R$)" : type === "unica" ? "Valor (R$)" : mode === "total" ? "Valor total (R$)" : "Valor da parcela (R$)"}
          <input className={input + " mt-1"} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></label>
        {type === "parcelada" && <label className="block text-sm">Nº de parcelas<input className={input + " mt-1"} type="number" inputMode="numeric" min={1} value={n} onChange={(e) => setN(e.target.value)} /></label>}
        <label className="block text-sm">{type === "parcelada" ? "1ª parcela em" : type === "fixa" ? "Começa em" : "Mês"}<input className={input + " mt-1"} type="month" value={start} onChange={(e) => setStart(e.target.value)} /></label>
        {type === "parcelada" && <label className="block text-sm">Já pagas<input className={input + " mt-1"} type="number" inputMode="numeric" min={0} value={paidCount} onChange={(e) => setPaidCount(e.target.value)} /></label>}
        {type === "fixa" && <label className="block text-sm">Termina em <span className="text-muted-foreground">(opcional)</span><input className={input + " mt-1"} type="month" value={end} onChange={(e) => setEnd(e.target.value)} /></label>}
      </div>
      {type !== "parcelada" && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" /> Já paguei {type === "fixa" ? "o primeiro mês" : "esta conta"}</label>
      )}
      <label className="block text-sm">Observação <span className="text-muted-foreground">(opcional)</span><input className={input + " mt-1"} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex: comprado no cartão da mãe" /></label>

      {v > 0 && (
        <div className="rounded-xl border border-border bg-background p-3 text-sm">
          {type === "parcelada" && <p>{count}x de <b>{brl(per)}</b> = <b>{brl(per * count)}</b> · termina em {monthLabel(addMonths(start, Math.max(count - 1, 0)), true)}</p>}
          {type === "fixa" && <p><b>{brl(v)}</b> todo mês a partir de {monthLabel(start, true)}{end ? ` até ${monthLabel(end, true)}` : " (sem data para acabar)"}. Você pode remover meses específicos depois.</p>}
          {type === "unica" && <p><b>{brl(v)}</b> apenas em {monthLabel(start, true)}.</p>}
        </div>
      )}
      {err && <p className="text-sm text-destructive">{err}</p>}
      <button onClick={submit} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90">Salvar</button>
    </Sheet>
  );
}

function EditDebt({ debt, onClose }: { debt: Debt; onClose: () => void }) {
  const [name, setName] = useState(debt.name);
  const [type, setType] = useState<DebtType>(debt.type);
  const [category, setCategory] = useState(debt.category ?? "Outros");
  const [note, setNote] = useState(debt.note ?? "");
  const [due, setDue] = useState(debt.due ? String(debt.due) : "");
  const [monthly, setMonthly] = useState(String(debt.recurring?.amount ?? "").replace(".", ","));
  const [end, setEnd] = useState(debt.recurring?.end ?? "");
  const [skipped, setSkipped] = useState<string[]>(debt.skipped ?? []);
  const [rows, setRows] = useState(() =>
    Object.entries(debt.payments).sort(([a], [b]) => a.localeCompare(b)).map(([m, p]) => ({ m, amount: String(p.amount).replace(".", ","), paid: p.paid })),
  );
  const [err, setErr] = useState("");

  const setRow = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => {
    const r = rows[i]!;
    if (type === "fixa") setSkipped((s) => [...new Set([...s, r.m])]);
    setRows((rs) => rs.filter((_, j) => j !== i));
  };

  const applyMonthly = () => {
    const v = num(monthly);
    if (!(v > 0)) return;
    const cm = currentMonth();
    setRows((rs) => rs.map((r) => (!r.paid && r.m >= cm ? { ...r, amount: String(v).replace(".", ",") } : r)));
  };

  const submit = () => {
    if (!name.trim() || name.length > 80) return setErr("Informe um nome (até 80 caracteres).");
    const payments: Debt["payments"] = {};
    for (const r of rows) {
      const v = num(r.amount);
      if (!r.m) return setErr("Todo mês precisa estar preenchido.");
      if (!(v > 0)) return setErr(`Valor inválido em ${monthLabel(r.m)}.`);
      payments[r.m] = { amount: v, paid: r.paid };
    }
    if (!Object.keys(payments).length && type !== "fixa") return setErr("A conta precisa de ao menos um mês.");
    const dd = parseInt(due);
    let recurring = undefined as Debt["recurring"];
    if (type === "fixa") {
      const v = num(monthly) || Object.values(payments).at(-1)?.amount || 0;
      if (!(v > 0)) return setErr("Informe o valor mensal.");
      const first = Object.keys(payments).sort()[0] ?? debt.recurring?.start ?? currentMonth();
      recurring = { amount: v, start: debt.recurring?.start && debt.recurring.start < first ? debt.recurring.start : first, end: end || undefined };
    }
    setState((s) => ({ ...s, debts: s.debts.map((d) => (d.id === debt.id ? { ...d, name: name.trim(), type, category, note: note.trim() || undefined, due: dd >= 1 && dd <= 31 ? dd : undefined, payments, recurring, skipped: type === "fixa" ? skipped.filter((m) => !payments[m]) : undefined } : d)) }));
    toast.success("Alterações salvas");
    onClose();
  };

  const del = async () => {
    if (!await confirmAction(`Excluir "${debt.name}" e todos os meses?`)) return;
    setState((s) => ({ ...s, debts: s.debts.filter((x) => x.id !== debt.id) }));
    toast("Conta excluída");
    onClose();
  };

  const total = rows.reduce((a, r) => a + num(r.amount), 0);
  const paid = rows.filter((r) => r.paid).reduce((a, r) => a + num(r.amount), 0);

  return (
    <Sheet title="Editar conta" onClose={onClose}><PrivateEditor>
      <TypePicker value={type} onChange={setType} />
      <label className="block text-sm">Nome<input className={input + " mt-1"} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></label>
      <div className="grid grid-cols-2 gap-3">
        <CategorySelect value={category} onChange={setCategory} />
        <label className="block text-sm">Dia do vencimento<input className={input + " mt-1"} type="number" inputMode="numeric" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} placeholder="Ex: 10" /></label>
      </div>
      {type === "fixa" && (
        <div className="space-y-3 rounded-xl border border-border bg-background p-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Valor mensal (R$)<input className={input + " mt-1"} inputMode="decimal" value={monthly} onChange={(e) => setMonthly(e.target.value)} /></label>
            <label className="block text-sm">Termina em <span className="text-muted-foreground">(opcional)</span><input className={input + " mt-1"} type="month" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          </div>
          <button type="button" onClick={applyMonthly} className="text-sm text-primary hover:underline">Aplicar novo valor aos meses pendentes daqui pra frente</button>
          {skipped.length > 0 && (
            <div className="text-sm">
              <p className="text-muted-foreground">Meses removidos (toque para voltar):</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {[...skipped].sort().map((m) => (
                  <button key={m} type="button" onClick={() => { setSkipped((s) => s.filter((x) => x !== m)); setRows((rs) => [...rs, { m, amount: monthly || rs.at(-1)?.amount || "", paid: false }].sort((a, b) => a.m.localeCompare(b.m))); }}
                    className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs hover:bg-secondary"><RotateCcw size={11} /> {monthLabel(m)}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium">{type === "parcelada" ? `Parcelas (${rows.length})` : `Meses (${rows.length})`}</p>
          <p className="text-xs text-muted-foreground">Pago {brl(paid)} de {brl(total)}</p>
        </div>
        <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
          {rows.map((r, i) => (
            <div key={r.m + i} className="flex items-center gap-2">
              {type === "parcelada" && <span className="w-7 text-xs text-muted-foreground">{i + 1}ª</span>}
              <input type="month" value={r.m} onChange={(e) => setRow(i, { m: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-input bg-background px-2 py-2 text-sm" />
              <input inputMode="decimal" value={r.amount} onChange={(e) => setRow(i, { amount: e.target.value })} className="w-24 rounded-lg border border-input bg-background px-2 py-2 text-right text-sm" />
              <button type="button" onClick={() => setRow(i, { paid: !r.paid })}
                className={`w-14 rounded-lg py-2 text-xs font-semibold ${r.paid ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                {r.paid ? "Paga" : "Pend."}
              </button>
              <button type="button" onClick={() => removeRow(i)} aria-label={`Remover ${monthLabel(r.m)}`} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setRows((rs) => [...rs, { m: addMonths(rs[rs.length - 1]?.m ?? currentMonth(), 1), amount: rs[rs.length - 1]?.amount ?? "", paid: false }])}
          className="mt-2 flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
          <Plus size={14} /> Adicionar {type === "parcelada" ? "parcela" : "mês"}
        </button>
      </div>
      <label className="block text-sm">Observação<input className={input + " mt-1"} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} /></label>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={del} className="flex items-center gap-1.5 rounded-xl border border-destructive/40 px-4 py-3 text-sm font-semibold text-destructive hover:bg-destructive/10"><Trash2 size={15} /> Excluir</button>
        <button onClick={submit} className="flex-1 rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90">Salvar alterações</button>
      </div>
    </PrivateEditor></Sheet>
  );
}

function BreakdownItem({ label, value, color }: { label: string; value: number; color: string }) {
  const zero = value === 0;
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-2.5 py-2">
      <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </span>
      <span className={`shrink-0 text-sm font-semibold tabular-nums ${zero ? "text-muted-foreground/60" : ""}`}>{brl(value)}</span>
    </div>
  );
}

function MobileList({ onEdit }: { onEdit: (d: Debt) => void }) {
  const valuesHidden = useMoneyPrivacy();
  const s = useFinance();
  const months = allMonths(s);
  const [m, setM] = useState(() => (months.includes(currentMonth()) ? currentMonth() : months[0] ?? currentMonth()));
  const i = months.indexOf(m);
  const sum = monthSummary(s, m);

  const breakdown = (() => {
    let parcelada = 0, fixa = 0, unica = 0;
    s.debts.forEach((d) => {
      const p = d.payments[m];
      if (p && !p.paid) {
        if (d.type === "parcelada") parcelada += p.amount;
        else if (d.type === "fixa") fixa += p.amount;
        else unica += p.amount;
      }
    });
    const avulsas = s.txs.filter((t) => t.date.startsWith(m) && t.kind === "saida" && !t.excludedFromTotals).reduce((a, t) => a + t.amount, 0);
    return { parcelada, fixa, unica, avulsas, total: parcelada + fixa + unica + avulsas };
  })();

  const [f, setF] = useState<"todas" | "pendentes" | "acabando" | DebtType>("todas");
  const [search, setSearch] = useState("");
  const items = s.debts.filter((d) => d.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) && d.payments[m] && (f === "todas" || (f === "pendentes" ? !d.payments[m]!.paid : f === "acabando" ? (d.type === "parcelada" && debtRemaining(d).left > 0 && debtRemaining(d).left <= 2) : d.type === f)))
    .sort((a, b) => Number(a.payments[m]!.paid) - Number(b.payments[m]!.paid) || (a.due ?? 99) - (b.due ?? 99));
  const monthTxs = s.txs.filter((t) => t.date.startsWith(m)).sort((a, b) => a.date.localeCompare(b.date));
  const chips: [typeof f, string][] = [["todas", "Todas"], ["pendentes", "Pendentes"], ["acabando", "Acabando"], ["parcelada", "Parceladas"], ["fixa", "Fixas"], ["unica", "Únicas"]];
  return (
    <div className="mt-4 md:hidden">
      <div className="finance-surface flex items-center justify-between rounded-2xl border border-border bg-card p-2">
        <button aria-label="Mês anterior" disabled={i <= 0} onClick={() => setM(months[i - 1]!)} className="grid h-11 w-11 place-items-center rounded-xl text-xl disabled:opacity-30">‹</button>
        <span className="font-display text-lg font-bold">{monthLabel(m, true)}</span>
        <button aria-label="Próximo mês" disabled={i >= months.length - 1} onClick={() => setM(months[i + 1]!)} className="grid h-11 w-11 place-items-center rounded-xl text-xl disabled:opacity-30">›</button>
      </div>

      <div className="mt-3 space-y-2.5">
        <div className="finance-surface rounded-2xl border border-border bg-card p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">A pagar total</span>
            <span className="font-display text-2xl font-bold tabular-nums text-destructive">{brl(breakdown.total)}</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            <BreakdownItem label="Parceladas" value={breakdown.parcelada} color="var(--chart-1)" />
            <BreakdownItem label="Fixas" value={breakdown.fixa} color="var(--chart-2)" />
            <BreakdownItem label="Únicas" value={breakdown.unica} color="var(--chart-3)" />
            <BreakdownItem label="Avulsas" value={breakdown.avulsas} color="var(--chart-4)" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="finance-surface rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Entradas previstas</p>
            <p className="mt-1 break-words font-display text-lg font-extrabold tabular-nums text-success">{brl(sum.income)}</p>
            {valuesHidden ? <p className="mt-2 text-xs text-muted-foreground">Renda base oculta neste aparelho.</p> : <label className="mt-2 block text-xs text-muted-foreground">Renda base prevista (R$)
              <input type="number" inputMode="decimal" step="0.01" min="0" key={m} defaultValue={s.income[m] ?? 0} onBlur={(event) => {
                const value = Math.max(0, Number(event.target.value) || 0);
                if (value !== (s.income[m] ?? 0)) setState((st) => ({ ...st, income: { ...st.income, [m]: value } }));
              }} className="mt-1 w-full rounded-lg border border-input bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-primary" />
            </label>}
          </div>
          <div className="finance-surface rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Sobra prevista</p>
            <p className={`mt-1 font-display text-lg font-bold tabular-nums ${sum.balance >= 0 ? "text-success" : "text-destructive"}`}>{brl(sum.balance)}</p>
          </div>
        </div>
      </div>

      <div className="relative mt-4">
        <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input aria-label="Buscar contas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pelo nome da conta..." className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-3 text-sm outline-none focus:border-primary" />
      </div>
      <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {chips.map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium ${f === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>{l}</button>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Toque numa conta para marcar como paga · lápis para editar.</p>
      {items.length === 0 && <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma conta aqui.</p>}
      <ul className="mt-2 space-y-2">
        {items.map((d) => {
          const p = d.payments[m]!;
          const r = debtRemaining(d);
          const n = Object.keys(d.payments).sort().indexOf(m) + 1;
          const isLast = d.type === "parcelada" && r.left === 1 && r.remaining > 0;
          const isAlmost = d.type === "parcelada" && r.left === 2 && r.remaining > 0;

          return (
            <li key={d.id} className="relative">
              <button onClick={() => togglePaid(d.id, m)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 pr-11 text-left active:scale-[0.99] ${p.paid ? "border-success/30 bg-success/10" : isLast ? "border-accent/45 bg-accent/8" : "border-border bg-card"}`}>
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-center leading-none ${p.paid ? "bg-success text-background" : isLast ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "bg-secondary"}`}>
                  {d.due ? <span><span className="block text-[9px] uppercase">dia</span><b className="text-base">{d.due}</b></span> : <span className="text-xs">—</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    {d.name}
                    {isLast && <span className="shrink-0 rounded bg-amber-500/20 px-1 py-0.5 text-[9px] font-bold text-amber-600 dark:text-amber-400">Última</span>}
                    {isAlmost && <span className="shrink-0 rounded bg-secondary px-1 py-0.5 text-[9px] font-bold text-muted-foreground">Falta 2</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">{d.type === "fixa" ? "Fixa · todo mês" : d.type === "unica" ? "Só este mês" : `Parcela ${n}/${Object.keys(d.payments).length} · resta ${brl(r.remaining)}`}{d.category ? ` · ${d.category}` : ""}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold tabular-nums ${p.paid ? "text-success" : isLast ? "text-amber-600 dark:text-amber-400" : ""}`}>{brl(p.amount)}</p>
                  <p className={`text-[11px] ${p.paid ? "text-success" : isLast ? "text-amber-600 dark:text-amber-400" : "text-destructive"}`}>{p.paid ? "Pago" : "Pendente"}</p>
                </div>
              </button>
              <button onClick={() => onEdit(d)} aria-label={`Editar ${d.name}`}
                className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                <Pencil size={14} />
              </button>
            </li>
          );
        })}
      </ul>

      {monthTxs.length > 0 && (
        <>
          <p className="mt-6 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Lançamentos do mês</p>
          <ul className="mt-2 space-y-2">
            {monthTxs.map((t) => {
              const entrada = t.kind === "entrada";
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
                  <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${entrada ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                    {entrada ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")} · {entrada ? "Entrada" : "Saída"}{t.category ? " · " + t.category : ""}{t.excludedFromTotals ? " · já somada em outra despesa" : ""}</p>
                  </div>
                  <p className={`text-xs font-extrabold tabular-nums sm:text-sm ${t.excludedFromTotals ? "text-muted-foreground" : entrada ? "text-success" : "text-destructive"}`}>{t.excludedFromTotals ? "↳" : entrada ? "+" : "−"} {brl(t.amount)}</p>
                  <button aria-label={"Excluir " + t.description} onClick={async () => await confirmAction(`Excluir "${t.description}"?`) && setState((st) => ({ ...st, txs: st.txs.filter((x) => x.id !== t.id) }))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
