# Validação desta adaptação

- Instalação npm concluída; `package-lock.json` incluído.
- `npm run typecheck`: passou.
- `npm run build`: passou com URL/chave pública fictícias de teste.
- `npm run check:deploy`: passou (`wrangler deploy --dry-run`, sem publicar).
- Comparação com o ZIP original: componentes, páginas de negócio, estilos,
  imagens e scripts SQL preservados. Ajustes em autenticação, configuração,
  remoção de integrações de preview/telemetria Lovable e idioma do documento HTML.
- Prévia HTTP local não concluída: o ambiente de execução bloqueou a consulta de
  interfaces de rede (`uv_interface_addresses`) usada pelo plugin Cloudflare.

## Validacao do Supabase conectado — 23/09/2026

- Estrutura aplicada com sucesso em vakqtlfewbeyeqxsdksa: 11 tabelas com RLS.
- Tres buckets privados e quatro produtos importados.
- Leitura do catalogo via HTTP usando chave publishable: passou.
- RPC de intencao de compra como anon: passou em transacao desfeita (rollback).
- Nenhuma intencao de compra de teste permaneceu no banco.
- Edicao do nome do perfil permitida; alteracao direta de status negada.
- Execucao anonima da funcao de aprovacao revogada.
- Advisors revisados: permanecem avisos de SECURITY DEFINER nas RPCs intencionais
  de compra publica e operacoes autenticadas, que fazem verificacoes internas.
  Isso nao equivale a uma auditoria completa de seguranca.
  Referencias: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
  e https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable
- Login real, e-mails, uploads, fluxo completo de carteira/saques e suporte ainda
  dependem da configuracao final e de uma conta do site.
- Nenhuma publicacao na Cloudflare. O ZIP inclui apenas URL e chave publica;
  nenhuma chave secret/service_role ou bundle de teste esta incluido.
