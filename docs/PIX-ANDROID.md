# Pix automático no Android — Meu Caixa

## Como funciona

MacroDroid detecta a notificação do app do banco e envia título e texto por HTTPS para o webhook do Meu Caixa. Um segredo criado dentro da sua conta autentica a requisição.
O servidor identifica o Pix recebido e o coloca na fila **Pix e repasses → A conferir**. A fila não aumenta sua renda. Você confirma no extrato e informa quanto fica com você.
Exemplo: recebeu R$ 500 de Fulano; informou R$ 50 para si; os outros R$ 450 passam a ser um repasse pendente. A renda aumenta somente R$ 50.

## Passo a passo

1. No Android, abra https://gleam-debt.lovable.app/pix, faça login e abra a seção **Pix automático / Android**.
2. Toque **Criar chave do celular**, copie a chave e toque **Testar conexão com o servidor**. O teste deve confirmar que o servidor reconheceu a chave. Se falhar, aguarde alguns segundos para a sincronização e teste novamente.
3. Instale MacroDroid pela Play Store: https://play.google.com/store/apps/details?id=com.arlosoft.macrodroid
4. Abra MacroDroid, dê permissão de **acesso às notificações** do Android e toque em **Adicionar macro**.
5. Gatilho: **Notificação recebida**. Selecione SOMENTE o app de seu banco, não todos os apps. Filtre o conteúdo pela palavra **Pix**, se o banco a inclui.
6. Ação: **HTTP Request / Requisição HTTP**. Método **POST**. Endereço: https://gleam-debt.lovable.app/api/pix-notificacao
7. Cabeçalho **X-MeuCaixa-Token**: a chave secreta copiada do Meu Caixa.
8. Cabeçalho **X-MeuCaixa-Banco**: nome do banco, por exemplo Nubank.
9. Tipo de conteúdo: **text/plain; charset=utf-8**.
10. Corpo: duas linhas usando o seletor **Texto Mágico** do MacroDroid, primeiro o campo título da notificação ({not_title}) e, na linha seguinte, o texto da notificação ({notification}). Escolha as variáveis oferecidas pelo app em vez de digitá-las literalmente.
11. Salve/ative a macro. Na próxima notificação real de Pix recebido, confirme no extrato e abra **Pix e repasses → A conferir → Conferir e dividir**.
12. Preencha a quantia que fica com você e salve. A receita só é contabilizada depois da conferência.

## Respostas do servidor

- **GET 200** com chave: conexão autorizada, sem criar Pix.
- **POST 202**: notificação aceita e salva para conferência.
- **POST 200 duplicate**: notificação repetida em período curto, ignorada.
- **401**: chave incorreta, revogada ou ainda não sincronizada.
- **422**: texto não identificado como Pix recebido; a notificação pode estar oculta ou num formato diferente.
- **503**: servidor temporariamente indisponível; confira se o app está publicado e o banco está disponível.
- Notificações idênticas do mesmo banco em 2 minutos são tratadas como uma só. Dois Pix reais iguais podem precisar de lançamento manual.

## Segurança e privacidade

- A automação NÃO usa senha bancária, token Pix, autenticação do banco ou acesso ao seu extrato.
- O Android concede ao MacroDroid acesso amplo às notificações; restrinja a macro aos apps de bancos e a Pix.
- A chave privada não deve ser compartilhada nem colocada na URL. Ela é enviada somente em um cabeçalho HTTPS. Apenas o hash da chave é armazenado no estado do Meu Caixa.
- O corpo completo da notificação não é salvo no histórico: só valor, nome sugerido, banco, data e identificador técnico.
- Confirmar a notificação não comprova o pagamento. Confira o valor no extrato bancário antes de classificar a entrada.
- Android 15 ou superior e alguns bancos podem ocultar partes da notificação. Nesse caso, não é possível adivinhar o que estiver oculto.
- Se a macro parar em segundo plano, confira as permissões e as opções de bateria para o MacroDroid.
- A automação pode receber Pix mesmo com o navegador Meu Caixa fechado, desde que MacroDroid esteja ativo, o Android disponibilize a notificação e haja internet.
- A qualquer momento, **Desativar conexão** no Meu Caixa revoga a chave.

## Implantação

O webhook usa a tabela já existente user_state no projeto Lovable Cloud, sem migração. O servidor de produção precisa fornecer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY ao código server-side. O serviço precisa estar publicado; o teste na tela confirma essa etapa.
