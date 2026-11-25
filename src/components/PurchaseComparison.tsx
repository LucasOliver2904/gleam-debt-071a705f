import { useState } from "react";
import { Scale } from "lucide-react";
import { brl, currentMonth, monthLabel, parseBrlCents, type State } from "@/lib/finance";
import { comparePurchase } from "@/lib/purchase-comparison";
import { useMoneyPrivacy } from "@/lib/money-privacy";

const field = "mt-1 block min-h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-base text-foreground focus-visible:outline-primary";
const amount = (cents: number) => brl(cents / 100);

export function PurchaseComparison({ state }: { state: State }) {
  const hidden = useMoneyPrivacy();
  const [cash, setCash] = useState("");
  const [financed, setFinanced] = useState("");
  const [count, setCount] = useState("3");
  const [start, setStart] = useState(currentMonth());
  const result = comparePurchase(state, start, (parseBrlCents(cash) ?? 0) / 100, (parseBrlCents(financed) ?? 0) / 100, Number(count));
  return <section id="comparar-compra" tabIndex={-1} aria-labelledby="comparison-title" className="finance-surface mt-3 scroll-mt-24 rounded-3xl border border-border bg-card p-4 outline-none sm:p-6">
    <div className="flex items-start gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary"><Scale size={22} aria-hidden="true" /></span>
      <div>
        <h2 id="comparison-title" className="font-display text-xl font-extrabold sm:text-2xl">À vista ou parcelado?</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">Compare o custo total das duas ofertas e a sobra prevista em cada mês.</p>
      </div>
    </div>
    {hidden ? <p className="mt-3 text-sm text-muted-foreground">Ative “Mostrar valores” para comparar uma compra.</p> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold">Preço à vista (R$)<input className={field} inputMode="decimal" placeholder="900,00" value={cash} onChange={e => setCash(e.target.value)} /></label>
        <label className="text-sm font-semibold">Total parcelado (R$)<input className={field} inputMode="decimal" placeholder="1.000,00" value={financed} onChange={e => setFinanced(e.target.value)} /></label>
        <label className="text-sm font-semibold">Número de parcelas<input type="number" min="1" max="36" step="1" className={field} value={count} onChange={e => setCount(e.target.value)} /></label>
        <label className="text-sm font-semibold">Mês do primeiro pagamento<input type="month" className={field} value={start} onChange={e => setStart(e.target.value)} /></label>
      </div>
      {cash && financed && !result && <p role="status" className="mt-3 text-sm">Confira os preços, o mês e o número de parcelas (1 a 36). Cada parcela precisa valer pelo menos R$ 0,01.</p>}
      {result && <>
        <p role="status" className="mt-5 rounded-xl bg-secondary p-3 font-semibold">{result.difference === 0 ? "As duas opções têm o mesmo preço." : (result.difference > 0 ? "À vista" : "Parcelado") + " custa " + amount(Math.abs(result.difference)) + " a menos."}</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">{(["cash", "financed"] as const).map(key => {
          const known = result.rows.filter(row => row.incomeKnown);
          const worst = known.reduce<typeof known[number] | undefined>((min, row) => !min || row[key] < min[key] ? row : min, undefined);
          const firstNegative = known.find(row => row[key] < 0);
          return <div key={key} className="rounded-xl border border-border p-3">
            <h3 className="font-bold">{key === "cash" ? "Pagando à vista" : "Pagando em parcelas"}</h3>
            {worst && <p className="mt-2 text-sm">Menor sobra prevista entre os meses com renda informada: <strong>{amount(worst[key])}</strong> em {monthLabel(worst.month, true)}.</p>}
            {firstNegative && <p className="mt-1 text-sm font-semibold">Primeiro mês com déficit previsto: {monthLabel(firstNegative.month, true)}.</p>}
          </div>;
        })}</div>
        {result.rows.some(row => !row.incomeKnown) && <p className="mt-3 text-sm text-muted-foreground">Há meses sem renda informada. Cadastre as entradas para conhecer a sobra desses meses.</p>}
        <details className="mt-3 rounded-xl border border-border p-3">
          <summary className="cursor-pointer font-semibold">Comparar mês a mês</summary>
          <ul className="mt-2 divide-y divide-border">{result.rows.map(row => <li key={row.month} className="py-3">
            <strong>{monthLabel(row.month, true)}</strong><span className="ml-2 text-sm text-muted-foreground">Parcela de {amount(row.installment)}</span>
            {row.incomeKnown ? <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">{([["Sem compra",row.base],["À vista",row.cash],["Parcelado",row.financed]] as const).map(([label,value]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold tabular-nums">{amount(value)}</dd></div>)}</dl> : <p className="text-sm text-muted-foreground">Renda não informada</p>}
          </li>)}</ul>
        </details>
        <p className="mt-3 text-xs text-muted-foreground">Cada mês considera suas entradas, contas e saídas cadastradas. A sobra de um mês não é transferida para o seguinte. Os dois cenários começam no mês escolhido.</p>
      </>}
    </>}
  </section>;
}
