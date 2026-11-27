import { useState } from "react";
import { CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { brl,localToday,parseBrlCents,setState,getFinanceUser,type State } from "@/lib/finance";
import { useMoneyPrivacy } from "@/lib/money-privacy";
import { forecastCash } from "@/lib/cash-forecast";
const field="mt-1 w-full rounded-xl border border-input bg-background p-3 text-sm";
export function CashForecast({state}:{state:State}) {
 const hidden=useMoneyPrivacy(),saved=state.cashSettings;
 const [raw,setRaw]=useState(()=>saved?(saved.balanceCents/100).toFixed(2).replace(".",","):"");
 const [date,setDate]=useState(()=>saved?.balanceDate??localToday());
 const [day,setDay]=useState(()=>String(saved?.incomeDay??5));
 const [horizon,setHorizon]=useState(60);
 const [expanded,setExpanded]=useState(false);
 const [owner]=useState(getFinanceUser);
 const sign=raw.trim().startsWith("-")?-1:1;
 const amount=parseBrlCents(raw.trim().replace(/^-/,""));
 const valid=amount!==null&&amount<=100_000_000_000&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date<=localToday()&&Number.isInteger(Number(day))&&Number(day)>=1&&Number(day)<=31;
 const scenario=valid?{balanceCents:amount*sign,balanceDate:date,incomeDay:Number(day)}:null;
 const result=scenario?forecastCash(state,scenario,horizon):null;
 const money=(c:number)=>brl(c/100);
 return <section className="finance-surface mt-6 rounded-3xl border border-border bg-card p-4 sm:p-6" aria-label="Previsão de caixa diária">
  <p className="finance-kicker">SALDO E VENCIMENTOS</p><h2 className="mt-1 flex items-center gap-2 font-display text-xl font-extrabold"><CalendarClock size={21} className="text-primary"/> Previsão de caixa diária</h2>
  <p className="mt-2 text-sm text-muted-foreground">Informe o saldo disponível ao final do dia escolhido. A previsão usa seus vencimentos pendentes e entradas cadastradas, não consulta bancos.</p>
  {hidden?<p className="mt-3 text-sm">Valores ocultos pelo modo privacidade.</p>:<>
  <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">Saldo informado (R$)<input className={field} inputMode="decimal" placeholder="0,00" value={raw} onChange={e=>setRaw(e.target.value)}/></label><label className="text-sm font-bold">Data do saldo<input type="date" max={localToday()} className={field} value={date} onChange={e=>setDate(e.target.value)}/></label><label className="text-sm font-bold">Dia da renda base<input type="number" min={1} max={31} className={field} value={day} onChange={e=>setDay(e.target.value)}/></label></div>
  <div className="mt-3 flex flex-wrap gap-2"><button type="button" disabled={!scenario||!result?.rows.length} onClick={()=>{if(!scenario||!owner||owner!==getFinanceUser())return;try{setState(s=>({...s,cashSettings:scenario}));toast.success("Saldo de referência salvo.");}catch{toast.error("Não foi possível salvar.");}}} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground disabled:opacity-50">Salvar referência</button><label className="text-sm">Horizonte <select value={horizon} onChange={e=>setHorizon(Number(e.target.value))} className="rounded-xl border border-input bg-background p-3"><option value={30}>30 dias</option><option value={60}>60 dias</option><option value={90}>90 dias</option><option value={180}>180 dias</option></select></label></div>
  {saved&&<p className="mt-2 text-xs text-muted-foreground">Último saldo salvo: {money(saved.balanceCents)} em {saved.balanceDate.split("-").reverse().join("/")}. Atualize sempre que necessário.</p>}
  {result&&result.rows.length>0&&<><div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Menor saldo projetado</p><p className="mt-1 text-xl font-bold">{money(result.minimum)}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Primeiro dia crítico</p><p className="mt-1 text-xl font-bold">{result.critical?result.critical.split("-").reverse().join("/"):"Nenhum"}</p></div><div className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Saldo ao fim do horizonte</p><p className="mt-1 text-xl font-bold">{money(result.rows.at(-1)!.balance)}</p></div></div>
  <button type="button" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded} className="mt-4 text-sm font-bold text-primary">{expanded?"Mostrar apenas dias com movimento":"Mostrar todos os dias"}</button>
  <div className="mt-2 max-h-96 space-y-2 overflow-y-auto">{result.rows.filter((r,i)=>expanded||i===0||r.income||r.expense||r.overdue).map(r=><article key={r.date} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3"><div><p className="text-sm font-bold">{r.date.split("-").reverse().join("/")}</p><p className="text-xs text-muted-foreground">Entradas {money(r.income)} · Saídas {money(r.expense+r.overdue)}{r.overdue>0?" (inclui vencidas)":""}</p></div><p className={"font-bold tabular-nums "+(r.balance<0?"text-destructive":"text-success")}>{money(r.balance)}</p></article>)}</div></>}
  <p className="mt-3 text-xs text-muted-foreground">Contas vencidas ainda abertas são provisionadas imediatamente. Movimentos até a data do saldo não são somados novamente. A renda base entra apenas no dia informado e nos meses cadastrados. Atualize o saldo após dar baixa nas contas. A projeção usa os vencimentos cadastrados. Evite cadastrar o mesmo recebimento na renda base e como entrada avulsa.</p></>}
 </section>;
}
