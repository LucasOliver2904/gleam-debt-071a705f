import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertCircle, ArrowDownLeft, ArrowRightLeft, Check, CheckCheck, ClipboardPaste,
  Coins, Info, Pencil, Plus, QrCode, Search, Trash2, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell, Stat } from "@/components/AppShell";
import { PixAutomationPanel } from "@/components/PixAutomationPanel";
import {
  brl, currentMonth, localToday, monthLabel, setState, uid, useFinance,
  type PixData, type PixInboxItem, type Tx,
} from "@/lib/finance";
import { parsePixNotification, pixAllocation } from "@/lib/pix";

export const Route = createFileRoute("/pix")({
  head: () => ({
    meta: [
      { title: "Meus Pix e repasses — Meu Caixa" },
      { name: "description", content: "Registre Pix recebidos, separe o valor que é seu e acompanhe os repasses." },
    ],
  }),
  component: PixPage,
});

const input = "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
const baseStatus: PixData["status"] = "pendente";

function PixPage() {
  const s = useFinance();
  const [editId, setEditId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [gross, setGross] = useState("");
  const [kept, setKept] = useState("");
  const [sender, setSender] = useState("");
  const [bank, setBank] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(localToday);
  const [status, setStatus] = useState<PixData["status"]>(baseStatus);
  const [source, setSource] = useState<PixData["source"]>("manual");
  const [notificationText, setNotificationText] = useState("");
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [search, setSearch] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const inbox = [...(s.pixInbox ?? [])].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  const received = s.txs.filter((tx) => tx.kind === "entrada" && tx.pix);
  const months = [...new Set(received.map((tx) => tx.date.slice(0, 7)).concat(currentMonth()))].sort().reverse();
  const filtered = received.filter((tx) =>
    (filterMonth === "todos" || tx.date.startsWith(filterMonth)) &&
    [tx.description, tx.pix?.sender ?? "", tx.pix?.bank ?? ""].join(" ").toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")) &&
    (!onlyPending || (tx.pix?.gross ?? 0) > (tx.pix?.kept ?? 0) && tx.pix?.status === "pendente")
  ).sort((a, b) => b.date.localeCompare(a.date));
  const grossTotal = filtered.reduce((acc, tx) => acc + (tx.pix?.gross ?? 0), 0);
  const keptTotal = filtered.reduce((acc, tx) => acc + tx.amount, 0);
  const pendingTotal = filtered.reduce((acc, tx) =>
    acc + (tx.pix?.status === "pendente" ? Math.max(0, tx.pix.gross - tx.pix.kept) : 0), 0);
  const repassedTotal = filtered.reduce((acc, tx) =>
    acc + (tx.pix?.status === "repassado" ? Math.max(0, tx.pix.gross - tx.pix.kept) : 0), 0);
  const split = pixAllocation(gross, kept);

  useEffect(() => {
    if (editId && !s.txs.some((tx) => tx.id === editId)) {
      setEditId(null);
    }
  }, [editId, s.txs]);

  useEffect(() => {
    if (!formOpen || (!editId && !reviewingId)) return;
    const frame = requestAnimationFrame(() =>
      document.getElementById("pix-editor")?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
    return () => cancelAnimationFrame(frame);
  }, [formOpen, editId, reviewingId]);

  const resetForm = () => {
    setEditId(null);
    setReviewingId(null);
    setGross("");
    setKept("");
    setSender("");
    setBank("");
    setNote("");
    setDate(localToday());
    setStatus("pendente");
    setSource("manual");
    setNotificationText("");
    setFormOpen(false);
  };

  function edit(tx: Tx) {
    if (!tx.pix) return;
    setReviewingId(null);
    setEditId(tx.id);
    setGross(String(tx.pix.gross).replace(".", ","));
    setKept(String(tx.pix.kept).replace(".", ","));
    setSender(tx.pix.sender ?? "");
    setBank(tx.pix.bank ?? "");
    setNote(tx.description === "Pix recebido" ? "" : tx.description);
    setDate(tx.date);
    setStatus(tx.pix.status);
    setSource(tx.pix.source);
    setNotificationText("");
    setFormOpen(true);

  }

  function reviewIncoming(item: PixInboxItem) {
    setEditId(null);
    setReviewingId(item.id);
    setGross(String(item.gross).replace(".", ","));
    setKept("");
    setSender(item.sender ?? "");
    setBank(item.bank ?? "");
    setNote("");
    setDate(item.date);
    setStatus("pendente");
    setSource("automacao");
    setNotificationText("");
    setFormOpen(true);

  }

  function discardIncoming(item: PixInboxItem) {
    if (!window.confirm("Ignorar este aviso de Pix? Você poderá cadastrá-lo manualmente depois.")) return;
    setState((current) => ({
      ...current,
      pixInbox: (current.pixInbox ?? []).filter((row) => row.id !== item.id),
      handledInboxIds: [...new Set([...(current.handledInboxIds ?? []), item.id])].slice(-1500),
    }));
    if (reviewingId === item.id) resetForm();
    toast.success("Aviso descartado.");
  }

  function fromNotification() {
    const parsed = parsePixNotification(notificationText);
    if (!parsed) {
      toast.error("Não identifiquei um recebimento Pix válido. Confira o texto ou preencha manualmente.");
      return;
    }
    setGross(String(parsed.gross).replace(".", ","));
    setKept("");
    if (parsed.sender) setSender(parsed.sender);
    setSource("texto");
    setReviewingId(null);
    setEditId(null);
    setFormOpen(true);
    toast.success("Valor identificado! Confira e informe quanto fica com você.");
  }

  function save() {
    if (!split) {
      toast.error("Informe o Pix recebido e quanto ficou com você (de 0 até o valor recebido).");
      return;
    }
    if (split.gross > 1e10 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error("Revise o valor e a data.");
      return;
    }
    const pix: PixData = {
      gross: split.gross, kept: split.kept,
      status: split.toPassOn === 0 ? "repassado" : status,
      source,
      ...(reviewingId ? (() => {
        const record = (s.pixInbox ?? []).find((item) => item.id === reviewingId);
        return record ? { fingerprint: record.fingerprint, receivedAt: record.receivedAt } : {};
      })() : {}),
      ...(sender.trim() ? { sender: sender.trim().slice(0, 100) } : {}),
      ...(bank.trim() ? { bank: bank.trim().slice(0, 60) } : {}),
    };
    const description = note.trim().slice(0, 100) || (sender.trim() ? "Pix de " + sender.trim().slice(0, 75) : "Pix recebido");
    if (editId) {
      setState((current) => ({
        ...current,
        txs: current.txs.map((tx) => tx.id === editId
          ? { ...tx, date, amount: split.kept, kind: "entrada" as const, description, category: "Pix", pix }
          : tx),
      }));
      toast.success("Pix atualizado. Sua renda pessoal foi recalculada.");
    } else {
      setState((current) => ({
        ...current,
        txs: [{
          id: uid() + uid(), date, description, kind: "entrada" as const,
          amount: split.kept, category: "Pix", pix,
        }, ...current.txs],
        pixInbox: reviewingId ? (current.pixInbox ?? []).filter((row) => row.id !== reviewingId) : current.pixInbox,
        handledInboxIds: reviewingId ? [...new Set([...(current.handledInboxIds ?? []), reviewingId])].slice(-1500) : current.handledInboxIds,
      }));
      toast.success(reviewingId ? "Recebimento conferido! Só a sua parte entrou na renda." : "Pix registrado! Só a sua parte entra no painel.");
    }
    resetForm();
  }

  function toggleStatus(tx: Tx) {
    if (!tx.pix || tx.pix.gross <= tx.pix.kept) return;
    const next = tx.pix.status === "pendente" ? "repassado" : "pendente";
    setState((current) => ({
      ...current,
      txs: current.txs.map((item) => item.id === tx.id && item.pix
        ? { ...item, pix: { ...item.pix, status: next } } : item),
    }));
    toast.success(next === "repassado" ? "Repasse marcado como feito." : "Repasse marcado como pendente.");
  }

  function remove(tx: Tx) {
    if (!window.confirm('Excluir o Pix "' + tx.description + '"? A receita pessoal correspondente também sairá dos lançamentos.')) return;
    setState((current) => ({ ...current, txs: current.txs.filter((item) => item.id !== tx.id) }));
    if (tx.id === editId) resetForm();
    toast.success("Pix excluído.");
  }

  return (
    <AppShell>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="finance-kicker">RECEBIMENTOS / CONCILIAÇÃO</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Pix e repasses</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Registre o valor total recebido, separe o que realmente fica com você e acompanhe os repasses sem confundir sua renda.
          </p>
        </div>
        <button onClick={() => { resetForm(); setFormOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
          <Plus size={17} /> Novo Pix
        </button>
      </header>

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pix recebidos" value={brl(grossTotal)} icon={QrCode} hint="Total bruto no filtro" />
        <Stat label="Fica para mim" value={brl(keptTotal)} tone="pos" icon={Coins} hint="Entra na renda do Meu Caixa" />
        <Stat label="Falta repassar" value={brl(pendingTotal)} tone={pendingTotal ? "neg" : "pos"} icon={AlertCircle} />
        <Stat label="Já repassado" value={brl(repassedTotal)} icon={CheckCheck} />
      </div>

      <PixAutomationPanel />

      <section className="finance-surface mt-6 rounded-3xl border border-primary/30 bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="finance-kicker">NOTIFICAÇÕES / PARA CONFERIR</p>
            <h2 className="mt-1 font-display text-xl font-extrabold">Pix recebidos automaticamente</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">Estes avisos chegaram do Android, mas ainda não foram conferidos no banco nem classificados. Eles não alteram sua renda até você informar a parte que fica com você.</p>
          </div>
          <span className={"rounded-full px-3 py-1.5 text-xs font-bold " + (inbox.length ? "bg-accent/15 text-accent" : "bg-success/15 text-success")}>{inbox.length} a conferir</span>
        </div>
        {inbox.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-border px-5 py-8 text-center">
            <CheckCheck size={24} className="text-success" />
            <p className="mt-2 text-sm font-semibold">Nenhum aviso esperando conferência</p>
            <p className="mt-1 max-w-md text-xs text-muted-foreground">Depois de configurar a automação e receber um Pix, ele aparecerá aqui mesmo se o Meu Caixa estiver fechado no celular.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {inbox.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-secondary/25 p-3 sm:p-4">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><QrCode size={20} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{item.sender ? "Pix de " + item.sender : "Pix recebido"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{new Date(item.receivedAt).toLocaleString("pt-BR")}{item.bank ? " · " + item.bank : ""}</p>
                  <p className="mt-1 text-[11px] font-semibold text-accent">Aguardando sua conferência</p>
                </div>
                <p className="shrink-0 font-display text-lg font-extrabold tabular-nums">{brl(item.gross)}</p>
                <div className="flex w-full gap-2 sm:w-auto">
                  <button onClick={() => reviewIncoming(item)} className="flex-1 rounded-xl bg-primary px-3.5 py-2.5 text-xs font-bold text-primary-foreground sm:flex-initial">Conferir e dividir</button>
                  <button onClick={() => discardIncoming(item)} className="rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-secondary">Ignorar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_1fr]">
        <section id="pix-editor" className="finance-surface scroll-mt-24 rounded-3xl border border-border bg-card p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><p className="finance-kicker">LANÇAMENTO INTELIGENTE</p><h2 className="mt-1 font-display text-lg font-extrabold">{reviewingId ? "Conferir Pix recebido" : editId ? "Editar recebimento" : "Registrar recebimento"}</h2></div>
            {formOpen && <button type="button" onClick={resetForm} aria-label="Fechar edição" className="rounded-lg border border-border p-2 text-muted-foreground hover:bg-secondary"><X size={17} /></button>}
          </div>
          {!formOpen ? (
            <button onClick={() => setFormOpen(true)} className="mt-4 flex w-full flex-col items-center rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-5 py-10 text-center transition hover:border-primary/60">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Plus size={24} /></span>
              <strong className="mt-3 font-display text-base">Adicionar um Pix recebido</strong>
              <span className="mt-1 text-xs text-muted-foreground">Informe o total e quanto é seu, mesmo que o repasse seja feito depois.</span>
            </button>
          ) : (
            <div className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold text-muted-foreground">Valor recebido (R$)
                  <input autoFocus className={input + " mt-1.5"} inputMode="decimal" placeholder="Ex: 500,00" value={gross} onChange={(e) => setGross(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">Quanto é seu (R$)
                  <input className={input + " mt-1.5"} inputMode="decimal" placeholder="Ex: 50,00" value={kept} onChange={(e) => setKept(e.target.value)} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setKept(gross)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Tudo fica comigo</button>
                <button type="button" onClick={() => setKept("0")} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-secondary">Tudo para repasse</button>
              </div>
              <div className="rounded-2xl border border-primary/30 bg-primary/7 p-3 sm:p-4">
                <div className="grid grid-cols-3 gap-2">
                  <div><p className="text-[10px] font-extrabold text-muted-foreground">RECEBIDO</p><p className="mt-1 break-words font-display text-sm font-extrabold tabular-nums sm:text-base">{split ? brl(split.gross) : "—"}</p></div>
                  <div><p className="text-[10px] font-extrabold text-muted-foreground">FICA COMIGO</p><p className="mt-1 break-words font-display text-sm font-extrabold tabular-nums text-success sm:text-base">{split ? brl(split.kept) : "—"}</p></div>
                  <div><p className="text-[10px] font-extrabold text-muted-foreground">A REPASSAR</p><p className="mt-1 break-words font-display text-sm font-extrabold tabular-nums text-accent sm:text-base">{split ? brl(split.toPassOn) : "—"}</p></div>
                </div>
                {split && split.gross > 0 && (
                  <>
                    <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-accent/50" role="progressbar" aria-label="Proporção do Pix que fica com você" aria-valuenow={Math.round(split.kept / split.gross * 100)} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: Math.round(split.kept / split.gross * 100) + "%" }}/>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{Math.round(split.kept / split.gross * 100)}% do recebimento fica com você. O restante é apenas controle de repasse.</p>
                  </>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-muted-foreground">Quem enviou (opcional)
                  <input className={input + " mt-1.5"} maxLength={100} placeholder="Nome do remetente" value={sender} onChange={(e) => setSender(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">Banco (opcional)
                  <input className={input + " mt-1.5"} maxLength={60} placeholder="Ex: Nubank" value={bank} onChange={(e) => setBank(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">Data do Pix
                  <input className={input + " mt-1.5"} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
                <label className="block text-xs font-semibold text-muted-foreground">Situação do repasse
                  <select className={input + " mt-1.5"} value={status} onChange={(e) => setStatus(e.target.value as PixData["status"])} disabled={split?.toPassOn === 0}>
                    <option value="pendente">Ainda vou repassar</option>
                    <option value="repassado">Já repassei</option>
                  </select>
                </label>
              </div>
              <label className="block text-xs font-semibold text-muted-foreground">Descrição (opcional)
                <input className={input + " mt-1.5"} maxLength={100} placeholder="Ex: Pagamento cliente, divisão de venda" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
              <p className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><Info size={15} className="mt-0.5 shrink-0" /> A renda do painel recebe apenas o valor da coluna “Seu”. O restante fica separado como repasse; isso não executa transferência bancária.</p>
              <button onClick={save} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground transition hover:opacity-90">
                {reviewingId ? "Conferir e registrar" : editId ? "Salvar alterações" : "Registrar Pix"}
              </button>
            </div>
          )}
        </section>

        <section className="finance-surface rounded-3xl border border-border bg-card p-4 sm:p-6">
          <p className="finance-kicker">IMPORTAR TEXTO / CONFERÊNCIA</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-lg font-extrabold"><ClipboardPaste size={20} className="text-primary" /> Colar notificação do banco</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Copie uma mensagem como “Você recebeu um Pix de R$ 500,00” e deixe o app preencher o valor para você conferir.
          </p>
          <textarea
            aria-label="Texto da notificação bancária"
            className={input + " mt-4 min-h-28 resize-y"}
            placeholder="Cole aqui somente a mensagem de Pix recebido..."
            maxLength={4000}
            value={notificationText}
            onChange={(e) => setNotificationText(e.target.value)}
          />
          <button onClick={fromNotification} disabled={!notificationText.trim()} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/35 bg-primary/10 px-4 py-2.5 text-sm font-bold text-primary transition hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50">
            <ArrowDownLeft size={17} /> Identificar valor
          </button>
          <div className="mt-5 space-y-2 rounded-2xl border border-border bg-secondary/40 p-4 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-center gap-2 font-semibold text-foreground"><Info size={16} className="text-accent" /> Importante sobre a automação</p>
            <p>O site não lê diretamente as notificações de outros apps; a integração Android usa o MacroDroid para enviá-las com sua autorização. Pix e compras recebidos assim aguardam sua conferência.</p>
            <p>A mensagem colada é apenas texto informado por você: não comprova que o Pix realmente chegou. Confira o recebimento no banco antes de salvar.</p>
          </div>
        </section>
      </div>

      <section className="finance-surface mt-6 rounded-3xl border border-border bg-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="finance-kicker">HISTÓRICO / REPASSES</p><h2 className="mt-1 font-display text-xl font-extrabold">Seus recebimentos</h2></div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold">{filtered.length} registro(s)</span>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <label className="relative flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input aria-label="Buscar Pix" className={input + " pl-9"} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar remetente, descrição ou banco" />
          </label>
          <select aria-label="Filtrar recebimentos por mês" className={input + " sm:max-w-52"} value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)}>
            <option value="todos">Todos os meses</option>
            {months.map((m) => <option value={m} key={m}>{monthLabel(m, true)}</option>)}
          </select>
          <label className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-xs font-semibold text-muted-foreground">
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="accent-[var(--primary)]" /> Só repasses pendentes
          </label>
        </div>
        {filtered.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-2xl border border-dashed border-border p-8 text-center">
            <QrCode size={28} className="text-primary" />
            <p className="mt-3 text-sm font-semibold">Nenhum Pix neste filtro</p>
            <p className="mt-1 text-xs text-muted-foreground">Registre um recebimento ou altere os filtros.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {filtered.map((tx) => {
              const pix = tx.pix!;
              const toPassOn = Math.max(0, Math.round((pix.gross - pix.kept) * 100) / 100);
              return (
                <li key={tx.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-background/35 p-4 lg:flex-row lg:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><QrCode size={21} /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{tx.description}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{tx.date.split("-").reverse().join("/")}{pix.bank ? " · " + pix.bank : ""}{pix.sender ? " · " + pix.sender : ""}</p>
                      <span className={"mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold " + (pix.status === "pendente" && toPassOn > 0 ? "bg-accent/15 text-accent" : "bg-success/10 text-success")}>
                        {toPassOn === 0 ? "Sem repasse" : pix.status === "pendente" ? "Repasse pendente" : "Repassado"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs lg:justify-end">
<div><p className="text-muted-foreground">Recebido</p><p className="mt-0.5 font-display font-extrabold tabular-nums">{brl(pix.gross)}</p></div>
<div><p className="text-muted-foreground">Seu ganho</p><p className="mt-0.5 font-display font-extrabold tabular-nums text-success">{brl(pix.kept)}</p></div>
<div><p className="text-muted-foreground">Repasse</p><p className="mt-0.5 font-display font-extrabold tabular-nums text-accent">{brl(toPassOn)}</p></div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 lg:ml-2">
                    {toPassOn > 0 && (
                      <button type="button" onClick={() => toggleStatus(tx)} className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-2 text-xs font-semibold hover:bg-secondary">
                        {pix.status === "pendente" ? <Check size={14} /> : <ArrowRightLeft size={14} />}
                        {pix.status === "pendente" ? "Já repassei" : "Reabrir"}
                      </button>
                    )}
                    <button type="button" aria-label={"Editar " + tx.description} onClick={() => edit(tx)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-primary"><Pencil size={15} /></button>
                    <button type="button" aria-label={"Excluir " + tx.description} onClick={() => remove(tx)} className="rounded-lg border border-border p-2 text-muted-foreground hover:text-destructive"><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 text-[11px] text-muted-foreground">Os valores recebidos e os repasses são controles informativos. Somente o que fica com você entra no cálculo da renda.</p>
      </section>
    </AppShell>
  );
}
