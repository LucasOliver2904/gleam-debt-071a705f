import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { ChevronRight, Download, RotateCcw, Trash2, Upload, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { exportBackup, importBackup, resetAll, useFinance } from "@/lib/finance";

export const Route = createFileRoute("/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes e backup — Meu Caixa" },
      { name: "description", content: "Faça backup dos seus dados e restaure em outro aparelho." },
      { property: "og:title", content: "Ajustes e backup — Meu Caixa" },
      { property: "og:description", content: "Backup e restauração das suas finanças." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ajustes,
});

function Card({
  icon: I,
  title,
  desc,
  action,
  danger,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  action: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={action}
      className={`group flex w-full items-center gap-4 rounded-2xl border bg-card p-4 text-left transition hover:bg-secondary/50 ${
        danger ? "border-destructive/30" : "border-border hover:border-primary/30"
      }`}
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
          danger ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
        }`}
      >
        <I size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block text-[15px] font-semibold">{title}</b>
        <span className="text-sm text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight
        size={18}
        className="shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
      />
    </button>
  );
}

function Ajustes() {
  const s = useFinance();
  const file = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `meu-caixa-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Backup baixado");
  };

  const upload = async (f: File) => {
    try {
      importBackup(await f.text());
      toast.success("Dados restaurados");
    } catch {
      toast.error("Arquivo inválido");
    }
  };

  return (
    <AppShell>
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Ajustes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {s.debts.length} contas · {s.txs.length} lançamentos salvos neste aparelho.
        </p>
      </div>

      <div className="mt-6 grid max-w-2xl gap-6">
        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Backup
          </p>
          <div className="space-y-3">
            <Card
              icon={Download}
              title="Baixar backup"
              desc="Salva um arquivo com todos os seus dados."
              action={download}
            />
            <Card
              icon={Upload}
              title="Restaurar backup"
              desc="Carrega um arquivo de backup (ex: passar do PC para o celular)."
              action={() => file.current?.click()}
            />
            <input
              ref={file}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
          </div>
        </section>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Dados
          </p>
          <div className="space-y-3">
            <Card
              icon={RotateCcw}
              title="Voltar dados de exemplo"
              desc="Recarrega as contas da planilha original."
              action={() =>
                confirm("Substituir tudo pelos dados de exemplo?") &&
                (resetAll(true), toast("Dados de exemplo carregados"))
              }
            />
          </div>
        </section>

        <section>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-destructive/80">
            Zona de perigo
          </p>
          <div className="space-y-3">
            <Card
              icon={Trash2}
              danger
              title="Apagar tudo"
              desc="Começa do zero. Faça um backup antes!"
              action={() =>
                confirm("Apagar TODOS os dados? Isso não pode ser desfeito.") &&
                (resetAll(false), toast("Tudo apagado"))
              }
            />
          </div>
        </section>
      </div>
    </AppShell>
  );
}