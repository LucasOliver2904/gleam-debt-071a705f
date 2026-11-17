import { useSyncExternalStore } from "react";

export type SyncPhase = "idle" | "local" | "syncing" | "synced" | "error" | "conflict";
export type SyncStatus = {
  userId: string | null;
  phase: SyncPhase;
  message?: string | undefined;
  lastSyncedAt?: string | undefined;
  conflicts?: { field: string; local: string; remote: string }[] | undefined;
};
const EMPTY_STATUS: SyncStatus = { userId: null, phase: "idle" };
let status = EMPTY_STATUS;
type SyncActions = { retry: () => void; resolve: (choice: "local" | "remote") => void };
let actions: SyncActions | null = null;
const listeners = new Set<() => void>();

export function resetSyncStatus(userId: string | null) {
  actions = null;
  status = { userId, phase: userId ? "local" : "idle" };
  listeners.forEach((listener) => listener());
}

export function setSyncStatus(
  userId: string,
  phase: SyncPhase,
  message?: string,
  conflicts?: SyncStatus["conflicts"],
) {
  if (status.userId !== userId) return;
  status = {
    userId,
    phase,
    message,
    conflicts,
    lastSyncedAt: phase === "synced" ? new Date().toISOString() : status.lastSyncedAt,
  };
  listeners.forEach((listener) => listener());
}

export function registerSyncActions(userId: string, next: SyncActions | null) {
  if (status.userId === userId) actions = next;
}

export function retrySync() {
  actions?.retry();
}
export function resolveSyncConflict(choice: "local" | "remote") {
  actions?.resolve(choice);
}
export function getSyncStatus() {
  return status;
}
export function useSyncStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => status,
    () => EMPTY_STATUS,
  );
}
