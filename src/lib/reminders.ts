import { brl, type Debt, type State } from "./finance";

export type ReminderConfig = {
  enabled: boolean;
  daysBefore: number[];
  showDetails: boolean;
};
export const DEFAULT_REMINDER_CONFIG: ReminderConfig = {
  enabled: false,
  daysBefore: [0, 1, 3, 7],
  showDetails: false,
};

export function reminderConfig(state: State): ReminderConfig {
  const config = state.reminderConfig;
  return {
    enabled: config?.enabled === true,
    daysBefore: (config?.daysBefore ?? DEFAULT_REMINDER_CONFIG.daysBefore)
      .filter((d) => Number.isInteger(d) && d >= 0 && d <= 30),
    showDetails: config?.showDetails === true,
  };
}

export type UpcomingBill = {
  debt: Debt;
  month: string;
  amount: number;
  date: Date;
  daysUntil: number;
};

export function upcomingBills(state: State, horizonDays = 30, today = new Date()): UpcomingBill[] {
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const entries: UpcomingBill[] = [];
  for (const debt of state.debts) {
    for (const [month, payment] of Object.entries(debt.payments)) {
      if (payment.paid) continue;
      const [year, index] = month.split("-").map(Number);
      if (!year || !index || index < 1 || index > 12) continue;
      const lastDay = new Date(year, index, 0).getDate();
      const day = Math.min(Math.max(1, debt.due ?? lastDay), lastDay);
      const date = new Date(year, index - 1, day);
      const daysUntil = Math.round((Date.UTC(year, index - 1, day) - todayUtc) / 86400000);
      if (daysUntil <= horizonDays) {
        entries.push({ debt, month, amount: payment.amount, date, daysUntil });
      }
    }
  }
  return entries.sort((a, b) => a.daysUntil - b.daysUntil || a.debt.name.localeCompare(b.debt.name, "pt-BR"));
}

export function notificationCandidates(state: State, today = new Date()): UpcomingBill[] {
  const settings = reminderConfig(state);
  const maxDays = Math.max(0, ...settings.daysBefore);
  return upcomingBills(state, maxDays, today).filter(
    (bill) => bill.daysUntil < 0 || settings.daysBefore.includes(bill.daysUntil),
  );
}

function localDateKey(today: Date) {
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0"),
  ].join("-");
}

export async function maybeNotifyDue(state: State): Promise<boolean> {
  const settings = reminderConfig(state);
  if (!settings.enabled || typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted" || !("serviceWorker" in navigator)) return false;
  const bills = notificationCandidates(state);
  if (bills.length === 0) return false;
  const today = localDateKey(new Date());
  const key = "meu-caixa-notified-date";
  if (localStorage.getItem(key) === today) return false;
  const overdue = bills.filter((b) => b.daysUntil < 0).length;
  const amount = bills.reduce((total, b) => total + b.amount, 0);
  const title = overdue > 0
    ? "Prumo: " + overdue + " conta(s) atrasada(s)"
    : "Prumo: " + bills.length + " conta(s) para acompanhar";
  const body = settings.showDetails
    ? bills.length + " conta(s), total de " + brl(amount) + ". Próxima: " + bills[0]!.debt.name + "."
    : "Você tem contas em aberto ou com vencimento próximo. Confira seu painel.";
  try {
    const worker = await navigator.serviceWorker.ready;
    await worker.showNotification(title, {
      body,
      icon: "/icons/icon-192.png",
      badge: "/favicon.png",
      tag: "meu-caixa-vencimentos",
      data: { url: "/" },
    });
    localStorage.setItem(key, today);
    return true;
  } catch (error) {
    console.warn("Não foi possível mostrar o lembrete do Prumo.", error);
    return false;
  }
}
