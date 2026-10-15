import { useSyncExternalStore } from "react";

export type DebtType = "parcelada" | "fixa";
export type Payment = { amount: number; paid: boolean };
export type Debt = { id: string; name: string; type: DebtType; due?: number | undefined; payments: Record<string, Payment> };
export type Tx = { id: string; date: string; description: string; amount: number; kind: "entrada" | "saida" };
export type State = { debts: Debt[]; income: Record<string, number>; txs: Tx[] };

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

let state: State | null = null;
const listeners = new Set<() => void>();
function load(): State {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? JSON.parse(raw) : seed();
    state = { ...state!, debts: state!.debts.map(fixDue) };
  } catch {
    state = seed();
  }
  return state!;
}
export function setState(fn: (s: State) => State) {
  state = fn(load());
  localStorage.setItem(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
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
  const ps = Object.values(d.payments);
  const open = ps.filter((p) => !p.paid);
  return { total: ps.reduce((a, p) => a + p.amount, 0), remaining: open.reduce((a, p) => a + p.amount, 0), left: open.length, count: ps.length };
}
