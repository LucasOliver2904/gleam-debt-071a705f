import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, BadgePercent } from "lucide-react";
import { brl, currentMonth, monthLabel, parseBrlCents, type Debt, type State } from "@/lib/finance";
import { openInstallments, simulatePayoff } from "@/lib/debt-payoff";

const money = (cents: number) => brl(cents / 100);
const field =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground focus-visible:outline-primary";
const percent = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 2 });

export function DebtPayoffSimulator({
  state,
  initialDebtId,
}: {
  state: State;
  initialDebtId?: string | undefined;
}) {
  const eligible = state.debts
    .filter((debt) => openInstallments(debt).length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const [chosenId, setChosenId] = useState(
    initialDebtId ?? (eligible.length === 1 ? eligible[0]?.id : ""),
  );
  const debt = eligible.find((item) => item.id === chosenId);

  return (
    <section
      id="antecipar-parcelas"
      tabIndex={-1}
      aria-labelledby="payoff-title"
      className="finance-surface mt-3 scroll-mt-24 rounded-3xl border border-border bg-card p-4 outline-none sm:p-6"
    >
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary">
          <BadgePercent aria-hidden="true" size={23} />
        </span>
        <div className="min-w-0">
          <h2 id="payoff-title" className="font-display text-xl font-extrabold sm:text-2xl">
            Vale antecipar?
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Compare a proposta do banco com as parcelas em aberto. Esta simulação não registra
            pagamentos.
          </p>
        </div>
      </header>
      {eligible.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border p-5">
          <p className="text-sm font-semibold">Nenhuma parcela em aberto para simular.</p>
          <Link
            to="/dividas"
            className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
          >
            Ver minhas contas <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <>
          <label className="mt-5 block max-w-xl text-sm font-semibold">
            Conta a antecipar
            <select
              value={debt?.id ?? ""}
              onChange={(event) => setChosenId(event.target.value)}
              className={field}
            >
              <option value="">Escolha a conta</option>
              {eligible.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          {debt && <PayoffSelection key={debt.id} debt={debt} state={state} />}
        </>
      )}
    </section>
  );
}

function PayoffSelection({ debt, state }: { debt: Debt; state: State }) {
  const now = currentMonth();
  const installments = openInstallments(debt);
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [lastCount, setLastCount] = useState("");
  const selected = installments.filter((item) => checked.has(item.month));
  const allChecked = selected.length === installments.length;
  const totalCents = selected.reduce((total, item) => total + item.cents, 0);
  const quantity = Number(lastCount);
  const validQuantity =
    Number.isInteger(quantity) && quantity > 0 && quantity <= installments.length;

  function toggle(month: string) {
    setChecked((previous) => {
      const next = new Set(previous);
      if (next.has(month)) next.delete(month);
      else next.add(month);
      return next;
    });
  }

  return (
    <div className="mt-5 grid min-w-0 items-start gap-5 lg:grid-cols-2">
      <fieldset className="min-w-0">
        <legend className="text-sm font-bold">Parcelas incluídas na proposta</legend>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3">
          <span className="text-xs text-muted-foreground">
            {selected.length} de {installments.length} em aberto
          </span>
          <button
            type="button"
            className="min-h-11 text-sm font-semibold text-primary hover:underline"
            onClick={() =>
              setChecked(allChecked ? new Set() : new Set(installments.map((item) => item.month)))
            }
          >
            {allChecked ? "Limpar seleção" : "Selecionar todas"}
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
          {installments.map((item) => (
            <label
              key={item.month}
              className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-secondary/45 has-[:checked]:bg-primary/8"
            >
              <input
                type="checkbox"
                checked={checked.has(item.month)}
                onChange={() => toggle(item.month)}
                className="size-4 shrink-0 accent-primary"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{monthLabel(item.month, true)}</span>
                <span className="block text-xs text-muted-foreground">{item.number}ª parcela</span>
              </span>
              <span className="text-sm font-bold tabular-nums">{money(item.cents)}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 text-sm">
          <span className="text-muted-foreground">Total das parcelas selecionadas</span>
          <strong className="text-base tabular-nums">{money(totalCents)}</strong>
        </div>
        {installments.length > 1 && (
          <details className="mt-2">
            <summary className="w-fit cursor-pointer content-center text-sm font-semibold text-primary">
              Marcar as últimas parcelas
            </summary>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (validQuantity)
                  setChecked(new Set(installments.slice(-quantity).map((item) => item.month)));
              }}
            >
              <label className="min-w-24 flex-1 text-xs font-semibold text-muted-foreground">
                Quantas parcelas finais?
                <input
                  className={field}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={installments.length}
                  value={lastCount}
                  onChange={(event) => setLastCount(event.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={!validQuantity}
                className="min-h-11 rounded-xl border border-border px-3 text-sm font-semibold hover:bg-secondary disabled:opacity-50"
              >
                Marcar
              </button>
            </form>
          </details>
        )}
      </fieldset>
      <PayoffQuote
        key={JSON.stringify([now, ...selected.map((item) => [item.month, item.cents])])}
        state={state}
        debtId={debt.id}
        months={selected.map((item) => item.month)}
        now={now}
      />
    </div>
  );
}

function PayoffQuote({
  state,
  debtId,
  months,
  now,
}: {
  state: State;
  debtId: string;
  months: string[];
  now: string;
}) {
  const [quote, setQuote] = useState("");
  const [expanded, setExpanded] = useState(false);
  const quoteId = useId();
  const cents = parseBrlCents(quote);
  const result = cents === null ? null : simulatePayoff(state, debtId, new Set(months), cents, now);
  const thisMonth = result?.rows[0];
  const visibleRows = expanded ? result?.rows : result?.rows.slice(0, 4);
  const invalid = quote.trim() !== "" && !result;

  return (
    <div className="min-w-0 rounded-2xl border border-border bg-secondary/20 p-4 sm:p-5">
      <label htmlFor={quoteId} className="text-sm font-bold">
        Quanto o banco cobra hoje?
      </label>
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-3 left-3 text-sm font-bold text-muted-foreground"
        >
          R$
        </span>
        <input
          id={quoteId}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          disabled={!months.length}
          aria-describedby={quoteId + (invalid ? "-error" : "-hint")}
          aria-invalid={invalid}
          value={quote}
          onChange={(event) => setQuote(event.target.value)}
          className={field + " pl-10 tabular-nums disabled:opacity-50"}
        />
      </div>
      <p id={quoteId + "-hint"} className="mt-2 text-xs leading-relaxed text-muted-foreground">
        {!months.length
          ? "Marque as parcelas que aparecem na proposta do banco."
          : "Informe o valor final da proposta para as parcelas marcadas, incluindo eventuais taxas."}
      </p>
      {invalid && (
        <p id={quoteId + "-error"} role="alert" className="mt-2 text-sm text-destructive">
          Confira o valor em reais. Use um formato como 1.250,90.
        </p>
      )}
      {result && (
        <>
          <div className="mt-5 border-y border-border py-4" role="status">
            <p className="text-sm font-semibold">
              {result.savingsCents < 0 ? "Custo adicional da proposta" : "Economia total"}
            </p>
            <p
              className={
                "mt-1 break-words font-display text-3xl font-extrabold tabular-nums " +
                (result.savingsCents < 0
                  ? "text-destructive"
                  : result.savingsCents > 0
                    ? "text-success"
                    : "text-foreground")
              }
            >
              {money(Math.abs(result.savingsCents))}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {result.savingsCents === 0
                ? "A proposta tem o mesmo valor das parcelas selecionadas."
                : percent.format(Math.abs(result.savingsCents) / result.scheduledCents) +
                  (result.savingsCents > 0 ? " de desconto" : " de acréscimo") +
                  " sobre as parcelas selecionadas."}
            </p>
          </div>
          {thisMonth && thisMonth.beforeCents !== null && thisMonth.afterCents !== null && (
            <p className="mt-4 text-sm leading-relaxed">
              Em {monthLabel(now, true)}, a sobra prevista passaria de{" "}
              {money(thisMonth.beforeCents)} para{" "}
              <strong className={thisMonth.afterCents < 0 ? "text-destructive" : ""}>
                {money(thisMonth.afterCents)}
              </strong>
              .
            </p>
          )}
          <table
            id={quoteId + "-months"}
            className="mt-4 w-full table-fixed text-left text-xs sm:text-sm"
          >
            <caption className="mb-3 text-left text-sm font-bold">Impacto por mês</caption>
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="w-[24%] pb-2 font-medium">
                  Mês
                </th>
                <th scope="col" className="pb-2 text-right font-medium">
                  Efeito na sobra
                </th>
                <th scope="col" className="pb-2 pl-2 text-right font-medium">
                  Sobra prevista
                </th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {visibleRows?.map((row) => (
                <tr key={row.month} className="border-t border-border">
                  <th scope="row" className="py-2.5 text-left font-semibold">
                    {monthLabel(row.month)}
                  </th>
                  <td className="break-words py-2.5 text-right">
                    {row.changeCents > 0 ? "+" : ""}
                    {money(row.changeCents)}
                  </td>
                  <td
                    className={
                      "break-words py-2.5 pl-2 text-right font-bold " +
                      (row.afterCents !== null && row.afterCents < 0 ? "text-destructive" : "")
                    }
                  >
                    {row.afterCents === null ? (
                      <span className="font-normal text-muted-foreground">Renda não informada</span>
                    ) : (
                      money(row.afterCents)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {result.rows.length > 4 && (
            <button
              type="button"
              aria-controls={quoteId + "-months"}
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
              className="min-h-11 text-sm font-semibold text-primary hover:underline"
            >
              {expanded ? "Mostrar menos meses" : `Ver os ${result.rows.length} meses afetados`}
            </button>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            O pagamento entra em {monthLabel(now, true)} e substitui as parcelas selecionadas nos
            respectivos meses. A sobra considera as receitas e despesas do mês inteiro.
          </p>
          {months.some((month) => month < now) && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Parcelas de meses anteriores entram no total da proposta. Elas já estavam previstas no
              passado e não liberam valor no mês atual.
            </p>
          )}
        </>
      )}
    </div>
  );
}
