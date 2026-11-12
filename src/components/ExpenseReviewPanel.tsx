import { useState } from "react";
import {
  AlertCircle, ArrowDownRight, Check, CheckCheck, CreditCard,
  Pencil, ShieldAlert, ShoppingBag, Trash2, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { brl, CATEGORIES, parseMoney, setState, uid, useFinance, type ExpenseInboxItem, type Tx } from "@/lib/finance";
import { findRelatedNotification } from "@/lib/notification-events";

const control = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";
const METHODS: Record<ExpenseInboxItem["method"], string> = {
  pix: "Pix enviado",
  cartao: "Compra no cartão",
  carteira: "Carteira do Google",
  pagamento: "Pagamento",
};

function suggestCategory(description: string, method: ExpenseInboxItem["method"]) {
  if (/mercado|supermercado|atacad|horti/i.test(description)) return "Mercado";
  if (/uber|99|posto|combust|gasolina|estacionamento/i.test(description)) return "Transporte";
  if (/restaurante|lanchonete|pizzaria|ifood|delivery|lanche/i.test(description)) return "Alimentação";
  return method === "pix" ? "Outros" : "Compras";
}

type Draft = {
  id: string;
  origin: "inbox" | "tx";
  amount: string;
  name: string;
  category: string;
  date: string;
  alreadyIncluded: boolean;
};

export function ExpenseReviewPanel() {
  const state = useFinance();
  const [draft, setDraft] = useState<Draft | null>(null);
  const inbox = [...(state.expenseInbox ?? [])].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const posted = [...state.txs].filter((tx) => tx.kind === "saida" && tx.expenseAuto)
    .sort((a, b) => (b.expenseAuto?.receivedAt ?? "").localeCompare(a.expenseAuto?.receivedAt ?? ""));

  function duplicateId(item: ExpenseInboxItem) {
    // Verificação no momento da revisão: o primeiro aviso pode já ter sido confirmado.
    const existing = [
      ...inbox.filter((other) => other.id !== item.id).map((other) => ({
        id: other.id, amount: other.amount, receivedAt: other.receivedAt,
        source: other.source, direction: "saida" as const,
      })),
      ...posted.map((tx) => ({
        id: tx.id, amount: tx.amount, receivedAt: tx.expenseAuto!.receivedAt,
        source: tx.expenseAuto!.source, direction: "saida" as const,
      })),
    ];
    return findRelatedNotification({
      amount: item.amount, receivedAt: item.receivedAt, source: item.source,
      direction: "saida",
    }, existing);
  }

  function review(item: ExpenseInboxItem) {
    setDraft({
      id: item.id,
      origin: "inbox",
      amount: String(item.amount).replace(".", ","),
      name: item.person || METHODS[item.method],
      category: suggestCategory(item.person ?? "", item.method),
      date: item.date,
      alreadyIncluded: false,
    });
    document.getElementById("expense-review-editor")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function editPosted(tx: Tx) {
    setDraft({
      id: tx.id, origin: "tx", amount: String(tx.amount).replace(".", ","),
      name: tx.description, category: tx.category ?? "Outros", date: tx.date,
      alreadyIncluded: Boolean(tx.excludedFromTotals),
    });
    document.getElementById("expense-review-editor")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function ignore(item: ExpenseInboxItem) {
    if (!window.confirm("Ignorar este aviso? Nenhuma despesa será lançada.")) return;
    setState((s) => ({
      ...s,
      expenseInbox: (s.expenseInbox ?? []).filter((row) => row.id !== item.id),
      handledInboxIds: [...new Set([...(s.handledInboxIds ?? []), item.id])].slice(-1500),
    }));
    if (draft?.id === item.id) setDraft(null);
    toast.success("Aviso ignorado. Não foi contabilizado.");
  }

  function save() {
    if (!draft) return;
    const amount = parseMoney(draft.amount);
    if (!(amount > 0) || amount > 1_000_000_000) { toast.error("Informe um valor válido."); return; }
    if (!draft.name.trim() || draft.name.length > 100) { toast.error("Informe uma descrição curta."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) { toast.error("Confira a data."); return; }
    const description = draft.name.trim();
    if (draft.origin === "inbox") {
      const current = inbox.find((i) => i.id === draft.id);
      if (!current) { toast.error("Este aviso não está mais na lista."); return; }
      const anotherConfirmed = posted.some((tx) =>
        tx.expenseAuto?.source !== current.source &&
        tx.amount === current.amount &&
        Math.abs(Date.parse(tx.expenseAuto?.receivedAt ?? "") - Date.parse(current.receivedAt)) <= 300_000 &&
        !tx.excludedFromTotals
      );
      if (anotherConfirmed && !draft.alreadyIncluded && !window.confirm(
        "Atenção: já existe outra despesa com o mesmo valor, registrada por outro aplicativo perto deste horário. Confirmar MAIS UM lançamento? Isso pode duplicar o gasto."
      )) return;

      setState((s) => ({
        ...s,
        txs: [
          {
            id: uid() + uid(),
            date: draft.date,
            description,
            category: draft.category,
            kind: "saida",
            amount,
            excludedFromTotals: draft.alreadyIncluded,
            expenseAuto: {
              fingerprint: current.fingerprint,
              receivedAt: current.receivedAt,
              source: current.source,
              method: current.method,
            },
          },
          ...s.txs,
        ],
        expenseInbox: (s.expenseInbox ?? []).filter((row) => row.id !== draft.id),
        handledInboxIds: [...new Set([...(s.handledInboxIds ?? []), draft.id])].slice(-1500),
      }));
      toast.success(draft.alreadyIncluded
        ? "Compra arquivada sem somar novamente à despesa."
        : "Despesa revisada e contabilizada.");
    } else {
      setState((s) => ({
        ...s,
        txs: s.txs.map((tx) => tx.id === draft.id
          ? { ...tx, date: draft.date, description, category: draft.category, amount, excludedFromTotals: draft.alreadyIncluded }
          : tx),
      }));
      toast.success("Despesa corrigida!");
    }
    setDraft(null);
  }

  return (
    <section className="mt-6 rounded-3xl border border-primary/20 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="finance-kicker">ANDROID / COMPRAS E PAGAMENTOS</p>
          <h2 className="mt-1 font-display text-xl font-extrabold">Despesas detectadas</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Pix enviados, pagamentos e compras por aproximação chegam aqui para sua conferência. O aplicativo não soma a despesa até você revisar o aviso.
          </p>
        </div>
        <span className={"rounded-full px-3 py-1.5 text-xs font-bold " +
          (inbox.length ? "bg-accent/15 text-accent" : "bg-success/15 text-success")}>
          {inbox.length} a conferir
        </span>
      </div>

      {inbox.length === 0 ? (
        <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border p-7 text-center">
          <CheckCheck size={24} className="text-success" />
          <p className="mt-2 text-sm font-semibold">Nenhuma despesa aguardando conferência</p>
          <p className="mt-1 text-xs text-muted-foreground">
            A automação do MacroDroid deve monitorar as notificações do banco e da Carteira do Google.
          </p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3">
          {inbox.map((item) => {
            const related = duplicateId(item);
            return (
              <li key={item.id} className="rounded-2xl border border-border bg-background/40 p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-destructive/10 text-destructive">
                    {item.method === "pix" ? <ArrowDownRight size={21} /> : <CreditCard size={21} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{item.person ?? METHODS[item.method]}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {METHODS[item.method]} · {item.source} · {new Date(item.receivedAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <p className="font-display text-lg font-extrabold tabular-nums text-destructive">−{brl(item.amount)}</p>
                </div>
                {related && (
                  <div className="mt-3 flex gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs leading-relaxed text-foreground">
                    <ShieldAlert size={17} className="mt-0.5 shrink-0 text-accent"/>
                    <span><b>Possível duplicidade:</b> outro aplicativo notificou uma saída do mesmo valor em até 5 minutos. Compare o extrato antes de registrar. Você pode ignorar esta notificação.</span>
                  </div>
                )}
                <div className="mt-3 flex gap-2">
                  <button onClick={() => review(item)}
                    className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-xs font-bold text-primary-foreground sm:flex-none">
                    <Pencil size={14}/> Conferir e lançar
                  </button>
                  <button onClick={() => ignore(item)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">
                    <Trash2 size={14}/> Ignorar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {draft && (
        <div id="expense-review-editor" className="mt-5 scroll-mt-24 rounded-2xl border border-primary/35 bg-primary/5 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-lg font-bold">{draft.origin === "tx" ? "Editar despesa registrada" : "Conferir despesa"}</h3>
            <button aria-label="Fechar formulário" onClick={() => setDraft(null)} className="rounded-lg border border-border p-2 hover:bg-secondary"><X size={17}/></button>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-muted-foreground">Valor (R$)
              <input className={control + " mt-1.5"} inputMode="decimal" value={draft.amount} onChange={(e) => setDraft((s) => s && { ...s, amount: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Data
              <input type="date" className={control + " mt-1.5"} value={draft.date} onChange={(e) => setDraft((s) => s && { ...s, date: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Descrição
              <input className={control + " mt-1.5"} value={draft.name} maxLength={100} onChange={(e) => setDraft((s) => s && { ...s, name: e.target.value })} />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">Categoria
              <select className={control + " mt-1.5"} value={draft.category} onChange={(e) => setDraft((s) => s && { ...s, category: e.target.value })}>
                {CATEGORIES.map((category) => <option value={category} key={category}>{category}</option>)}
              </select>
            </label>
          </div>
          <label className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-card px-3 py-3 text-sm leading-relaxed">
            <input type="checkbox" checked={draft.alreadyIncluded} onChange={(e) => setDraft((s) => s && { ...s, alreadyIncluded: e.target.checked })} className="mt-1 accent-[var(--primary)]" />
            <span><b>Já está na fatura do cartão ou em outra despesa.</b>
              <span className="mt-1 block text-xs text-muted-foreground">
                Manter no histórico sem somar novamente às despesas. Use ao registrar compras que já estão contabilizadas em uma fatura cadastrada ou num outro lançamento.
              </span>
            </span>
          </label>
          <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-accent" />
            A notificação não é comprovante de pagamento. Confira o extrato ou a fatura antes de salvar.
          </p>
          <button onClick={save} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground">
            <Check size={17}/> {draft.origin === "tx" ? "Salvar alterações" : draft.alreadyIncluded ? "Guardar sem duplicar gastos" : "Registrar nas despesas"}
          </button>
        </div>
      )}

      {posted.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary"/>
            <h3 className="font-display text-base font-bold">Últimas despesas importadas</h3>
          </div>
          <ul className="mt-3 divide-y divide-border">
            {posted.slice(0, 8).map((tx) => (
              <li key={tx.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-secondary text-muted-foreground"><Wallet size={17}/></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{tx.description}</p>
                  <p className="truncate text-xs text-muted-foreground">{tx.expenseAuto?.source}{tx.excludedFromTotals ? " · Incluída em outra despesa" : " · Contabilizada"}</p>
                </div>
                <p className={"text-sm font-bold tabular-nums " + (tx.excludedFromTotals ? "text-muted-foreground" : "text-destructive")}>{brl(tx.amount)}</p>
                <button aria-label={"Editar despesa " + tx.description} onClick={() => editPosted(tx)} className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-primary"><Pencil size={16}/></button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
