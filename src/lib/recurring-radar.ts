import type { Debt,Tx } from "./finance";
export function recurrenceKey(name:string) {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/\b(pix|compra|pagamento|debito)\b/g," ").replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
}
export function detectRecurring(txs:Tx[],debts:Debt[],today:string) {
  const registered=new Set(debts.filter(d=>d.type==="fixa").map(d=>recurrenceKey(d.name)));
  const byName=new Map<string,Tx[]>();
  for(const t of txs){if(t.kind!=="saida"||t.excludedFromTotals||t.date>today||t.amount<=0)continue;const key=recurrenceKey(t.description);if(!key||registered.has(key))continue;const a=byName.get(key)??[];a.push(t);byName.set(key,a);}
  return [...byName].flatMap(([key,items])=>{
    const monthly=new Map<string,Tx[]>();
    for(const t of items){const m=t.date.slice(0,7);const a=monthly.get(m)??[];a.push(t);monthly.set(m,a);}
    if(monthly.size<3||[...monthly.values()].some(a=>a.length!==1))return [];
    const ordered=items.slice().sort((a,b)=>b.date.localeCompare(a.date));
    const values=items.map(t=>Math.round(t.amount*100)).sort((a,b)=>a-b);const middle=Math.floor(values.length/2);
    const med=values.length%2?values[middle]!:(values[middle-1]!+values[middle]!)/2;
    if(values.some(v=>Math.abs(v-med)>med*0.15))return [];
    const monthlyCents=Math.round(values.reduce((a,b)=>a+b,0)/values.length);
    return [{key,name:ordered[0]!.description,months:monthly.size,monthlyCents,annualCents:monthlyCents*12,last:ordered[0]!.date}];
  }).sort((a,b)=>b.annualCents-a.annualCents);
}
