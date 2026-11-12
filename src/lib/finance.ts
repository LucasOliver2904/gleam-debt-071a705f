import { useSyncExternalStore } from "react";

export type DebtType = "parcelada" | "fixa" | "unica";
export const TYPE_INFO: Record<DebtType, { label: string; short: string; desc: string }> = {
  parcelada: { label: "Parcelada", short: "Parcelada", desc: "Compra dividida em X parcelas" },
  fixa: { label: "Fixa (todo mês)", short: "Fixa", desc: "Conta recorrente, repete todos os meses" },
  unica: { label: "Só este mês", short: "Única", desc: "Paga uma única vez, em um mês" },
};
export const CATEGORIES = ["Cartão", "Empréstimo", "Compras", "Alimentação", "Mercado", "Pix", "Moradia", "Contas da casa", "Assinaturas", "Transporte", "Saúde", "Educação", "Lazer", "Pessoas", "Outros"] as const;
export type Recurring = { amount: number; start: string; end?: string | undefined };
export type Payment = { amount: number; paid: boolean };
export type Debt = { id: string; name: string; type: DebtType; due?: number | undefined; category?: string | undefined; note?: string | undefined; recurring?: Recurring | undefined; skipped?: string[] | undefined; payments: Record<string, Payment> };
export type PixData = {
  gross: number;
  kept: number;
  status: "pendente" | "repassado";
  source: "manual" | "texto";
  sender?: string;
  bank?: string;
};
export type Tx = { id: string; date: string; description: string; amount: number; kind: "entrada" | "saida"; category?: string; pix?: PixData };
export type SavingsGoal = { id: string; name: string; target: number; saved: number; deadline?: string; createdAt: string };
export type State = { debts: Debt[]; income: Record<string, number>; txs: Tx[]; reminderConfig?: { enabled: boolean; daysBefore: number[]; showDetails: boolean }; budgets?: Record<string, Record<string, number>>; savingsGoals?: SavingsGoal[] };

export const dueLabel = (d: Debt) => (d.due ? `Vence dia ${String(d.due).padStart(2, "0")}` : "");
const KEY = "minhas-financas-v1";
const CURRENT = "2026-10";

export const uid = () => Math.random().toString(36).slice(2, 10);

