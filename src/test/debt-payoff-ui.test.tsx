import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { PlanningSimulators } from "@/components/PlanningSimulators";
import { addMonths, currentMonth, type State } from "@/lib/finance";
import { setMoneyHidden } from "@/lib/money-privacy";

const location = { hash: "antecipar-parcelas", state: { payoffDebtId: "b" } };
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useRouterState: ({ select }: { select: (r: { location: typeof location }) => unknown }) =>
    select({ location }),
}));

const month = currentMonth();
const next = addMonths(month, 1);
const state: State = {
  income: { [month]: 600 },
  txs: [],
  debts: [
    {
      id: "a",
      name: "Conta A",
      type: "parcelada",
      payments: { [next]: { amount: 100, paid: false } },
    },
    {
      id: "b",
      name: "Conta B",
      type: "parcelada",
      payments: {
        [month]: { amount: 300, paid: false },
        [next]: { amount: 200, paid: false },
      },
    },
  ],
};

afterEach(() => {
  cleanup();
  setMoneyHidden(false);
});

describe("proposta de quitação no Planejamento", () => {
  it("abre a conta indicada e pede uma nova cotação ao mudar a seleção ou sincronizar um pagamento", () => {
    const view = render(<PlanningSimulators state={state} />);
    expect(screen.getByLabelText("Conta a antecipar")).toHaveValue("b");
    const quote = () => screen.getByLabelText("Quanto o banco cobra hoje?");
    expect(quote()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todas" }));
    fireEvent.change(quote(), { target: { value: "400,00" } });
    expect(screen.getByRole("status")).toHaveTextContent("100,00");
    fireEvent.click(screen.getAllByRole("checkbox")[0]!);
    expect(quote()).toHaveValue("");
    fireEvent.change(quote(), { target: { value: "190,00" } });
    expect(screen.getByRole("status")).toHaveTextContent("10,00");
    const updated = structuredClone(state);
    updated.debts[1]!.payments[next]!.paid = true;
    view.rerender(<PlanningSimulators state={updated} />);
    expect(quote()).toBeDisabled();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("remove campos e resultados do modo privacidade e apresenta o estado vazio", () => {
    const view = render(<PlanningSimulators state={state} />);
    fireEvent.click(screen.getByRole("button", { name: "Selecionar todas" }));
    fireEvent.change(screen.getByLabelText("Quanto o banco cobra hoje?"), {
      target: { value: "380,90" },
    });
    act(() => {
      setMoneyHidden(true);
    });
    expect(screen.queryByText("Conta B")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("380,90")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar valores para simular" }));
    view.rerender(<PlanningSimulators state={{ debts: [], income: {}, txs: [] }} />);
    expect(screen.getByText("Nenhuma parcela em aberto para simular.")).toBeVisible();
  });

  it("marca as últimas parcelas em aberto e revela todos os meses afetados", () => {
    const payments = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [addMonths(month, i), { amount: 100, paid: false }]),
    );
    render(<PlanningSimulators state={{ ...state, debts: [{ ...state.debts[1]!, payments }] }} />);
    fireEvent.click(screen.getByText("Marcar as últimas parcelas"));
    fireEvent.change(screen.getByLabelText("Quantas parcelas finais?"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: /^Marcar$/ }));
    expect(screen.getAllByRole("checkbox", { checked: true })).toHaveLength(6);
    expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked();
    fireEvent.change(screen.getByLabelText("Quanto o banco cobra hoje?"), {
      target: { value: "480" },
    });
    expect(screen.getByRole("status")).toHaveTextContent("120,00");
    expect(screen.getAllByRole("row")).toHaveLength(5);
    fireEvent.click(screen.getByRole("button", { name: "Ver os 7 meses afetados" }));
    expect(screen.getAllByRole("row")).toHaveLength(8);
  });
});
