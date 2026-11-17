import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QuickAdd } from "@/components/QuickAdd";
import { getState, setFinanceUser, setState, setSyncHandler, type Tx } from "@/lib/finance";
import { quickEntryShortcuts } from "@/lib/quick-entry";

const { success, error, notice } = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  notice: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: Object.assign(notice, { success, error }) }));

const existing: Tx = {
  id: "existing",
  date: "2026-11-01",
  description: "Outro gasto",
  amount: 10,
  kind: "saida",
  category: "Outros",
};

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
  setSyncHandler(null);
  setFinanceUser(null);
  localStorage.clear();
  setFinanceUser("quick-user");
  setState(() => ({ debts: [], income: {}, txs: [existing] }));
});

afterEach(() => {
  cleanup();
  setSyncHandler(null);
  setFinanceUser(null);
});

function saveMarket() {
  fireEvent.click(screen.getByRole("button", { name: "Usar atalho Mercado de saída" }));
  expect(screen.getByLabelText("Descrição")).toHaveValue("Mercado");
  expect(screen.getByLabelText("Categoria")).toHaveValue("Mercado");
  fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "45,90" } });
  fireEvent.click(screen.getByRole("button", { name: "Lançar saída" }));
  return success.mock.calls.at(-1)![1].action.onClick as () => void;
}

describe("lançamento rápido", () => {
  it("preenche o atalho, registra e desfaz somente a movimentação criada", () => {
    const close = vi.fn();
    render(<QuickAdd onClose={close} />);
    const undo = saveMarket();
    const created = getState().txs[0];
    expect(created).toMatchObject({
      description: "Mercado",
      amount: 45.9,
      category: "Mercado",
      kind: "saida",
    });
    expect(close).toHaveBeenCalledOnce();
    act(() =>
      setState((state) => ({ ...state, txs: [...state.txs, { ...existing, id: "later" }] })),
    );
    act(undo);
    expect(getState().txs.map((tx) => tx.id)).toEqual(["existing", "later"]);
  });

  it("não desfaz registros que foram editados depois de salvar", () => {
    render(<QuickAdd onClose={vi.fn()} />);
    const undo = saveMarket();
    const id = getState().txs[0]!.id;
    act(() =>
      setState((state) => ({
        ...state,
        txs: state.txs.map((tx) => (tx.id === id ? { ...tx, amount: 52 } : tx)),
      })),
    );
    act(undo);
    expect(getState().txs.find((tx) => tx.id === id)?.amount).toBe(52);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("foi alterado"));
  });

  it("não aplica o callback Desfazer em outra conta", () => {
    render(<QuickAdd onClose={vi.fn()} />);
    const undo = saveMarket();
    const created = getState().txs[0]!;
    act(() => {
      setFinanceUser("another-user");
      setState(() => ({ debts: [], income: {}, txs: [created] }));
    });
    act(undo);
    expect(getState().txs).toEqual([created]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("Volte à conta"));
  });

  it("não salva um formulário aberto antes da troca de conta", () => {
    render(<QuickAdd onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar atalho Transporte de saída" }));
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "12" } });
    act(() => setFinanceUser("another-user"));
    fireEvent.click(screen.getByRole("button", { name: "Lançar saída" }));
    expect(getState().txs).toEqual([]);
    expect(error).toHaveBeenCalledWith(expect.stringContaining("A conta mudou"));
  });

  it("usa lançamentos frequentes sem copiar valor, data ou metadados de importação", () => {
    const salary: Tx = {
      id: "salary-1",
      date: "2026-10-10",
      description: "Salário",
      amount: 3200,
      kind: "entrada",
      category: "Outros",
      statement: { source: "Banco", importedAt: "2026-10-10T12:00:00Z" },
    };
    setState((state) => ({
      ...state,
      txs: [salary, { ...salary, id: "salary-2", date: "2026-11-10" }],
    }));
    render(<QuickAdd onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Usar atalho Salário de entrada" }));
    expect(screen.getByRole("button", { name: "Entrada" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Valor (R$)")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("Valor (R$)"), { target: { value: "3500" } });
    fireEvent.click(screen.getByRole("button", { name: "Lançar entrada" }));
    expect(getState().txs[0]).toMatchObject({
      description: "Salário",
      kind: "entrada",
      amount: 3500,
    });
    expect(getState().txs[0]).not.toHaveProperty("statement");
    expect(getState().txs[0]).not.toHaveProperty("pix");
  });
});

describe("atalhos frequentes", () => {
  it("prioriza frequência, remove duplicatas e usa categorias conhecidas", () => {
    const repeated = [
      { ...existing, id: "1", description: "Padaria", category: "Categoria antiga" },
      { ...existing, id: "2", description: "padaria", date: "2026-11-02", category: "Alimentação" },
      { ...existing, id: "3", description: "Mercado", category: "Mercado" },
      { ...existing, id: "4", description: "Mercado", category: "Mercado" },
    ];
    const shortcuts = quickEntryShortcuts(repeated);
    expect(shortcuts[0]).toEqual({
      description: "padaria",
      kind: "saida",
      category: "Alimentação",
    });
    expect(shortcuts.filter((item) => item.description === "Mercado")).toHaveLength(1);
    expect(shortcuts.some((item) => item.description === "Transporte")).toBe(true);
  });
});
