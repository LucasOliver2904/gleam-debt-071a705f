import { parseMoney } from "./finance";
import { parsePixNotification } from "./pix";

export type PaymentMethod = "pix" | "cartao" | "carteira" | "pagamento";
export type ParsedNotification =
  | { direction: "entrada"; amount: number; person?: string; method: "pix" }
  | { direction: "saida"; amount: number; person?: string; method: PaymentMethod };

export const DUPLICATE_WINDOW_MS = 5 * 60_000;

function amountFromNotification(text: string): number | null {
  // Exige valor monetário com marcador R$ para não capturar número de cartão, data ou CPF.
  const matches = [...text.matchAll(/R\$\s*((?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{2})?)/gi)];
  const amounts = matches.map((match) => parseMoney(match[1] ?? "")).filter((n) => Number.isFinite(n) && n > 0 && n <= 1_000_000_000);
  return amounts.length === 1 ? amounts[0]! : null;
}

function counterpart(text: string, method: PaymentMethod): string | undefined {
  const after = method === "pix"
    ? text.match(/(?:para|destinat[aá]rio:?)\s+([\p{L}\d][\p{L}\p{M}\d .'-]{1,95})/iu)
    : text.match(/(?:em|na loja|estabelecimento:?|comerciante:?)\s+([\p{L}\d][\p{L}\p{M}\d .'-]{1,95})/iu);
  if (!after?.[1]) return undefined;
  const value = after[1].split(/(?:[,;]|\s+CPF\b|\s+CNPJ\b|\s+com\s+cart[aã]o\b|[.!?]\s)/i)[0]?.trim().replace(/[.!?]+$/, "");
  return value ? value.slice(0, 80) : undefined;
}

export function parseFinancialNotification(raw: string, sourceApp = ""): ParsedNotification | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length < 8 || text.length > 4000) return null;

  // Decisões sobre direção antes de classificar entradas evitam confundir Pix enviado e recebido.
  const outPix = /\b(pix enviado|pix realizado|pix efetuado|pix transferido|enviou (?:um )?(?:pix|r\$)|fez um pix|transfer[eê]ncia pix enviada|pagou (?:com|via) pix)\b/i.test(text);
  const inbound = /\b(recebid[oa]|recebeu|creditad[oa]|entrada de pix|pix de entrada|pix que chegou)\b/i.test(text);
  if (outPix) {
    if (inbound && !/pix enviado|pix realizado|pix efetuado|fez um pix/i.test(text)) return null;
    const amount = amountFromNotification(text);
    if (!amount) return null;
    const person = counterpart(text, "pix");
    return { direction: "saida", amount, method: "pix", ...(person ? { person } : {}) };
  }
  if (/\bpix\b/i.test(text) && inbound) {
    const pix = parsePixNotification(text);
    return pix ? { direction: "entrada", amount: pix.gross, method: "pix", ...(pix.sender ? { person: pix.sender } : {}) } : null;
  }

  // Avisos de crédito/recebimento não podem ser confundidos com compras.
  if (/\b(recebeu|recebido|recebida|creditado|creditada|estorno recebido)\b/i.test(text)) return null;
  // Recibos da Carteira do Google podem não citar "Pix"; só aceitar se indicarem compra/pagamento.
  const wallet = /google wallet|carteira do google/i.test(sourceApp);
  const purchase = /\b(compra(?:\s+aprovada|\s+realizada|\s+efetuada)?|pagamento (?:realizado|efetuado|aprovado|confirmado)|voc[eê] pagou|pagou r\$|d[eé]bito(?:\s+aprovado)?|cart[aã]o (?:de cr[eé]dito|de d[eé]bito)|transa[cç][aã]o (?:aprovada|realizada)|pagamento por aproxima[cç][aã]o)\b/i.test(text);
  if (!purchase && !(wallet && /\b(pago|compra|cart[aã]o|pagamento|transa[cç][aã]o)\b/i.test(text))) return null;
  // Não classifica notificações de fatura disponível, limite, estorno ou falha.
  if (/\b(estorno|estornada|cancelad[oa]|recusad[oa]|negad[oa]|n[aã]o aprov|falh[ao]|fatura (?:dispon[ií]vel|fechada)|limite dispon[ií]vel)\b/i.test(text)) return null;
  const amount = amountFromNotification(text);
  if (!amount) return null;
  const method: PaymentMethod = wallet ? "carteira"
    : /\bcart[aã]o\b/i.test(text) ? "cartao" : "pagamento";
  const person = counterpart(text, method);
  return { direction: "saida", amount, method, ...(person ? { person } : {}) };
}

export type DuplicateCandidate = { id: string; amount: number; receivedAt: string; direction: "entrada" | "saida"; source: string };

export function findRelatedNotification(incoming: Omit<DuplicateCandidate, "id">, existing: DuplicateCandidate[]) {
  const incomingTime = Date.parse(incoming.receivedAt);
  if (!Number.isFinite(incomingTime)) return null;
  for (const previous of existing) {
    const elapsed = Math.abs(Date.parse(previous.receivedAt) - incomingTime);
    if (previous.direction !== incoming.direction || !Number.isFinite(elapsed) || elapsed > DUPLICATE_WINDOW_MS) continue;
    if (Math.round(previous.amount * 100) !== Math.round(incoming.amount * 100)) continue;
    // Dois aplicativos diferentes podem descrever a mesma compra de maneiras distintas.
    // Apenas sugere duplicidade: o usuário decide se é realmente a mesma operação.
    if (previous.source.toLocaleLowerCase("pt-BR") !== incoming.source.toLocaleLowerCase("pt-BR")) return previous.id;
  }
  return null;
}
