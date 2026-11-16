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
  source: "manual" | "texto" | "automacao";
  sender?: string;
  bank?: string;
  fingerprint?: string;
  receivedAt?: string;
};
export type PixInboxItem = {
  id: string;
  date: string;
  receivedAt: string;
  gross: number;
  sender?: string;
  bank?: string;
  fingerprint: string;
};
export type ExpenseInboxItem = {
  id: string;
  amount: number;
  date: string;
  receivedAt: string;
  source: string;
  method: "pix" | "cartao" | "carteira" | "pagamento";
  fingerprint: string;
  person?: string;
  possibleDuplicateOf?: string;
};
export type ExpenseAuto = {
  receivedAt: string;
  fingerprint: string;
  source: string;
  method: "pix" | "cartao" | "carteira" | "pagamento";
};
export type Tx = { id: string; date: string; description: string; amount: number; kind: "entrada" | "saida"; category?: string; pix?: PixData; expenseAuto?: ExpenseAuto; excludedFromTotals?: boolean; statement?: { source: string; importedAt: string } };
export type SavingsGoal = { id: string; name: string; target: number; saved: number; deadline?: string; createdAt: string };
export type State = { debts: Debt[]; income: Record<string, number>; txs: Tx[]; reminderConfig?: { enabled: boolean; daysBefore: number[]; showDetails: boolean }; budgets?: Record<string, Record<string, number>>; savingsGoals?: SavingsGoal[]; pixInbox?: PixInboxItem[] | undefined; expenseInbox?: ExpenseInboxItem[] | undefined; handledInboxIds?: string[] | undefined; pixAutomationHash?: string | undefined };

export const dueLabel = (d: Debt) => (d.due ? `Vence dia ${String(d.due).padStart(2, "0")}` : "");
// Chaves locais separadas por UID. Nunca expor os dados de outra conta ao trocar login.
const LEGACY_KEY = "minhas-financas-v1";
const KEY_PREFIX = "meu-caixa-private-v2:";
let activeFinanceUser: string | null = null;
function storageKey() { return activeFinanceUser ? KEY_PREFIX + activeFinanceUser : null; }
export function setFinanceUser(userId: string | null) {
  if (userId === activeFinanceUser) return;
  activeFinanceUser = userId;
  state = null;
  listeners.forEach((listener) => listener());
}
export function hasLegacyLocalBackup() {
  return typeof localStorage !== "undefined" && localStorage.getItem(LEGACY_KEY) !== null;
}
export function legacyLocalBackup() {
  return typeof localStorage === "undefined" ? null : localStorage.getItem(LEGACY_KEY);
}
export const uid = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

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
  // Apenas dados FICTÍCIOS para demonstração em perfis novos.
  // Nunca expor dívidas ou dados pessoais reais como exemplos no código.
  const now = currentMonth();
  const start = addMonths(now, -2);
  const mk = (name: string, type: DebtType, vals: (number | null)[]): Debt => {
    const payments: Record<string, Payment> = {};
    vals.forEach((value, index) => {
      if (value === null) return;
      const month = addMonths(start, index);
      payments[month] = { amount: value, paid: month < now };
    });
    return fixDue({ id: uid(), name, type, payments });
  };
  const repeat = (value: number, count: number): number[] => Array(count).fill(value);
  const debts = [
    mk("Cartão Aurora (10)", "parcelada", repeat(142.5, 8)),
    mk("Notebook (05)", "parcelada", repeat(389.9, 10)),
    mk("Reforma da cozinha (15)", "parcelada", repeat(450, 6)),
    mk("Empréstimo Horizonte (20)", "parcelada", repeat(620, 12)),
    mk("Geladeira (08)", "parcelada", repeat(215.4, 5)),
    mk("Curso de inglês (12)", "fixa", repeat(189.9, 8)),
    mk("Internet (10)", "fixa", repeat(99.9, 8)),
    mk("Streaming (22)", "fixa", repeat(39.9, 8)),
    mk("Plano de celular (18)", "fixa", repeat(49.9, 8)),
    mk("Academia (03)", "fixa", repeat(109.9, 8)),
  ];
  const income: Record<string, number> = {};
  [3200, 3200, 3200, 3200, 3200, 3350, 3350, 3350].forEach((value, index) => {
    income[addMonths(start, index)] = value;
  });
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
  // Nunca incluir o hash de pareamento em backups: restauração não pode reativar
  // uma chave que já foi revogada ou transferi-la para outra conta.
  const { pixAutomationHash: _ignored, ...backup } = load();
  return JSON.stringify(backup, null, 2);
}
export function importBackup(json: string) {
  if (json.length > 15_000_000) throw new Error("Arquivo muito grande");
  const data = JSON.parse(json) as State;
  if (!data || !Array.isArray(data.debts) ||
      !data.income || typeof data.income !== "object" ||
      !Array.isArray(data.txs)) throw new Error("Arquivo inválido");
  setState((current) => ({
    ...data,
    pixAutomationHash: current.pixAutomationHash,
    // Não perde avisos chegados do Android enquanto um backup era restaurado.
    pixInbox: current.pixInbox,
    expenseInbox: current.expenseInbox,
    handledInboxIds: current.handledInboxIds,
  }));
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
  const key = storageKey();
  if (!key || typeof localStorage === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(key);
    // Não importa o legado automaticamente: poderia ser de outro login no mesmo aparelho.
    state = normalize(raw ? JSON.parse(raw) as State : { debts: [], income: {}, txs: [] });
  } catch {
    // Se o cache está corrompido, o Supabase ainda pode ter a cópia válida.
    state = { debts: [], income: {}, txs: [] };
  }
  return state;
}
let syncHandler: ((s: State) => void) | null = null;
export function setSyncHandler(h: ((s: State) => void) | null) {
  syncHandler = h;
}
export function getState() {
  return load();
}
export function applyRemote(s: State) {
  const key = storageKey();
  if (!key) return;
  state = normalize(s);
  localStorage.setItem(key, JSON.stringify(state));
  listeners.forEach((l) => l());
}
export function setState(fn: (s: State) => State) {
  const key = storageKey();
  if (!key) return; // Proíbe edição local sem usuário autenticado.
  state = normalize(fn(load()));
  localStorage.setItem(key, JSON.stringify(state));
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
  const txOut = s.txs.filter((t) => t.date.startsWith(m) && t.kind === "saida" && !t.excludedFromTotals).reduce((a, t) => a + t.amount, 0);
  const income = (s.income[m] ?? 0) + txIn;
  const out = debts + txOut;
  return { debts, paid, pending: debts - paid, income, out, balance: income - out };
}

/** Dívida a quitar: exclui contas fixas recorrentes, que são compromissos futuros
 * e não saldo de financiamento/parcelas em aberto. */
export function outstandingDebtBalance(state: State) {
  return state.debts
    .filter((debt) => debt.type !== "fixa")
    .reduce((sum, debt) => sum + debtRemaining(debt).remaining, 0);
}

export function debtRemaining(d: Debt) {
  const ps = Object.entries(d.payments).filter(([m]) => d.type !== "fixa" || m <= currentMonth()).map(([, p]) => p);
  const open = ps.filter((p) => !p.paid);
  return { total: ps.reduce((a, p) => a + p.amount, 0), remaining: open.reduce((a, p) => a + p.amount, 0), left: open.length, count: ps.length };
}
