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
    <section className="finance-surface mt-6 overflow-hidden rounded-3xl border border-primary/30 bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Smartphone size={21} /></span>
          <div>
            <p className="finance-kicker">PIX AUTOMÁTICO / ANDROID</p>
            <h2 className="mt-1 font-display text-xl font-extrabold">Conecte seus bancos e a Carteira do Google</h2>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Conecte seus bancos e a Carteira do Google pelo complemento Android privado ou pelo MacroDroid. Pix e compras chegam para sua conferência, sem alterar os totais automaticamente.
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
          <h3 className="font-display text-base font-extrabold">Configure em seu Android</h3>
          <div className="rounded-2xl border border-primary/30 bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><span className="finance-pill">MÉTODO RECOMENDADO</span><h4 className="mt-2 font-display text-lg font-extrabold">Meu Caixa · Android privado</h4></div>
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/12 text-primary"><Smartphone size={22}/></span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Instale o complemento Android gratuito e selecione quais aplicativos bancários ele pode acompanhar. É uma ferramenta pessoal e não exige conta na Play Store.</p>
            <ol className="mt-4 list-inside list-decimal space-y-2 text-sm leading-relaxed">
              <li><a target="_blank" rel="noreferrer" href="https://github.com/LucasOliver2904/gleam-debt-071a705f/actions/workflows/meu-caixa-android.yml" className="font-bold text-primary hover:underline">Abra o instalador privado no seu GitHub <ExternalLink size={13} className="inline" /></a>, baixe o ZIP em <b>Artifacts</b> e extraia o APK.</li>
              <li>Instale e abra <strong>Meu Caixa · Android</strong> no seu celular.</li>
              <li>Crie sua chave nesta página, copie e cole no complemento. Toque em <strong>Testar conexão HTTPS</strong>.</li>
              <li>Marque apenas seus bancos e a Carteira do Google. Conceda acesso a notificações e ative a captura.</li>
              <li>Confira um recebimento ou uma compra real no Meu Caixa antes de desativar o MacroDroid.</li>
            </ol>
            <p className="mt-3 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs leading-relaxed text-muted-foreground">O instalador é um APK privado de testes. A leitura de notificações depende das permissões Android e da mensagem do banco. Não deixe duas automações ativas sem necessidade.</p>
          </div>

          <details className="rounded-2xl border border-border bg-card p-4 sm:p-5">
            <summary className="cursor-pointer text-sm font-bold text-primary">Prefiro usar o MacroDroid · Ver instruções alternativas</summary>
            <ol className="mt-4 list-inside list-decimal space-y-3 text-sm leading-relaxed text-foreground">
            <li><a href={bankAppUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">Instale o MacroDroid pela Play Store <ExternalLink size={13} /></a> e conceda acesso às notificações do Android quando solicitado.</li>
            <li>Toque em <strong>Adicionar macro</strong>. No gatilho <strong>Notificação recebida</strong>, escolha apenas os bancos para sua macro de Pix. Filtre por <strong>Pix</strong> e escolha notificação recebida (não removida).</li>
            <li>Para compras, crie outra macro com <strong>Carteira do Google</strong> e os bancos que notificam compras. Filtre pelo texto <strong>Compra</strong> ou <strong>Pagamento</strong>, conforme as notificações reais. A macro de Pix existente pode continuar igual.</li>
            <li>Adicione a ação <strong>Requisição HTTP / HTTP Request</strong>, com método <strong>POST</strong> e o endereço abaixo. Não use GET para enviar Pix.</li>
            <li>Adicione <code>X-MeuCaixa-Token</code> com a chave privada. No cabeçalho <code>X-MeuCaixa-Banco</code>, use o <strong>Texto Mágico: nome do aplicativo <code>{"{not_app_name}"}</code></strong>. Assim identificamos Sicredi, Itaú e Google Wallet separadamente para avisar sobre duplicidades. Use <code>text/plain</code> como tipo do corpo.</li>
            <li>Em <strong>Corpo / Body</strong>, escolha texto e insira o título e o conteúdo da notificação, um em cada linha. Use o seletor de <strong>Texto Mágico</strong> do MacroDroid para inserir os campos de notificação.</li>
            <li>Salve e ative as macros. Pix recebido vai para <strong>Pix e repasses → A conferir</strong>. Pix enviado e compras aparecem em <strong>Lançamentos → Despesas detectadas</strong>. Confira o banco antes de salvar.</li>
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

          </details>
          <p className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-primary" />
            O Android dá ao leitor de notificações uma permissão ampla. Escolha exclusivamente os bancos e a Carteira do Google e nunca inclua apps de mensagens ou códigos de autenticação. O Meu Caixa guarda apenas os campos financeiros reconhecidos, não o texto completo da notificação.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">Alguns bancos ocultam detalhes do Pix. O Android também pode limitar notificações sensíveis. Faça primeiro um teste com um recebimento real e confira o extrato do banco. Se a notificação não mostrar valor, a automação não tem como adivinhá-lo.</p>
        </div>
      )}
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">A chave autoriza somente importar sugestões de Pix e compras para sua conta, não fazer transações bancárias. Você pode revogá-la a qualquer momento. A integração exige que o servidor do Meu Caixa esteja acessível.</p>
    </section>
  );
}
