import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { BadgePercent, Calculator, EyeOff, Scale } from "lucide-react";
import { DebtPayoffSimulator } from "./DebtPayoffSimulator";
import { PurchaseComparison } from "./PurchaseComparison";
import { PurchaseSimulator } from "./PurchaseSimulator";
import { setMoneyHidden, useMoneyPrivacy } from "@/lib/money-privacy";
import type { State } from "@/lib/finance";

declare module "@tanstack/history" {
  interface HistoryState {
    payoffDebtId?: string;
  }
}

const simulators = [
  { id: "cabe-no-meu-mes", label: "Simular compra", icon: Calculator },
  { id: "comparar-compra", label: "Comparar preços", icon: Scale },
  { id: "antecipar-parcelas", label: "Antecipar parcelas", icon: BadgePercent },
] as const;

export function PlanningSimulators({ state }: { state: State }) {
  const hash = useRouterState({ select: (router) => router.location.hash.replace(/^#/, "") });
  const debtId = useRouterState({ select: (router) => router.location.state.payoffDebtId });
  const active = simulators.find((item) => item.id === hash) ?? simulators[0];
  const group = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const hidden = useMoneyPrivacy();

  useEffect(() => {
    if (hash !== active.id || nav.current?.contains(document.activeElement)) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(hash)?.focus({ preventScroll: true });
      group.current?.scrollIntoView({ block: "start" });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash, active.id]);

  return (
    <div ref={group} data-planning-simulators className="mt-6 min-w-0 scroll-mt-20">
      <nav
        ref={nav}
        aria-label="Simuladores de planejamento"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-secondary/40 p-1"
      >
        {simulators.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            to="/planejamento"
            hash={id}
            state={(previous) => previous}
            replace
            resetScroll={false}
            hashScrollIntoView={false}
            activeOptions={{ exact: true, includeHash: true }}
            aria-current={active.id === id ? "location" : undefined}
            className={
              "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center text-xs font-bold leading-tight transition-colors focus-visible:outline-primary sm:flex-row sm:gap-2 sm:text-sm " +
              (id === active.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground")
            }
          >
            <Icon aria-hidden="true" size={17} />
            {label}
          </Link>
        ))}
      </nav>
      {hidden ? (
        <section
          id={active.id}
          tabIndex={-1}
          className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5"
        >
          <p className="flex items-center gap-2 text-sm font-semibold">
            <EyeOff aria-hidden="true" size={18} /> Valores da simulação ocultos
          </p>
          <button
            type="button"
            onClick={() => setMoneyHidden(false)}
            className="min-h-11 rounded-xl border border-primary/40 px-3 text-sm font-bold text-primary"
          >
            Mostrar valores para simular
          </button>
        </section>
      ) : active.id === "antecipar-parcelas" ? (
        <DebtPayoffSimulator key={debtId} state={state} initialDebtId={debtId} />
      ) : active.id === "comparar-compra" ? (
        <PurchaseComparison state={state} />
      ) : (
        <PurchaseSimulator state={state} />
      )}
    </div>
  );
}
