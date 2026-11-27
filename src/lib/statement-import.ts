import type { Debt, PixInboxItem, ExpenseInboxItem, State, Tx } from "./finance";

export type StatementKind = Tx["kind"] | "";
export type StatementRow = {
  id: string;
  date: string;
  description: string;
  gross: number;
  kept: number;
  kind: StatementKind;
  category: string;
  isPix: boolean;
  included: boolean;
  excludedFromTotals: boolean;
  source: string;
  needsReview: boolean;
  warning?: string;
};
export type StatementResult = { rows: StatementRow[]; skipped: number; notes: string[] };
export const monthlyDebtWarning = "Uma conta cadastrada já tem este valor no mês. Confira a parcela antes de importar.";

const MONTHS: Record<string, number> = {
  jan: 1, janeiro: 1, fev: 2, fevereiro: 2, mar: 3, marco: 3, março: 3,
  abr: 4, abril: 4, mai: 5, maio: 5, jun: 6, junho: 6,
  jul: 7, julho: 7, ago: 8, agosto: 8, set: 9, setembro: 9,
  out: 10, outubro: 10, nov: 11, novembro: 11, dez: 12, dezembro: 12,
};

export function normalizeStatementText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR")
    .replace(/[\u2010-\u2015]/g, "-").replace(/\s+/g, " ").trim();
}
function pad(n: number) { return String(n).padStart(2, "0"); }

