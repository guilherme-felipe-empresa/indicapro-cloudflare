# Seu IndicaPro: banco configurado em 23/09/2026

Projeto: `vakqtlfewbeyeqxsdksa` — IndicaPro.

O banco ja foi criado neste projeto. **Nao execute BANCO_DE_DADOS.sql novamente.**
Os quatro produtos e os ajustes de DADOS_OPCIONAIS.sql ja foram importados.
A foto do produto Netflix nao constava no arquivo original; reenvie no admin.
O WhatsApp importado e `5562998080215`; confira se e o numero desejado.

## Proximo passo: Cloudflare Workers

Suba o conteudo da pasta indicapro no Git e importe o repositorio em Workers.
Build: `npm run build`. Deploy: `npm run deploy`. Nome do Worker: `indicapro`.
Use Node 22.12+ (`NODE_VERSION=22` nas variaveis de build).

Configure estas variaveis na secao de BUILD:

```dotenv
VITE_SUPABASE_URL=https://vakqtlfewbeyeqxsdksa.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_gXwdOIOz3RqWLWncOPs9kQ_brOosaMf
```

Configure estas variaveis na secao de execucao do WORKER:

```dotenv
SUPABASE_URL=https://vakqtlfewbeyeqxsdksa.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_gXwdOIOz3RqWLWncOPs9kQ_brOosaMf
```

Adicione tambem `SUPABASE_SERVICE_ROLE_KEY`, do tipo Secret, com a chave secret
ou service_role do seu painel Supabase. Ela e necessaria para a rota das fotos
privadas de produtos. A integracao nao fornece essa chave: nao esta neste ZIP.
Nao coloque essa chave no Git nem em variaveis VITE_.

A chave publishable acima e publica e foi testada para ler o catalogo.
Preencher .env.example nao configura automaticamente o painel da Cloudflare.

## Depois de publicar

1. Em Supabase > Authentication > URL Configuration, defina Site URL como a URL
   publicada e inclua essa URL seguida de `/**` em Redirect URLs.
2. Cadastre sua conta no site e confirme o e-mail se solicitado.
3. Use TORNAR_ADMIN.sql com seu e-mail (ou informe o e-mail cadastrado nesta conversa).
4. Confira WhatsApp, produtos e configuracoes antes de usar vendas reais.

Ainda nao ha usuarios cadastrados nem administrador. A conta do painel Supabase
nao e automaticamente uma conta do site. Nao houve deploy na Cloudflare.

Consulte GUIA_CLOUDFLARE.md para as instrucoes completas.
