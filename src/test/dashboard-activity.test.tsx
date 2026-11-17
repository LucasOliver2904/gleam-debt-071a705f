import type { ReactNode } from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecentActivity, WeeklyOverview } from "@/components/DashboardActivity";
import { weeklyOverview } from "@/lib/dashboard-week";
import { brl, type Debt, type State, type Tx } from "@/lib/finance";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

const empty: State = { debts: [], income: {}, txs: [] };
const today = new Date(2026, 10, 17, 14);
const moneyText = (amount: number) => brl(amount).replace(/\s/g, " ");
function bill(id: string, month: string, due: number, amount: number, paid = false): Debt {
  return { id, name: id, type: "unica", due, payments: { [month]: { amount, paid } } };
}

describe("Resumo dos próximos sete dias", () => {
  it("inclui hoje e o sétimo dia, separando atrasos e excluindo pagos e o oitavo dia", () => {
    const state: State = {
      ...empty,
      debts: [
        bill("Hoje", "2026-11", 17, 10.1),
        bill("Daqui sete dias", "2026-11", 24, 20.2),
        bill("Daqui oito dias", "2026-11", 25, 900),
        bill("Ontem", "2026-11", 16, 5.3),
        bill("Mês passado", "2026-10", 31, 15.1),
        bill("Já paga", "2026-11", 18, 100, true),
      ],
    };

    expect(weeklyOverview(state, today)).toEqual({
      upcomingCount: 2,
      upcomingAmount: 30.3,
      overdueCount: 2,
      overdueAmount: 20.4,
    });
    expect(state.debts[0]?.payments["2026-11"]?.paid).toBe(false);
  });

  it("atravessa o fim do mês sem perder vencimentos", () => {
    const state: State = {
      ...empty,
      debts: [
        bill("Janeiro", "2027-01", 31, 100),
        bill("Fevereiro", "2027-02", 4, 200),
        bill("Fora do período", "2027-02", 5, 300),
      ],
    };
    expect(weeklyOverview(state, new Date(2027, 0, 28))).toEqual({
      upcomingCount: 2,
      upcomingAmount: 300,
      overdueCount: 0,
      overdueAmount: 0,
    });
  });

  it("apresenta vencimentos e atrasos como totais separados e oferece a agenda", () => {
    render(
      <WeeklyOverview
        today={today}
        state={{
          ...empty,
          debts: [bill("Internet", "2026-11", 18, 90), bill("Aluguel", "2026-11", 10, 500)],
        }}
      />,
    );
    const upcoming = screen.getByLabelText("Contas a vencer em até sete dias");
    const overdue = screen.getByLabelText("Contas em atraso");
    expect(within(upcoming).getByText(moneyText(90))).toBeInTheDocument();
    expect(within(upcoming).getByText("1 conta para pagar")).toBeInTheDocument();
    expect(within(overdue).getByText(moneyText(500))).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver agenda" })).toHaveAttribute("href", "/agenda");
  });

  it("explica quando não há vencimentos ou atrasos", () => {
    render(<WeeklyOverview today={today} state={empty} />);
    expect(screen.getByText("Nenhuma conta neste período")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma conta atrasada")).toBeInTheDocument();
  });
});

describe("Últimas movimentações", () => {
  it("mostra as seis datas mais recentes sem modificar a ordem do histórico", () => {
    const txs: Tx[] = Array.from({ length: 7 }, (_, i) => ({
      id: String(i),
      date: `2026-11-${10 + i}`,
      description: `Movimentação ${i}`,
      amount: 10 + i,
      kind: "saida",
    }));
    render(<RecentActivity state={{ ...empty, txs }} />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(6);
    expect(within(rows[0]!).getByText("Movimentação 6")).toBeInTheDocument();
    expect(within(rows[5]!).getByText("Movimentação 1")).toBeInTheDocument();
    expect(screen.queryByText("Movimentação 0")).not.toBeInTheDocument();
    expect(txs[0]?.id).toBe("0");
    expect(screen.getByRole("link", { name: "Ver histórico" })).toHaveAttribute(
      "href",
      "/lancamentos",
    );
  });

  it("distingue uma entrada de uma compra já contabilizada na fatura", () => {
    render(
      <RecentActivity
        state={{
          ...empty,
          txs: [
            {
              id: "entrada",
              date: "2026-11-18",
              description: "Salário",
              kind: "entrada",
              amount: 2000,
            },
            {
              id: "fatura",
              date: "2026-11-17",
              description: "Mercado no cartão",
              kind: "saida",
              amount: 50,
              excludedFromTotals: true,
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("+" + moneyText(2000))).toBeInTheDocument();
    const row = screen.getByText("Mercado no cartão").closest("li")!;
    expect(within(row).getByText("Não somado")).toBeInTheDocument();
    expect(within(row).getByText(moneyText(50))).toBeInTheDocument();
    expect(within(row).queryByText("−" + moneyText(50))).not.toBeInTheDocument();
  });

  it("orienta a registrar uma movimentação quando o histórico está vazio", () => {
    render(<RecentActivity state={empty} />);
    expect(screen.getByText("Seu histórico começa aqui")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Adicionar movimentação" })).toHaveAttribute(
      "href",
      "/lancamentos",
    );
  });
});
