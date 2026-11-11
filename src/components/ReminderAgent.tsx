import { useEffect } from "react";
import { useFinance } from "@/lib/finance";
import { maybeNotifyDue, reminderConfig } from "@/lib/reminders";

/**
 * Enquanto o app está aberto, verifica vencimentos ao iniciar, ao voltar
 * para a aba e periodicamente. Push com o app fechado exige um emissor
 * remoto (não é oferecido apenas pela permissão do navegador).
 */
export function ReminderAgent() {
  const state = useFinance();
  useEffect(() => {
    if (!state.ready || !reminderConfig(state).enabled) return;
    const check = () => {
      if (document.visibilityState === "visible") void maybeNotifyDue(state);
    };
    check();
    const timer = window.setInterval(check, 15 * 60 * 1000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [state.ready, state.debts, state.reminderConfig]);
  return null;
}
