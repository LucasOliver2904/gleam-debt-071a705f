import { useEffect, useState } from "react";
import { Download, ExternalLink, Smartphone, CheckCircle2, ShieldCheck, RefreshCw, Info } from "lucide-react";
import { toast } from "sonner";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function InstallAppCard() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [android, setAndroid] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)");
    const onInstall = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPromptEvent);
    };
    const update = () => setInstalled(standalone.matches || "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    setAndroid(/Android/i.test(navigator.userAgent));
    update();
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", update);
    standalone.addEventListener("change", update);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", update);
      standalone.removeEventListener("change", update);
    };
  }, []);

  const install = async () => {
    if (!prompt) return;
    try {
      await prompt.prompt();
      const decision = await prompt.userChoice;
      if (decision.outcome === "accepted") setPrompt(null);
    } catch {
      toast.error("Use o menu do navegador para instalar o Prumo.");
    }
  };

  async function refreshVersion() {
    try {
      if ("serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        await reg?.update();
      }
    } catch {
      // Ainda é possível recarregar o aplicativo quando o service worker falha.
    }
    window.location.reload();
  }

  return (
    <section className="rounded-2xl border border-primary/25 bg-card p-5">
      <div className="flex gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><Smartphone size={21} /></span>
        <div>
          <p className="finance-kicker">ANDROID / INSTALAÇÃO PRIVADA</p>
          <h2 className="mt-1 font-display text-lg font-bold">Prumo no celular</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Você não precisa publicar na Play Store. Instale este site como aplicativo,
            com ícone e janela própria, mantendo o login na sua conta.
          </p>
        </div>
      </div>
      {installed ? (
        <p className="mt-4 flex items-center gap-2 rounded-xl bg-success/10 px-4 py-3 text-sm font-semibold text-success"><CheckCircle2 size={17}/> O Prumo já está aberto em modo aplicativo.</p>
      ) : prompt ? (
        <button type="button" onClick={() => void install()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"><Download size={16}/> Instalar Prumo</button>
      ) : (
        <p className="mt-4 rounded-xl border border-border bg-secondary/30 px-4 py-3 text-sm leading-relaxed">
          {android
            ? "No Google Chrome, abra o menu ⋮ no canto superior direito e escolha “Instalar app” ou “Adicionar à tela inicial”."
            : "No Android com Google Chrome, abra este endereço, menu ⋮ → Instalar app. Se estiver no computador, use a opção de instalação do navegador."}
        </p>
      )}
      <div className="mt-4 rounded-2xl border border-primary/25 bg-primary/5 p-3.5 sm:p-4">
        <p className="flex items-center gap-2 text-sm font-extrabold"><RefreshCw size={17} className="text-primary"/> Atualizar visual e ícone</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Identidade atual: <strong className="text-foreground">Prumo · Teal</strong>. O nome e a imagem do atalho antigo “Meu Caixa” podem ficar salvos pelo Android mesmo depois de atualizar o site.</p>
        <button type="button" onClick={() => void refreshVersion()} className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2.5 text-xs font-extrabold text-primary hover:bg-primary/15">
          <RefreshCw size={15}/> Verificar e recarregar Prumo
        </button>
        <p className="mt-3 flex gap-2 text-xs leading-relaxed text-muted-foreground"><Info size={16} className="mt-0.5 shrink-0 text-info"/>
          Se continuar “Meu Caixa” na tela inicial, primeiro confirme que os lançamentos estão sincronizados e faça um backup em Ajustes. Depois, remova a instalação/atalho antigo, abra o endereço do Prumo no Chrome e escolha <strong>Instalar app</strong> para obter o novo nome e ícone. Não use “Limpar dados” no Android.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck size={15} className="text-primary"/>
        <span>Instalar não dá acesso ao seu banco e não transforma o site em aplicativo com leitura nativa de notificações.</span>
      </div>
      <a href="/privacidade" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">Como seus dados são tratados <ExternalLink size={13}/></a>
    </section>
  );
}