export function addMonths(m: string, n: number) {
  const [y = 2026, mo = 1] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_L = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
export const monthLabel = (m: string, long = false) => {
  const [y = 2026, mo = 1] = m.split("-").map(Number);
  return `${(long ? MESES_L : MESES)[mo - 1]}/${String(y).slice(long ? 0 : 2)}`;
};
export const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function parseMoney(raw: string): number {
  const clean = raw.replace(/R\$/gi, "").replace(/\s/g, "");
  const value = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : Number.NaN;
}
export function localToday() {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
}

function seed(): State {
  const start = "2026-08";
  const mk = (name: string, type: DebtType, vals: (number | null)[]): Debt => {
    const payments: Record<string, Payment> = {};
    vals.forEach((v, i) => {
      if (v == null) return;
      const m = addMonths(start, i);
      payments[m] = { amount: v, paid: m <= CURRENT };
    });
    return fixDue({ id: uid(), name, type, payments });
  };
  const r = (v: number, n: number) => Array(n).fill(v);
  const debts = [
    mk("Máq. Barb + Remed. + Bingo (Sandra)", "parcelada", [156.74, 360.71, 360.71, 712.09]),
    mk("Bradescard", "parcelada", r(53.32, 7)),
    mk("Bicicleta (Sônia)", "parcelada", [166, 166, null, ...r(166, 7)]),
    mk("Itaú 1", "parcelada", r(65.78, 7)),
    mk("Nacional", "parcelada", r(70, 9)),
    mk("Raquete (Julia)", "parcelada", [280, 280, ...r(290, 8)]),
    mk("Guido Chato", "parcelada", [180, 120, 169.9]),
    mk("Shopee (01)", "parcelada", r(19.6, 4)),
    mk("Shopee (03)", "parcelada", r(72.48, 5)),
    mk("Shopee (16)", "parcelada", [90.81, 90.81, 90.77]),
    mk("Shopee (16) B", "parcelada", r(133.33, 4)),
    mk("Shopee (19)", "parcelada", r(78.62, 5)),
    mk("Shopee (20)", "parcelada", r(46.5, 8)),
    mk("Shopee (21)", "parcelada", [null, null, ...r(480, 8)]),
    mk("Shopee (28)", "parcelada", r(104.84, 3)),
    mk("Shopee (28) B", "parcelada", r(84.9, 5)),
    mk("Sicredi", "parcelada", r(630, 10)),
    mk("Lucas (Aulas Beach)", "fixa", [90, 180, 225, ...r(180, 7)]),
    mk("Spotify", "fixa", r(40.9, 10)),
    mk("Netflix", "fixa", [null, ...r(59.9, 9)]),
    mk("TIM", "fixa", r(38, 10)),
  ];
  const sal = [2750, 2750, 2750, 2600, 2600, 2600, 2600, 2600, 2800, 2814.55];
  const income: Record<string, number> = {};
  sal.forEach((v, i) => (income[addMonths(start, i)] = v));
  return { debts, income, txs: [] };
}

// "Shopee (16)" => name "Shopee", due 16. "(16) B" => name "Shopee B".
export function fixDue(d: Debt): Debt {
  const m = d.name.match(/\s*\((\d{1,2})\)\s*/);
  if (!m || d.due) return d;
  const name = d.name.replace(m[0], " ").replace(/\s+/g, " ").trim();
  return { ...d, name, due: Number(m[1]) };
}

const HORIZON = 12; // meses à frente gerados para contas fixas
function normalizeDebt(d0: Debt): Debt {
  let d = fixDue(d0);
  if (!d.category) d = { ...d, category: guessCategory(d) };
  if (d.type !== "fixa") return d.recurring ? { ...d, recurring: undefined } : d;
  const keys = Object.keys(d.payments).sort();
  let rec = d.recurring;
  if (!rec) {
    const last = keys[keys.length - 1];
    rec = { amount: last ? d.payments[last]!.amount : 0, start: keys[0] ?? currentMonth() };
    d = { ...d, recurring: rec };
  }
  const limit = addMonths(currentMonth(), HORIZON);
  const stop = rec.end && rec.end < limit ? rec.end : limit;
  const skip = new Set(d.skipped ?? []);
  let payments = d.payments;
  // remove meses depois do encerramento
  if (rec.end) for (const k of keys) if (k > rec.end && !payments[k]!.paid) { if (payments === d.payments) payments = { ...payments }; delete payments[k]; }
  for (let m = rec.start; m <= stop; m = addMonths(m, 1)) {
    if (!payments[m] && !skip.has(m)) { if (payments === d.payments) payments = { ...payments }; payments[m] = { amount: rec.amount, paid: false }; }
  }
  return payments === d.payments ? d : { ...d, payments };
}
function guessCategory(d: Debt) {
  const n = d.name.toLowerCase();
  if (/spotify|netflix|prime|disney|hbo|youtube/.test(n)) return "Assinaturas";
  if (/tim|vivo|claro|oi |luz|água|agua|internet|energia/.test(n)) return "Contas da casa";
  if (/shopee|mercado|amazon|magalu/.test(n)) return "Compras";
  if (/card|cartão|cartao|nubank|itaú|itau|nacional/.test(n)) return "Cartão";
  if (/sicredi|empr|banco/.test(n)) return "Empréstimo";
  if (/aula|curso|escola/.test(n)) return "Educação";
  if (/\(/.test(d.name)) return "Pessoas";
  return "Outros";
}
function normalize(s: State): State {
  return { ...s, debts: s.debts.map(normalizeDebt) };
}

export function skipMonth(id: string, m: string) {
  setState((s) => ({ ...s, debts: s.debts.map((d) => {
    if (d.id !== id) return d;
    const payments = { ...d.payments }; delete payments[m];
    return { ...d, payments, skipped: d.type === "fixa" ? [...new Set([...(d.skipped ?? []), m])] : d.skipped };
  }) }));
}

export function exportBackup() {
  return JSON.stringify(load(), null, 2);
}
export function importBackup(json: string) {
  const data = JSON.parse(json) as State;
  if (!Array.isArray(data.debts) || typeof data.income !== "object" || !Array.isArray(data.txs)) throw new Error("Arquivo inválido");
  setState(() => data);
}
export function resetAll(withExample: boolean) {
  setState(() => (withExample ? seed() : { debts: [], income: {}, txs: [] }));
}

export type Alert = { d: Debt; m: string; amount: number; status: "atrasada" | "hoje" | "breve" };
export function alerts(s: State): Alert[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const limit = new Date(today);
  limit.setDate(limit.getDate() + 7);
  const out: Alert[] = [];
  s.debts.forEach((d) => Object.entries(d.payments).forEach(([m, p]) => {
    if (p.paid) return;
    const [year, month] = m.split("-").map(Number);
    if (!year || !month || month < 1 || month > 12) return;
    const lastDay = new Date(year, month, 0).getDate();
    const dueDate = new Date(year, month - 1, Math.min(d.due ?? lastDay, lastDay));
    if (dueDate > limit) return;
    const status = dueDate < today ? "atrasada" : dueDate.getTime() === today.getTime() ? "hoje" : "breve";
    out.push({ d, m, amount: p.amount, status });
  }));
  const rank = { atrasada: 0, hoje: 1, breve: 2 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || a.m.localeCompare(b.m) || (a.d.due ?? 99) - (b.d.due ?? 99));
}

export function debtFreeMonth(s: State) {
  let last = "";
  s.debts.forEach((d) => { if (d.type === "fixa") return; Object.entries(d.payments).forEach(([m, p]) => { if (!p.paid && m > last) last = m; }); });
  return last || null;
}

let state: State | null = null;
const listeners = new Set<() => void>();
function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : seed();
    state = normalize(state!);
  } catch {
    state = seed();
  }
  return state!;
}
let syncHandler: ((s: State) => void) | null = null;
export function setSyncHandler(h: ((s: State) => void) | null) {
  syncHandler = h;
}
export function getState() {
  return load();
}
export function applyRemote(s: State) {
  state = normalize(s);
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}
export function setState(fn: (s: State) => State) {
  state = normalize(fn(load()));
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
  syncHandler?.(state);
}
const EMPTY: State = { debts: [], income: {}, txs: [] };
export function useFinance(): State & { ready: boolean } {
  const s = useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => load(),
    () => EMPTY,
  );
  return { ...s, ready: s !== EMPTY };
}

