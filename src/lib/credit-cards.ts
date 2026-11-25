import {addMonths,type CreditCard,type Debt} from "./finance";
import {dueDate,localDayKey} from "./planning";
export function firstInvoiceMonth(date:string,card:CreditCard) {
 const purchaseMonth=date.slice(0,7);
 const closing=localDayKey(dueDate(purchaseMonth,card.closingDay));
 const cycle=date>closing?addMonths(purchaseMonth,1):purchaseMonth;
 return card.dueDay<=card.closingDay?addMonths(cycle,1):cycle;
}
export function createCardPurchase(card:CreditCard,p:{id:string;name:string;category:string;date:string;totalCents:number;installments:number}):Debt|null {
 if(!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date+"T12:00:00Z"))||new Date(p.date+"T12:00:00Z").toISOString().slice(0,10)!==p.date||!Number.isSafeInteger(p.totalCents)||p.totalCents<=0||!Number.isInteger(p.installments)||p.installments<1||p.installments>60||p.totalCents<p.installments||!p.name.trim()||p.name.length>80)return null;
 const month=firstInvoiceMonth(p.date,card);
 const base=Math.floor(p.totalCents/p.installments),extra=p.totalCents%p.installments;
 const payments:Debt["payments"]={};
 for(let i=0;i<p.installments;i++)payments[addMonths(month,i)]={amount:(base+(i<extra?1:0))/100,paid:false};
 return {id:p.id,cardId:card.id,name:p.name.trim(),category:p.category,due:card.dueDay,type:p.installments===1?"unica":"parcelada",note:"Compra no cartão em "+p.date.split("-").reverse().join("/"),payments};
}
export function cardInvoices(card:CreditCard,debts:Debt[]) {
 const groups=new Map<string,{month:string;totalCents:number;openCents:number;items:{debtId:string;name:string;cents:number;paid:boolean}[]}>();
 let usedCents=0;
 for(const d of debts){
  if(d.cardId!==card.id||d.type==="fixa")continue;
  for(const [month,p] of Object.entries(d.payments)){
   const cents=Math.round(p.amount*100);
   const group=groups.get(month)??{month,totalCents:0,openCents:0,items:[]};
   group.totalCents+=cents;
   if(!p.paid){group.openCents+=cents;usedCents+=cents;}
   group.items.push({debtId:d.id,name:d.name,cents,paid:p.paid});groups.set(month,group);
  }
 }
 return {usedCents,availableCents:card.limitCents-usedCents,invoices:[...groups.values()].sort((a,b)=>a.month.localeCompare(b.month))};
}
