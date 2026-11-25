import {describe,it,expect} from "vitest";
import {cardInvoices,firstInvoiceMonth,createCardPurchase} from "@/lib/credit-cards";
import type {CreditCard} from "@/lib/finance";
const card:CreditCard={id:"card",name:"Teste",limitCents:100000,closingDay:25,dueDay:5};
describe("Cartões",()=>{
 it("respeita fechamento inclusivo, vencimento e virada de ano",()=>{expect(firstInvoiceMonth("2026-12-25",card)).toBe("2027-01");expect(firstInvoiceMonth("2026-12-26",card)).toBe("2027-02");expect(firstInvoiceMonth("2026-02-28",{...card,closingDay:31})).toBe("2026-03");});
 it("divide centavos sem perda e agrupa sem duplicar",()=>{const d=createCardPurchase(card,{id:"a",name:"Compra",category:"Compras",date:"2026-12-25",totalCents:10000,installments:3})!;expect(Object.values(d.payments).map(p=>p.amount)).toEqual([33.34,33.33,33.33]);expect(cardInvoices(card,[d]).usedCents).toBe(10000);d.payments["2027-01"]!.paid=true;expect(cardInvoices(card,[d]).usedCents).toBe(6666);});
 it("rejeita data inválida e parcelas superiores aos centavos",()=>expect(createCardPurchase(card,{id:"a",name:"Compra",category:"Compras",date:"2026-02-30",totalCents:2,installments:3})).toBeNull());
});
