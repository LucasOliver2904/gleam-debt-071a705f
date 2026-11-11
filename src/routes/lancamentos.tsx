import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/AppShell";
import { brl, localToday, monthLabel, setState, uid, useFinance, type Tx } from "@/lib/finance";

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

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

function Lancamentos() {
  const s = useFinance();
  const [kind, setKind] = useState<Tx["kind"]>("saida");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(() => localToday());
  const [err, setErr] = useState("");
  if (!s.ready) return <AppShell><div /></AppShell>;

  const add = () => {
    const v = parseFloat(amount.replace(",", "."));
    if (!desc.trim() || desc.length > 100) return setErr("Informe uma descrição.");
    if (!(v > 0)) return setErr("Valor inválido.");
    setState((st) => ({ ...st, txs: [{ id: uid(), date, description: desc.trim(), amount: v, kind }, ...st.txs] }));
    setDesc(""); setAmount(""); setErr("");
    toast.success(kind === "entrada" ? "Entrada registrada" : "Saída registrada");
  };

  const del = (t: Tx) => {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    setState((st) => ({ ...st, txs: st.txs.filter((x) => x.id !== t.id) }));
    toast("Lançamento excluído");
  };

  const txs = [...s.txs].sort((a, b) => b.date.localeCompare(a.date));
  const tin = txs.filter((t) => t.kind === "entrada").reduce((a, t) => a + t.amount, 0);
  const tout = txs.filter((t) => t.kind === "saida").reduce((a, t) => a + t.amount, 0);

  // agrupar por mês (YYYY-MM), mantendo ordem decrescente
  const groups = new Map<string, Tx[]>();
  for (const t of txs) {
    const k = t.date.slice(0, 7);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }

  return (
    <AppShell>
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary"><Receipt size={20} /></span>
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold leading-tight">Lançamentos</h1>
          <p className="text-sm text-muted-foreground">Entradas e gastos avulsos — fora das dívidas e do salário.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Entradas" value={brl(tin)} tone="pos" />
        <Stat label="Saídas" value={brl(tout)} tone="neg" />
        <Stat label="Saldo" value={brl(tin - tout)} tone={tin - tout >= 0 ? "pos" : "neg"} />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Novo lançamento</p>
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

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_150px_170px_auto]">
          <input className={input} placeholder="Descrição (ex: Mercado, Freela...)" value={desc} onChange={(e) => setDesc(e.target.value)} />
          <input className={input} placeholder="Valor R$" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <input className={input} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button
            onClick={add}
            className={`rounded-xl px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90 ${kind === "entrada" ? "bg-success" : "bg-primary"}`}
          >
            Lançar
          </button>
        </div>
        {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
      </div>

      {txs.length === 0 ? (
        <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary text-muted-foreground"><Receipt size={22} /></span>
          <p className="text-sm font-medium">Nenhum lançamento ainda</p>
          <p className="max-w-xs text-xs text-muted-foreground">Use o formulário acima para registrar entradas e gastos extras.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {[...groups.entries()].map(([mes, items]) => {
            const mesIn = items.filter((t) => t.kind === "entrada").reduce((a, t) => a + t.amount, 0);
            const mesOut = items.filter((t) => t.kind === "saida").reduce((a, t) => a + t.amount, 0);
            return (
              <div key={mes}>
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{monthLabel(mes, true)}</p>
                  <p className="text-xs tabular-nums text-muted-foreground">
                    <span className="text-success">+{brl(mesIn)}</span> · <span className="text-destructive">−{brl(mesOut)}</span>
                  </p>
                </div>
                <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
                  {items.map((t) => {
                    const entrada = t.kind === "entrada";
                    return (
                      <li key={t.id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-secondary/40">
                        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${entrada ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                          {entrada ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{t.description}</p>
                          <p className="text-xs text-muted-foreground">{t.date.split("-").reverse().join("/")}</p>
                        </div>
                        <span className={`font-semibold tabular-nums ${entrada ? "text-success" : "text-destructive"}`}>{entrada ? "+" : "−"} {brl(t.amount)}</span>
                        <button onClick={() => del(t)} aria-label="Excluir lançamento" className="p-1.5 text-muted-foreground transition hover:text-destructive"><Trash2 size={15} /></button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
