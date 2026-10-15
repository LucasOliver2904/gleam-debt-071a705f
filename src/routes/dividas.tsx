import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { addMonths, allMonths, brl, currentMonth, debtRemaining, monthLabel, monthSummary, setState, uid, useFinance, type Debt, type DebtType } from "@/lib/finance";

export const Route = createFileRoute("/dividas")({
  head: () => ({
    meta: [
      { title: "Dívidas e parcelas — Meu Caixa" },
      { name: "description", content: "Todas as suas dívidas, parcelas e contas fixas mês a mês." },
      { property: "og:title", content: "Dívidas e parcelas — Meu Caixa" },
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
  if (!s.ready) return <AppShell><div /></AppShell>;
  const months = allMonths(s);
  const cm = currentMonth();

  const Section = ({ type, title }: { type: DebtType; title: string }) => (
    <>
      <tr><td colSpan={months.length + 3} className="bg-accent px-3 py-2 font-display text-sm font-bold uppercase tracking-widest text-accent-foreground">{title}</td></tr>
      {s.debts.filter((d) => d.type === type).map((d) => <Row key={d.id} d={d} months={months} cm={cm} onEdit={() => setEditing(d)} />)}
    </>
  );

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Dívidas</h1>
          <p className="mt-1 hidden md:block text-sm text-muted-foreground">Clique numa parcela para marcar como paga / pendente. Clique no salário para editar.</p>
        </div>
        <button onClick={() => setOpen(true)} className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"><Plus size={16} /> Nova dívida</button>
      </div>

      <MobileList />
      <div className="mt-6 hidden md:block overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="sticky left-0 z-10 bg-card px-3 py-3">Conta</th>
              {months.map((m) => <th key={m} className={`px-2 py-3 text-right ${m === cm ? "text-primary" : ""}`}>{monthLabel(m)}</th>)}
              <th className="px-3 py-3 text-right">Resta</th><th />
            </tr>
          </thead>
          <tbody>
            <Section type="parcelada" title="Parceladas" />
            <Section type="fixa" title="Fixas" />
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
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-success" /> Pago</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded bg-destructive" /> Pendente</span>
      </div>
      {open && <NewDebt onClose={() => setOpen(false)} />}
    </AppShell>
  );
}

function Row({ d, months, cm }: { d: Debt; months: string[]; cm: string }) {
  const r = debtRemaining(d);
  return (
    <tr className="border-t border-border">
      <td className="sticky left-0 z-10 bg-card px-3 py-1.5 font-medium whitespace-nowrap">{d.name} <span className="text-xs text-muted-foreground">{d.due ? `· dia ${d.due} ` : ""}({r.count}x)</span></td>
      {months.map((m) => {
        const p = d.payments[m];
        return (
          <td key={m} className="p-0.5">
            {p ? (
              <button onClick={() => togglePaid(d.id, m)} title={p.paid ? "Pago" : "Pendente"}
                className={`w-full rounded-md px-2 py-1.5 text-right tabular-nums transition hover:opacity-80 ${p.paid ? "bg-success/20 text-success" : m < cm ? "bg-destructive text-destructive-foreground" : "bg-destructive/20 text-destructive"}`}>
                {brl(p.amount)}
              </button>
            ) : <div className="h-8" />}
          </td>
        );
      })}
      <td className="px-3 text-right font-semibold tabular-nums">{r.remaining ? brl(r.remaining) : <span className="text-success">Quitada</span>}</td>
      <td className="pr-2">
        <button onClick={() => confirm(`Excluir "${d.name}"?`) && setState((s) => ({ ...s, debts: s.debts.filter((x) => x.id !== d.id) }))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
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
  if (!edit) return <button onClick={() => setEdit(true)} className="w-full rounded-md px-1 py-1.5 text-right tabular-nums hover:bg-secondary">{brl(value)}</button>;
  return (
    <input autoFocus type="number" step="0.01" defaultValue={value} className="w-24 rounded-md border border-input bg-background px-1 py-1 text-right"
      onBlur={(e) => { const v = parseFloat(e.target.value) || 0; setState((s) => ({ ...s, income: { ...s.income, [m]: v } })); setEdit(false); }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
  );
}

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function NewDebt({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<DebtType>("parcelada");
  const [amount, setAmount] = useState("");
  const [n, setN] = useState("1");
  const [start, setStart] = useState(currentMonth());
  const [paidCount, setPaidCount] = useState("0");
  const [err, setErr] = useState("");
  const [due, setDue] = useState("");

  const submit = () => {
    const v = parseFloat(amount.replace(",", "."));
    const count = parseInt(n);
    const pc = parseInt(paidCount) || 0;
    if (!name.trim() || name.length > 80) return setErr("Informe um nome (até 80 caracteres).");
    if (!(v > 0)) return setErr("Valor da parcela inválido.");
    if (!(count >= 1 && count <= 240)) return setErr("Parcelas entre 1 e 240.");
    const dd = parseInt(due);
    const payments: Debt["payments"] = {};
    for (let i = 0; i < count; i++) payments[addMonths(start, i)] = { amount: v, paid: i < pc };
    setState((s) => ({ ...s, debts: [...s.debts, { id: uid(), name: name.trim(), type, due: dd >= 1 && dd <= 31 ? dd : undefined, payments }] }));
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold">Nova dívida</h2>
          <button onClick={onClose} className="text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="mt-5 space-y-4">
          <label className="block text-sm">Nome<input className={input + " mt-1"} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Shopee" /></label>
          <label className="block text-sm">Dia do vencimento<input className={input + " mt-1"} type="number" inputMode="numeric" min={1} max={31} value={due} onChange={(e) => setDue(e.target.value)} placeholder="Ex: 10" /></label>
          <div className="grid grid-cols-2 gap-2">
            {(["parcelada", "fixa"] as const).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`rounded-xl border px-3 py-2 text-sm capitalize ${type === t ? "border-primary bg-primary/15 text-primary" : "border-border"}`}>{t}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Valor da parcela (R$)<input className={input + " mt-1"} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" /></label>
            <label className="block text-sm">{type === "fixa" ? "Meses" : "Nº de parcelas"}<input className={input + " mt-1"} type="number" min={1} value={n} onChange={(e) => setN(e.target.value)} /></label>
            <label className="block text-sm">Primeiro mês<input className={input + " mt-1"} type="month" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label className="block text-sm">Já pagas<input className={input + " mt-1"} type="number" min={0} value={paidCount} onChange={(e) => setPaidCount(e.target.value)} /></label>
          </div>
          {amount && n && <p className="text-sm text-muted-foreground">Total: <b className="text-foreground">{brl((parseFloat(amount.replace(",", ".")) || 0) * (parseInt(n) || 0))}</b></p>}
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button onClick={submit} className="w-full rounded-xl bg-primary py-3 font-semibold text-primary-foreground hover:opacity-90">Salvar dívida</button>
        </div>
      </div>
    </div>
  );
}

function MobileList() {
  const s = useFinance();
  const months = allMonths(s);
  const [m, setM] = useState(() => (months.includes(currentMonth()) ? currentMonth() : months[0] ?? currentMonth()));
  const i = months.indexOf(m);
  const sum = monthSummary(s, m);
  const items = s.debts.filter((d) => d.payments[m]).sort((a, b) => (a.due ?? 99) - (b.due ?? 99));
  return (
    <div className="mt-4 md:hidden">
      <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-2">
        <button disabled={i <= 0} onClick={() => setM(months[i - 1]!)} className="grid h-11 w-11 place-items-center rounded-xl text-xl disabled:opacity-30">‹</button>
        <span className="font-display text-lg font-bold">{monthLabel(m, true)}</span>
        <button disabled={i >= months.length - 1} onClick={() => setM(months[i + 1]!)} className="grid h-11 w-11 place-items-center rounded-xl text-xl disabled:opacity-30">›</button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-card p-2"><p className="text-[11px] text-muted-foreground">A pagar</p><p className="text-sm font-bold text-destructive">{brl(sum.pending)}</p></div>
        <div className="rounded-xl bg-card p-2"><p className="text-[11px] text-muted-foreground">Entradas</p><p className="text-sm font-bold text-success">{brl(sum.income)}</p></div>
        <div className="rounded-xl bg-card p-2"><p className="text-[11px] text-muted-foreground">Sobra</p><p className={`text-sm font-bold ${sum.balance >= 0 ? "text-success" : "text-destructive"}`}>{brl(sum.balance)}</p></div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Toque numa conta para marcar como paga.</p>
      <ul className="mt-2 space-y-2">
        {items.map((d) => {
          const p = d.payments[m]!;
          const r = debtRemaining(d);
          const n = Object.keys(d.payments).sort().indexOf(m) + 1;
          return (
            <li key={d.id}>
              <button onClick={() => togglePaid(d.id, m)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left active:scale-[0.99] ${p.paid ? "border-success/30 bg-success/10" : "border-border bg-card"}`}>
                <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-center leading-none ${p.paid ? "bg-success text-background" : "bg-secondary"}`}>
                  {d.due ? <span><span className="block text-[9px] uppercase">dia</span><b className="text-base">{d.due}</b></span> : <span className="text-xs">—</span>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.type === "fixa" ? "Fixa" : `Parcela ${n}/${r.count}`} · resta {brl(r.remaining)}</p>
                </div>
                <div className="text-right">
                  <p className={`font-semibold tabular-nums ${p.paid ? "text-success" : ""}`}>{brl(p.amount)}</p>
                  <p className={`text-[11px] ${p.paid ? "text-success" : "text-destructive"}`}>{p.paid ? "Pago" : "Pendente"}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
