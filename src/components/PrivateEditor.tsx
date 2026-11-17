import type { ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { setMoneyHidden, useMoneyPrivacy } from "@/lib/money-privacy";

/** Prefilled forms are disclosed only after the user explicitly reveals values. */
export function PrivateEditor({
  children,
  active = true,
}: {
  children: ReactNode;
  active?: boolean;
}) {
  const hidden = useMoneyPrivacy();
  if (!active || !hidden) return <>{children}</>;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4 text-sm">
      <p className="flex items-center gap-2 font-semibold">
        <EyeOff size={18} />
        Valores ocultos
      </p>
      <p className="leading-relaxed text-muted-foreground">
        Este formulário contém valores já cadastrados. Mostre os valores para conferir e editar com
        segurança.
      </p>
      <button
        type="button"
        className="min-h-11 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
        onClick={() => setMoneyHidden(false)}
      >
        Mostrar valores para editar
      </button>
    </div>
  );
}
