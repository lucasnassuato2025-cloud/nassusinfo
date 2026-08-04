# Nassus Tecnologia e Serviços

Repositório do site institucional da Nassus Tecnologia e do Nassus CRM.

## Projetos

### Site institucional

Projeto estático localizado na raiz do repositório e publicado pela Vercel.

- `index.html` — página inicial, portfólio resumido e calculadora de orçamento;
- `servicos.html` — serviços e processo de desenvolvimento;
- `projetos.html` — portfólio e estudos de caso;
- `planos.html` — planos, valores e regras comerciais;
- `contato.html` — briefing que prepara a mensagem para o WhatsApp;
- `duvidas.html` — central de dúvidas sobre sites, SEO e hospedagem;
- `privacidade.html` — política de privacidade;
- `404.html` — página para endereços inexistentes;
- `criacao-de-sites-para-clinicas.html` e `criacao-de-sites-para-turismo.html` — páginas comerciais por segmento;
- `assets/site.css` e `assets/site.js` — identidade e comportamento compartilhados;
- `robots.txt`, `sitemap.xml` e `vercel.json` — indexação e configuração da publicação.

### Nassus CRM

Aplicação Next.js localizada em `crm/`, com Neon Auth e Neon Postgres.

- login e cadastro por e-mail e senha;
- clientes isolados por usuário;
- cadastro, edição, exclusão, pesquisa e filtros;
- funil comercial, valores estimados e próximas ações;
- documentação própria em `crm/README.md`;
- exemplo seguro de configuração em `crm/.env.example`.

O site e o CRM devem permanecer em projetos separados na Vercel:

- site institucional: raiz do repositório;
- projeto `nassus-crm`: **Root Directory** igual a `crm`.

## Publicação

A branch `main` é utilizada para produção. Alterações devem passar por branch e pull request antes da integração.

## Cuidados de manutenção

1. Alterações do site compartilhadas devem ser feitas primeiro em `assets/site.css` e `assets/site.js`.
2. Ao criar uma página pública, atualizar o `sitemap.xml`.
3. Manter títulos, descrições, canonical e Open Graph exclusivos.
4. Conferir links de WhatsApp, Instagram, CRM e projetos publicados.
5. Nunca inserir senhas, tokens, conexões de banco, chaves de API ou arquivos `.env` no repositório.
6. Validar a prévia da Vercel antes de integrar mudanças à `main`.
7. Não alterar o Root Directory do site institucional para `crm`.

## Responsável

Lucas Nassuato da Silva — Nassus Tecnologia e Serviços.
