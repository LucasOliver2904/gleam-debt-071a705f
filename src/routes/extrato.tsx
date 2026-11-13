import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import {
  AlertTriangle, ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight,
  Check, CheckCheck, ChevronDown, FileImage, FileSearch, ImagePlus,
  Info, LockKeyhole, Receipt, RefreshCw, ShieldCheck, Sparkles,
  Trash2, UploadCloud, Wallet, X,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { brl, CATEGORIES, getState, localToday, parseMoney, setState, uid, useFinance, type Tx } from "@/lib/finance";
import { parseStatementText, statementCategory, statementDuplicate, type StatementRow, type StatementKind } from "@/lib/statement-import";

export const Route = createFileRoute("/extrato")({
  head: () => ({
    meta: [
      { title: "Importar extrato privado — Meu Caixa" },
      { name: "description", content: "Leia prints de extrato no próprio aparelho, confira datas e valores antes de lançar." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: StatementImportPage,
});

const field = "w-full min-w-0 rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

type ExtractedBatch = { rows: StatementRow[]; notes: string[] };
function firstName(description: string): string | undefined {
  const m = description.match(/(?:pix recebido\s*(?:de|por)?\s*)(.+)/i);
  const sender = m?.[1]?.trim();
  return sender && sender.length >= 3 ? sender.slice(0, 100) : undefined;
}

function StatementImportPage() {
  const s = useFinance();
  const [files, setFiles] = useState<File[]>([]);
  const [source, setSource] = useState("Meu banco");
  const [referenceDate, setReferenceDate] = useState(() => localToday());
  const [text, setText] = useState("");
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [keptAmounts, setKeptAmounts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [scanning, setScanning] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  if (!s.ready) return <AppShell><div /></AppShell>;

  function appendFiles(newFiles: FileList | File[]) {
    const picked = Array.from(newFiles);
    const valid = picked.filter((file) => {
      const validType = ["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        /\.(png|jpe?g|webp)$/i.test(file.name);
      if (!validType || file.size > 12 * 1024 * 1024) {
        toast.error("Use PNG, JPG ou WebP, com até 12 MB por print.");
        return false;
      }
      return true;
    });
    setFiles((old) => [...old, ...valid].slice(0, 8));
    if (picked.length + files.length > 8) toast("Limite de 8 imagens por leitura. Você pode importar outros prints depois.");
  }

  function mergeBatch(batch: ExtractedBatch) {
    const accepted: StatementRow[] = [];
    const newRows = batch.rows.map((item) => {
      const id = "statement-" + uid() + "-" + uid();
      const next = { ...item, id, source: source.trim().slice(0, 60) || "Extrato" };
      const duplicate = statementDuplicate(next, getState(), [...rows, ...accepted]);
      const enriched: StatementRow = duplicate
        ? { ...next, included: false, needsReview: true, warning: duplicate }
        : next;
      accepted.push(enriched);
      return enriched;
    });
    setRows((old) => [...old, ...newRows].slice(0, 150));
    const money: Record<string, string> = {};
    for (const row of newRows) money[row.id] = row.gross.toFixed(2).replace(".", ",");
    setAmounts((old) => ({ ...old, ...money }));
    setKeptAmounts((old) => ({ ...old, ...money }));
    setNotes((old) => [...old, ...batch.notes].slice(-12));
    setError("");
    if (newRows.length) toast.success(newRows.length + " movimentação(ões) identificada(s) para conferir.");
  }

  async function scanImages() {
    if (scanning) return;
    if (!files.length) { toast.error("Selecione pelo menos um print."); return; }
    setScanning(true);
    setProgress(0);
    setError("");
    setPhase("Carregando reconhecimento de texto em português...");
    let worker: Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>> | undefined;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("por", 1, {
        logger: (event) => {
          if (event.status === "recognizing text" && typeof event.progress === "number") {
            setProgress(Math.round(event.progress * 100));
          }
        },
      });
      const batch: ExtractedBatch = { rows: [], notes: [] };
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        setPhase("Lendo print " + (i + 1) + " de " + files.length + ": " + file.name);
        setProgress(0);
        const { data } = await worker.recognize(file);
        const parsed = parseStatementText(data.text, source.trim() || file.name, referenceDate);
        batch.rows.push(...parsed.rows);
        batch.notes.push(...parsed.notes.map((note) => file.name + ": " + note));
      }
      mergeBatch(batch);
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
      setPhase(batch.rows.length ? "Leitura concluída. Revise todas as linhas." : "Nenhum lançamento encontrado.");
    } catch (reason) {
      console.error("Falha no reconhecimento local do extrato", reason);
      setError("Não foi possível ler a imagem neste aparelho. Verifique sua conexão (o primeiro uso baixa o motor e o idioma do OCR), tente outro print ou cole o texto manualmente.");
    } finally {
      try { await worker?.terminate(); } catch { /* O leitor pode já ter sido encerrado. */ }
      setScanning(false);
      setProgress(0);
    }
  }

  function processText() {
    if (text.trim().length < 10) { setError("Cole pelo menos uma linha completa com data, descrição e valor."); return; }
    const parsed = parseStatementText(text, source.trim() || "Texto de extrato", referenceDate);
    mergeBatch({ rows: parsed.rows, notes: parsed.notes });
    setText("");
  }

  function updateRow(id: string, patch: Partial<StatementRow>) {
    setRows((old) => old.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function checkedRows() { return rows.filter((row) => row.included); }

  function confirmedAmounts(row: StatementRow): { gross: number; kept: number } {
    const gross = parseMoney(amounts[row.id] ?? "");
    const kept = row.isPix && row.kind === "entrada" ? parseMoney(keptAmounts[row.id] ?? "") : gross;
    // Valor de repasse 100% é válido, portanto "0" é uma opção expressa.
    const keptInput = (keptAmounts[row.id] ?? "").replace(/\s/g, "");
    const validKept = row.isPix && row.kind === "entrada" && /^0+(?:[,.]0{1,2})?$/.test(keptInput) ? 0 : kept;
    return { gross, kept: validKept };
  }

  function importChecked() {
    const selected = checkedRows();
    if (!selected.length) { toast.error("Selecione ao menos uma movimentação para importar."); return; }
    const prepared: { row: StatementRow; gross: number; kept: number }[] = [];
    for (const row of selected) {
      const { gross, kept } = confirmedAmounts(row);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date) || Number.isNaN(Date.parse(row.date + "T12:00:00"))) {
        setError("Preencha uma data válida para todos os lançamentos selecionados."); return;
      }
      if (!row.kind || !row.description.trim() || row.description.trim().length > 100) {
        setError("Defina o tipo e a descrição de todos os lançamentos selecionados."); return;
      }
      if (!(gross > 0) || gross > 1_000_000_000 || !Number.isFinite(kept) || kept < 0 || kept > gross) {
        setError("Confira os valores. Em Pix recebido, o valor que fica com você deve estar entre R$ 0 e o valor bruto."); return;
      }
      prepared.push({ row, gross, kept });
    }
    const current = getState();
    const suspect = prepared.filter(({ row, gross }) =>
      statementDuplicate({ ...row, gross }, current) || row.warning);
    if (suspect.length && !window.confirm(suspect.length + " lançamento(s) selecionado(s) podem estar duplicados ou já previstos. Você conferiu no banco e deseja importar mesmo assim?")) return;
    const count = prepared.length;
    const importedAt = new Date().toISOString();
    const freshTxs: Tx[] = prepared.map(({ row, gross, kept }) => ({
      id: uid() + uid(),
      date: row.date,
      description: row.description.trim(),
      kind: row.kind as Tx["kind"],
      amount: row.isPix && row.kind === "entrada" ? kept : gross,
      category: row.category || statementCategory(row.description, row.kind),
      ...(row.kind === "saida" && row.excludedFromTotals ? { excludedFromTotals: true } : {}),
      ...(row.kind === "entrada" && row.isPix
        ? { pix: {
          gross,
          kept,
          status: gross > kept ? "pendente" as const : "repassado" as const,
          source: "texto" as const,
          ...(firstName(row.description) ? { sender: firstName(row.description)! } : {}),
          ...(row.source ? { bank: row.source } : {}),
        } }
        : {}),
      statement: { source: row.source, importedAt },
    }));
    setState((state) => ({ ...state, txs: [...freshTxs, ...state.txs] }));
    setRows((old) => old.filter((row) => !row.included));
    setError("");
    toast.success(count + " movimentação(ões) adicionada(s) ao Meu Caixa.");
  }

  const selectedCount = rows.filter((row) => row.included).length;
  const selectedIncome = rows.reduce((sum, row) => {
    if (!row.included || row.kind !== "entrada") return sum;
    const amount = confirmedAmounts(row);
    return sum + (Number.isFinite(amount.kept) ? amount.kept : 0);
  }, 0);
  const selectedOut = rows.reduce((sum, row) => {
    if (!row.included || row.kind !== "saida" || row.excludedFromTotals) return sum;
    const amount = confirmedAmounts(row);
    return sum + (Number.isFinite(amount.gross) ? amount.gross : 0);
  }, 0);
  const suspiciousCount = rows.filter((row) => row.warning).length;

  return (
    <AppShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="finance-kicker">SÓ PARA VOCÊ / EXTRATO PRIVADO</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Importar extrato por print</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Envie imagens do extrato e o Meu Caixa tenta identificar valores, datas e quem recebeu ou enviou.
            Você confere tudo antes de registrar.
          </p>
        </div>
        <Link to="/lancamentos" className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-muted-foreground hover:text-primary"><ArrowLeft size={16}/> Voltar aos lançamentos</Link>
      </div>

      <section className="finance-surface mt-6 overflow-hidden rounded-3xl border border-primary/25 bg-card p-4 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary"><ShieldCheck size={24}/></span>
          <div>
            <h2 className="font-display text-lg font-extrabold">Seus prints ficam neste aparelho</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">O reconhecimento é processado no seu navegador, sem enviar as fotos ao servidor do Meu Caixa ou a uma API de IA. O motor de OCR e os dados do idioma português são baixados da internet no primeiro uso. Somente os lançamentos que você confirmar serão sincronizados no seu espaço financeiro.</p>
          </div>
        </div>
      </section>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1.18fr_0.82fr]">
        <section className="finance-surface rounded-3xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-info/12 text-info"><ImagePlus size={21}/></span>
            <div><p className="finance-kicker">PASSO 1 · IMAGENS</p><h2 className="mt-1 font-display text-lg font-extrabold">Escolha os prints</h2></div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-muted-foreground">De qual banco é o extrato?
              <input className={field + " mt-1.5"} value={source} maxLength={60} onChange={(event) => setSource(event.target.value)} placeholder="Sicredi, Itaú..." />
            </label>
            <label className="block text-xs font-bold text-muted-foreground">Data de referência
              <input className={field + " mt-1.5"} type="date" value={referenceDate} onChange={(event) => setReferenceDate(event.target.value)}/>
            </label>
          </div>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={scanning}
            className="mt-5 flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-5 py-8 text-center transition hover:border-primary hover:bg-primary/10 disabled:opacity-60">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary"><UploadCloud size={26}/></span>
            <strong className="font-display text-sm font-extrabold">Selecionar prints da galeria</strong>
            <span className="text-xs leading-relaxed text-muted-foreground">Até 8 prints por leitura · JPG, PNG ou WebP · 12 MB cada</span>
          </button>
          <input ref={fileInput} type="file" className="hidden" aria-label="Selecionar capturas do extrato" accept="image/png,image/jpeg,image/webp" multiple onChange={(event) => { if (event.target.files) appendFiles(event.target.files); event.target.value = ""; }}/>
          {files.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="Imagens selecionadas">
              {files.map((file, i) => (
                <li key={i + file.name} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/20 px-3 py-2">
                  <FileImage size={18} className="shrink-0 text-info"/>
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{file.name}</span>
                  <span className="text-[10px] text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button disabled={scanning} type="button" onClick={() => setFiles((old) => old.filter((_, pos) => pos !== i))} aria-label={"Remover " + file.name} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X size={15}/></button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" onClick={() => void scanImages()} disabled={scanning || !files.length} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-extrabold text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
            {scanning ? <RefreshCw size={18} className="animate-spin"/> : <FileSearch size={18}/>}
            {scanning ? "Lendo os prints no aparelho..." : "Ler imagens e identificar movimentações"}
          </button>
          {(phase || scanning) && <div className="mt-3 rounded-xl bg-secondary/35 p-3">
            <p aria-live="polite" className="text-xs font-semibold text-muted-foreground">{phase}</p>
            {scanning && <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-primary transition-all" style={{width: progress + "%"}}/></div>}
          </div>}
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground"><Info size={15} className="mt-0.5 shrink-0 text-accent"/> Para melhores resultados, capture o extrato inteiro, com data, descrição e valor legíveis. Evite imagens borradas ou cortadas.</p>
        </section>

        <section className="finance-surface rounded-3xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-accent/12 text-accent"><Receipt size={21}/></span>
            <div><p className="finance-kicker">ALTERNATIVA / TEXTO</p><h2 className="mt-1 font-display text-lg font-extrabold">Colar texto do extrato</h2></div>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Se seu banco permitir copiar os lançamentos, cole aqui. Também serve para corrigir manualmente um texto que o reconhecimento não conseguiu ler.</p>
          <textarea className={field + " mt-3 min-h-40 resize-y"} aria-label="Texto do extrato a identificar" value={text} onChange={(event) => setText(event.target.value)} maxLength={20000} placeholder={"13/11/2026\nPix recebido de Fulano\nR$ 500,00\n\n12/11/2026\nCompra Mercado Central\n- R$ 54,80"} />
          <button type="button" onClick={processText} disabled={scanning || !text.trim()} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 text-xs font-bold text-primary transition hover:bg-primary/15 disabled:opacity-50"><Sparkles size={17}/> Identificar no texto</button>
          <button type="button" onClick={() => setShowHelp((old) => !old)} aria-expanded={showHelp} className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl bg-secondary/40 px-3 py-3 text-xs font-bold text-foreground">
            O que o app reconhece? <ChevronDown size={16} className={showHelp ? "rotate-180 transition" : "transition"}/>
          </button>
          {showHelp && (
            <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p><b className="text-foreground">Datas:</b> 13/11/2026, 13 nov, hoje e ontem.</p>
              <p><b className="text-foreground">Valores:</b> R$ 500,00, -R$ 20,00 e 1.250,80.</p>
              <p><b className="text-foreground">Operações:</b> Pix enviado/recebido, compras, depósitos, pagamentos e transferências.</p>
              <p><b className="text-foreground">Limitação:</b> cada banco usa uma tela diferente. Nomes e sinais podem falhar no OCR. Por isso, a revisão é obrigatória.</p>
            </div>
          )}
        </section>
      </div>

      {error && <p role="alert" className="mt-5 rounded-2xl border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm font-semibold leading-relaxed text-destructive"><AlertTriangle size={18} className="mr-2 inline"/>{error}</p>}
      {notes.length > 0 && <div className="mt-5 rounded-xl border border-accent/25 bg-accent/7 p-3 text-xs text-muted-foreground">{notes.slice(-3).map((note, i) => <p key={i}>{note}</p>)}</div>}

      <section className="finance-surface mt-6 rounded-3xl border border-border bg-card p-4 sm:p-6" aria-labelledby="statement-review-title">
        <header className="finance-section-head">
          <div>
            <p className="finance-kicker">PASSO 2 · CONFERÊNCIA ANTES DE LANÇAR</p>
            <h2 id="statement-review-title" className="mt-1 font-display text-xl font-extrabold">Movimentações reconhecidas</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Apenas os itens marcados serão importados. Altere qualquer informação errada. Marcas de alerta indicam possíveis lançamentos repetidos.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rows.length > 0 && <button onClick={() => setRows((old) => old.map((row) => row.needsReview || row.warning ? row : { ...row, included: true }))} className="rounded-xl border border-primary/30 px-3 py-2 text-xs font-bold text-primary hover:bg-primary/10"><CheckCheck size={15} className="mr-1 inline"/> Marcar confiáveis</button>}
            {rows.length > 0 && <button onClick={() => { if (!window.confirm("Limpar a prévia? Nenhum lançamento já salvo será excluído.")) return; setRows([]); setAmounts({}); setKeptAmounts({}); setNotes([]); }} className="rounded-xl border border-border px-3 py-2 text-xs font-bold text-muted-foreground hover:text-destructive"><Trash2 size={15} className="mr-1 inline"/> Limpar prévia</button>}
          </div>
        </header>

        {rows.length === 0 ? (
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-border bg-secondary/15 px-5 py-12 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-info/12 text-info"><FileImage size={27}/></span>
            <p className="mt-4 font-display text-base font-extrabold">Nenhum extrato analisado ainda</p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">Selecione seus prints e toque em “Ler imagens”. O Meu Caixa mostrará cada movimentação para revisão.</p>
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border bg-secondary/20 p-3"><p className="finance-insight-label">Selecionados</p><p className="mt-2 font-display text-2xl font-extrabold tabular-nums">{selectedCount}</p></div>
              <div className="rounded-2xl border border-border bg-success/7 p-3"><p className="finance-insight-label">Entradas minhas</p><p className="mt-2 break-words font-display text-lg font-extrabold tabular-nums text-success">{brl(selectedIncome)}</p></div>
              <div className="rounded-2xl border border-border bg-destructive/7 p-3"><p className="finance-insight-label">Saídas contabilizadas</p><p className="mt-2 break-words font-display text-lg font-extrabold tabular-nums text-destructive">{brl(selectedOut)}</p></div>
              <div className="rounded-2xl border border-border bg-accent/7 p-3"><p className="finance-insight-label">Para revisar</p><p className="mt-2 font-display text-2xl font-extrabold tabular-nums text-accent">{suspiciousCount}</p></div>
            </div>
            <ul className="mt-5 space-y-3">
              {rows.map((row) => {
                const amountsValid = confirmedAmounts(row);
                return (
                  <li key={row.id} className={"rounded-2xl border p-3.5 sm:p-4 " + (row.warning || row.needsReview ? "border-accent/35 bg-accent/5" : "border-border bg-secondary/15")}>
                    <div className="flex flex-wrap items-start gap-3">
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-extrabold">
                        <input type="checkbox" checked={row.included} onChange={(event) => updateRow(row.id, { included: event.target.checked })} className="h-4 w-4 accent-[var(--primary)]"/>
                        Importar
                      </label>
                      <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold " + (row.kind === "entrada" ? "bg-success/12 text-success" : row.kind === "saida" ? "bg-destructive/12 text-destructive" : "bg-accent/15 text-accent")}>
                        {row.kind === "entrada" ? <ArrowDownLeft size={13}/> : row.kind === "saida" ? <ArrowUpRight size={13}/> : <AlertTriangle size={13}/>}
                        {row.kind === "entrada" ? "Entrada" : row.kind === "saida" ? "Saída" : "Tipo não reconhecido"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{row.source}</span>
                      <button onClick={() => { setRows((old) => old.filter((r) => r.id !== row.id)); }} aria-label="Remover esta linha" className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X size={16}/></button>
                    </div>
                    {row.warning && <p className="mt-3 flex items-start gap-2 rounded-xl border border-accent/25 bg-accent/10 p-2.5 text-xs font-semibold leading-relaxed text-accent"><AlertTriangle size={16} className="mt-0.5 shrink-0"/> {row.warning} Você decide se deve importar.</p>}
                    <div className="mt-4 grid gap-3 sm:grid-cols-[130px_minmax(0,2fr)_120px_130px]">
                      <label className="text-[11px] font-bold text-muted-foreground">Data
                        <input type="date" value={row.date} onChange={(event) => updateRow(row.id, { date: event.target.value, needsReview: false })} className={field + " mt-1"}/>
                      </label>
                      <label className="text-[11px] font-bold text-muted-foreground">Pessoa / estabelecimento / descrição
                        <input maxLength={100} value={row.description} onChange={(event) => updateRow(row.id, { description: event.target.value })} className={field + " mt-1"}/>
                      </label>
                      <label className="text-[11px] font-bold text-muted-foreground">Tipo
                        <select value={row.kind} onChange={(event) => {
                          const kind = event.target.value as StatementKind;
                          updateRow(row.id, { kind, category: statementCategory(row.description, kind), isPix: kind === "entrada" && /\bpix\b/i.test(row.description) });
                        }} className={field + " mt-1"}>
                          <option value="">Definir...</option><option value="entrada">Entrada (+)</option><option value="saida">Saída (−)</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-bold text-muted-foreground">Valor bruto (R$)
                        <input inputMode="decimal" value={amounts[row.id] ?? ""} onChange={(event) => setAmounts((old) => ({ ...old, [row.id]: event.target.value }))} className={field + " mt-1"}/>
                      </label>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <label className="text-[11px] font-bold text-muted-foreground">Categoria
                        <select className={field + " mt-1"} value={row.category} onChange={(event) => updateRow(row.id, { category: event.target.value })}>
                          {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                      </label>
                      {row.kind === "entrada" ? (
                        <label className="flex items-center gap-2 self-end rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold">
                          <input type="checkbox" checked={row.isPix} onChange={(event) => updateRow(row.id, { isPix: event.target.checked, category: event.target.checked ? "Pix" : row.category })} className="h-4 w-4 accent-[var(--primary)]"/>
                          É um Pix recebido (pode ter repasse)
                        </label>
                      ) : row.kind === "saida" ? (
                        <label className="flex items-center gap-2 self-end rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-bold">
                          <input type="checkbox" checked={row.excludedFromTotals} onChange={(event) => updateRow(row.id, { excludedFromTotals: event.target.checked })} className="h-4 w-4 accent-[var(--primary)]"/>
                          Já incluído na fatura ou em outra despesa (não somar)
                        </label>
                      ) : null}
                    </div>
                    {row.isPix && row.kind === "entrada" && (
                      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-success/25 bg-success/7 p-3">
                        <label className="min-w-[145px] flex-1 text-[11px] font-bold text-muted-foreground">Quanto fica comigo (R$)
                          <input inputMode="decimal" value={keptAmounts[row.id] ?? ""} onChange={(event) => setKeptAmounts((old) => ({ ...old, [row.id]: event.target.value }))} className={field + " mt-1"}/>
                        </label>
                        <div className="min-w-[145px] flex-1">
                          <p className="finance-insight-label">A repassar</p>
                          <p className="mt-1 font-display text-base font-extrabold text-accent">{Number.isFinite(amountsValid.gross) && Number.isFinite(amountsValid.kept) ? brl(Math.max(0, amountsValid.gross - amountsValid.kept)) : "Confira os valores"}</p>
                        </div>
                        <p className="basis-full text-[11px] leading-relaxed text-muted-foreground">Exemplo: recebeu R$ 500, mas só R$ 50 são seus? Digite 50,00 acima. Apenas R$ 50 serão receita no painel.</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-primary/30 bg-primary/6 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-display text-base font-extrabold">{selectedCount} lançamento(s) prontos para confirmar</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Nenhum valor será registrado até você tocar em confirmar. Linhas não marcadas ficam na prévia.</p>
              </div>
              <button disabled={!selectedCount || scanning} onClick={importChecked} type="button" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-extrabold text-primary-foreground hover:opacity-90 disabled:opacity-50"><Check size={18}/> Confirmar e lançar {selectedCount}</button>
            </div>
          </>
        )}
      </section>

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><LockKeyhole size={17} className="mt-0.5 shrink-0 text-primary"/> Privacidade: as imagens e o texto extraído não são salvos nem sincronizados. Como todo OCR, a leitura pode falhar; confirme os valores no extrato original antes de lançar. Transferências entre suas próprias contas e gastos que já aparecem na fatura não devem ser somados duas vezes.</p>
    </AppShell>
  );
}
