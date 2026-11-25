import {useState} from "react";
import {CreditCard as CardIcon} from "lucide-react";
import {toast} from "sonner";
import {brl,categoryOptions,currentMonth,getFinanceUser,localToday,monthLabel,parseBrlCents,setState,uid,type CreditCard,type State} from "@/lib/finance";
import {useMoneyPrivacy} from "@/lib/money-privacy";
import {confirmAction} from "@/lib/confirm-action";
import {cardInvoices,createCardPurchase} from "@/lib/credit-cards";
const field="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm";
const money=(c:number)=>brl(c/100);
export function CreditCards({state}:{state:State}) {
 const hidden=useMoneyPrivacy();
 const cards=Object.values(state.cards??{});
 const [owner]=useState(getFinanceUser);
 const [name,setName]=useState(""),[limit,setLimit]=useState(""),[closing,setClosing]=useState(""),[due,setDue]=useState("");
 const [selected,setSelected]=useState("");
 const card=cards.find(c=>c.id===selected)??cards[0];
 const [description,setDescription]=useState(""),[amount,setAmount]=useState(""),[date,setDate]=useState(localToday),[count,setCount]=useState("1"),[category,setCategory]=useState("Compras");
 const [invoiceMonth,setInvoiceMonth]=useState(currentMonth);
 const [error,setError]=useState("");
 const active=()=>!!owner&&owner===getFinanceUser();
 const summary=card?cardInvoices(card,state.debts):null;
 const invoice=summary?.invoices.find(i=>i.month===invoiceMonth);
 const preview=card?createCardPurchase(card,{id:"preview",name:description,category,date,totalCents:parseBrlCents(amount)??0,installments:Number(count)}):null;
 function addCard(e:React.FormEvent){
  e.preventDefault();setError("");if(!active())return;
  const cents=parseBrlCents(limit),c=Number(closing),d=Number(due);
  if(!name.trim()||name.length>80||cents===null||cents<=0||cents>100_000_000_000||!Number.isInteger(c)||c<1||c>31||!Number.isInteger(d)||d<1||d>31){setError("Confira nome, limite, fechamento e vencimento.");return;}
  const id=uid(),newCard:CreditCard={id,name:name.trim(),limitCents:cents,closingDay:c,dueDay:d};
  try{setState(s=>({...s,cards:{...s.cards,[id]:newCard}}));setSelected(id);setName("");setLimit("");setClosing("");setDue("");toast.success("Cartão cadastrado.");}catch{setError("Não foi possível salvar.");}
 }
 function addPurchase(e:React.FormEvent){
  e.preventDefault();setError("");if(!active()||!card||!preview)return;
  const debt={...preview,id:uid()};
  try{setState(s=>({...s,debts:[debt,...s.debts]}));setInvoiceMonth(Object.keys(debt.payments).sort()[0]!);setDescription("");setAmount("");toast.success("Compra registrada em Contas, sem duplicar a fatura.");}catch{setError("Não foi possível registrar.");}
 }
 async function payInvoice(){
  if(!card||!invoice||invoice.openCents<=0||!active())return;
  const target=card.id,month=invoice.month,ids=new Set(invoice.items.filter(i=>!i.paid).map(i=>i.debtId));
  if(!await confirmAction("Marcar como pagas todas as compras pendentes desta fatura? Isso não realiza pagamento no banco."))return;
  if(!active())return;
  try{setState(s=>({...s,debts:s.debts.map(d=>{const p=d.payments[month];return d.cardId===target&&ids.has(d.id)&&p&&!p.paid?{...d,payments:{...d.payments,[month]:{...p,paid:true}}}:d;})}));toast.success("Fatura marcada como paga.");}catch{setError("Não foi possível atualizar a fatura.");}
 }
 return <section aria-label="Cartões e faturas" className="finance-surface mt-6 rounded-3xl border border-border bg-card p-4 sm:p-6">
  <p className="finance-kicker">CARTÕES DE CRÉDITO</p><h2 className="mt-1 flex items-center gap-2 font-display text-xl font-extrabold"><CardIcon size={21} className="text-primary"/> Cartões e faturas</h2><p className="mt-2 text-sm text-muted-foreground">Controle compras futuras e faturas. As compras entram em Contas, e a fatura apenas agrupa essas parcelas — não cria uma segunda despesa.</p>
  {hidden?<p className="mt-3 text-sm text-muted-foreground">Valores ocultos pelo modo privacidade.</p>:<>
  <details className="mt-4 rounded-2xl border border-border p-3" open={cards.length===0?true:undefined}><summary className="cursor-pointer text-sm font-bold text-primary">Cadastrar cartão</summary><form onSubmit={addCard} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Nome<input required maxLength={80} value={name} onChange={e=>setName(e.target.value)} className={field}/></label><label className="text-sm">Limite (R$)<input required inputMode="decimal" value={limit} onChange={e=>setLimit(e.target.value)} className={field}/></label><label className="text-sm">Dia de fechamento<input required type="number" min={1} max={31} value={closing} onChange={e=>setClosing(e.target.value)} className={field}/></label><label className="text-sm">Dia de vencimento<input required type="number" min={1} max={31} value={due} onChange={e=>setDue(e.target.value)} className={field}/></label><button type="submit" className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Salvar cartão</button></form></details>
  {card&&summary&&<><label className="mt-4 block text-sm font-bold">Cartão<select className={field} value={card.id} onChange={e=>{setSelected(e.target.value);setInvoiceMonth(currentMonth());}}>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
   <div className="mt-3 grid gap-2 sm:grid-cols-3">{[{label:"Limite informado",value:card.limitCents},{label:"Limite usado estimado",value:summary.usedCents},{label:"Limite disponível estimado",value:summary.availableCents}].map(x=><div key={x.label} className="rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">{x.label}</p><p className="mt-1 font-display text-xl font-bold">{money(x.value)}</p></div>)}</div>
   <p className="mt-2 text-xs text-muted-foreground">Fechamento dia {card.closingDay} · vencimento dia {card.dueDay}. Compras no fechamento entram na fatura do ciclo que fecha nesse dia; depois dele, no ciclo seguinte. Confirme com o banco.</p>
   <details className="mt-4 rounded-2xl border border-border p-3"><summary className="cursor-pointer text-sm font-bold text-primary">Nova compra no cartão</summary><form onSubmit={addPurchase} className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm">Descrição<input required maxLength={80} value={description} onChange={e=>setDescription(e.target.value)} className={field}/></label><label className="text-sm">Valor total (R$)<input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className={field}/></label><label className="text-sm">Data da compra<input required type="date" value={date} onChange={e=>setDate(e.target.value)} className={field}/></label><label className="text-sm">Quantidade de parcelas<input required type="number" min={1} max={60} value={count} onChange={e=>setCount(e.target.value)} className={field}/></label><label className="text-sm">Categoria<select className={field} value={category} onChange={e=>setCategory(e.target.value)}>{categoryOptions(state).map(c=><option key={c}>{c}</option>)}</select></label>{preview&&<p className="self-end text-sm text-muted-foreground">Primeira fatura: {monthLabel(Object.keys(preview.payments).sort()[0]!,true)}. Confira parcelas e limite antes de salvar.</p>}<button type="submit" disabled={!preview} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">Registrar compra</button></form></details>
   <div className="mt-5 flex flex-wrap items-end justify-between gap-2"><h3 className="font-display text-lg font-bold">Fatura por mês</h3><label className="text-sm">Mês<input type="month" value={invoiceMonth} onChange={e=>setInvoiceMonth(e.target.value)} className={field}/></label></div>
   {invoice?<><div className="mt-3 rounded-xl border border-border p-3"><p className="text-xs text-muted-foreground">Total da fatura</p><p className="text-xl font-bold">{money(invoice.totalCents)}</p><p className="text-xs text-muted-foreground">Em aberto: {money(invoice.openCents)}</p></div><div className="mt-3 space-y-2">{invoice.items.map(i=><div key={i.debtId} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"><span>{i.name}<small className="block text-muted-foreground">{i.paid?"Pago":"Pendente"}</small></span><strong>{money(i.cents)}</strong></div>)}</div><button type="button" disabled={!invoice.openCents} onClick={()=>void payInvoice()} className="mt-3 rounded-xl border border-primary/40 px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-50">Marcar fatura como paga</button></>:<p className="mt-3 text-sm text-muted-foreground">Nenhuma compra vinculada neste mês.</p>}</>}
  {error&&<p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
  <p className="mt-4 text-xs text-muted-foreground">Não importa compras do banco automaticamente. Faturas antigas cadastradas manualmente continuam em Contas: não recadastre as mesmas compras aqui. O limite é estimado apenas com as compras vinculadas neste aplicativo.</p>
  </>}
 </section>;
}
