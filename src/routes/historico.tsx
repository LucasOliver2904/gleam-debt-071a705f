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
      <p className="finance-kicker">PRUMO / HISTÓRICO</p>
      <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Histórico de gastos</h1>
      <p className="mt-1 text-sm text-muted-foreground">Veja seus pagamentos e compromissos diretamente aqui, sem precisar baixar arquivos.</p>
      {state.ready ? <CategoryReport key={getFinanceUser()} state={state}/> : <p role="status" className="mt-5 text-sm text-muted-foreground">Carregando seu histórico...</p>}
    </AppShell>
  );
}
