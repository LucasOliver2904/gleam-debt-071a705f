import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  EyeOff,
  PiggyBank,
  ShieldCheck,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { brl, currentMonth, monthLabel, parseMoney, type State } from "@/lib/finance";
import { simulatePurchase, type PurchaseSimulationInput } from "@/lib/planning";
import { useMoneyPrivacy } from "@/lib/money-privacy";

const field = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";

function monthList(months: string[]) {
  const visible = months.slice(0, 3).map((month) => monthLabel(month));
  return visible.join(", ") + (months.length > 3 ? ` e mais ${months.length - 3}` : "");
}

export function PurchaseSimulator({ state }: { state: State }) {
  const valuesHidden = useMoneyPrivacy();
  const [total, setTotal] = useState("");
  const [installments, setInstallments] = useState("12");
  const [firstMonth, setFirstMonth] = useState(currentMonth());
  const [submitted, setSubmitted] = useState<PurchaseSimulationInput | null>(null);

  const calculation = useMemo(() => {
    if (!submitted) return { result: null, error: null };
    try {
      return { result: simulatePurchase(state, submitted), error: null };
    } catch (error) {
      return {
        result: null,
        error: error instanceof Error ? error.message : "Não foi possível fazer a simulação.",
      };
    }
  }, [state, submitted]);
  const result = calculation.result;
  const chartData = result?.rows.map((row) => ({
    label: monthLabel(row.month),
    currentBalance: row.current.balance,
    purchaseBalance: row.withPurchase.balance,
  })) ?? [];

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted({
      total: parseMoney(total),
      installments: Number(installments),
      firstMonth,
    });
  }

  const status = result?.firstShortage
    ? "shortage"
    : result?.missingIncomeMonths.length
      ? "unknown"
      : result
        ? "fits"
        : null;

  return (
    <section
      id="cabe-no-meu-mes"
      tabIndex={-1}
      aria-labelledby="purchase-simulator-title"
      className="finance-surface mt-6 scroll-mt-24 rounded-3xl border border-primary/35 bg-card p-4 outline-none sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Calculator size={22} aria-hidden="true" />
          </span>
          <div>
            <p className="finance-kicker">SIMULAÇÃO SEM SALVAR</p>
            <h2 id="purchase-simulator-title" className="mt-1 font-display text-xl font-extrabold sm:text-2xl">
              Cabe no meu mês?
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Compare sua sobra atual com o impacto de uma compra parcelada antes de decidir.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/35 px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
          <ShieldCheck size={14} className="text-primary" aria-hidden="true" /> Não altera suas contas
        </span>
      </div>

      <form onSubmit={submit} className="mt-5 grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_150px_180px_auto]">
        <label className="block min-w-0">
          <span className="finance-field-label">Valor total da compra</span>
          <input
            aria-label="Valor total da compra"
            value={total}
            onChange={(event) => setTotal(event.target.value)}
            inputMode="decimal"
            placeholder="R$ 0,00"
            autoComplete="off"
            className={field}
            required
          />
        </label>
        <label className="block min-w-0">
          <span className="finance-field-label">Parcelas iguais</span>
          <input
            aria-label="Quantidade de parcelas"
            type="number"
            min={1}
            max={36}
            step={1}
            value={installments}
            onChange={(event) => setInstallments(event.target.value)}
            className={field}
            required
          />
        </label>
        <label className="block min-w-0">
          <span className="finance-field-label">Primeiro mês</span>
          <input
            aria-label="Primeiro mês da parcela"
            type="month"
            value={firstMonth}
            onChange={(event) => setFirstMonth(event.target.value)}
            className={field}
            required
          />
        </label>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-primary-foreground transition hover:bg-primary/90">
          <Calculator size={17} aria-hidden="true" /> Simular
        </button>
      </form>

      {calculation.error && (
        <p role="alert" className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm font-semibold text-destructive">
          {calculation.error}
        </p>
      )}

      {result && (
        <div className="mt-6 border-t border-border pt-5" aria-live="polite">
          <div className={`rounded-2xl border p-4 ${
            status === "shortage"
              ? "border-destructive/35 bg-destructive/10"
              : status === "unknown"
                ? "border-warning/35 bg-warning/10"
                : "border-success/35 bg-success/10"
          }`}>
            <div className="flex items-start gap-3">
              {status === "shortage" ? (
                <AlertTriangle size={22} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
              ) : status === "unknown" ? (
                <AlertTriangle size={22} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              ) : (
                <CheckCircle2 size={22} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              )}
              <div>
                <h3 className={`font-display text-lg font-extrabold ${
                  status === "shortage" ? "text-destructive" : status === "unknown" ? "text-warning" : "text-success"
                }`}>
                  {status === "shortage" ? "Há falta de dinheiro na projeção" : status === "unknown" ? "Não dá para confirmar ainda" : "Cabe na projeção atual"}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-foreground">
                  {result.firstShortage
                    ? `A primeira falta acontece em ${monthLabel(result.firstShortage.month, true)}: a sobra passa de ${brl(result.firstShortage.current.balance)} para ${brl(result.firstShortage.withPurchase.balance)}.`
                    : status === "unknown"
                      ? "Os valores disponíveis não ficam negativos, mas ainda falta informar renda para concluir a análise."
                      : `Todas as ${result.rows.length} parcelas mantêm a sobra positiva ou zerada, considerando apenas o que já está cadastrado.`}
                </p>
              </div>
            </div>
          </div>

          {result.missingIncomeMonths.length > 0 && (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/10 p-3 text-sm leading-relaxed text-foreground">
              <CalendarDays size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
              <p><strong className="text-warning">Renda não informada:</strong> {monthList(result.missingIncomeMonths)}. Sem esses valores, a sobra é apenas uma estimativa e não uma garantia.</p>
            </div>
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border border-border bg-secondary/25 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Parcelas estimadas</p>
              <p className="mt-2 break-words font-display text-lg font-extrabold tabular-nums">
                {Math.min(...result.amounts) === Math.max(...result.amounts)
                  ? `${result.amounts.length} × ${brl(result.amounts[0] ?? 0)}`
                  : `${result.amounts.length} × ${brl(Math.min(...result.amounts))} a ${brl(Math.max(...result.amounts))}`}
              </p>
              {Math.min(...result.amounts) !== Math.max(...result.amounts) && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A diferença de um centavo distribui o total sem perda.</p>
              )}
            </article>
            <article className="rounded-2xl border border-border bg-secondary/25 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Mês mais apertado</p>
              <p className="mt-2 font-display text-lg font-extrabold">{monthLabel(result.tightest.month, true)}</p>
              <p className={`mt-1 break-words text-sm font-bold tabular-nums ${result.tightest.withPurchase.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                Sobra com a compra: {brl(result.tightest.withPurchase.balance)}
              </p>
              <p className="mt-1 break-words text-xs text-muted-foreground">Hoje: {brl(result.tightest.current.balance)}</p>
            </article>
            <article className="rounded-2xl border border-border bg-secondary/25 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Primeira falta</p>
              <p className={`mt-2 font-display text-lg font-extrabold ${result.firstShortage ? "text-destructive" : "text-success"}`}>
                {result.firstShortage ? monthLabel(result.firstShortage.month, true) : "Nenhuma nos valores atuais"}
              </p>
              {result.firstShortage && <p className="mt-1 break-words text-sm font-bold tabular-nums text-destructive">Faltam {brl(Math.abs(result.firstShortage.withPurchase.balance))}</p>}
            </article>
          </div>

          <div className="mt-5 rounded-2xl border border-border bg-secondary/15 p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <PiggyBank size={18} className="text-primary" aria-hidden="true" />
              <h3 className="font-display text-base font-extrabold">Sobra mês a mês</h3>
            </div>
            <div className="mt-3 h-64 sm:h-72">
              {valuesHidden ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  <EyeOff size={24} aria-hidden="true" />
                  <p className="font-semibold text-foreground">Gráfico oculto pelo modo privacidade</p>
                  <p>Use Mostrar valores no menu para consultar a comparação.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={24} tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                    <YAxis tickLine={false} axisLine={false} width={66} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
                    <Tooltip formatter={(value: number | string) => brl(Number(value))} contentStyle={{ background: "var(--card)", color: "var(--foreground)", border: "1px solid var(--border)", borderRadius: 12 }} />
                    <ReferenceLine y={0} stroke="var(--destructive)" strokeDasharray="4 4" />
                    <Line name="Sobra atual" type="monotone" dataKey="currentBalance" stroke="var(--info)" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                    <Line name="Com a compra" type="monotone" dataKey="purchaseBalance" stroke="var(--primary)" strokeWidth={3} dot={false} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs font-semibold text-muted-foreground" aria-hidden="true">
              <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 bg-info" /> Sobra atual</span>
              <span className="inline-flex items-center gap-1.5"><i className="h-0.5 w-5 bg-primary" /> Com a compra</span>
            </div>
          </div>

          <details className="group mt-4 rounded-2xl border border-border bg-card">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
              <span>Ver detalhe de todos os {result.rows.length} meses</span>
              <ChevronDown size={18} className="shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="space-y-2 border-t border-border p-3">
              {result.rows.map((row, index) => (
                <li key={row.month} className="rounded-xl border border-border/80 bg-secondary/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-display text-sm font-extrabold">{index + 1}ª parcela · {monthLabel(row.month, true)}</p>
                    {!row.incomeKnown && <span className="rounded-full bg-warning/12 px-2 py-1 text-[10px] font-bold text-warning">Renda não informada</span>}
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2">
                    <div className="min-w-0"><dt className="text-[10px] font-semibold text-muted-foreground">Parcela</dt><dd className="mt-1 break-words text-xs font-bold tabular-nums sm:text-sm">{brl(row.installment)}</dd></div>
                    <div className="min-w-0"><dt className="text-[10px] font-semibold text-muted-foreground">Sobra atual</dt><dd className={`mt-1 break-words text-xs font-bold tabular-nums sm:text-sm ${row.current.balance < 0 ? "text-destructive" : ""}`}>{brl(row.current.balance)}</dd></div>
                    <div className="min-w-0"><dt className="text-[10px] font-semibold text-muted-foreground">Com a compra</dt><dd className={`mt-1 break-words text-xs font-bold tabular-nums sm:text-sm ${row.withPurchase.balance < 0 ? "text-destructive" : "text-success"}`}>{brl(row.withPurchase.balance)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </details>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-2xl text-xs leading-relaxed text-muted-foreground">
              A projeção usa renda, contas e lançamentos cadastrados. Ela não consulta seu banco e esta simulação desaparece ao sair da tela.
            </p>
            <button type="button" onClick={() => setSubmitted(null)} className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-secondary hover:text-foreground">
              Limpar simulação
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
