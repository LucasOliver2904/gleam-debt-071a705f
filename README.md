# Gleam Debt

QUERO QUE VOCÊ CRIE UM APLICATIVO, PRA EU PODER COLOCAR MINHAS DIVIDAS, COM BASE NO QUE VOU TE MANDAR, PRA EU LANÇAR TUDO QUE ENTRAR E TUDO QUE SAIR, PRA EU DIGITAR UMA NOVA DIVIDA, QUANTIDADE DE PARCELAS, O QUANTO AINDA DEVO, COM UM DASHBOARD INICIAL PRA EU VER O QUE FALTA EU PAGAR, OS MESES TUDO DETALHADO, TIPO UM APP PROFISSIONAL MESMO DE FINANÇAS, PARA EU LANÇAR TUDO.
CONSEGUE?

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gleam-debt.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7c958dbd-12a5-4ed5-9504-ad0c515c6db1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Melhorias de segurança e experiência (novembro/2026)

- Nome e inicial no painel refletem a conta autenticada, sem nomes pessoais fixos no código.
- Novo lançamento rápido utiliza janela acessível, campos identificados e validação de dados.
- A marcação de pagamento pelo painel oferece ação **Desfazer**.
- O carregamento do painel utiliza indicadores visuais em vez de área vazia.
- Registros de demonstração para contas novas são explicitamente fictícios e relativos ao mês atual. **As dívidas de contas existentes no Supabase não são redefinidas por essa atualização.**
- IDs de novos lançamentos preferem `crypto.randomUUID`, com fallback para navegadores antigos. IDs já salvos não mudam.
- O GitHub Actions verifica build, tipos e testes, e relata o lint como diagnóstico não bloqueante.
- Foram aproveitadas melhorias de um script externo sugerido para a marca "Prumo". O aplicativo continua se chamando **Meu Caixa**: renomeá-lo exige uma decisão de marca separada para preservar links, PWA e integração Android.
