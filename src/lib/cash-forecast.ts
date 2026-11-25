import type { State,CashSettings } from "./finance";
import { dueDate,localDayKey } from "./planning";
export function forecastCash(state:State,settings:CashSettings,days=60) {
  const [y,m,d]=settings.balanceDate.split("-").map(Number);
  const start=new Date(y!,m!-1,d!);
  if(!Number.isFinite(start.getTime())||localDayKey(start)!==settings.balanceDate)return {rows:[],critical:null,minimum:settings.balanceCents};
  const events=new Map<string,{income:number;expense:number;overdue:number}>();
  const event=(key:string)=>{const e=events.get(key)??{income:0,expense:0,overdue:0};events.set(key,e);return e;};
  const first=localDayKey(start);
  for(const debt of state.debts)for(const [month,p] of Object.entries(debt.payments)){
    if(p.paid)continue;
    const day=localDayKey(dueDate(month,debt.due)), amount=Math.round(p.amount*100);
    if(day<=first)event(first).overdue+=amount;else event(day).expense+=amount;
  }
  for(const [month,value] of Object.entries(state.income)){
    const day=localDayKey(dueDate(month,settings.incomeDay));
    if(day>first)event(day).income+=Math.round(value*100);
  }
  for(const tx of state.txs){
    if(tx.date<=first||tx.excludedFromTotals)continue;
    const e=event(tx.date);
    if(tx.kind==="entrada")e.income+=Math.round(tx.amount*100);else e.expense+=Math.round(tx.amount*100);
  }
  const rows:{date:string;income:number;expense:number;overdue:number;balance:number}[]=[];
  let balance=settings.balanceCents;
  for(let i=0;i<=Math.min(180,Math.max(0,days));i++){
    const date=new Date(start);date.setDate(date.getDate()+i);const key=localDayKey(date);
    const e=events.get(key)??{income:0,expense:0,overdue:0};
    balance+=e.income-e.expense-e.overdue;
    rows.push({date:key,...e,balance});
  }
  return {rows,critical:rows.find(r=>r.balance<0)?.date??null,minimum:Math.min(settings.balanceCents,...rows.map(r=>r.balance))};
}
