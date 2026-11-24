import { z } from "zod";
import type { State } from "./finance";

export const MAX_BACKUP_BYTES = 15_000_000;
const money = z.number().finite().min(0).max(1_000_000_000_000);
const month = z.string().regex(/^(19|[2-9]\d)\d{2}-(0[1-9]|1[0-2])$/);
const date = z.string().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + "T12:00:00Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Data inválida");
const timestamp = z.string().datetime({ offset: true });
const id = z.string().min(1).max(256);
const text = z.string().max(1000);
const optionalText = text.optional();
const payment = z.object({ amount: money, paid: z.boolean() });
const monthlyMoney = z.record(month, money);
const debt = z.object({
  id,
  name: z.string().min(1).max(500),
  type: z.enum(["parcelada", "fixa", "unica"]),
  due: z.number().int().min(1).max(31).optional(),
  category: optionalText,
  note: optionalText,
  recurring: z
    .object({ amount: money, start: month, end: month.optional() })
    .refine(
      (value) => !value.end || value.end >= value.start,
      "O fim da recorrência deve ser posterior ao início",
    )
    .optional(),
  skipped: z.array(month).max(10_000).optional(),
  payments: z
    .record(month, payment)
    .refine((value) => Object.keys(value).length <= 5000, "Parcelas demais em uma conta"),
});
const tx = z.object({
  id,
  date,
  description: z.string().min(1).max(1000),
  amount: money,
  kind: z.enum(["entrada", "saida"]),
  category: optionalText,
  excludedFromTotals: z.boolean().optional(),
  statement: z.object({ source: text, importedAt: timestamp }).optional(),
  expenseAuto: z
    .object({
      receivedAt: timestamp,
      fingerprint: text,
      source: text,
      method: z.enum(["pix", "cartao", "carteira", "pagamento"]),
    })
    .optional(),
  pix: z
    .object({
      gross: money,
      kept: money,
      status: z.enum(["pendente", "repassado"]),
      source: z.enum(["manual", "texto", "automacao"]),
      sender: optionalText,
      bank: optionalText,
      fingerprint: optionalText,
      receivedAt: timestamp.optional(),
    })
    .refine((value) => value.kept <= value.gross, "Repasse Pix inválido")
    .optional(),
});
const stateSchema = z
  .object({
    debts: z.array(debt).max(10_000),
    income: monthlyMoney,
    txs: z.array(tx).max(100_000),
    reminderConfig: z
      .object({
        enabled: z.boolean(),
        daysBefore: z.array(z.number().int().min(0).max(365)).max(366),
        showDetails: z.boolean(),
      })
      .optional(),
    budgets: z.record(month, z.record(z.string().max(1000), money)).optional(),
    customCategories: z.record(z.string().min(1).max(80), z.literal(true)).optional(),
    savingsGoals: z
      .array(
        z.object({
          id,
          name: z.string().min(1).max(500),
          target: money.positive(),
          saved: money,
          deadline: month.optional(),
          createdAt: timestamp,
        }),
      )
      .max(100_000)
      .optional(),
    pixInbox: z
      .array(
        z.object({
          id,
          date,
          receivedAt: timestamp,
          gross: money,
          sender: optionalText,
          bank: optionalText,
          fingerprint: text,
        }),
      )
      .max(100_000)
      .optional(),
    expenseInbox: z
      .array(
        z.object({
          id,
          amount: money,
          date,
          receivedAt: timestamp,
          source: text,
          method: z.enum(["pix", "cartao", "carteira", "pagamento"]),
          fingerprint: text,
          person: optionalText,
          possibleDuplicateOf: id.optional(),
        }),
      )
      .max(100_000)
      .optional(),
    handledInboxIds: z.array(id).max(100_000).optional(),
  })
  .superRefine((state, context) => {
    for (const key of ["debts", "txs", "savingsGoals", "pixInbox", "expenseInbox"] as const) {
      const items = state[key] ?? [];
      if (new Set(items.map((item) => item.id)).size !== items.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: "Identificadores duplicados",
        });
      }
    }
    const today = new Date();
    const horizon = today.getFullYear() * 12 + today.getMonth() + 12;
    const monthIndex = (value: string) =>
      Number(value.slice(0, 4)) * 12 + Number(value.slice(5, 7)) - 1;
    const estimatedPayments = state.debts.reduce((total, item) => {
      const recurring = item.type === "fixa" ? item.recurring : undefined;
      const projected = recurring
        ? Math.max(
            0,
            Math.min(horizon, recurring.end ? monthIndex(recurring.end) : horizon) -
              monthIndex(recurring.start) +
              1,
          )
        : 0;
      return total + Math.max(Object.keys(item.payments).length, projected);
    }, 0);
    if (estimatedPayments > 250_000)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["debts"],
        message: "O backup gera parcelas demais para este aparelho",
      });
  });

export type BackupSummary = {
  debts: number;
  transactions: number;
  goals: number;
  firstMonth: string | null;
  lastMonth: string | null;
  exportedAt: string | null;
};
export type ParsedBackup = { state: State; summary: BackupSummary };

