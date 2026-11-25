import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CategoryReport } from "@/components/CategoryReport";
import { getFinanceUser, useFinance } from "@/lib/finance";

export const Route = createFileRoute("/historico")({
  head: () => ({ meta: [
    { title: "Histórico de gastos — Prumo" },
    { name: "description", content: "Consulte seus gastos por categoria, data e mês." },
  ] }),
  component: Historico,
});

function Historico() {
  const state = useFinance();
  return (
    <AppShell>
      <header className="prumo-page-heading"><h1>Histórico de gastos</h1></header>
      <p className="mt-2 text-sm text-muted-foreground">Consulte quanto você pagou e o que ficou pendente em cada categoria.</p>
      {state.ready ? <CategoryReport key={getFinanceUser()} state={state}/> : <p role="status" className="mt-5 text-sm text-muted-foreground">Carregando seu histórico...</p>}
    </AppShell>
  );
}
