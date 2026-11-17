# Prumo

Aplicativo de **finanças pessoais e controle de dívidas**: registre o que entra e o que
sai, acompanhe parcelas, vencimentos e quanto ainda falta pagar, mês a mês.

> Antes chamado *Gleam Debt / Meu Caixa*. App publicado: https://gleam-debt.lovable.app
> (o endereço continua o mesmo até você trocar o domínio nas configurações do Lovable).

## Funcionalidades

- **Painel**: sobra prevista do mês, contas pagas e pendentes e dívidas a quitar.
- **Resumo da semana e histórico**: contas a vencer nos próximos sete dias,
  atrasos separados e últimas movimentações na tela inicial.
- **Lançamento rápido**: atalhos de mercado, transporte e descrições frequentes,
  com opção de desfazer sem apagar outros registros.
- **Dívidas**: parceladas, fixas (recorrentes) e únicas, com saldo restante e parcelas.
- **Agenda**: vencimentos por dia, com marcação de contas como pagas (e desfazer).
- **Lançamentos**: entradas e saídas, categorias e conferência de gastos pendentes.
- **Pix e repasses**: separa o valor recebido do que é seu; avisos automáticos pelo
  app Android ficam como rascunho até você conferir.
- **Importar extrato**: leitura de prints (OCR no próprio aparelho) com conferência
  e proteção contra duplicidade antes de lançar.
- **Planejamento**: orçamentos por categoria, metas de economia e previsões.
- **Lembretes** de vencimento, tema claro/escuro e instalação como PWA.
- **Modo privacidade**: o botão de olho oculta os valores de consulta em todas as
  telas, inclusive gráficos e formulários preenchidos, com preferência neste
  aparelho. Os arquivos exportados continuam completos.
- **Primeiros passos**: guia opcional por conta para definir a renda base prevista,
  cadastrar uma conta e registrar a primeira movimentação. A previsão explica
  separadamente a renda base, as entradas registradas e as despesas.
- **Interface consistente**: paleta teal com temas claro/escuro, confirmações no
  aplicativo, navegação por teclado e controles de toque maiores.
- **Sincronização acompanhada**: indicador de envio, pendências preservadas no
  aparelho e conferência quando dois aparelhos alteram os mesmos dados.
- **Backup com recuperação**: validação e prévia antes de restaurar, cópia anterior
  por conta e recuperação reversível neste aparelho. Aceita backups antigos e o
  novo formato versionado; as chaves de automação não entram no arquivo.

## Tecnologias

TanStack Start + React 19, Tailwind CSS 4, shadcn/ui, Lovable Cloud (Supabase) com RLS,
Recharts, Vitest e Drizzle (migrações). Gerenciador de pacotes: **Bun**.

## Como rodar

```sh
bun install
bun run dev         # desenvolvimento
bun run test        # testes
bunx tsc --noEmit   # tipos
bun run lint        # lint (no CI é informativo, não bloqueia)
bun run build       # build de produção
```

As variáveis `VITE_SUPABASE_*` do `.env` são chaves **publicáveis** (seguras no
navegador). Chaves de serviço existem só no servidor e nunca devem ir para o
repositório, para o navegador ou para o APK.

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/routes/` | Páginas e a API `api/pix-notificacao` |
| `src/lib/finance.ts` | Modelo de dados, cálculos e cache local por usuário |
| `src/lib/sync.ts` | Sincronização com o banco (gravação condicional por versão) |
| `src/components/` | Telas e componentes; `ui/` é o shadcn/ui |
| `drizzle/` | Esquema e migrações do banco |
| `android-companion/` | App Android que repassa notificações bancárias (uso privado) |
| `scripts/` | Teste de fumaça HTTP do servidor real e geração de ícones |
| `docs/` | Segurança, privacidade e guia do Pix no Android |

## Segurança

Leia `docs/SECURITY-PRIVATE.md` antes de abrir o app para outras pessoas. O ponto
principal: manter desligado o cadastro público de usuários no Auth e conferir as
políticas RLS no banco real.

## Convenções

- Interface e mensagens em português do Brasil.
- Todo push passa pelo CI: build, tipos, testes e teste de fumaça.
- O repositório sincroniza com o Lovable: não reescreva o histórico publicado.
