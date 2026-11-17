import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getFinanceUser, useFinance } from "@/lib/finance";
import {
  getConfirmation,
  mountConfirmationHost,
  settleConfirmation,
  subscribeConfirmation,
} from "@/lib/confirm-action";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function ConfirmProvider({ children }: { children: ReactNode }) {
  useFinance();
  const owner = getFinanceUser();
  const request = useSyncExternalStore(subscribeConfirmation, getConfirmation, () => null);
  useEffect(mountConfirmationHost, []);
  useEffect(() => {
    if (request && request.owner !== owner) settleConfirmation(request.id, false);
  }, [owner, request]);
  return (
    <>
      {children}
      <AlertDialog
        open={request !== null && request.owner === owner}
        onOpenChange={(open) => {
          if (!open && request) settleConfirmation(request.id, false);
        }}
      >
        <AlertDialogContent className="z-[401] w-[calc(100%-2rem)] rounded-2xl border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title ?? "Conferir antes de continuar"}</AlertDialogTitle>
            <AlertDialogDescription className="break-words leading-relaxed">
              {request?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => request && settleConfirmation(request.id, false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className={
                request?.tone === "danger"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
              onClick={() => request && settleConfirmation(request.id, true)}
            >
              {request?.confirmLabel ?? "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
