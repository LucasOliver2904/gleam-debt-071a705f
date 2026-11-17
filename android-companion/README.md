# Prumo Android — instalador privado sem Play Store

Este projeto gera um APK pessoal para ler notificações financeiras selecionadas e abrir o Prumo pelo Chrome. Ele **não** faz transações bancárias nem exige pagamento.

## Instalar o Prumo como aplicativo (PWA, mais simples)

1. Abra https://gleam-debt.lovable.app pelo Google Chrome no seu Android e faça login.
2. No menu de três pontos do Chrome, toque **Instalar app** ou **Adicionar à tela inicial**.
3. O ícone Prumo aparece no celular e abre em janela própria. Também há orientação em **Ajustes** no próprio Prumo.
4. O PWA é seu aplicativo financeiro principal. Ele não pode ler notificações de outros apps diretamente.

## Gerar e instalar o APK privado de captura de notificações

1. Abra o repositório privado https://github.com/LucasOliver2904/gleam-debt-071a705f
2. Entre em **Actions → Prumo Android - instalador privado**.
3. Abra um workflow verde recente, ou use **Run workflow**, com a branch **main**.
4. Em **Artifacts**, baixe **Meu-Caixa-Android-Privado-APK**.
5. Extraia o ZIP. Dentro estará o arquivo **app-debug.apk**.
6. Passe o APK ao celular e instale pelo gerenciador de arquivos. Autorize instalar apps dessa fonte quando o Android solicitar.
7. Abra **Prumo · Android** (o complemento nativo).
8. No site Prumo, abra **Pix e repasses → Pix automático / Android**, crie a chave e copie-a. Cole no complemento, toque **Salvar chave com criptografia** e **Testar conexão HTTPS**. O teste deve retornar 200.
9. Em **Selecionar bancos e carteira**, marque somente Itaú, Sicredi X, Carteira do Google e outros apps financeiros que desejar. NÃO marque WhatsApp, SMS, e-mail ou mensageiros.
10. Em **Abrir acesso às notificações**, autorize o complemento do Prumo.
11. No Android 13+, um APK manualmente instalado pode ter as permissões restritas: abra **Configurações → Apps → Prumo · Android → ⋮ → Permitir configurações restritas**, apenas se confiar no APK privado, e então volte ao acesso às notificações.
12. Toque **Ativar / pausar captura**. O status deve indicar ATIVA.
13. Confira uma notificação financeira real. O código 202 indica recebimento. Pix recebidos vão para **Pix e repasses → A conferir** e compras/Pix enviados para **Lançamentos → Despesas detectadas**.
14. Após confirmar que o complemento funciona, desative suas macros antigas do MacroDroid para não manter dois aplicativos monitorando as mesmas notificações.

## Privacidade e segurança

- A chave da integração é de 256 bits e fica criptografada com AES-GCM no Android Keystore. Não a envie a ninguém.
- A captura só começa após escolher explicitamente os aplicativos e conceder a permissão de notificações.
- O Android concede permissão ampla ao leitor, mas este código só processa os apps selecionados e textos com valor monetário e palavras financeiras.
- Este código rejeita mensagens que contêm palavras relacionadas a senhas, códigos ou autenticação.
- Não guarda histórico bruto de notificações, não faz Pix, não tem SDK de publicidade e não acessa senhas bancárias.
- Utiliza somente HTTPS para o endereço fixo do Prumo. HTTP sem TLS é proibido.
- Para parar, use **Desativar e apagar chave deste Android**. Revogue também a chave em **Pix e repasses**.
- Notificações não comprovam uma transferência. Confira no extrato e confirme manualmente no Prumo antes de contabilizar.
- A duplicidade entre aplicativos é apenas sinalizada quando houver valores iguais em horário próximo.
- O uso pessoal e exclusivamente não econômico recebe tratamento específico na LGPD, art. 4º, inciso I; isso não é uma certificação legal.

## Limitações reais

- O Android pode ocultar o conteúdo de algumas notificações bancárias, bloquear o leitor ou suspender sua execução em segundo plano.
- Sem internet, o envio falha. Não há fila persistente de retransmissão nesta primeira versão.
- O APK é **debug**, assinado pelo ambiente de build do GitHub. Ao atualizar pode ser necessário desinstalar a versão anterior e configurar novamente por conta da assinatura.
- É um complemento separado, não substitui o PWA. O botão **Abrir Prumo** abre seu navegador e mantém a compatibilidade com login Google.
- O webhook precisa estar realmente disponível no servidor de produção. O teste HTTPS confirma se a chave foi reconhecida.
- O Supabase do Prumo está vinculado a um projeto Lovable Cloud que não aparece na conexão de administração disponível aqui. O RLS real não foi auditado, apenas a migração de código.
- O workflow pode consumir a franquia gratuita de minutos do GitHub Actions para repositórios privados. Nenhuma compra é criada por este projeto.
- Para publicação na Play Store seria necessário um instalador de produção com assinatura estável, documentação extra e registro de desenvolvedor. **Não estamos publicando nem pagando.**

Código: pasta android-companion.
Build: .github/workflows/meu-caixa-android.yml.
Privacidade web: https://gleam-debt.lovable.app/privacidade.
