import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrivacyToggle } from "@/components/PrivacyToggle";
import { SyncStatus } from "@/components/SyncStatus";
import { setSyncStatus } from "@/lib/sync-status";
import {
  applyRemote,
  brl,
  currentMonth,
  exportBackup,
  getState,
  setFinanceUser,
  useFinance,
} from "@/lib/finance";
import { financeCsv } from "@/lib/planning";
import { MONEY_PRIVACY_KEY, setMoneyHidden, useMoneyPrivacy } from "@/lib/money-privacy";

function Reading({ label }: { label: string }) {
  const state = useFinance();
  const hidden = useMoneyPrivacy();
  return (
    <section aria-label={label}>
      <p>{brl(state.txs[0]?.amount ?? 0)}</p>
      {hidden ? <p>Gráfico oculto</p> : <p>Gráfico disponível</p>}
    </section>
  );
}
beforeEach(() => {
  setMoneyHidden(false);
  setFinanceUser("privacy-user");
  applyRemote({
    debts: [],
    income: {},
    txs: [
      {
        id: "tx",
        date: currentMonth() + "-01",
        description: "Compra",
        amount: 1234.56,
        kind: "saida",
      },
    ],
  });
});
afterEach(() => {
  cleanup();
  setMoneyHidden(false);
  setFinanceUser(null);
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Privacidade dos valores", () => {
  it("pede revelação explícita antes de permitir decidir entre valores em conflito", () => {
    setMoneyHidden(true);
    setSyncStatus("privacy-user", "conflict", "Confira as versões", [
      { field: "Compra · Valor", local: "R$ 1.234,56", remote: "R$ 2.000,00" },
    ]);
    render(<SyncStatus />);
    fireEvent.click(screen.getByRole("button", { name: "Conferir versões" }));
    expect(screen.queryByText(/1\.234,56/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Manter meus valores deste aparelho" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mostrar valores para editar" }));
    expect(screen.getByText(/1\.234,56/)).toBeInTheDocument();
    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Manter meus valores deste aparelho" }),
    ).toBeEnabled();
  });
  it("atualiza todas as leituras imediatamente sem alterar valores financeiros ou exportações", () => {
    const before = JSON.stringify(getState());
    render(
      <>
        <PrivacyToggle />
        <Reading label="Painel" />
        <Reading label="Outra tela" />
      </>,
    );
    expect(screen.getAllByText(/1\.234,56/)).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Ocultar valores" }));
    expect(screen.queryByText(/1\.234,56/)).not.toBeInTheDocument();
    expect(screen.getAllByText("••••")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Mostrar valores" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem(MONEY_PRIVACY_KEY)).toBe("true");
    expect(JSON.stringify(getState())).toBe(before);
    expect(JSON.parse(exportBackup()).data.txs[0].amount).toBe(1234.56);
    expect(financeCsv(getState(), currentMonth())).toContain("1234,56");
    fireEvent.click(screen.getByRole("button", { name: "Mostrar valores" }));
    expect(screen.getAllByText(/1\.234,56/)).toHaveLength(2);
  });
  it("acompanha a preferência alterada em outra aba", () => {
    render(
      <>
        <PrivacyToggle />
        <Reading label="Painel" />
      </>,
    );
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: MONEY_PRIVACY_KEY, newValue: "true" }),
      );
    });
    expect(screen.getByText("••••")).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: MONEY_PRIVACY_KEY, newValue: "false" }),
      );
    });
    expect(screen.getByText(/1\.234,56/)).toBeInTheDocument();
  });
  it("mantém o controle funcionando e informa quando a preferência só vale na sessão", () => {
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
      if (key === MONEY_PRIVACY_KEY) throw new DOMException("Blocked", "SecurityError");
      original.call(this, key, value);
    });
    render(
      <>
        <PrivacyToggle />
        <Reading label="Painel" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Ocultar valores" }));
    expect(screen.getByText("••••")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("nesta sessão");
  });
  it("lê a preferência salva antes de formatar o primeiro valor após recarregar", async () => {
    localStorage.setItem(MONEY_PRIVACY_KEY, "true");
    vi.resetModules();
    const fresh = await import("@/lib/money-privacy");
    expect(fresh.displayMoney(1234.56)).toBe("••••");
    expect(fresh.formatMoney(1234.56)).toMatch(/1\.234,56/);
    fresh.setMoneyHidden(false);
  });
});
