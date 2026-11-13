import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, LockKeyhole, Server, Smartphone, DatabaseBackup, Trash2 } from "lucide-react";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Privacidade e segurança — Meu Caixa" },
      { name: "description", content: "Como seus dados financeiros e as notificações são tratados no uso privado." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <AppShell>
      <header className="max-w-3xl">
        <p className="finance-kicker">SEUS DADOS / TRANSPARÊNCIA</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight md:text-3xl">Privacidade e segurança</h1>
        <p className="mt-2 text-sm text-muted-foreground">Informações para o uso pessoal e privado do Meu Caixa. Revisão: novembro de 2026.</p>
      </header>
      <div className="mt-6 max-w-3xl space-y-4 text-sm leading-relaxed">
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><ShieldCheck className="text-primary" size={19}/> Uso pessoal</h2>
          <p className="mt-3 text-muted-foreground">O Meu Caixa foi desenvolvido como ferramenta de controle financeiro pessoal, não como banco ou instituição de pagamento. Ele não executa Pix, não transfere dinheiro e não acessa seu extrato por conta própria. Esta versão não é um serviço comercial disponível ao público.</p>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Server className="text-primary" size={19}/> Quais informações existem no aplicativo?</h2>
          <p className="mt-3 text-muted-foreground">A conta de acesso é gerenciada pelo serviço de autenticação do Supabase/Lovable Cloud. Você registra valores, dívidas, parcelas, descrições, categorias, metas e datas. Esses dados podem ser sincronizados com o banco de dados vinculado ao aplicativo e guardados em cache neste dispositivo, separados por conta.</p>
          <p className="mt-2 text-muted-foreground">O aplicativo não precisa de sua senha do banco, chave Pix, SMS, código de autenticação nem dados de cartão para funcionar.</p>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Smartphone className="text-primary" size={19}/> Notificações bancárias</h2>
          <p className="mt-3 text-muted-foreground">A leitura de notificações de outros aplicativos depende de uma automação Android separada (MacroDroid ou o componente nativo pessoal), ativada explicitamente por você. Configure apenas os bancos e a carteira que deseja monitorar. O sistema envia ao Meu Caixa o título e o texto de notificações financeiras selecionadas para interpretar valor e direção.</p>
          <p className="mt-2 text-muted-foreground">O webhook procura conservar somente valor, data, aplicativo de origem, nome/estabelecimento quando identificado e um identificador de duplicidade. O texto completo não é salvo no histórico financeiro. Avisos ficam aguardando conferência e não devem ser tratados como comprovantes.</p>
          <p className="mt-2 text-muted-foreground">A chave de integração deve permanecer privada e pode ser revogada na aba Pix e repasses. O aplicativo Android complementar exige uma permissão ampla de notificações do sistema: não a conceda se não quiser utilizá-la.</p>
        </section>
        <section className="rounded-2xl border border-primary/25 bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><LockKeyhole className="text-primary" size={19}/> Prints de extrato e reconhecimento no aparelho</h2>
          <p className="mt-3 text-muted-foreground">Na área <Link to="/extrato" className="font-semibold text-primary hover:underline">Importar extrato</Link>, você pode selecionar capturas de tela ou colar texto. O reconhecimento das imagens é feito no próprio navegador com Tesseract.js. O motor e os modelos de idioma precisam ser baixados pela internet na primeira utilização, mas as imagens não são enviadas a um serviço externo de OCR ou à API do Meu Caixa.</p>
          <p className="mt-2 text-muted-foreground">A prévia de texto/imagens fica temporariamente na página e é descartada quando você sai dela. Somente lançamentos explicitamente confirmados (data, tipo, nome, valor e, se for Pix, valor que ficou com você) passam para o histórico e podem ser sincronizados pelo Supabase/Lovable Cloud. Uma indicação do banco e o horário da importação também podem acompanhar o lançamento.</p>
          <p className="mt-2 text-muted-foreground">O OCR pode cometer erros e avisos de duplicidade são apenas sugestões. Compare os valores com o extrato original antes de confirmar. Não inclua números de conta, códigos ou outros dados que não sejam necessários na descrição das movimentações.</p>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><LockKeyhole className="text-primary" size={19}/> Segurança e compartilhamento</h2>
          <p className="mt-3 text-muted-foreground">A conta é protegida pelo login. A configuração de banco do projeto prevê políticas por proprietário (Row Level Security), mas a aplicação das regras e a configuração de autenticação ainda precisam ser auditadas diretamente no projeto financeiro real antes de qualquer distribuição a outras pessoas.</p>
          <p className="mt-2 text-muted-foreground">Não há venda de dados pelo código do Meu Caixa. Provedores de infraestrutura e autenticação podem processar dados técnicos necessários para a operação de seus serviços, conforme seus próprios termos.</p>
        </section>
        <section className="rounded-2xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><DatabaseBackup className="text-primary" size={19}/> Cópia e controle dos dados</h2>
          <p className="mt-3 text-muted-foreground">Em <Link to="/ajustes" className="font-semibold text-primary hover:underline">Ajustes</Link> você pode baixar um backup em JSON, restaurar uma cópia e apagar seus registros financeiros. O arquivo de backup fica sob sua responsabilidade e deve ser guardado em local seguro, pois contém seus dados.</p>
          <p className="mt-2 text-muted-foreground">Apagar os registros financeiros não é o mesmo que excluir a conta de autenticação ou eventuais cópias de segurança mantidas pelo provedor.</p>
        </section>
        <section className="rounded-2xl border border-destructive/25 bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold"><Trash2 className="text-destructive" size={19}/> Excluir a conta integralmente</h2>
          <p className="mt-3 text-muted-foreground">Para excluir também a identidade de login e dados mantidos pelo provedor, será necessário utilizar as ferramentas de administração do projeto financeiro no Lovable Cloud/Supabase. Não considere o botão “Apagar tudo” equivalente a essa operação.</p>
        </section>
        <p className="text-xs text-muted-foreground">Esta página explica o tratamento projetado pelo aplicativo e não representa certificação, auditoria jurídica ou garantia de conformidade da infraestrutura. Para uso exclusivamente particular e não econômico, a LGPD prevê uma hipótese de não aplicação no art. 4º, I, sem dispensar cuidados de segurança.</p>
      </div>
    </AppShell>
  );
}
