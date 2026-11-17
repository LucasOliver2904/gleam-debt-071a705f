import { useState } from "react";
import { AlertTriangle, Check, CloudUpload, Download, LoaderCircle, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getFinanceUser, type State } from "@/lib/finance";
import { resolveSyncConflict, retrySync, useSyncStatus } from "@/lib/sync-status";

export function SyncStatus() {
  const status = useSyncStatus();
  const [reviewing, setReviewing] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  if (!status.userId) return null;
  const label = {
    idle: "Aguardando sincronização",
    local: "Salvo neste aparelho",
    syncing: "Sincronizando",
    synced: "Sincronizado",
    error: "Sincronização pendente",
    conflict: "Alterações para conferir",
  }[status.phase];
  let hasRecovery = false;
  try {
    hasRecovery =
      typeof localStorage !== "undefined" &&
      !!localStorage.getItem("prumo-sync-recovery:" + status.userId);
  } catch {
    /* unavailable storage is reported by sync */
  }
  const warning = status.phase === "error" || status.phase === "conflict";
  const Icon =
    status.phase === "synced"
      ? Check
      : status.phase === "syncing"
        ? LoaderCircle
        : warning
          ? AlertTriangle
          : CloudUpload;
  function choose(choice: "local" | "remote") {
    if (getFinanceUser() !== status.userId) return;
    resolveSyncConflict(choice);
    setReviewing(false);
  }
  function downloadRecovery() {
    try {
      if (getFinanceUser() !== status.userId) return;
      const records = JSON.parse(
        localStorage.getItem("prumo-sync-recovery:" + status.userId) ?? "[]",
      ) as { savedAt: string; local: State; remote: State }[];
      const latest = records.at(-1);
      if (!latest) {
        setDownloadError("Ainda não há uma cópia de conflito guardada neste aparelho.");
        return;
      }
      const { pixAutomationHash: _hash, ...data } = latest.local;
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "prumo-antes-conflito-" + latest.savedAt.slice(0, 10) + ".json";
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError("");
    } catch {
      setDownloadError("Não foi possível baixar a cópia de recuperação.");
    }
  }
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 text-xs" role="status" aria-live="polite">
        <span
          className={
            "inline-flex items-center gap-1.5 " +
            (warning ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")
          }
        >
          <Icon size={14} className={status.phase === "syncing" ? "animate-spin" : ""} /> {label}
        </span>
        {warning && (
          <button
            type="button"
            onClick={retrySync}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-semibold text-primary hover:bg-primary/10"
          >
            <RefreshCw size={12} /> Tentar novamente
          </button>
        )}
        {status.phase === "conflict" && (
          <button
            type="button"
            onClick={() => setReviewing(true)}
            className="rounded-lg border border-border px-2 py-1 font-semibold"
          >
            Conferir versões
          </button>
        )}
        {hasRecovery && (
          <button
            type="button"
            onClick={downloadRecovery}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground hover:bg-secondary"
            title="Baixar a cópia local guardada antes de resolver um conflito"
          >
            <Download size={12} /> Cópia anterior
          </button>
        )}
      </div>
      {warning && status.message && (
        <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{status.message}</p>
      )}
      {downloadError && (
        <p role="alert" className="text-xs text-destructive">
          {downloadError}
        </p>
      )}
      <Dialog open={reviewing && status.phase === "conflict"} onOpenChange={setReviewing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferir alterações entre aparelhos</DialogTitle>
            <DialogDescription>
              Os mesmos campos foram alterados de formas diferentes. As alterações independentes dos
              dois aparelhos serão combinadas. Escolha qual versão usar somente nos campos em
              conflito.
            </DialogDescription>
          </DialogHeader>
          {!!status.conflicts?.length && (
            <div className="max-h-64 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
              {status.conflicts.map((entry) => (
                <div key={entry.field} className="text-xs">
                  <p className="break-all font-semibold">{entry.field}</p>
                  <p className="mt-1 break-all">Neste aparelho: {entry.local}</p>
                  <p className="mt-1 break-all">Na nuvem: {entry.remote}</p>
                </div>
              ))}
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            Antes de aplicar sua escolha, o Prumo guardará as duas cópias neste aparelho. A versão
            local anterior poderá ser baixada pelo botão “Cópia anterior”.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => choose("local")}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            >
              Manter meus valores deste aparelho
            </button>
            <button
              type="button"
              onClick={() => choose("remote")}
              className="rounded-xl border border-border px-4 py-3 text-sm font-semibold"
            >
              Usar os valores da nuvem nos conflitos
            </button>
            <button
              type="button"
              onClick={() => setReviewing(false)}
              className="rounded-xl px-4 py-2 text-sm text-muted-foreground"
            >
              Decidir depois
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
