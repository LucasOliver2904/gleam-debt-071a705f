import { useEffect, useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Plus, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { currentMonth, getFinanceUser, parseMoney, setState, type State } from "@/lib/finance";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function saved(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** A private, device-local guide; never writes onboarding flags into financial data. */
export function FirstSteps({ state }: { state: State }) {
  const owner = getFinanceUser();
  const month = currentMonth();
  const key = "prumo-first-steps:" + owner;
  const empty = !state.debts.length && !state.txs.length && !Object.keys(state.income).length;
  const [visible, setVisible] = useState(
    () => saved(key) !== "dismissed" && (empty || saved(key) === "started"),
  );
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [income, setIncome] = useState("");
  const [error, setError] = useState("");
  const incomeId = useId();
  const tasks = [Object.hasOwn(state.income, month), state.debts.length > 0, state.txs.length > 0];
  const completed = tasks.filter(Boolean).length;
  useEffect(() => {
    if (!owner || !visible) return;
    try {
      localStorage.setItem(key, completed === 3 ? "dismissed" : "started");
    } catch {
      /* optional guide only */
    }
  }, [key, owner, visible, completed]);
  if (!owner || !visible || completed === 3) return null;

  function dismiss() {
    try {
      localStorage.setItem(key, "dismissed");
    } catch {
      /* dismiss for this session */
    }
    setVisible(false);
  }
  function saveIncome(event: React.FormEvent) {
    event.preventDefault();
    if (getFinanceUser() !== owner) {
      setIncomeOpen(false);
      return;
    }
    const amount = /^\s*(?:R\$\s*)?0(?:[,.]0{1,2})?\s*$/.test(income) ? 0 : parseMoney(income);
    if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
      setError("Informe um valor válido, inclusive zero se não houver renda base.");
      return;
    }
    try {
      setState((current) => ({ ...current, income: { ...current.income, [month]: amount } }), {
        requireDurable: true,
      });
      setIncomeOpen(false);
      toast.success("Renda base prevista cadastrada.");
    } catch {
      setError("Não foi possível salvar neste aparelho. Libere espaço e tente novamente.");
    }
  }

  const stepStyle =
    "flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border px-3 py-3 text-left text-sm transition hover:border-primary/50 hover:bg-primary/5";
  return (
    <section
      aria-labelledby="first-steps-title"
      className="finance-surface mt-4 rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="finance-kicker">COMECE POR AQUI</p>
          <h2 id="first-steps-title" className="mt-1 font-display text-lg font-bold">
            Seu primeiro mês no Prumo
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {completed} de 3 passos concluídos. Você pode fazer no seu ritmo.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dispensar guia de primeiros passos"
          onClick={dismiss}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground hover:bg-secondary"
        >
          <X size={18} />
        </button>
      </div>
      <ol className="mt-4 grid gap-2 lg:grid-cols-3">
        <li>
          {tasks[0] ? (
            <p className={stepStyle}>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-success" />
                Renda base configurada
              </span>
            </p>
          ) : (
            <button
              type="button"
              className={stepStyle + " w-full"}
              onClick={() => {
                setIncomeOpen(true);
                setError("");
              }}
            >
              <span className="flex items-center gap-2">
                <Wallet size={17} className="text-primary" />
                Definir renda prevista
              </span>
              <Plus size={16} />
            </button>
          )}
        </li>
        <li>
          {tasks[1] ? (
            <p className={stepStyle}>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-success" />
                Primeira conta cadastrada
              </span>
            </p>
          ) : (
            <Link to="/dividas" className={stepStyle}>
              <span>Adicionar uma conta</span>
              <ArrowRight size={16} />
            </Link>
          )}
        </li>
        <li>
          {tasks[2] ? (
            <p className={stepStyle}>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-success" />
                Primeiro lançamento registrado
              </span>
            </p>
          ) : (
            <button
              type="button"
              className={stepStyle + " w-full"}
              onClick={() => window.dispatchEvent(new Event("prumo:quick-add"))}
            >
              <span>Registrar uma movimentação</span>
              <Plus size={16} />
            </button>
          )}
        </li>
      </ol>
      <Dialog open={incomeOpen && owner === getFinanceUser()} onOpenChange={setIncomeOpen}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Renda base prevista do mês</DialogTitle>
            <DialogDescription>
              Informe apenas a parte da renda que não será lançada separadamente. As entradas
              registradas serão somadas a ela. Isso é uma previsão, não uma confirmação de
              recebimento.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={saveIncome} className="space-y-4">
            <label htmlFor={incomeId} className="block text-sm font-semibold">
              Renda base prevista (R$)
              <input
                id={incomeId}
                required
                autoFocus
                inputMode="decimal"
                value={income}
                onChange={(event) => setIncome(event.target.value)}
                placeholder="0,00"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? incomeId + "-error" : undefined}
                className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3 py-3"
              />
            </label>
            {error && (
              <p id={incomeId + "-error"} role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="min-h-11 w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              Salvar renda prevista
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
