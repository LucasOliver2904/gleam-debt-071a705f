import { parseMoney } from "./finance";

/** A leitura de texto é apenas uma sugestão: nunca confirma recebimento bancário. */
export type ParsedPix = { gross: number; sender?: string };

export function parsePixNotification(raw: string): ParsedPix | null {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length < 10 || text.length > 4000 || !/\bpix\b/i.test(text)) return null;
  const credited = /\b(recebid[oa]|recebeu|creditad[oa]|entrada de pix|pix de entrada|pix que chegou)\b/i.test(text);
  const outgoing = /\b(pix enviado|pix realizado|pix efetuado|voc[eê] enviou|transfer[eê]ncia enviada|pagamento realizado)\b/i.test(text);
  if (!credited || outgoing) return null;
  const amountMatch = text.match(/R\$\s*([\d.]+,\d{2}|[\d.]+)/i);
  if (!amountMatch?.[1]) return null;
  const gross = parseMoney(amountMatch[1]);
  if (!(gross > 0) || gross > 1_000_000_000) return null;
  const nameMatch = text.match(/(?:de|por|remetente:)\s+([\p{L}][\p{L}\p{M}\s.'-]{1,70})/iu);
  const sender = nameMatch?.[1]?.replace(/\s+(?:no|na|para|em|via)\s*$/i, "").trim();
  return { gross, ...(sender ? { sender } : {}) };
}

export type PixAllocation = { gross: number; kept: number; toPassOn: number };

export function pixAllocation(grossInput: string, keptInput: string): PixAllocation | null {
  const gross = parseMoney(grossInput);
  const kept = keptInput.trim() === "0" || /^0(?:[,.]0{1,2})?$/.test(keptInput.trim())
    ? 0
    : parseMoney(keptInput);
  if (!Number.isFinite(gross) || !Number.isFinite(kept) || kept < 0 || kept > gross) return null;
  return { gross, kept, toPassOn: Math.round((gross - kept) * 100) / 100 };
}