function restorableData(state: State): State {
  const parsed = stateSchema.parse(state) as State;
  // Pareamento e filas de notificações pertencem à conta atual, não ao arquivo.
  const { pixInbox: _pix, expenseInbox: _expenses, handledInboxIds: _handled, ...data } = parsed;
  return data;
}

export function serializeBackup(state: State): string {
  return JSON.stringify(
    {
      format: "prumo",
      version: 1,
      exportedAt: new Date().toISOString(),
      data: restorableData(state),
    },
    null,
    2,
  );
}

export function parseBackup(json: string): ParsedBackup {
  if (new Blob([json]).size > MAX_BACKUP_BYTES)
    throw new Error("O backup excede o limite de 15 MB.");
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error("O arquivo não contém um JSON válido.");
  }
  let exportedAt: string | null = null;
  if (raw && typeof raw === "object" && ("format" in raw || "version" in raw)) {
    const envelope = z
      .object({
        format: z.literal("prumo"),
        version: z.literal(1),
        exportedAt: timestamp,
        data: z.unknown(),
      })
      .safeParse(raw);
    if (!envelope.success) throw new Error("Formato ou versão de backup não suportado.");
    exportedAt = envelope.data.exportedAt;
    raw = envelope.data.data;
  }
  const validated = stateSchema.safeParse(raw);
  if (!validated.success)
    throw new Error(
      "O backup contém registros, valores ou datas inválidos. Seus dados foram preservados.",
    );
  const state = restorableData(validated.data as State);
  const months = [
    ...Object.keys(state.income),
    ...state.debts.flatMap((item) => Object.keys(item.payments)),
    ...state.txs.map((item) => item.date.slice(0, 7)),
  ].sort();
  return {
    state,
    summary: {
      debts: state.debts.length,
      transactions: state.txs.length,
      goals: state.savingsGoals?.length ?? 0,
      firstMonth: months[0] ?? null,
      lastMonth: months.at(-1) ?? null,
      exportedAt,
    },
  };
}

export function preserveLiveFields(restored: State, current: State): State {
  return {
    ...restored,
    pixAutomationHash: current.pixAutomationHash,
    pixInbox: current.pixInbox,
    expenseInbox: current.expenseInbox,
    handledInboxIds: current.handledInboxIds,
  };
}

const recoveryKey = (userId: string) => "prumo-backup-recovery-v1:" + userId;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ":" + canonical(item))
        .join(",") +
      "}"
    );
  return JSON.stringify(value) ?? "null";
}

export function backupFingerprint(state: State): string {
  return canonical(restorableData(state));
}

// Se o navegador recusar até o rollback, não descarte a cópia que ainda está em memória.
const recoveryFallbacks = new Map<string, string | null>();

export function saveRecoveryPoint(userId: string, before: State, restored: State): () => void {
  if (!userId) throw new Error("Entre na sua conta antes de restaurar um backup.");
  let previousRaw: string | null;
  try {
    previousRaw = recoveryFallbacks.has(userId)
      ? (recoveryFallbacks.get(userId) ?? null)
      : localStorage.getItem(recoveryKey(userId));
    localStorage.setItem(
      recoveryKey(userId),
      JSON.stringify({
        version: 1,
        savedAt: new Date().toISOString(),
        before: restorableData(before),
        restored: restorableData(restored),
      }),
    );
    recoveryFallbacks.delete(userId);
  } catch {
    throw new Error(
      "Não foi possível guardar a cópia de segurança neste aparelho. Libere espaço antes de restaurar.",
    );
  }
  // Não duplica arquivos persistidos: a operação síncrona conserva o valor anterior
  // somente até a gravação financeira terminar ou ser desfeita.
  return () => {
    try {
      if (previousRaw === null) localStorage.removeItem(recoveryKey(userId));
      else localStorage.setItem(recoveryKey(userId), previousRaw);
      recoveryFallbacks.delete(userId);
    } catch {
      recoveryFallbacks.set(userId, previousRaw);
      throw new Error(
        "A alteração não foi aplicada. A cópia anterior só pôde ser mantida nesta sessão. Mantenha o app aberto, libere espaço e tente novamente.",
      );
    }
  };
}

export type BackupRecovery = {
  before: State;
  savedAt: string;
  changedSinceRestore: boolean;
  durable: boolean;
};
export function readRecoveryPoint(userId: string, current: State): BackupRecovery | null {
  try {
    const raw = recoveryFallbacks.has(userId)
      ? recoveryFallbacks.get(userId)
      : localStorage.getItem(recoveryKey(userId));
    if (!raw) return null;
    const point = z
      .object({
        version: z.literal(1),
        savedAt: timestamp,
        before: stateSchema,
        restored: stateSchema,
      })
      .parse(JSON.parse(raw));
    return {
      before: restorableData(point.before as State),
      savedAt: point.savedAt,
      durable: !recoveryFallbacks.has(userId),
      changedSinceRestore:
        backupFingerprint(current) !== backupFingerprint(point.restored as State),
    };
  } catch {
    throw new Error(
      "A cópia anterior deste aparelho não pôde ser lida. Seus dados atuais foram preservados.",
    );
  }
}

export function removeRecoveryPoint(userId: string): void {
  localStorage.removeItem(recoveryKey(userId));
  recoveryFallbacks.delete(userId);
}
