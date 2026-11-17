# Prumo — revisão de segurança e privacidade (uso privado)

## Status do projeto

- Repositório GitHub: PRIVADO; não publicar nem copiar para um repositório público.
- Aplicativo web já pode ser instalado pelo Google Chrome como PWA, sem taxa de Play Store.
- Complemento Android em Java, com API HTTPS fixa, permissão de notificações sob controle do sistema e chave cifrada no Android Keystore. O workflow GitHub Actions gera APK debug privado (não publicar na loja).
- Página de privacidade e instalação na aba Ajustes.
- Autenticação: tela de cadastro removida para o uso privado. Isso **NÃO bloqueia** novos cadastros via API do provedor. Ainda é preciso verificar a configuração real do Supabase Auth do Prumo.
- Cache local: chaves separadas por UID autenticado, e não compartilhadas entre contas; cache antigo preservado só para importação manual confirmada.
- Backups: não exportam o hash de pareamento do Android nem restauram chaves revogadas.
- As regras da migração de código user_state usam RLS para SELECT/INSERT/UPDATE/DELETE, filtrando por auth.uid() = user_id. **Não verificamos o banco real**, porque ele está no projeto Lovable Cloud cmalxzidslfilcfnqfbx e a conexão Supabase desta sessão mostra somente projetos BR STORM. Não aplicar comandos em BR STORM.

## Checklist obrigatório no projeto financeiro real (pendente de acesso)

**Abra SOMENTE o banco vinculado ao Prumo no Lovable Cloud/Supabase.** Antes de usar para outro usuário ou divulgar, verificar:
1. Supabase Database → Tables → user_state → Row Level Security habilitado.
2. Policies: SELECT, INSERT, UPDATE e DELETE **somente quando user_id = auth.uid()**; na UPDATE conferir USING e WITH CHECK.
3. Confirmar que a role anon não consegue ler nem gravar user_state; grants e políticas devem ser avaliados juntos.
4. Inspecionar outras tabelas, especialmente push_subscriptions se existente, e habilitar políticas específicas por user_id.
5. Auth → Providers/Sign-ups: desligar cadastro público caso a instalação seja exclusiva da conta existente, sem desativar login da conta.
6. Auth: exigir senha forte, confirmação por e-mail, MFA quando disponível; proteger o acesso à conta de administrador do Supabase e do Lovable.
7. Confirmar se a função server-side de notificações realmente tem SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente seguro, nunca no Vite/browser, APK ou GitHub.
8. Definir procedimentos de backup e restauração. O botão Apagar tudo remove registros financeiros, mas não exclui conta de autenticação nem backups do provedor.
9. Testar login, edição, exclusão, sincronização e avisos em aparelho real, com dados fictícios antes de usar em produção.

## Consultas de diagnóstico (somente leitura; executar em SQL Editor do projeto CORRETO)

    SELECT n.nspname AS schema, c.relname AS tabela, c.relrowsecurity AS rls_ativa
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r';

    SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public';

    SELECT table_schema, table_name, grantee, privilege_type
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('user_state', 'push_subscriptions');

Se as políticas estiverem ausentes, não tente consertar na base da BR STORM e não execute alterações destrutivas sem backup.

## Modelo de ameaça (uso pessoal)

- **Telefone perdido:** use biometria/PIN do dispositivo; revogue o token Android e troque a senha de login.
- **Token de integração exposto:** gere uma chave nova no site e substitua na automação ou complemento. Não envie token em print.
- **Aviso falso de Pix:** o sistema apenas cria rascunho para conferência, nunca soma sem revisão. Confirme no extrato.
- **Aviso duplicado:** mesmo texto e origem em janela curta é ignorado; bancos diferentes com mesma compra geram apenas alerta.
- **Chrome compartilhado:** não deixe sessões abertas em dispositivos de terceiros. Chaves de cache estão separadas por UID, mas o dispositivo desbloqueado ainda pode ter acesso a dados locais.
- **Backup JSON:** contém seus dados financeiros sem criptografia de arquivo; guarde-o em local protegido, não em grupo de mensagens.

## LGPD para uso exclusivamente particular

A Lei nº 13.709/2018 (LGPD) art. 4º, I, prevê não aplicação para tratamentos de dados pessoais realizados por pessoa natural para fins exclusivamente particulares e não econômicos. Esta documentação não é parecer jurídico. Se o projeto passar a atender outras pessoas, o contexto legal muda e será preciso revisar transparência, direitos do titular, compartilhamento, retenção, exclusão, segurança, suporte e contratos com operadores de dados.

## Limitações que permanecem

- Não houve auditoria direta no banco financeiro real nem prova de política RLS em produção.
- Não houve teste físico do APK com notificações protegidas do Itaú, Sicredi ou Carteira do Google.
- O APK é DEBUG e usa assinatura gerada pelo runner. Futuras atualizações podem exigir reinstalação.
- Não há sincronização de notificações offline nem push de vencimentos quando o PWA está fechado.
- A URL do site continua acessível publicamente; o login é a barreira de acesso, e robots/noindex é apenas instrução para indexadores, não bloqueio de rede.
