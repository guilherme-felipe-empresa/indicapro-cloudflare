# IndicaPro — seu Supabase + Cloudflare Workers pelo Git

> Seu projeto IndicaPro ja foi configurado. Leia primeiro
> `CONFIGURACAO_DO_SEU_PROJETO.md` e pule a criacao/importacao do banco.

O código mantém as telas, estilos, produtos de exemplo, carteira, indicações,
administração e suporte do arquivo original. O build usa Vite, TanStack Start e o
plugin oficial da Cloudflare, sem depender do Lovable.

## 1. Prepare seu Supabase

1. Crie um projeto **novo e vazio** no Supabase.
2. No SQL Editor, execute `BANCO_DE_DADOS.sql` inteiro uma única vez.
   Ele reúne as migrações, permissões, funções e três buckets privados.
   Não execute também os arquivos em `supabase/migrations`: são a mesma base.
3. Para carregar o catálogo e os ajustes exportados, execute `DADOS_OPCIONAIS.sql`.
   Confira o WhatsApp importado em Admin > Configurações antes de vender.
   As três fotos de exemplo estão no código. A foto do produto Netflix não veio
   no ZIP original e precisa ser reenviada em Admin > Produtos.
4. Habilite o provedor Email em Authentication.
5. Em Authentication > URL Configuration, configure inicialmente o domínio
   planejado; após publicar, atualize para a URL real:
   - Site URL: `https://SEU-WORKER.SUA-CONTA.workers.dev`
   - Redirect URLs: `https://SEU-WORKER.SUA-CONTA.workers.dev/**`
   - Para desenvolvimento: `http://localhost:8080/**`
6. Se a confirmação de e-mail estiver habilitada, confirme o cadastro antes de
   entrar. Para envio de e-mails em produção, configure seu SMTP no Supabase.

Este pacote recria a estrutura e inclui apenas os dados de `DADOS_OPCIONAIS.sql`.
Usuários, senhas, saldos, saques, indicações, chamados e arquivos do Supabase antigo
não estão no ZIP. Migrar esses registros exige um backup separado do projeto antigo.

## 2. Suba o código no Git

Extraia o ZIP e envie **o conteúdo da pasta `indicapro`** para a raiz do repositório.
`package.json`, `package-lock.json` e `wrangler.jsonc` devem ficar nessa raiz.
Se enviar a pasta inteira, use `indicapro` como Root directory na Cloudflare.

Não envie `.env`, `.dev.vars`, `node_modules` ou `dist`. O `.gitignore` já os exclui.
Os arquivos `.env.example` e `.dev.vars.example` são modelos sem credenciais.

## 3. Importe na Cloudflare

Em Workers & Pages, crie um **Worker** conectado ao seu repositório Git.
Este projeto tem renderização e uma rota de imagens no servidor, por isso a
configuração fornecida é de Workers com assets, e não de hospedagem Pages estática.

| Campo | Valor |
| --- | --- |
| Nome do Worker | `indicapro` (ou altere também `name` em `wrangler.jsonc`) |
| Root directory | raiz que contém `package.json` |
| Build command | `npm run build` |
| Deploy command | `npm run deploy` |
| Node | 22.12 ou superior; configure `NODE_VERSION=22` no build |

O npm instala as dependências a partir do `package-lock.json`. Para instalação
manual ou CI próprio use `npm ci`. O plugin gera o bundle e a configuração usada
pelo Wrangler; não configure manualmente uma pasta de saída de Pages.

### Variáveis de BUILD

Configure em Settings > Builds > Variables and secrets **antes do build**:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | Project URL, como `https://SEU-PROJETO.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave pública `sb_publishable_...` ou `anon` |
| `NODE_VERSION` | `22` |

As duas variáveis VITE são públicas e ficam incorporadas ao JavaScript. Se mudar
qualquer uma, execute um novo build/deploy. Use URL e chave do mesmo projeto.

### Variáveis do WORKER (execução)

Em Settings > Variables and Secrets do Worker, configure:

| Nome | Valor |
| --- | --- |
| `SUPABASE_URL` | a mesma Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | a mesma chave pública |
| `SUPABASE_SERVICE_ROLE_KEY` | chave `service_role` ou `sb_secret_...`, tipo Secret |

A chave privilegiada é usada exclusivamente pelo servidor para ler as imagens
privadas de produtos. **Nunca** use essa chave em uma variável `VITE_` ou no Git.
Configure as variáveis de execução antes de testar as imagens e aplique/salve
essas alterações no Worker. Não é necessário configurar `VITE_SUPABASE_PROJECT_ID`.

Após o deploy, copie a URL real e ajuste Site URL e Redirect URLs no Supabase.

## 4. Torne sua conta administradora

1. Abra `/auth`, cadastre sua conta e confirme o e-mail, se solicitado.
2. No SQL Editor do seu Supabase, abra `TORNAR_ADMIN.sql`, troque o e-mail e execute.
3. Saia e entre novamente no site.
4. No admin, revise nome, WhatsApp, saque mínimo, produtos e imagens.

O script também define sua conta como destinatária das vendas diretas, seguindo
a lógica original. Confira isso antes de aprovar vendas.

## 5. Desenvolvimento local (opcional)

Instale Node.js 22.12+ e execute na pasta do projeto:

```bash
npm ci
cp .env.example .env
cp .dev.vars.example .dev.vars
```

No Windows, você pode copiar e renomear os modelos pelo Explorador de Arquivos.
Preencha `.env` com as duas variáveis públicas e `.dev.vars` com as três variáveis
do servidor. Depois:

```bash
npm run dev
```

Abra `http://localhost:8080`. Para conferir a versão de produção localmente:

```bash
npm run build
npm run check:deploy
npm run preview
```

`check:deploy` prepara o deploy sem publicar. Para publicar pelo terminal, faça
`npx wrangler login` e, depois do build, `npm run deploy`. Pelo Git, a Cloudflare
executa os comandos de build e deploy configurados a cada push na branch de produção.

## 6. Confira após configurar seu projeto

- Cadastro, confirmação de e-mail, login, logout e recuperação de senha.
- Catálogo e abertura de produto por URL direta.
- Upload de foto no admin e exibição pública da imagem.
- Geração do link de indicação e compra por WhatsApp.
- Aprovação de indicação com comprovante e crédito correto na carteira.
- Pedido de saque e atualização pelo admin.
- Chamado de suporte com anexo e resposta pelo admin.
- Usuário comum sem acesso a dados de outros usuários ou ações de admin.

Esses fluxos dependem do seu Supabase configurado; o pacote não inclui credenciais.

## Solução de problemas

- **Build pede VITE_SUPABASE...:** cadastre as variáveis na seção de build e execute
  novamente; cadastrar apenas nas variáveis de execução não resolve.
- **Fotos enviadas retornam erro:** confira os buckets criados pelo SQL e as
  variáveis de execução, especialmente `SUPABASE_SERVICE_ROLE_KEY`.
- **Cadastro não entra:** confira a confirmação de e-mail e as URLs de redirecionamento.
- **Tabelas já existem ao executar SQL:** o script é para projeto vazio e execução
  única. Não apague dados de um projeto existente para tentar novamente.
- **Nome do Worker divergente:** use o mesmo nome no painel e em `wrangler.jsonc`.

## Referências oficiais

- https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/
- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/getting-started/api-keys
