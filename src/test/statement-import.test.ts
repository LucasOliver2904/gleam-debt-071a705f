import { describe, expect, it } from "vitest";
import { parseStatementText, statementCategory, statementDate, statementDuplicate } from "@/lib/statement-import";
import type { State, Tx } from "@/lib/finance";

const empty: State = { debts: [], income: {}, txs: [] };

describe("Importação privada de extratos brasileiros", () => {
  it("interpreta data completa, dia sem ano, hoje, ontem e virada do ano", () => {
    expect(statementDate("Pix em 12/11/2026", "2026-11-13")).toBe("2026-11-12");
    expect(statementDate("12/11", "2026-11-13")).toBe("2026-11-12");
    expect(statementDate("13 de novembro de 2026", "2026-11-13")).toBe("2026-11-13");
    expect(statementDate("Ontem", "2026-01-01")).toBe("2025-12-31");
    expect(statementDate("29 dez", "2027-01-02")).toBe("2026-12-29");
    expect(statementDate("31/02", "2026-11-13")).toBeNull();
  });

  it("reconhece Pix recebido e enviado, estabelecimento e valor com centavos", () => {
    const text = [
      "EXTRATO", "12/11/2026",
      "Pix recebido de Fulano", "R$ 500,00",
      "Pix enviado para Ana Maria", "- R$ 50,00",
      "Compra no Mercado ABC", "- R$ 1.234,56",
      "SALDO DISPONÍVEL R$ 9.999,99",
    ].join("\n");
    const parsed = parseStatementText(text, "Sicredi", "2026-11-13");
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows.map((row) => [row.date, row.kind, row.gross])).toEqual([
      ["2026-11-12", "entrada", 500],
      ["2026-11-12", "saida", 50],
      ["2026-11-12", "saida", 1234.56],
    ]);
    expect(parsed.rows[0]?.isPix).toBe(true);
    expect(parsed.rows[2]?.category).toBe("Mercado");
    expect(parsed.rows.every((row) => row.included)).toBe(true);
  });

  it("não importa dados incompletos automaticamente", () => {
    const parsed = parseStatementText("Transferência\nR$ 30,00", "Banco", "2026-11-13");
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0]?.kind).toBe("");
    expect(parsed.rows[0]?.date).toBe("");
    expect(parsed.rows[0]?.included).toBe(false);
  });

  it("identifica depósitos, compra sem R$ e ignora saldos e totais", () => {
    const text = "11 nov\nDepósito em conta\n+ 200,00\nCompra Padaria do Zé\n- 14,90\nSaldo: 800,50\nTOTAL RECEBIDO R$ 700,00";
    const parsed = parseStatementText(text, "Itaú", "2026-11-13");
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]?.kind).toBe("entrada");
    expect(parsed.rows[1]?.kind).toBe("saida");
  });

  it("alerta sobre lançamentos, notificações e renda mensal existentes", () => {
    const oldTx: Tx = { id: "1", date: "2026-11-12", kind: "saida", description: "Compra Mercado ABC", amount: 55, category: "Mercado" };
    const row = { date: "2026-11-12", kind: "saida" as const, description: "Compra Mercado ABC", gross: 55, isPix: false };
    expect(statementDuplicate(row, { ...empty, txs: [oldTx] })).toMatch(/Já existe/);
    expect(statementDuplicate({ ...row, description: "Despesa no posto" }, { ...empty, txs: [oldTx] })).toMatch(/mesmo valor/);
    expect(statementDuplicate({ date: "2026-11-13", kind: "entrada", description: "Salário", gross: 3000, isPix: false }, { ...empty, income: { "2026-11": 3000 } })).toMatch(/Renda mensal/);
    expect(statementDuplicate({ date: "2026-11-13", kind: "entrada", description: "Pix recebido", gross: 500, isPix: true }, { ...empty, pixInbox: [{ id: "a", date: "2026-11-13", receivedAt: "2026-11-13T14:00:00Z", gross: 500, fingerprint: "abc" }] })).toMatch(/Android/);
  });

  it("não marca duplicidade apenas por nomes quando as datas e valores diferem", () => {
    const tx: Tx = { id: "1", date: "2026-11-11", kind: "saida", description: "Mercado ABC", amount: 120 };
    expect(statementDuplicate({ date: "2026-11-12", kind: "saida", description: "Mercado ABC", gross: 120, isPix: false }, { ...empty, txs: [tx] })).toBeNull();
  });

  it("usa classificação de categoria sem depender de serviços externos", () => {
    expect(statementCategory("Mercado Central", "saida")).toBe("Mercado");
    expect(statementCategory("Compra farmácia do bairro", "saida")).toBe("Saúde");
    expect(statementCategory("Pix recebido de André", "entrada")).toBe("Pix");
  });
});
