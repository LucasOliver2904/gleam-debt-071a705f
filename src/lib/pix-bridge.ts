import { parsePixNotification } from "./pix";

export const AUTOMATION_KEY_BYTES = 32;
export const AUTOMATION_KEY_LENGTH = AUTOMATION_KEY_BYTES * 2;

export async function digestAutomationKey(token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/i.test(token)) throw new Error("Chave inválida");
  const bytes = new TextEncoder().encode(token.toLowerCase());
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}

export function generateAutomationKey() {
  const bytes = new Uint8Array(AUTOMATION_KEY_BYTES);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => n.toString(16).padStart(2, "0")).join("");
}

export function parseIncomingPixNotification(raw: string) {
  if (raw.length > 4000 || raw.length < 10) return null;
  return parsePixNotification(raw);
}

export async function fingerprintNotification(raw: string, bank: string) {
  const bytes = new TextEncoder().encode(
    bank.trim().toLowerCase() + "\n" + raw.replace(/\s+/g, " ").trim().toLowerCase(),
  );
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, "0")).join("");
}
