import { Repeat } from "lucide-react";
import { brl,localToday,type State } from "@/lib/finance";
import { useMoneyPrivacy } from "@/lib/money-privacy";
import { detectRecurring } from "@/lib/recurring-radar";
export function RecurringRadar({state}:{state:State}) {
  const hidden=useMoneyPrivacy();
  const rows=detectRecurring(state.txs,state.debts,localToday());
  return <section aria-label="Radar de recorrências" className="finance-surface mt-5 rounded-2xl border border-border bg-card p-4 sm:p-5">
    <p className="finance-kicker">GASTOS RECORRENTES</p><h2 className="mt-1 flex items-center gap-2 font-display text-lg font-bold"><Repeat size={19} className="text-primary"/> Radar de recorrências</h2>
    <p className="mt-2 text-xs text-muted-foreground">Possíveis assinaturas: mesma descrição em pelo menos três meses, uma saída por mês e valores próximos. Não inclui contas fixas já cadastradas com o mesmo nome.</p>
    {rows.length===0?<p className="mt-4 rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">Nenhuma recorrência identificada com segurança suficiente.</p>:<><p className="mt-4 text-sm">Custo anual estimado: <strong className="text-primary">{brl(rows.reduce((sum,r)=>sum+r.annualCents,0)/100)}</strong></p><div className="mt-3 space-y-2">{rows.map(r=><article key={r.key} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p className="text-sm font-bold">{r.name}</p><p className="text-xs text-muted-foreground">{r.months} meses · Último: {r.last.split("-").reverse().join("/")}</p></div><div className="text-right"><p className="font-bold">{brl(r.monthlyCents/100)}/mês</p><p className="text-xs text-muted-foreground">{brl(r.annualCents/100)}/ano</p></div></article>)}</div></>}
    <p className="mt-3 text-xs text-muted-foreground">{hidden?"Valores ocultos. ":""}As sugestões são estimativas; nenhuma assinatura é criada ou cancelada automaticamente.</p>
  </section>;
}
