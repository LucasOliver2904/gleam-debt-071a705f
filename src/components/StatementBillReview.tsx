import { CalendarCheck2, Check, Link2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { brl } from "@/lib/finance";
import { billDateLabel, type BillMatch } from "@/lib/statement-bills";

export function StatementBillReview({
  bills,
  counted,
  onChoose,
}: {
  bills: BillMatch[];
  counted: boolean;
  onChoose: (bill: BillMatch) => void;
}) {
  if (!bills.length) return null;
  return (
    <section
      aria-label="Conferir com as contas"
      className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-card"
    >
      <div className="flex items-start gap-3 bg-primary/5 px-3.5 py-3">
        <Link2 size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
        <div>
          <h3 className="font-display text-sm font-extrabold">
            {bills.length === 1
              ? "Este débito é desta conta?"
              : "Este débito é de uma destas contas?"}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            O valor coincide. Confira o nome e o vencimento antes de escolher.
          </p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {bills.map((bill) => (
          <li
            key={bill.debtId + "/" + bill.month}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2.5 px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-bold text-foreground">{bill.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">{billDateLabel(bill)}</p>
            </div>
            <div className="min-w-0 text-right">
              <p className="text-sm font-bold tabular-nums">{brl(bill.amount)}</p>
              <p
                className={
                  "mt-1 text-xs font-semibold " +
                  (bill.paid ? "text-success" : "text-muted-foreground")
                }
              >
                {bill.paid ? "Já paga" : "Em aberto"}
              </p>
            </div>
            {(bill.paid || !counted) && (
              <button
                type="button"
                onClick={() => onChoose(bill)}
                aria-label={(bill.paid ? "Dispensar linha" : "Dar baixa") + " · " + bill.name}
                className={
                  "col-span-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3.5 text-xs font-bold sm:col-span-1 sm:w-auto " +
                  (bill.paid
                    ? "border-border text-foreground hover:bg-secondary/40"
                    : "border-primary/35 bg-primary/10 text-primary hover:bg-primary/15")
                }
              >
                {bill.paid ? (
                  <Check size={16} aria-hidden="true" />
                ) : (
                  <CalendarCheck2 size={16} aria-hidden="true" />
                )}
                {bill.paid ? "Dispensar linha" : "Dar baixa"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {counted && (
        <p className="border-t border-border px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
          Já existe uma saída com a mesma descrição, data e valor.{" "}
          <Link to="/lancamentos" className="font-bold text-primary underline">
            Ver em Lançamentos
          </Link>
        </p>
      )}
    </section>
  );
}
