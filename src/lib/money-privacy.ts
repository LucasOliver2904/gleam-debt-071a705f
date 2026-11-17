import { useSyncExternalStore } from "react";

export const MONEY_PRIVACY_KEY = "prumo-money-hidden";
export const MASKED_MONEY = "••••";

let initialized = false;
let hidden = false;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((listener) => listener());
}

function initialize() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    hidden = localStorage.getItem(MONEY_PRIVACY_KEY) === "true";
  } catch {
    // The control still works for this session when device storage is unavailable.
  }
  window.addEventListener("storage", (event) => {
    if (event.key !== MONEY_PRIVACY_KEY && event.key !== null) return;
    hidden = event.key === null ? false : event.newValue === "true";
    emit();
  });
}

/** Read before formatting: a saved hidden preference must never flash an amount. */
export function getMoneyHidden() {
  initialize();
  return hidden;
}

/** Returns whether the preference was saved beyond the current session. */
export function setMoneyHidden(next: boolean): boolean {
  initialize();
  hidden = next;
  let persisted = true;
  try {
    localStorage.setItem(MONEY_PRIVACY_KEY, String(next));
  } catch {
    persisted = false;
  }
  emit();
  return persisted;
}

export function useMoneyPrivacy() {
  return useSyncExternalStore(
    (listener) => {
      initialize();
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getMoneyHidden,
    () => false,
  );
}

/** For files and internal comparisons: never apply a display preference to data. */
export function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function displayMoney(value: number) {
  return getMoneyHidden() ? MASKED_MONEY : formatMoney(value);
}
