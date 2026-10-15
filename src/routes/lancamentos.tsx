import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Trash2 } from "lucide-react";
import { AppShell, Stat } from "@/components/AppShell";
import { brl, setState, uid, useFinance, type Tx } from "@/lib/finance";

export const Route = createFileRoute("/lancamentos")({
  head: () => ({
    meta: [
      { title: "Lançamentos — Meu Caixa" },
      { name: "description", content: "Registre tudo que entra e tudo que sai." },
      { property: "og:title", content: "Lançamentos — Meu Caixa" },
      { property: "og:description", content: "Entradas e saídas do seu dinheiro." },
    ],
  }),
  component: Lancamentos,
});

const input = "rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function Lancamentos() {
  const s = useFinance();
  const [kind, setKind] = useState<Tx["kind"]>("saida");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState("");
  if (!s.ready) return <AppShell><div /></AppShell>;

  const add = () => {
    const v = parseFloat(amount.replace(",", "."));
    if (!desc.trim() || desc.length > 100) return setErr("Informe uma descrição.");
    if (!(v > 0)) return setErr("Valor inválido.");
    setState((st) => ({ ...st, txs: [{ id: uid(), date, description: desc.trim(), amount: v, kind }, ...st.txs] }));
    setDesc(""); setAmount(""); setErr("");
  };
  const txs = [...s.txs].sort((a, b) => b.date.localeCompare(a.date));
  const tin = txs.filter((t) => t.kind === "entrada").reduce((a, t) => a + t.amount, 0);
  const tout = txs.filter((t) => t.kind === "saida").reduce((a, t) => a + t.amount, 0);

  return (
    <AppShell>
      <h1 className="font-display text-3xl font-bold">Lançamentos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Entradas e gastos avulsos (extras, além das dívidas e do salário).</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Entradas" value={brl(tin)} tone="pos" />
        <Stat label="Saídas" value={brl(tout)} tone="neg" />
        <Stat label="Saldo" value={brl(tin - tout)} tone={tin - tout >= 0 ? "pos" : "neg"} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex gap-2">
          <button onClick={() => setKind("entrada")} className={`flex-1 rounded-xl border py-2 text-sm font-medium ${kind === "entrada" ? "border-success bg-success/15 text-success" : "border-border"}`}>+ Entrada</button>
          <button onClick={() => setKind("saida")} className={`flex-1 rounded-xl border py-2 text-sm font-medium ${kind === "saida" ? "border-destructive bg-destructive/15 text-destructive" : "border-border"}`}>− Saída</button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_170px_auto]">
          <input className={input} placeholder="Descrição (ex: Mercado, Freela...)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <input className={input} placeholder="Valor R$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button onClick={add} className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90">Lançar</button>
        </div>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      </div>

      <ul className="mt-6 divide-y divide-border rounded-2xl border border-border bg-card">
        {txs.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">Nenhum lançamento ainda.</li>}
        {txs.map((t) => (
          <li key={t.id} className="flex items-center gap-3 px-5 py-3">
            <span className={`grid h-9 w-9 place-items-center rounded-full ${t.kind === "entrada" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
              {t.kind === "entrada" ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
            </span>
            <div className="flex-1">
              <p className="font-medium">{t.description}</p>
              <p className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")}</p>
            </div>
            <span className={`font-semibold tabular-nums ${t.kind === "entrada" ? "text-success" : "text-destructive"}`}>{t.kind === "entrada" ? "+" : "−"} {brl(t.amount)}</span>
            <button onClick={() => setState((st) => ({ ...st, txs: st.txs.filter((x) => x.id !== t.id) }))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
