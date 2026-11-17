import { confirmAction } from "@/lib/confirm-action";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Bell, BellOff, Check, CheckCircle2, ChevronRight, Download, Eye, EyeOff, Info, MonitorSmartphone, RotateCcw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { InstallAppCard } from "@/components/InstallAppCard";
import { AccentPicker } from "@/components/AccentPicker";
import { alerts, exportBackup, getBackupRecovery, getFinanceUser, getState, hasLegacyLocalBackup, importBackup, legacyLocalBackup, monthLabel, resetAll, setState, undoBackupRestore, useFinance } from "@/lib/finance";
import { backupFingerprint, MAX_BACKUP_BYTES, parseBackup, type BackupRecovery, type BackupSummary } from "@/lib/backup";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_REMINDER_CONFIG, reminderConfig, type ReminderConfig } from "@/lib/reminders";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Preferências e lembretes — Prumo" },
      { name: "description", content: "Personalize os lembretes de vencimento, notificações e backups." },
    ],
  }),
  component: Ajustes,
});

const reminderDays = [
  { value: 0, label: "No dia" },
  { value: 1, label: "1 dia antes" },
  { value: 3, label: "3 dias antes" },
  { value: 7, label: "7 dias antes" },
  { value: 15, label: "15 dias antes" },
  { value: 30, label: "30 dias antes" },
];

function ActionRow({
  icon: Icon, title, description, action, danger = false,
}: {
  icon: typeof Bell;
  title: string;
  description: string;
  action: () => void;
  danger?: boolean;
}) {
  return (
    <button type="button" onClick={action} className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 text-left transition hover:border-primary/40 hover:bg-secondary/40">
      <span className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl " + (danger ? "bg-destructive/15 text-destructive" : "bg-primary/10 text-primary")}><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5" />
    </button>
  );
}

