import {describe,it,expect} from "vitest";
import {forecastCash} from "@/lib/cash-forecast";
import type {State,CashSettings} from "@/lib/finance";
const state:State={debts:[{id:"a",name:"Conta",type:"parcelada",due:10,payments:{"2026-11":{amount:50,paid:false},"2026-12":{amount:125,paid:false},"2027-01":{amount:90,paid:true}}}],income:{"2026-11":1000,"2026-12":100},txs:[{id:"old",date:"2026-11-25",description:"já refletido",kind:"saida",amount:20},{id:"new",date:"2026-11-26",description:"previsto",kind:"saida",amount:60},{id:"dup",date:"2026-11-26",description:"fatura",kind:"saida",amount:60,excludedFromTotals:true}]};
const settings:CashSettings={balanceCents:10000,balanceDate:"2026-11-25",incomeDay:5};
describe("Previsão diária",()=>{
 it("provisiona vencidas, ignora movimentos refletidos e detecta dia crítico",()=>{const r=forecastCash(state,settings,30);expect(r.rows[0]).toMatchObject({balance:5000,overdue:5000});expect(r.critical).toBe("2026-11-26");expect(r.rows.at(-1)?.balance).toBe(-3500);});
 it("não transforma conta paga em nova despesa",()=>expect(forecastCash(state,settings,90).rows.find(r=>r.date==="2027-01-10")?.expense).toBe(0));
});