export function allMonths(s: State) {
  const set = new Set<string>(Object.keys(s.income));
  s.debts.forEach((d) => Object.keys(d.payments).forEach((m) => set.add(m)));
  s.txs.forEach((t) => set.add(t.date.slice(0, 7)));
  return [...set].sort();
}

export function monthSummary(s: State, m: string) {
  let debts = 0, paid = 0;
  s.debts.forEach((d) => {
    const p = d.payments[m];
    if (p) { debts += p.amount; if (p.paid) paid += p.amount; }
  });
  const txIn = s.txs.filter((t) => t.date.startsWith(m) && t.kind === "entrada").reduce((a, t) => a + t.amount, 0);
  const txOut = s.txs.filter((t) => t.date.startsWith(m) && t.kind === "saida").reduce((a, t) => a + t.amount, 0);
  const income = (s.income[m] ?? 0) + txIn;
  const out = debts + txOut;
  return { debts, paid, pending: debts - paid, income, out, balance: income - out };
}

export function debtRemaining(d: Debt) {
  const ps = Object.entries(d.payments).filter(([m]) => d.type !== "fixa" || m <= currentMonth()).map(([, p]) => p);
  const open = ps.filter((p) => !p.paid);
  return { total: ps.reduce((a, p) => a + p.amount, 0), remaining: open.reduce((a, p) => a + p.amount, 0), left: open.length, count: ps.length };
}
