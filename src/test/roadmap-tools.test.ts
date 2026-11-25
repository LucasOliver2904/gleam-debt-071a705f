import { describe,it,expect } from "vitest";
import { debtJourney,extraPayoff } from "@/lib/debt-journey";
import { parseQuickPhrase } from "@/lib/quick-parse";
import { detectRecurring } from "@/lib/recurring-radar";
import type { Debt,Tx } from "@/lib/finance";
const d:Debt={id:"a",name:"Teste",type:"parcelada",payments:{"2026-10":{amount:100,paid:true},"2026-11":{amount:100,paid:false},"2026-12":{amount:100,paid:false},"2027-01":{amount:100,paid:false}}};
const now=new Date(2026,10,25);
const cats=["Outros","Mercado","Shopee","Pessoas","Transporte"];
describe("Jornada e aportes",()=>{
 it("soma centavos e exclui fixas da quitação",()=>{expect(debtJourney([d], "2026-11",1000)).toMatchObject({paid:10000,open:30000,percent:25,streak:1,commitment:10});});
 it("antecipa sem mudar os registros",()=>{const before=JSON.stringify(d);expect(extraPayoff([d],"2026-11",100,"menor-saldo")).toMatchObject({baseline:"2027-01",end:"2026-12",saved:1,extraUsed:10000});expect(JSON.stringify(d)).toBe(before);});
 it("sem extra segue calendário",()=>expect(extraPayoff([d],"2026-11",0,"maior-parcela").end).toBe("2027-01"));
});
describe("Frases",()=>{
 it.each([["45 mercado ontem","45,00","2026-11-24"],["R$ 1.250,50 Shopee hoje","1250,50","2026-11-25"],["recebi 2 mil freela","2000,00","2026-11-25"],["gastei 12.50 mercado dia 3","12,50","2026-11-03"],["45 mercado anteontem","45,00","2026-11-23"],["10 mercado","10,00","2026-11-25"],["10,5 mercado","10,50","2026-11-25"],["1.200 mercado","1200,00","2026-11-25"],["recebi 1200 freela","1200,00","2026-11-25"],["paguei 3 mercado","3,00","2026-11-25"],["R$ 9 mercado","9,00","2026-11-25"]])("interpreta %s",(phrase,amount,date)=>expect(parseQuickPhrase(phrase,cats,now)).toMatchObject({amount,date}));
 it.each(["","0 mercado","20","dez reais","15 mercado dia 31","-5 mercado","12,345 mercado"])("não adivinha %s",(phrase)=>expect(parseQuickPhrase(phrase,cats,now)).toBeNull());
 it("classifica categoria personalizada e entradas",()=>expect(parseQuickPhrase("recebi 10 Pessoa teste",["Outros","Pessoa teste"],now)).toMatchObject({kind:"entrada",category:"Pessoa teste"}));
});
describe("Radar",()=>{
 const txs:Tx[]=["09","10","11"].map((m,i)=>({id:String(i),kind:"saida",date:"2026-"+m+"-10",amount:10.25,description:"Pix Serviço teste"}));
 it("calcula anual e ignora fatura duplicada",()=>expect(detectRecurring([...txs,{...txs[0]!,id:"dup",excludedFromTotals:true}],[],"2026-11-25")[0]).toMatchObject({monthlyCents:1025,annualCents:12300,months:3}));
 it("ignora conta fixa cadastrada, meses repetidos e valores muito diferentes",()=>{expect(detectRecurring(txs,[{...d,type:"fixa",name:"Serviço teste"}],"2026-11-25")).toEqual([]);expect(detectRecurring([...txs,{...txs[0]!,id:"dup"}],[],"2026-11-25")).toEqual([]);expect(detectRecurring([txs[0]!,txs[1]!,{...txs[2]!,amount:90}],[],"2026-11-25")).toEqual([]);});
});
