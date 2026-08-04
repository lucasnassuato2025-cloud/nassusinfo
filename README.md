# Nassus Tecnologia e Serviços

Site institucional e comercial da Nassus Tecnologia, desenvolvido como projeto estático e publicado pela Vercel.

## Estrutura principal

- `index.html` — página inicial, portfólio resumido e calculadora de orçamento;
- `servicos.html` — serviços e processo de desenvolvimento;
- `projetos.html` — portfólio e estudos de caso;
- `planos.html` — planos, valores e regras comerciais;
- `contato.html` — briefing que prepara a mensagem para o WhatsApp;
- `duvidas.html` — central de dúvidas sobre sites, SEO e hospedagem;
- `privacidade.html` — política de privacidade;
- `404.html` — página para endereços inexistentes;
- `criacao-de-sites-para-clinicas.html` e `criacao-de-sites-para-turismo.html` — páginas comerciais por segmento;
- `assets/site.css` — identidade visual compartilhada das páginas internas;
- `assets/site.js` — comportamento compartilhado do menu e ano do rodapé;
- `segmentos.css` — estilos das páginas comerciais por segmento;
- `robots.txt` e `sitemap.xml` — arquivos de indexação;
- `vercel.json` — cabeçalhos básicos de segurança.

## Publicação

A branch `main` é utilizada para produção. Branches e pull requests geram prévias automáticas na Vercel para validação antes da publicação.

## Cuidados de manutenção

1. Alterações de cabeçalho, rodapé, botões e componentes compartilhados devem ser feitas primeiro em `assets/site.css` e `assets/site.js`.
2. Ao criar uma página pública, adicionar URL e data de atualização ao `sitemap.xml`.
3. Manter títulos, descrições, canonical e Open Graph exclusivos em cada página.
4. Conferir todos os links de WhatsApp, Instagram, CRM e projetos publicados.
5. Não inserir senhas, tokens, chaves de API ou dados privados no repositório.
6. Validar a prévia da Vercel antes de integrar mudanças à `main`.

## Responsável

Lucas Nassuato da Silva — Nassus Tecnologia e Serviços.
