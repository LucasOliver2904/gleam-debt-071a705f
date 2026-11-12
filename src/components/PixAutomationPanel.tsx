import { useState } from "react";
import {
  BellRing, CheckCircle2, Clipboard, ExternalLink, KeyRound, LockKeyhole, RotateCcw,
  ShieldCheck, Smartphone, Unplug, Wifi,
} from "lucide-react";
import { toast } from "sonner";
import { setState, useFinance } from "@/lib/finance";
import { digestAutomationKey, generateAutomationKey } from "@/lib/pix-bridge";

const endpoint = "/api/pix-notificacao";
const bankAppUrl = "https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid";

export function PixAutomationPanel() {
  const s = useFinance();
  const enabled = Boolean(s.pixAutomationHash);
  const [key, setKey] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [testing, setTesting] = useState(false);
  const [busy, setBusy] = useState(false);
  const url = typeof window === "undefined" ? endpoint : location.origin + endpoint;

  async function copy(value: string, title: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(title + " copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  async function pair() {
    if (!window.isSecureContext || !crypto.subtle || !crypto.getRandomValues) {
      toast.error("A conexão precisa ser HTTPS para configurar a automação.");
      return;
    }
    if (enabled && !window.confirm("Gerar outra chave revogará a anterior e exigirá atualizar a macro no Android. Continuar?")) return;
    setBusy(true);
    try {
      const rawKey = generateAutomationKey();
      const hash = await digestAutomationKey(rawKey);
      setState((state) => ({ ...state, pixAutomationHash: hash }));
      setKey(rawKey);
      setExpanded(true);
      toast.success("Chave criada. Copie e coloque no MacroDroid!");
    } catch {
      toast.error("Não foi possível criar a chave.");
    } finally {
      setBusy(false);
    }
  }

  function revoke() {
    if (!window.confirm("Desativar a integração? Seu celular não poderá enviar novos Pix até você gerar outra chave.")) return;
    setState((state) => ({ ...state, pixAutomationHash: undefined }));
    setKey("");
    toast.success("Integração desativada.");
  }

  async function test() {
    if (!key) {
      toast.error("Por segurança, a chave aparece só após ser criada. Gere uma nova para testar.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(endpoint, {
        method: "GET",
        headers: { "X-MeuCaixa-Token": key },
        cache: "no-store",
      });
      if (res.ok) toast.success("Servidor conectado e chave reconhecida! Configure a macro no Android.");
      else toast.error(res.status === 401 ? "O servidor ainda não reconheceu a chave. Aguarde a sincronização e teste novamente." : "Servidor indisponível. Tente novamente.");
    } catch {
      toast.error("Não foi possível acessar o servidor.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="mt-6 overflow-hidden rounded-3xl border border-primary/20 bg-card p-4 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Smartphone size={21} /></span>
          <div>
            <p className="finance-kicker">PIX AUTOMÁTICO / ANDROID</p>
            <h2 className="mt-1 font-display text-xl font-extrabold">Conecte as notificações do seu banco</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Use o MacroDroid para detectar notificações de Pix recebido. O Meu Caixa guarda o recebimento para você revisar antes de somar à renda.
            </p>
          </div>
        </div>
        <span className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold " +
          (enabled ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")}>
          {enabled ? <CheckCircle2 size={14} /> : <Unplug size={14} />}
          {enabled ? "Chave cadastrada" : "Ainda não conectado"}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => void pair()} disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90 disabled:opacity-50">
          {enabled ? <RotateCcw size={16} /> : <KeyRound size={16} />}
          {enabled ? "Gerar nova chave" : "1. Criar chave do celular"}
        </button>
        <button type="button" onClick={() => setExpanded((value) => !value)}
          className="rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary">
          {expanded ? "Ocultar instruções" : "Ver configuração passo a passo"}
        </button>
        {enabled && <button type="button" onClick={revoke} className="rounded-xl border border-destructive/35 px-4 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/10">Desativar conexão</button>}
      </div>

      {key && (
        <div className="mt-4 rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <p className="flex items-center gap-2 text-xs font-semibold text-foreground"><LockKeyhole size={15} className="text-accent" /> Sua chave privada de conexão</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Ela só aparece enquanto esta tela estiver aberta. Não envie a ninguém nem coloque em mensagens ou links públicos.</p>
          <div className="mt-3 flex gap-2">
            <input className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground" readOnly aria-label="Chave secreta de integração" value={key} onFocus={(event) => event.target.select()} />
            <button type="button" onClick={() => void copy(key, "Chave")} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground"><Clipboard size={15} /> Copiar</button>
          </div>
          <button type="button" disabled={testing} onClick={() => void test()} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline disabled:opacity-50">
            <Wifi size={15} /> {testing ? "Verificando..." : "Testar conexão com o servidor"}
          </button>
        </div>
      )}

      {expanded && (
        <div className="mt-5 space-y-4 rounded-2xl border border-border bg-secondary/25 p-4 sm:p-5">
          <h3 className="font-display text-base font-extrabold">Configure uma vez no seu Android</h3>
          <ol className="list-inside list-decimal space-y-3 text-sm leading-relaxed text-foreground">
            <li><a href={bankAppUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Instale o MacroDroid pela Play Store <ExternalLink size={13} /></a> e conceda acesso às notificações do Android quando solicitado.</li>
            <li>Toque em <strong>Adicionar macro</strong>. No gatilho <strong>Notificação recebida</strong>, escolha apenas o aplicativo do seu banco. Filtre por texto que contenha <strong>Pix</strong> e escolha notificação recebida (não removida).</li>
            <li>Adicione a ação <strong>Requisição HTTP / HTTP Request</strong>, com método <strong>POST</strong> e o endereço abaixo. Não use GET para enviar Pix.</li>
            <li>Adicione os cabeçalhos <code>X-MeuCaixa-Token</code> com a chave privada copiada acima e <code>X-MeuCaixa-Banco</code> com o nome do seu banco (ex.: Nubank). Use <code>Content-Type</code> igual a <code>text/plain; charset=utf-8</code>.</li>
            <li>Em <strong>Corpo / Body</strong>, escolha texto e insira o título e o conteúdo da notificação, um em cada linha. Use o seletor de <strong>Texto Mágico</strong> do MacroDroid para inserir os campos de notificação.</li>
            <li>Salve e ative a macro. Ao chegar um Pix real, abra <strong>Pix e repasses → A conferir</strong>, veja o valor e informe quanto fica com você.</li>
          </ol>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">ENDEREÇO DA REQUISIÇÃO (HTTPS)</p>
            <div className="flex gap-2">
              <input readOnly value={url} aria-label="URL da automação Pix" onFocus={(event) => event.target.select()} className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2.5 text-xs" />
              <button onClick={() => void copy(url, "Endereço")} className="rounded-xl border border-border px-3 py-2 text-xs font-bold hover:bg-secondary">Copiar</button>
            </div>
            <p className="text-xs font-semibold text-muted-foreground">CORPO: INSIRA ESSES CAMPOS PELO TEXTO MÁGICO</p>
            <pre className="overflow-x-auto rounded-xl border border-border bg-background p-3 text-xs leading-relaxed text-foreground">{'{not_title}\n{notification}'}</pre>
          </div>

          <p className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" />
            O Android concede ao MacroDroid acesso amplo às notificações, mas configure a macro para enviar <strong className="text-foreground">somente as do banco</strong>. O Meu Caixa usa apenas os campos de Pix recebido; o texto completo não é salvo no histórico.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">Alguns bancos ocultam detalhes do Pix. O Android também pode limitar notificações sensíveis. Faça primeiro um teste com um recebimento real e confira o extrato do banco. Se a notificação não mostrar valor, a automação não tem como adivinhá-lo.</p>
        </div>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">A chave autoriza somente importar propostas de Pix para sua conta, não fazer transações bancárias. Você pode revogá-la a qualquer momento. A integração exige que o servidor do Meu Caixa esteja acessível.</p>
    </section>
  );
}
