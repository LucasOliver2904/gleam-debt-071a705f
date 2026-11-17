import type { ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardHome } from "@/components/DashboardHome";
import { FirstSteps } from "@/components/FirstSteps";
import {
  applyRemote,
  currentMonth,
  getState,
  setFinanceUser,
  useFinance,
  type State,
} from "@/lib/finance";
import { setMoneyHidden } from "@/lib/money-privacy";
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));
const empty: State = { debts: [], txs: [], income: {} };
beforeEach(() => {
  setMoneyHidden(false);
  setFinanceUser("new-user");
  applyRemote(empty);
});
afterEach(() => {
  cleanup();
  setFinanceUser(null);
  localStorage.clear();
  setMoneyHidden(false);
});
function Guide() {
  const state = useFinance();
  return <FirstSteps state={state} />;
}
describe("Clareza das finanças e primeiros passos", () => {
  it("distingue renda prevista das entradas registradas sem mudar o cálculo", () => {
    const month = currentMonth();
    render(
      <DashboardHome
        month={month}
        onPay={vi.fn()}
        state={{
          income: { [month]: 2000 },
          debts: [
            {
              id: "bill",
              name: "Conta",
              type: "unica",
              payments: { [month]: { amount: 100, paid: true } },
            },
          ],
          txs: [
            { id: "in", date: month + "-01", amount: 300, kind: "entrada", description: "Extra" },
            { id: "out", date: month + "-01", amount: 50, kind: "saida", description: "Compra" },
          ],
        }}
      />,
    );
    expect(screen.getByRole("tab", { name: "Previsão" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Entradas previstas")).toBeInTheDocument();
    expect(screen.queryByText("Entrou")).not.toBeInTheDocument();
    const details = screen.getByText("Como calculamos esta previsão").closest("details")!;
    expect(details).toHaveTextContent("Renda base prevista");
    expect(details).toHaveTextContent("Entradas registradas");
    expect(details).toHaveTextContent("2.000,00");
    expect(details).toHaveTextContent("300,00");
    expect(screen.getByText(/2\.150,00/)).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("tab", { name: "Previsão" }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: "A pagar" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "A pagar" })).toHaveFocus();
  });
  it("guia uma conta vazia e aceita renda zero, sem criar movimentação fictícia", () => {
    render(<Guide />);
    expect(screen.getByText(/0 de 3 passos/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Adicionar uma conta/ })).toHaveAttribute(
      "href",
      "/dividas",
    );
    fireEvent.click(screen.getByRole("button", { name: /Definir renda prevista/ }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Renda base prevista (R$)"), {
      target: { value: "0" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Salvar renda prevista" }));
    expect(getState().income[currentMonth()]).toBe(0);
    expect(getState().txs).toHaveLength(0);
    expect(screen.getByText(/1 de 3 passos/)).toBeInTheDocument();
  });
  it("mantém a dispensa por conta e não mostra o guia a usuários que já usavam o app", () => {
    const view = render(<Guide />);
    fireEvent.click(screen.getByRole("button", { name: "Dispensar guia de primeiros passos" }));
    view.unmount();
    render(<Guide />);
    expect(screen.queryByText("Seu primeiro mês no Prumo")).not.toBeInTheDocument();
    cleanup();
    act(() => {
      setFinanceUser("other-user");
      applyRemote(empty);
    });
    render(<Guide />);
    expect(screen.getByText("Seu primeiro mês no Prumo")).toBeInTheDocument();
    cleanup();
    act(() => {
      setFinanceUser("existing-user");
      applyRemote({ ...empty, income: { [currentMonth()]: 100 } });
    });
    render(<Guide />);
    expect(screen.queryByText("Seu primeiro mês no Prumo")).not.toBeInTheDocument();
  });
});
