import { useId, useState } from "react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import {
  useCategories,
  getFinanceUser,
  getState,
  localToday,
  parseMoney,
  setState,
  uid,
  useFinance,
  type Tx,
} from "@/lib/finance";
import { parseQuickPhrase } from "@/lib/quick-parse";
import { isUnchangedQuickEntry, quickEntryShortcuts } from "@/lib/quick-entry";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const input =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function QuickAdd({ onClose }: { onClose: () => void }) {
  const categories = useCategories();
  const formId = useId();
  const finances = useFinance();
  const [ownerId] = useState(getFinanceUser);
  const shortcuts = quickEntryShortcuts(finances.txs);
  const [kind, setKind] = useState<Tx["kind"]>("saida");
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Outros");
  const [date, setDate] = useState(() => localToday());
  const [err, setErr] = useState("");
  const [phrase,setPhrase]=useState("");
  const [phraseHint,setPhraseHint]=useState("");
  function fillPhrase() {
    const parsed=parseQuickPhrase(phrase,categories);
    if(!parsed){setPhraseHint("Use um valor seguido da descrição, por exemplo: 45 mercado ontem.");return;}
    setKind(parsed.kind);setDesc(parsed.description);setAmount(parsed.amount);setCategory(parsed.category);setDate(parsed.date);setErr("");setPhraseHint("Confira todos os campos antes de salvar.");
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!ownerId || getFinanceUser() !== ownerId) {
      toast.error("A conta mudou. Abra um novo lançamento na conta atual.");
      onClose();
      return;
    }
    const value = parseMoney(amount);
    if (!desc.trim() || desc.trim().length > 100)
      return setErr("Informe uma descrição de até 100 caracteres.");
    if (!(value > 0) || value > 1_000_000_000) return setErr("Informe um valor válido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + "T12:00:00"))) {
      return setErr("Informe uma data válida.");
    }
    const created: Tx = {
      id: uid(),
      date,
      description: desc.trim(),
      amount: value,
      kind,
      category,
    };
    try {
      setState((state) => ({ ...state, txs: [created, ...state.txs] }));
    } catch {
      setErr("Não foi possível salvar neste aparelho. Tente novamente.");
      return;
    }
    toast.success(kind === "entrada" ? "Entrada registrada" : "Saída registrada", {
      action: {
        label: "Desfazer",
        onClick: () => {
          if (getFinanceUser() !== ownerId) {
            toast.error("Volte à conta em que o lançamento foi registrado para desfazer.");
            return;
          }
          const current = getState().txs.find((tx) => tx.id === created.id);
          if (!current) {
            toast("Este lançamento já foi removido.");
            return;
          }
          if (!isUnchangedQuickEntry(current, created)) {
            toast.error("O lançamento foi alterado. Revise-o em Lançamentos para excluir.");
            return;
          }
          try {
            setState((state) => ({
              ...state,
              txs: state.txs.filter((tx) => tx.id !== created.id),
            }));
            toast("Lançamento desfeito.");
          } catch {
            toast.error("Não foi possível desfazer neste aparelho. Tente novamente.");
          }
        },
      },
    });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-h-[92dvh] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto rounded-3xl border-border bg-card p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-extrabold">Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma entrada ou saída em poucos segundos.</DialogDescription>
        </DialogHeader>
        <form className="mt-3 space-y-4" onSubmit={submit}>
          <div className="rounded-2xl border border-primary/25 bg-primary/5 p-3"><label className="text-sm font-bold" htmlFor={formId+"-phrase"}>Lançar por frase</label><div className="mt-2 flex gap-2"><input id={formId+"-phrase"} className={input+" min-w-0 flex-1"} value={phrase} maxLength={180} onChange={e=>{setPhrase(e.target.value);setPhraseHint("");}} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();fillPhrase();}}} placeholder="45 mercado ontem"/><button type="button" onClick={fillPhrase} className="rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground">Preencher</button></div><p className="mt-2 text-xs text-muted-foreground" role="status">{phraseHint||"Preencha o formulário automaticamente. Nada é salvo sem sua confirmação."}</p></div>
          <fieldset>
            <legend className="text-xs font-semibold text-muted-foreground">
              Atalhos para preencher
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {shortcuts.map((shortcut) => (
                <button
                  key={shortcut.kind + ":" + shortcut.description}
                  type="button"
                  aria-label={
                    "Usar atalho " +
                    shortcut.description +
                    (shortcut.kind === "entrada" ? " de entrada" : " de saída")
                  }
                  onClick={() => {
                    setDesc(shortcut.description);
                    setCategory(shortcut.category ?? "Outros");
                    setKind(shortcut.kind);
                    setErr("");
                  }}
                  className="max-w-full truncate rounded-full border border-primary/20 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition hover:bg-primary/15"
                >
                  {shortcut.kind === "entrada" ? "+ " : ""}
                  {shortcut.description}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Os mais frequentes aparecem aqui. Confira o valor e a data antes de lançar.
            </p>
          </fieldset>
          <div role="group" aria-label="Tipo de lançamento" className="flex gap-2">
            <button
              type="button"
              aria-pressed={kind === "entrada"}
              onClick={() => setKind("entrada")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${kind === "entrada" ? "border-success bg-success/15 text-success" : "border-border text-muted-foreground hover:bg-secondary"}`}
            >
              <ArrowDownLeft size={16} /> Entrada
            </button>
            <button
              type="button"
              aria-pressed={kind === "saida"}
              onClick={() => setKind("saida")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-sm font-semibold transition ${kind === "saida" ? "border-destructive bg-destructive/15 text-destructive" : "border-border text-muted-foreground hover:bg-secondary"}`}
            >
              <ArrowUpRight size={16} /> Saída
            </button>
          </div>
          <label
            htmlFor={formId + "-valor"}
            className="block text-sm font-semibold text-muted-foreground"
          >
            Valor (R$)
            <input
              id={formId + "-valor"}
              autoFocus
              required
              className={input + " mt-1.5 text-lg font-bold"}
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0,00"
              aria-invalid={err.includes("valor")}
            />
          </label>
          <label
            htmlFor={formId + "-descricao"}
            className="block text-sm font-semibold text-muted-foreground"
          >
            Descrição
            <input
              id={formId + "-descricao"}
              required
              maxLength={100}
              className={input + " mt-1.5"}
              value={desc}
              onChange={(event) => setDesc(event.target.value)}
              placeholder="Ex.: Mercado, transporte..."
            />
          </label>
          <label
            htmlFor={formId + "-data"}
            className="block text-sm font-semibold text-muted-foreground"
          >
            Data
            <input
              id={formId + "-data"}
              required
              type="date"
              className={input + " mt-1.5"}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label
            htmlFor={formId + "-categoria"}
            className="block text-sm font-semibold text-muted-foreground"
          >
            Categoria
            <select
              id={formId + "-categoria"}
              className={input + " mt-1.5"}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          {err && (
            <p role="alert" className="text-xs font-semibold text-destructive">
              {err}
            </p>
          )}
          <button
            type="submit"
            className={`w-full rounded-xl py-3.5 font-bold text-primary-foreground transition hover:opacity-90 ${kind === "entrada" ? "bg-success" : "bg-primary"}`}
          >
            Lançar {kind === "entrada" ? "entrada" : "saída"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
