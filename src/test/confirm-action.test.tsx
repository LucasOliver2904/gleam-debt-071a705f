import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { confirmAction } from "@/lib/confirm-action";
import { applyRemote, setFinanceUser } from "@/lib/finance";

function Example() {
  const [removed, setRemoved] = useState(false);
  return (
    <>
      <button
        onClick={async () => {
          if (await confirmAction("Excluir esta conta?")) setRemoved(true);
        }}
      >
        Excluir conta
      </button>
      <p>{removed ? "Excluída" : "Preservada"}</p>
    </>
  );
}
beforeEach(() => {
  setFinanceUser("account-a");
  applyRemote({ debts: [], income: {}, txs: [] });
});
afterEach(() => {
  cleanup();
  setFinanceUser(null);
  localStorage.clear();
});

describe("Confirmação de ações", () => {
  it("preserva o registro até a confirmação explícita, com foco inicial em cancelar", async () => {
    render(
      <ConfirmProvider>
        <Example />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Excluir esta conta?");
    expect(screen.getByText("Preservada")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByText("Preservada")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    expect(await screen.findByText("Excluída")).toBeInTheDocument();
  });
  it("Escape cancela e não executa a operação", async () => {
    render(
      <ConfirmProvider>
        <Example />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    const dialog = await screen.findByRole("alertdialog");
    fireEvent.keyDown(dialog, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByText("Preservada")).toBeInTheDocument();
  });
  it("cancela quando a conta muda e resolve pendências ao desmontar", async () => {
    const view = render(
      <ConfirmProvider>
        <Example />
      </ConfirmProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Excluir conta" }));
    await screen.findByRole("alertdialog");
    act(() => setFinanceUser("account-b"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(screen.getByText("Preservada")).toBeInTheDocument();
    let result: Promise<boolean>;
    act(() => {
      result = confirmAction("Continuar?");
    });
    view.unmount();
    expect(await result!).toBe(false);
    expect(await confirmAction("Sem interface montada")).toBe(false);
  });
});