function Ajustes() {
  const s = useFinance();
  const backupInput = useRef<HTMLInputElement>(null);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [pendingBackup, setPendingBackup] = useState<{ text: string; summary: BackupSummary; owner: string; source: string } | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{ owner: string; fingerprint: string; changed: boolean } | null>(null);
  const prefs = reminderConfig(s);
  let recovery: BackupRecovery | null = null;
  let recoveryError = "";
  try { recovery = getBackupRecovery(); }
  catch (error) { recoveryError = error instanceof Error ? error.message : "Não foi possível ler a cópia anterior."; }

  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
  }, []);

  const updateSettings = (patch: Partial<ReminderConfig>) => {
    setState((current) => ({
      ...current,
      reminderConfig: { ...reminderConfig(current), ...patch },
    }));
  };

  const activate = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("Este navegador não suporta notificações do aplicativo.");
      return;
    }
    let result = Notification.permission;
    if (result !== "granted") result = await Notification.requestPermission();
    setPermission(result);
    if (result !== "granted") {
      toast.error(result === "denied" ? "Permissão bloqueada. Libere nas configurações do navegador." : "É necessário permitir notificações para receber lembretes.");
      return;
    }
    updateSettings({ enabled: true });
    toast.success("Lembretes ativados neste navegador!");
  };

  const test = async () => {
    if (!("Notification" in window) || Notification.permission !== "granted" || !("serviceWorker" in navigator)) {
      toast.error("Ative a permissão de notificações antes de testar.");
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Prumo • Tudo pronto!", {
        body: "O teste de notificação funcionou. Seus vencimentos estão no painel.",
        icon: "/icons/icon-192.png",
        badge: "/favicon.png",
        tag: "meu-caixa-teste",
        data: { url: "/" },
      });
      toast.success("Notificação de teste enviada");
    } catch {
      toast.error("Não foi possível mostrar a notificação. Confira as permissões do navegador.");
    }
  };

  const download = () => {
    try {
      const blob = new Blob([exportBackup()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "meu-caixa-backup-" + new Date().toLocaleDateString("en-CA") + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 500);
      toast.success("Backup baixado com sucesso.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível baixar o backup.");
    }
  };

  const previewRestore = (text: string, source: string, owner: string | null) => {
    if (!owner || owner !== getFinanceUser()) throw new Error("A conta mudou. Selecione o backup novamente.");
    const parsed = parseBackup(text);
    setPendingBackup({ text, summary: parsed.summary, owner, source });
  };

  const restore = async (file: File) => {
    const owner = getFinanceUser();
    try {
      if (file.size > MAX_BACKUP_BYTES) throw new Error("O backup excede o limite de 15 MB.");
      const text = await file.text();
      previewRestore(text, file.name, owner);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Arquivo inválido. Seus dados foram preservados.");
    }
  };

  const confirmRestore = () => {
    if (!pendingBackup) return;
    try {
      if (pendingBackup.owner !== getFinanceUser()) throw new Error("A conta mudou. Selecione o backup novamente.");
      importBackup(pendingBackup.text);
      setPendingBackup(null);
      toast.success("Backup restaurado. A cópia anterior foi guardada neste aparelho.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível restaurar. Seus dados foram preservados.");
    }
  };

  const confirmUndo = () => {
    if (!pendingUndo) return;
    try {
      if (pendingUndo.owner !== getFinanceUser()) throw new Error("A conta mudou. Confira novamente a cópia desta conta.");
      undoBackupRestore(pendingUndo.fingerprint);
      setPendingUndo(null);
      toast.success("Cópia anterior recuperada. Os dados substituídos também ficaram guardados neste aparelho.");
    } catch (error) {
      setPendingUndo(null);
      toast.error(error instanceof Error ? error.message : "Não foi possível recuperar a cópia anterior.");
    }
  };

  const notice = permission === "unsupported"
    ? "Seu navegador não oferece notificações web."
    : permission === "denied"
      ? "O navegador bloqueou as notificações. Desbloqueie nas configurações do site."
      : permission === "granted"
        ? "Seu navegador permite notificações."
        : "Ative as notificações para receber avisos de vencimento.";

  const billCount = alerts(s).length;

  return (
    <AppShell>
      <div className="mb-6">
        <p className="finance-kicker">PREFERÊNCIAS / SEGURANÇA</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Ajustes e lembretes</h1>
        <p className="mt-2 text-sm text-muted-foreground">Seu centro de controle. Personalize os avisos e mantenha seus dados protegidos.</p>
      </div>

      <div className="grid max-w-4xl gap-5">
        <InstallAppCard />
        <section className="finance-surface overflow-hidden rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Bell size={21} /></span>
              <div>
                <h2 className="font-display text-lg font-bold">Alertas de contas</h2>
                <p className="mt-1 text-sm text-muted-foreground">Receba avisos para não perder o dia de pagar.</p>
              </div>
            </div>
            <span className={"inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold " + (prefs.enabled && permission === "granted" ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")}>
              {prefs.enabled && permission === "granted" ? <CheckCircle2 size={14} /> : <BellOff size={14} />}
              {prefs.enabled && permission === "granted" ? "Ativos" : "Desativados"}
            </span>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{notice}</p>
                <p className="mt-1 text-xs text-muted-foreground">{billCount} conta(s) atrasada(s) ou vencendo nos próximos 7 dias.</p>
              </div>
              {prefs.enabled ? (
                <button onClick={() => { updateSettings({ enabled: false }); toast("Lembretes do app pausados."); }} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold transition hover:bg-secondary">
                  Pausar lembretes
                </button>
              ) : (
                <button onClick={() => void activate()} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90">
                  <Bell size={16} /> Ativar lembretes
                </button>
              )}
            </div>

            <div>
              <p className="text-sm font-semibold">Quando você quer ser lembrado?</p>
              <p className="mt-1 text-xs text-muted-foreground">Marque os intervalos desejados. Contas atrasadas também aparecem no painel.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {reminderDays.map(({ value, label }) => {
                  const checked = prefs.daysBefore.includes(value);
                  return (
                    <button key={value} type="button" aria-pressed={checked}
                      onClick={() => updateSettings({ daysBefore: checked ? prefs.daysBefore.filter((d) => d !== value) : [...prefs.daysBefore, value].sort((a, b) => a - b) })}
                      className={"inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition " + (checked ? "border-primary/50 bg-primary/15 text-primary" : "border-border bg-secondary/50 text-muted-foreground hover:bg-secondary")}>
                      {checked && <Check size={13} />} {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button type="button" onClick={() => updateSettings({ showDetails: !prefs.showDetails })} className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary/35 px-4 py-3 text-left transition hover:bg-secondary/65">
              <span className="text-primary">{prefs.showDetails ? <Eye size={19} /> : <EyeOff size={19} />}</span>
              <span className="flex-1"><strong className="block text-sm">Mostrar nomes e valores na notificação</strong>
                <span className="text-xs text-muted-foreground">Desativado por padrão para proteger sua privacidade na tela bloqueada.</span>
              </span>
              <span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + (prefs.showDetails ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>{prefs.showDetails ? "Sim" : "Não"}</span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-secondary/25 p-3">
              <p className="flex items-center gap-2 text-xs leading-relaxed text-muted-foreground"><Info size={18} className="shrink-0" /> Os avisos automáticos funcionam quando você abre ou retorna ao app. O envio com o app fechado ainda exige um serviço de push remoto configurado.</p>
              <button type="button" onClick={() => void test()} disabled={permission !== "granted"} className="shrink-0 rounded-lg border border-border bg-card px-3 py-2 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-50">Testar notificação</button>
            </div>
          </div>
        </section>

        <section className="finance-surface rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-warning/10 text-warning"><ShieldCheck size={20} /></span>
            <div><h2 className="font-display text-lg font-bold">Seus dados e backups</h2><p className="text-xs text-muted-foreground">{s.debts.length} contas · {s.txs.length} lançamentos</p></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionRow icon={Download} title="Baixar backup" description="Guarde uma cópia dos seus dados em JSON." action={download} />
            <ActionRow icon={Upload} title="Restaurar backup" description="Importe um backup salvo anteriormente." action={() => backupInput.current?.click()} />
            {hasLegacyLocalBackup() && (
              <ActionRow icon={RotateCcw} title="Recuperar dados locais antigos" description="Se você usava o Prumo antes, pode importar o cache antigo deste aparelho, após conferir que os dados são seus." action={() => {
                const legacy = legacyLocalBackup();
                if (!legacy) { toast.error("Cache antigo indisponível."); return; }
                try {
                  previewRestore(legacy, "Cache antigo deste navegador — confira se os dados são seus", getFinanceUser());
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Cache antigo inválido. Os dados atuais foram preservados.");
                }
              }} />
            )}
            <input hidden aria-label="Selecionar arquivo de backup" ref={backupInput} type="file" accept="application/json,.json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void restore(file); event.target.value = ""; }} />
          </div>
          {recovery && <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-bold">Cópia anterior disponível</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Guardada em {new Date(recovery.savedAt).toLocaleString("pt-BR")}, apenas neste aparelho e nesta conta. {recovery.changedSinceRestore ? "Você fez alterações depois da restauração. Confira antes de substituir seus dados." : "Você pode desfazer a última substituição dos seus dados."}</p>
            {!recovery.durable && <p role="alert" className="mt-2 text-xs font-semibold text-destructive">Esta cópia está disponível apenas nesta sessão. Não feche o app; libere espaço e tente recuperar novamente.</p>}
            <button type="button" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/30 px-3 py-2 text-xs font-bold text-primary" onClick={() => {
              const owner = getFinanceUser();
              if (owner) setPendingUndo({ owner, fingerprint: backupFingerprint(getState()), changed: recovery.changedSinceRestore });
            }}><RotateCcw size={15} /> Recuperar cópia anterior</button>
          </div>}
          {recoveryError && <p role="alert" className="mt-3 text-xs text-destructive">{recoveryError}</p>}
          <p className="mt-4 rounded-xl border border-warning/25 bg-warning/7 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground"><Info size={15} className="mr-2 inline text-warning"/> O arquivo de backup contém seus dados financeiros em texto legível. Guarde-o em local privado e protegido. As chaves de automação não são incluídas.</p>
        </section>

        <AccentPicker />

        <section className="finance-surface rounded-2xl border border-border bg-card p-5">
          <div className="mb-4 flex items-center gap-2"><MonitorSmartphone className="text-primary" size={19} /><h2 className="font-display text-lg font-bold">Aparência e privacidade</h2></div>
          <p className="text-sm leading-relaxed text-muted-foreground">Alterne entre os modos claro e escuro pelo menu lateral ou pelo ícone no alto da versão mobile. Cores e tema ficam salvos neste dispositivo, sem afetar suas finanças.</p>
          <Link to="/privacidade" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-3.5 py-2.5 text-xs font-bold text-primary transition hover:bg-primary/15"><ShieldCheck size={16}/> Ler política de privacidade <ChevronRight size={15}/></Link>
        </section>

        <section className="finance-surface rounded-2xl border border-destructive/25 bg-card p-5">
          <h2 className="font-display text-lg font-bold text-destructive">Zona de cuidado</h2>
          <p className="mb-4 mt-1 text-xs text-muted-foreground">Ações que substituem ou excluem registros financeiros. Baixe um backup antes de prosseguir.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionRow icon={RotateCcw} danger title="Carregar dados de exemplo" description="Substitui todos os registros atuais por exemplos." action={async () => {
              if (await confirmAction("Isso substituirá todos os registros atuais por exemplos. Baixe um backup antes de continuar.", { title: "Substituir por dados de exemplo?", confirmLabel: "Carregar exemplos", tone: "warning" })) {
                resetAll(true);
                toast("Dados de exemplo carregados.");
              }
            }} />
            <ActionRow icon={Trash2} danger title="Apagar tudo" description="Remove todos os dados financeiros armazenados." action={async () => {
              if (await confirmAction("Todos os registros financeiros serão apagados e essa alteração será sincronizada nos seus aparelhos. Baixe um backup antes de continuar.", { title: "Apagar todos os registros?", confirmLabel: "Apagar tudo", tone: "danger" })) {
                resetAll(false);
                toast("Registros apagados.");
              }
            }} />
          </div>
        </section>
        <p className="text-center text-[11px] text-muted-foreground">Prumo · Controle financeiro pessoal · Configuração padrão: {DEFAULT_REMINDER_CONFIG.daysBefore.length} intervalos de aviso</p>
      </div>
      <Dialog open={pendingBackup !== null && pendingBackup.owner === getFinanceUser()} onOpenChange={(open) => { if (!open) setPendingBackup(null); }}>
        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-2xl">
          <DialogHeader><DialogTitle>Conferir backup antes de restaurar</DialogTitle><DialogDescription>Confira o conteúdo. A restauração substitui seus registros financeiros atuais.</DialogDescription></DialogHeader>
          {pendingBackup && <>
            <p className="break-words text-xs text-muted-foreground">Arquivo: {pendingBackup.source}</p>
            <dl className="grid grid-cols-3 gap-3 rounded-xl bg-secondary/40 p-4 text-center">
              <div><dt className="text-xs text-muted-foreground">Contas</dt><dd className="mt-1 text-xl font-bold">{pendingBackup.summary.debts}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Lançamentos</dt><dd className="mt-1 text-xl font-bold">{pendingBackup.summary.transactions}</dd></div>
              <div><dt className="text-xs text-muted-foreground">Metas</dt><dd className="mt-1 text-xl font-bold">{pendingBackup.summary.goals}</dd></div>
            </dl>
            <p className="text-sm">Período: {pendingBackup.summary.firstMonth && pendingBackup.summary.lastMonth ? monthLabel(pendingBackup.summary.firstMonth, true) + " a " + monthLabel(pendingBackup.summary.lastMonth, true) : "sem registros com data"}.</p>
            <p className="text-xs leading-relaxed text-muted-foreground">Seus {s.debts.length} registros de contas e {s.txs.length} lançamentos atuais serão substituídos. Uma cópia anterior será guardada neste aparelho para desfazer. As notificações pendentes e o pareamento Android da conta serão preservados.</p>
            <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setPendingBackup(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancelar</button><button type="button" onClick={confirmRestore} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Restaurar este backup</button></div>
          </>}
        </DialogContent>
      </Dialog>
      <Dialog open={pendingUndo !== null && pendingUndo.owner === getFinanceUser()} onOpenChange={(open) => { if (!open) setPendingUndo(null); }}>
        <DialogContent className="w-[calc(100%-2rem)] rounded-2xl">
          <DialogHeader><DialogTitle>Recuperar a cópia anterior?</DialogTitle><DialogDescription>{pendingUndo?.changed ? "Você alterou seus dados depois da restauração. Essas alterações serão substituídas pela cópia anterior." : "Isso desfaz a última substituição e recupera os registros anteriores."}</DialogDescription></DialogHeader>
          <p className="text-xs leading-relaxed text-muted-foreground">Os registros atuais ficarão guardados neste aparelho para recuperar novamente. Você também pode baixar um backup antes de continuar.</p>
          <button type="button" onClick={download} className="justify-self-start text-sm font-bold text-primary">Baixar backup atual</button>
          <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setPendingUndo(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">Cancelar</button><button type="button" onClick={confirmUndo} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground">Confirmar recuperação</button></div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
