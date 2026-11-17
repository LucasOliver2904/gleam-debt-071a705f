import type { ComponentType, ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { Route } from "@/routes/ajustes";
import { applyRemote, getState, setFinanceUser, setState, setSyncHandler } from "@/lib/finance";

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));
vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/InstallAppCard", () => ({ InstallAppCard: () => null }));
vi.mock("@/components/AccentPicker", () => ({ AccentPicker: () => null }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const Settings = Route.options.component as ComponentType;
const text = JSON.stringify({
  debts: [],
  txs: [{ id: "mercado", description: "Mercado", amount: 50, kind: "saida", date: "2026-10-01" }],
  income: {},
});
function selectBackup(content = text) {
  const file = new File([content], "meu-backup.json", { type: "application/json" });
  Object.defineProperty(file, "text", { value: () => Promise.resolve(content) });
  fireEvent.change(screen.getByLabelText("Selecionar arquivo de backup"), {
    target: { files: [file] },
  });
}

beforeEach(() => {
  setFinanceUser("pessoa-a");
  applyRemote({ debts: [], txs: [], income: { "2026-11": 2000 } });
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  setSyncHandler(null);
  setFinanceUser(null);
  localStorage.clear();
});

describe("Conferência e recuperação de backup nos ajustes", () => {
  it("mostra o resumo e deixa cancelar antes de substituir os registros", async () => {
    render(<Settings />);
    selectBackup();
    expect(await screen.findByRole("dialog")).toHaveTextContent("Conferir backup");
    expect(screen.getByRole("dialog")).toHaveTextContent("Outubro/2026 a Outubro/2026");
    expect(getState().income["2026-11"]).toBe(2000);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getState().income["2026-11"]).toBe(2000);
  });

  it("restaura somente após confirmar e avisa sobre edições posteriores antes de recuperar", async () => {
    render(<Settings />);
    selectBackup();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Restaurar este backup" }));
    expect(getState().txs[0]?.description).toBe("Mercado");
    expect(screen.getByText("Cópia anterior disponível")).toBeInTheDocument();
    act(() => setState((state) => ({ ...state, income: { "2026-11": 300 } })));
    fireEvent.click(screen.getByRole("button", { name: "Recuperar cópia anterior" }));
    expect(screen.getByRole("dialog")).toHaveTextContent(
      "Você alterou seus dados depois da restauração",
    );
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recuperação" }));
    expect(getState().income["2026-11"]).toBe(2000);
    expect(getState().txs).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Recuperar cópia anterior" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar recuperação" }));
    expect(getState().income["2026-11"]).toBe(300);
    expect(getState().txs).toHaveLength(1);
  });

  it("rejeita arquivo inválido antes de abrir a confirmação", async () => {
    render(<Settings />);
    selectBackup('{"debts":[],"txs":[{"amount":-2}],"income":{}}');
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getState().income["2026-11"]).toBe(2000);
  });

  it("não abre os dados do arquivo se a conta mudar durante a leitura", async () => {
    render(<Settings />);
    let finish: (text: string) => void = () => {};
    const file = new File([text], "backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
      value: () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    });
    fireEvent.change(screen.getByLabelText("Selecionar arquivo de backup"), {
      target: { files: [file] },
    });
    await act(async () => {
      setFinanceUser("pessoa-b");
      finish(text);
    });
    expect(toast.error).toHaveBeenCalledWith("A conta mudou. Selecione o backup novamente.");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getState().txs).toHaveLength(0);
  });
});
