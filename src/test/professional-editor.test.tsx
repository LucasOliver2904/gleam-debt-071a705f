import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TransactionEditor } from "@/components/TransactionEditor";
import { applyRemote, getState, setFinanceUser, setState, type Tx } from "@/lib/finance";
import { setMoneyHidden } from "@/lib/money-privacy";

const original: Tx = {
  id: "tx",
  date: "2026-11-01",
  description: "Mercado",
  amount: 123.45,
  kind: "saida",
  category: "Mercado",
};
beforeEach(() => {
  setMoneyHidden(false);
  setFinanceUser("editor-a");
  applyRemote({ income: {}, debts: [], txs: [original] });
});
afterEach(() => {
  cleanup();
  setMoneyHidden(false);
  setFinanceUser(null);
  localStorage.clear();
});

describe("Edição segura de lançamentos", () => {
  it("não mostra valores preenchidos em modo privado e permite revelá-los explicitamente", () => {
    setMoneyHidden(true);
    render(<TransactionEditor transaction={original} onClose={vi.fn()} />);
    expect(screen.queryByLabelText("Valor em R$")).not.toBeInTheDocument();
    expect(document.querySelector('input[value="123,45"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar valores para editar" }));
    expect(screen.getByLabelText("Valor em R$")).toHaveValue("123,45");
    act(() => setMoneyHidden(true));
    expect(screen.queryByLabelText("Valor em R$")).not.toBeInTheDocument();
  });
  it("não sobrescreve uma alteração recebida enquanto o formulário estava aberto", () => {
    render(<TransactionEditor transaction={original} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Valor em R$"), { target: { value: "200,00" } });
    act(() => setState((state) => ({ ...state, txs: [{ ...original, amount: 300 }] })));
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    expect(screen.getByRole("alert")).toHaveTextContent("atualizado ou removido");
    expect(getState().txs[0]?.amount).toBe(300);
  });
});
