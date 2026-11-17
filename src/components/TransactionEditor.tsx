import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrivateEditor } from "@/components/PrivateEditor";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Pencil } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, getFinanceUser, getState, parseMoney, setState, type Tx } from "@/lib/finance";

const field = "mt-1.5 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";

export function TransactionEditor({ transaction, onClose }: {
  transaction: Tx;
  onClose: () => void;
}) {
  const [description, setDescription] = useState(transaction.description);
  const [amount, setAmount] = useState(String(transaction.amount).replace(".", ","));
  const [date, setDate] = useState(transaction.date);
  const [kind, setKind] = useState<Tx["kind"]>(transaction.kind);
  const [category, setCategory] = useState(transaction.category || "Outros");
  const [error, setError] = useState("");

  const [owner] = useState(getFinanceUser);

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!owner || getFinanceUser() !== owner) { onClose(); return; }
    const current = getState().txs.find((tx) => tx.id === transaction.id);
    if (!current || current.pix || current.expenseAuto || ["description", "amount", "date", "category", "kind"].some((key) => current[key as keyof Tx] !== transaction[key as keyof Tx])) {
      setError("Este lançamento foi atualizado ou removido. Feche a edição e confira os dados mais recentes.");
      return;
    }
    const total = parseMoney(amount);
    if (!description.trim() || description.trim().length > 100) return setError("Informe uma descrição de até 100 caracteres.");
    if (!(total > 0) || total > 1_000_000_000) return setError("Informe um valor válido.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + "T12:00:00"))) return setError("Informe uma data válida.");
    if (transaction.pix || transaction.expenseAuto) return setError("Edite este recebimento na área Pix ou esta despesa na área de notificações.");
    setState((state) => ({
      ...state,
      txs: state.txs.map((tx) => tx.id === transaction.id
        ? { ...tx, description: description.trim(), amount: total, date, category, kind }
        : tx),
    }));
    toast.success("Lançamento atualizado sem criar duplicidade.");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[92dvh] bg-card p-5 sm:p-6">
        <DialogHeader>
          <p className="finance-kicker">MOVIMENTAÇÃO / EDIÇÃO</p>
          <DialogTitle className="flex items-center gap-2 font-display text-xl font-bold"><Pencil size={19} className="text-primary"/>Editar lançamento</DialogTitle>
          <DialogDescription>Altere o registro existente sem criar uma nova movimentação.</DialogDescription>
        </DialogHeader>
        <PrivateEditor><form onSubmit={save} className="mt-6 space-y-4">
          <fieldset>
            <legend className="finance-field-label">Tipo de movimentação</legend>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setKind("entrada")} className={"inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold " + (kind === "entrada" ? "border-success/50 bg-success/12 text-success" : "border-border text-muted-foreground")}>
                <ArrowDownLeft size={17}/> Entrada
              </button>
              <button type="button" onClick={() => setKind("saida")} className={"inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-bold " + (kind === "saida" ? "border-destructive/50 bg-destructive/12 text-destructive" : "border-border text-muted-foreground")}>
                <ArrowUpRight size={17}/> Saída
              </button>
            </div>
          </fieldset>
          <label className="block text-sm font-semibold">Descrição
            <input autoFocus maxLength={100} className={field} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Onde e por quê?"/>
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold">Valor em R$
              <input inputMode="decimal" className={field} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00"/>
            </label>
            <label className="block text-sm font-semibold">Data
              <input type="date" className={field} value={date} onChange={(event) => setDate(event.target.value)}/>
            </label>
          </div>
          <label className="block text-sm font-semibold">Categoria
            <select className={field} value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {error && <p role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
          <div className="grid grid-cols-[1fr_1.6fr] gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-3 text-sm font-bold text-muted-foreground hover:bg-secondary">Cancelar</button>
            <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-extrabold text-primary-foreground hover:opacity-90"><Check size={17}/> Salvar alterações</button>
          </div>
        </form></PrivateEditor>
      </DialogContent>
    </Dialog>
  );
}