function validDay(year: number, month: number, day: number): boolean {
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export function validStatementDay(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && validDay(year!, month!, day!);
}

/** Lê datas de extratos brasileiros, incluindo cabeçalhos sem ano e "hoje/ontem". */
export function statementDate(raw: string, referenceDate: string): string | null {
  const ref = /^\d{4}-\d{2}-\d{2}$/.test(referenceDate) ? referenceDate : "2026-11-13";
  const [refYear, refMonth, refDay] = ref.split("-").map(Number);
  const normalized = normalizeStatementText(raw);
  if (/\bhoje\b/.test(normalized)) return ref;
  if (/\bontem\b/.test(normalized)) {
    const d = new Date(refYear!, refMonth! - 1, refDay! - 1);
    return [d.getFullYear(), pad(d.getMonth() + 1), pad(d.getDate())].join("-");
  }
  const numeric = normalized.match(/(?:^|[^\d])(\d{1,2})\s*[/.]\s*(\d{1,2})(?:\s*[/.]\s*(\d{2,4}))?(?!\d)/);
  const written = normalized.match(/(?:^|[^\d])(\d{1,2})\s*(?:de\s+)?(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b(?:\s*(?:de\s*)?(\d{4}))?/);
  if (!numeric && !written) return null;
  const day = Number((numeric ?? written)![1]);
  const month = numeric ? Number(numeric[2]) : MONTHS[written![2]!];
  if (!month || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const explicitYear = numeric?.[3] || written?.[3];
  const givenYear = explicitYear ? Number(explicitYear.length === 2 ? "20" + explicitYear : explicitYear) : refYear!;
  // Para extratos de dezembro enviados em janeiro, usa o ano anterior.
  let year = givenYear;
  if (!explicitYear && (month - refMonth!) > 6) year--;
  if (!validDay(year, month, day)) return null;
  return [year, pad(month), pad(day)].join("-");
}

const AMOUNT = /(?:R\$\s*)?[+-]?\s*(?:\d{1,3}(?:\.\d{3})+|\d+),\d{2}(?!\d)/gi;
const BALANCE = /\b(saldo|dispon[ií]vel|total\s+(?:recebido|enviado|debitos|creditos|movimentado)|limite|resumo|resultado do per[ií]odo)\b/i;
const HEADER = /^(?:extrato(?:\s+da?\s+conta)?|movimenta[cç][oõ]es|lan[cç]amentos|data|descri[cç][aã]o|valor|per[ií]odo|buscar|filtrar|conta corrente|ag[eê]ncia|in[ií]cio|fim|ver mais|carregar mais|transa[cç][oõ]es|pagina \d+|p[aá]gina \d+)\s*[:-]?\s*$/i;
const INBOUND = /\b(pix recebido|recebimento|transferencia recebida|transferencia de|credito em conta|deposito recebido|deposito|salario|proventos|reembolso recebido|estorno|entrada|recebido de|recebida de|cashback)\b/;
const OUTBOUND = /\b(pix enviado|pix realizado|pix para|transferencia enviada|transferencia para|ted enviada|compra|debito|pagamento|boleto|fatura paga|saque|tarifa|taxa|transferido para|enviado para|pago para|cobranca|cartao)\b/;

function direction(line: string, moneySign: string): StatementKind {
  const s = normalizeStatementText(line);
  if (OUTBOUND.test(s)) return "saida";
  if (INBOUND.test(s)) return "entrada";
  if (/^\s*[-−]/.test(moneySign) || /(?:^|\s)d(?:ebito)?\s*$/.test(s)) return "saida";
  if (/^\s*\+/.test(moneySign) || /(?:^|\s)c(?:redito)?\s*$/.test(s)) return "entrada";
  return "";
}

export function statementCategory(description: string, kind: StatementKind): string {
  const s = normalizeStatementText(description);
  if (/\bshopee\b/.test(s)) return "Shopee";
  if (/\bpix\b|transferencia|ted\b/.test(s)) return "Pix";
  if (/mercado|supermercado|mercearia|atacadao|atacad|hortifruti|a[cç]ougue|padaria/.test(s)) return "Mercado";
  if (/restaurante|lanchonete|pizzaria|ifood|lanche|cafe|a[cç]ai|almo[cç]o/.test(s)) return "Alimentação";
  if (/posto|combust[ií]vel|gasolina|uber|99\b|estacionamento|ped[aá]gio/.test(s)) return "Transporte";
  if (/farm[aá]cia|drogaria|consulta|laborat[oó]rio|cl[ií]nica/.test(s)) return "Saúde";
  if (/netflix|spotify|youtube|assinatura|streaming/.test(s)) return "Assinaturas";
  if (/aluguel|condom[ií]nio|energia|[aá]gua|internet|telefone/.test(s)) return "Contas da casa";
  if (/sal[aá]rio|provento|renda|freela/.test(s) && kind === "entrada") return "Outros";
  if (/compra|cart[aã]o|d[eé]bito/.test(s)) return "Compras";
  return kind === "entrada" ? "Outros" : "Outros";
}

function moneyValue(raw: string): number {
  const value = raw.replace(/R\$/gi, "").replace(/[−+\-\s]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= 1_000_000_000 ? Math.round(n * 100) / 100 : NaN;
}

function textWithoutDate(text: string): string {
  return text.replace(/\b\d{1,2}\s*[/.]\s*\d{1,2}(?:\s*[/.]\s*\d{2,4})?\b/g, " ")
    .replace(/\b\d{1,2}\s+(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)(?:embro|eiro|il|ho|sto|ubro)?(?:\s+de\s+\d{4})?\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ")
    .replace(/\b(?:CPF|CNPJ|Conta|Ag[eê]ncia)\s*[:-]?\s*[\d.*/-]+/gi, " ")
    .replace(/\s+/g, " ").trim();
}

function descriptionFrom(lines: string[]): string {
  const useful = lines.map((line) => textWithoutDate(line))
    .filter((line) => line.length > 1 && !HEADER.test(line) && !BALANCE.test(line));
  const combined = useful.join(" ").replace(/\s+/g, " ").trim()
    .replace(/^(?:extrato banc[aá]rio|movimenta[cç][oõ]es|detalhes da transa[cç][aã]o)\s*/i, "");
  return combined.slice(0, 100);
}

/** Nunca infere uma direção ou data ausente: isso deve ser preenchido pelo usuário. */
export function parseStatementText(text: string, source = "Extrato", referenceDate = "2026-11-13"): StatementResult {
  const lines = text.replace(/\r/g, "").split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 1600);
  const rows: StatementRow[] = [];
  const notes: string[] = [];
  let date = "";
  let buffer: string[] = [];
  let skipped = 0;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    if (BALANCE.test(line) || HEADER.test(line)) {
      skipped++;
      buffer = [];
      continue;
    }
    const dated = statementDate(line, referenceDate);
    const amounts = [...line.matchAll(AMOUNT)];
    if (dated) {
      date = dated;
      if (amounts.length === 0) {
        buffer = [];
        continue;
      }
    }
    if (amounts.length === 0) {
      buffer.push(line);
      if (buffer.length > 4) buffer.shift();
      continue;
    }
    if (amounts.length !== 1) {
      skipped++;
      notes.push("Uma linha tinha mais de um valor e foi ignorada para evitar confundir saldo com movimento.");
      buffer = [];
      continue;
    }

    const match = amounts[0]!;
    const gross = moneyValue(match[0]);
    if (!Number.isFinite(gross)) {
      skipped++;
      buffer = [];
      continue;
    }

    const monetary = match[0];
    const remaining = (line.slice(0, match.index) + " " + line.slice(match.index! + monetary.length)).trim();
    const previous = [...buffer];
    const context = [...previous, remaining].filter(Boolean);
    const originalContext = context.join(" ");
    let kind = direction(originalContext, monetary);
    // O texto "R$ 5,00 D" ou "R$ 5,00 C" indica movimento de débito/crédito.
    if (!kind && /\bD\b/.test(remaining)) kind = "saida";
    if (!kind && /\bC\b/.test(remaining)) kind = "entrada";
    const isPix = /\bpix\b/i.test(originalContext) && kind === "entrada";
    let description = descriptionFrom(context);
    // Alguns extratos mostram valor primeiro e a descrição na próxima linha.
    if (!description && index + 1 < lines.length) {
      const next = lines[index + 1]!;
      if (![...next.matchAll(AMOUNT)].length && !statementDate(next, referenceDate) && !BALANCE.test(next)) {
        description = descriptionFrom([next]);
        kind ||= direction(next, monetary);
        index++;
      }
    }
    if (!description) description = "Movimentação do extrato";
    const rowDate = dated ?? date;
    const needsReview = !rowDate || !kind || description === "Movimentação do extrato";
    rows.push({
      id: "ocr-" + index + "-" + rows.length,
      date: rowDate,
      description,
      gross,
      kept: gross,
      kind,
      category: statementCategory(description, kind),
      isPix: /\bpix\b/i.test(description) && kind === "entrada",
      included: !needsReview,
      excludedFromTotals: false,
      source,
      needsReview,
      ...(needsReview ? { warning: "Revise a data, o tipo ou a descrição antes de importar." } : {}),
    });
    buffer = [];
  }

  if (!rows.length) notes.push("Nenhuma movimentação completa foi reconhecida. Experimente prints mais nítidos, sem cortes, ou cole o texto do extrato.");
  return { rows, skipped, notes };
}

/** Alerta preventivo para não registrar em dobro movimentos de prints sobrepostos. */
export function statementDuplicate(row: Pick<StatementRow, "date" | "description" | "gross" | "kind" | "isPix">,
  state: Pick<State, "txs" | "pixInbox" | "expenseInbox" | "income" | "debts">,
  additional: Pick<StatementRow, "date" | "description" | "gross" | "kind" | "isPix">[] = []
): string | null {
  if (!row.date || !row.kind || !Number.isFinite(row.gross)) return null;
  const normalized = normalizeStatementText(row.description);
  const compareName = (name: string) => {
    const candidate = normalizeStatementText(name);
    return candidate === normalized || (candidate.length >= 8 && normalized.length >= 8 &&
      (candidate.includes(normalized) || normalized.includes(candidate)));
  };
  const matching = (date: string, kind: string, gross: number) =>
    date === row.date && kind === row.kind && Math.abs(gross - row.gross) < .005;

  for (const tx of state.txs) {
    const gross = tx.pix?.gross ?? tx.amount;
    if (!matching(tx.date, tx.kind, gross)) continue;
    if (compareName(tx.description) || tx.pix?.sender && compareName(tx.pix.sender)) return "Já existe um lançamento com mesma data, valor e descrição.";
    return "Existe um lançamento de mesmo valor e data; confira antes de somar.";
  }
  for (const item of additional) {
    if (matching(item.date, item.kind, item.gross)) return "Outra linha do extrato tem o mesmo valor e data; confira se não é repetida.";
  }
  const pixInbox = state.pixInbox ?? [];
  if (row.kind === "entrada" && pixInbox.some((item: PixInboxItem) =>
    item.date === row.date && Math.abs(item.gross - row.gross) < .005))
    return "Pix do mesmo valor/data já capturado pelo Android e aguardando conferência.";
  const expenseInbox = state.expenseInbox ?? [];
  if (row.kind === "saida" && expenseInbox.some((item: ExpenseInboxItem) =>
    item.date === row.date && Math.abs(item.amount - row.gross) < .005))
    return "Despesa do mesmo valor/data já capturada pelo Android e aguardando conferência.";
  if (row.kind === "entrada" && /\bsalar(?:io|ial)\b/.test(normalized) && (state.income[row.date.slice(0, 7)] ?? 0) > 0)
    return "Renda mensal já cadastrada; importar este crédito pode somá-la duas vezes.";
  if (row.kind === "saida" && state.debts.some((debt: Debt) => {
    const monthly = debt.payments[row.date.slice(0, 7)];
    return monthly && Math.abs(monthly.amount - row.gross) < .005 && compareName(debt.name);
  }))
    return monthlyDebtWarning;
  return null;
}
