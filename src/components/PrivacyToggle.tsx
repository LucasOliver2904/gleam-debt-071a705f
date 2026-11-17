import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { setMoneyHidden, useMoneyPrivacy } from "@/lib/money-privacy";

export function PrivacyToggle({ compact = false }: { compact?: boolean }) {
  const hidden = useMoneyPrivacy();
  const [sessionOnly, setSessionOnly] = useState(false);
  const label = hidden ? "Mostrar valores" : "Ocultar valores";
  return (
    <div className={compact ? "" : "mb-2"}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={hidden}
        title={label}
        onClick={() => setSessionOnly(!setMoneyHidden(!hidden))}
        className={
          compact
            ? "grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-border bg-card text-muted-foreground transition hover:text-primary"
            : "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        }
      >
        {hidden ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        {!compact && <span>{label}</span>}
      </button>
      <span role="status" className="sr-only">
        {hidden ? "Valores monetários ocultos." : "Valores monetários visíveis."}
        {sessionOnly &&
          " A preferência vale nesta sessão. O navegador não permitiu salvá-la neste aparelho."}
      </span>
    </div>
  );
}
