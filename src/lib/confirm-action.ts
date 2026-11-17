import { getFinanceUser } from "./finance";

export type ConfirmOptions = {
  title?: string;
  confirmLabel?: string;
  tone?: "danger" | "warning" | "default";
};
export type ConfirmRequest = ConfirmOptions & {
  id: number;
  owner: string | null;
  description: string;
};
let request: ConfirmRequest | null = null;
let finish: ((accepted: boolean) => void) | null = null;
let sequence = 0;
let hosts = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
export const getConfirmation = () => request;
export function subscribeConfirmation(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function settleConfirmation(id: number, accepted: boolean) {
  if (!request || request.id !== id) return;
  const allowed = accepted && request.owner === getFinanceUser();
  const resolve = finish;
  request = null;
  finish = null;
  emit();
  resolve?.(allowed);
}
export function mountConfirmationHost() {
  hosts++;
  return () => {
    hosts--;
    if (!hosts && request) settleConfirmation(request.id, false);
  };
}
/** A missing/unmounted host or a changed account always cancels the operation. */
export function confirmAction(description: string, options: ConfirmOptions = {}): Promise<boolean> {
  if (request) settleConfirmation(request.id, false);
  if (!hosts) return Promise.resolve(false);
  return new Promise((resolve) => {
    finish = resolve;
    const destructive = /^(Excluir|Remover|Apagar)/i.test(description);
    request = {
      title: destructive ? "Confirmar exclusão" : "Conferir antes de continuar",
      confirmLabel: destructive ? "Excluir" : "Continuar",
      tone: destructive ? "danger" : "default",
      ...options,
      id: ++sequence,
      owner: getFinanceUser(),
      description,
    };
    emit();
  });
}
