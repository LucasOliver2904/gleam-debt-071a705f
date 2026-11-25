import type { Debt } from "./finance";
type Strategy = "menor-saldo" | "maior-parcela";
const cents = (n: number) => Math.round(n * 100);
const idx = (m: string) => Number(m.slice(0,4))*12 + Number(m.slice(5,7))-1;
const month = (i: number) => String(Math.floor(i/12)).padStart(4,"0")+"-"+String(i%12+1).padStart(2,"0");

export function debtJourney(debts: Debt[], current: string, income: number) {
  let paid=0, open=0, pending=0, due=0, fixed=0;
  const history=new Map<string,boolean>();
  for(const debt of debts) for(const [m,p] of Object.entries(debt.payments)) {
    const c=cents(p.amount);
    if(debt.type!=="fixa") { if(p.paid) paid+=c; else {open+=c; pending++;} }
    if(m===current) {if(debt.type==="fixa") fixed+=c; else due+=c;}
    if(m<current) history.set(m,(history.get(m)??true)&&p.paid);
  }
  let streak=0;
  for(const [,settled] of [...history].sort(([a],[b])=>b.localeCompare(a))) {if(!settled)break;streak++;}
  return {paid,open,pending,streak,percent:paid+open>0?Math.floor(paid*100/(paid+open)):null,commitment:income>0?Math.round(due*1000/cents(income))/10:null,totalCommitment:income>0?Math.round((due+fixed)*1000/cents(income))/10:null};
}

// Scenario only: contractual nominal amounts, no interest or lender discount.
// Extra funds pay future installments from the end of the selected schedule.
export function extraPayoff(debts:Debt[], start:string, extra:number, strategy:Strategy) {
  const startIdx=idx(start);
  const queues=debts.filter(d=>d.type!=="fixa").map(d=>({id:d.id,name:d.name,parts:Object.entries(d.payments).filter(([,p])=>!p.paid&&p.amount>0).map(([m,p])=>({m:Math.max(startIdx,idx(m)),c:cents(p.amount)})).sort((a,b)=>a.m-b.m)})).filter(d=>d.parts.length);
  if(!queues.length)return {baseline:null,end:null,saved:0,extraUsed:0,order:[] as {id:string;name:string;month:string}[]};
  const baseline=Math.max(startIdx,...queues.map(q=>q.parts.at(-1)!.m));
  const score=(q:typeof queues[number])=>strategy==="menor-saldo"?q.parts.reduce((a,p)=>a+p.c,0):-q.parts.reduce((a,p)=>Math.max(a,p.c),0);
  const budget=Number.isFinite(extra)&&extra>0?Math.min(cents(extra),100_000_000_000):0;
  const order:{id:string;name:string;month:string}[]=[];let extraUsed=0,end=startIdx;
  const done=new Set<string>();
  for(let i=startIdx;i<=baseline;i++){
    for(const q of queues) while(q.parts[0]&&q.parts[0].m<=i)q.parts.shift();
    let available=budget;
    while(available>0){
      const q=queues.filter(q=>q.parts.length).sort((a,b)=>score(a)-score(b)||a.name.localeCompare(b.name,"pt-BR")||a.id.localeCompare(b.id))[0];
      if(!q)break;
      const part=q.parts.at(-1)!;const use=Math.min(part.c,available);
      part.c-=use;available-=use;extraUsed+=use;
      if(part.c===0)q.parts.pop();
    }
    for(const q of queues)if(!q.parts.length&&!done.has(q.id)){done.add(q.id);order.push({id:q.id,name:q.name,month:month(i)});}
    end=i;if(done.size===queues.length)break;
  }
  return {baseline:month(baseline),end:month(end),saved:baseline-end,extraUsed,order};
}
