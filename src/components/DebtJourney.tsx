import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Gauge, Rocket } from "lucide-react";
import { brl,currentMonth,monthLabel,monthSummary,parseBrlCents,type State } from "@/lib/finance";
import { useMoneyPrivacy } from "@/lib/money-privacy";
import { debtJourney,extraPayoff } from "@/lib/debt-journey";

export function DebtJourney({state}:{state:State}) {
  const hidden=useMoneyPrivacy();
  const [raw,setRaw]=useState("");
  const [strategy,setStrategy]=useState<"menor-saldo"|"maior-parcela">("menor-saldo");
  const now=currentMonth();
  const journey=debtJourney(state.debts,now,monthSummary(state,now).income);
  const extra=parseBrlCents(raw);
  const sim=extraPayoff(state.debts,now,hidden?0:(extra??0)/100,strategy);
  if(journey.percent===null)return null;
  return <section aria-label="Jornada de quitação" className="finance-surface mt-5 rounded-3xl border border-border bg-card p-4 sm:p-6">
    <p className="finance-kicker">SUA JORNADA</p><h2 className="mt-1 flex items-center gap-2 font-display text-xl font-extrabold"><Gauge size={21} className="text-primary"/> Rumo à liberdade das dívidas</h2>
    {hidden?<p className="mt-4 text-sm text-muted-foreground">Indicadores financeiros ocultos pelo modo privacidade.</p>:<>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Quitação registrada</p><p className="mt-1 text-2xl font-extrabold text-primary">{journey.percent}%</p><div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary" style={{width:journey.percent+"%"}}/></div><p className="mt-2 text-xs">{brl(journey.paid/100)} pagos · {brl(journey.open/100)} em aberto</p></div>
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Última parcela prevista</p><p className="mt-1 text-xl font-bold">{sim.baseline?monthLabel(sim.baseline,true):"Quitado"}</p><p className="mt-2 text-xs text-muted-foreground">{journey.pending} parcelas abertas · {journey.streak} meses registrados seguidos sem pendência</p></div>
        <div className="rounded-2xl border border-border p-4"><p className="text-xs text-muted-foreground">Renda comprometida com parcelas</p><p className="mt-1 text-2xl font-extrabold">{journey.commitment===null?"—":journey.commitment.toLocaleString("pt-BR")+"%"}</p><p className="mt-2 text-xs text-muted-foreground">{journey.totalCommitment===null?"Sem renda registrada":journey.totalCommitment.toLocaleString("pt-BR")+"% incluindo contas fixas"}. Não inclui gastos avulsos.</p></div>
      </div>
      {sim.baseline&&<details className="mt-4 rounded-2xl border border-border p-4"><summary className="cursor-pointer font-bold text-primary"><Rocket size={17} className="mr-2 inline"/> Simular valor extra mensal</summary><p className="mt-2 text-xs text-muted-foreground">Cenário nominal: mantenha as parcelas previstas e use um valor extra para abater parcelas finais. Não pressupõe desconto, juros, autorização do credor ou sobra de caixa.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Extra por mês (R$)<input className="mt-1 w-full rounded-xl border border-input bg-background p-3" inputMode="decimal" value={raw} onChange={e=>setRaw(e.target.value)} placeholder="300,00"/></label><label className="text-sm font-semibold">Estratégia<select className="mt-1 w-full rounded-xl border border-input bg-background p-3" value={strategy} onChange={e=>setStrategy(e.target.value==="maior-parcela"?"maior-parcela":"menor-saldo")}><option value="menor-saldo">Menor saldo primeiro (bola de neve)</option><option value="maior-parcela">Maior parcela primeiro</option></select></label></div>
      {raw.trim()&&extra===null?<p role="alert" className="mt-3 text-sm text-destructive">Informe um valor válido.</p>:<div className="mt-3 rounded-xl bg-secondary/40 p-3"><p className="text-sm">Termina em <strong>{sim.end?monthLabel(sim.end,true):"—"}</strong> · {sim.saved} mês(es) antes</p><p className="mt-1 text-xs text-muted-foreground">Total extra usado: {brl(sim.extraUsed/100)}</p>{extra!==null&&extra>0&&<ol className="mt-3 space-y-1 text-sm">{sim.order.map(q=><li key={q.id} className="flex justify-between gap-2"><span>{q.name}</span><span className="shrink-0">{monthLabel(q.month)}</span></li>)}</ol>}</div>}
      <Link to="/planejamento" hash="antecipar-parcelas" className="mt-3 inline-block text-sm font-bold text-primary">Comparar proposta real do credor →</Link>
      </details>}
      <p className="mt-3 text-xs text-muted-foreground">Baseado nos registros existentes, não em extrato bancário. Meses sem registros são ignorados na sequência. As simulações não modificam pagamentos.</p>
    </>}
  </section>;
}
