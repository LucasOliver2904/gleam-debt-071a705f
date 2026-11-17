import { Link } from "@tanstack/react-router";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CheckCheck, Clock3,
  Inbox, QrCode, ReceiptText, Sparkles, Wallet,
} from "lucide-react";
import { brl, monthLabel, currentMonth, type State } from "@/lib/finance";

/**
 * Capturas por notificações NÃO alteram os totais até serem conferidas.
 * Dar visibilidade a elas no dashboard evita que o usuário esqueça de revisar.
 */
export function PendingReviewBanner({ state }: { state: State }) {
  const pix = state.pixInbox?.length ?? 0;
  const expenses = state.expenseInbox?.length ?? 0;
  const total = pix + expenses;
  if (!total) return null;

  return (
    <section aria-label="Pendências para conferir" className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-warning/30 bg-warning/7 px-3 py-2.5">
      <Inbox size={17} className="shrink-0 text-warning" />
      <span className="mr-auto text-xs font-bold">{total} {total === 1 ? "movimentação para conferir" : "movimentações para conferir"}</span>
      {pix > 0 && <Link to="/pix" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-primary hover:bg-primary/10">
        Pix · {pix} <ArrowRight size={13}/>
      </Link>}
      {expenses > 0 && <Link to="/lancamentos" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-extrabold text-warning hover:bg-warning/10">
        Gastos · {expenses} <ArrowRight size={13}/>
      </Link>}
    </section>
  );
}

export function RecentActivity({ state }: { state: State }) {
  const latest = [...state.txs]
    .filter((tx) => /^\d{4}-\d{2}-\d{2}$/.test(tx.date))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6);
  const thisMonth = currentMonth();
  const countInMonth = state.txs.filter((tx) => tx.date.startsWith(thisMonth)).length;

  return (
    <section className="finance-surface mt-6 overflow-hidden rounded-3xl border border-border bg-card p-4 sm:p-6" aria-labelledby="recent-finances-title">
      <header className="finance-section-head">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-info/12 text-info"><Clock3 size={20}/></span>
          <div>
            <p className="finance-kicker">SEU HISTÓRICO</p>
            <h2 id="recent-finances-title" className="mt-0.5 font-display text-lg font-extrabold sm:text-xl">Últimas movimentações</h2>
          </div>
        </div>
        <Link to="/lancamentos" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          Ver histórico <ArrowRight size={15}/>
        </Link>
      </header>

      {latest.length === 0 ? (
        <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-secondary/15 px-5 py-9 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/12 text-primary"><Wallet size={24}/></span>
          <p className="mt-3 text-sm font-bold">Seu histórico começa aqui</p>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Registre uma entrada ou despesa para começar a acompanhar tudo de perto.
          </p>
          <Link to="/lancamentos" className="mt-3 text-xs font-bold text-primary hover:underline">Adicionar movimentação</Link>
        </div>
      ) : (
        <>
          <ul className="mt-5 divide-y divide-border/75">
            {latest.map((tx) => {
              const income = tx.kind === "entrada";
              return (
                <li key={tx.id} className="flex min-w-0 items-center gap-3 py-3">
                  <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl " +
                    (income ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive")}>
                    {income ? <ArrowDownLeft size={19}/> : <ArrowUpRight size={19}/>}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{tx.description}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {tx.date.split("-").reverse().join("/")} · {tx.category ?? "Outros"}
                      {tx.excludedFromTotals ? " · Já contabilizado em outra despesa" : tx.pix ? " · Pix conferido" : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={"font-display text-sm font-extrabold tabular-nums sm:text-base " +
                      (tx.excludedFromTotals ? "text-muted-foreground" : income ? "text-success" : "text-destructive")}>
                      {tx.excludedFromTotals ? "" : income ? "+" : "−"}{brl(tx.amount)}
                    </p>
                    {tx.excludedFromTotals && <p className="mt-0.5 text-[10px] text-muted-foreground">Não somado</p>}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-secondary/35 px-3 py-2.5 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Sparkles size={14} className="text-warning"/> {monthLabel(thisMonth, true)}</span>
            <span className="font-bold">{countInMonth} {countInMonth === 1 ? "lançamento" : "lançamentos"}</span>
          </div>
        </>
      )}
    </section>
  );
}
