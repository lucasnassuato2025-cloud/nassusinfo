# Nassus CRM

Aplicação privada de gestão comercial da Nassusinfo. Esta pasta foi reconstruída a partir da versão publicada diretamente na Vercel, das rotas existentes e do esquema real do banco Neon.

## Recursos

- login e cadastro por e-mail e senha com Neon Auth;
- isolamento dos clientes pelo usuário autenticado;
- cadastro, edição e exclusão de oportunidades;
- status comercial: novo, contato, proposta, negociação, fechado e perdido;
- valor estimado, próxima ação, data e observações;
- pesquisa, filtros e indicadores do funil;
- layout responsivo para computador e celular.

## Desenvolvimento local

```bash
cd crm
npm install
cp .env.example .env.local
npm run dev
```

Preencha no `.env.local`:

- `DATABASE_URL` — conexão do projeto Neon;
- `NEON_AUTH_BASE_URL` — endereço do Neon Auth;
- `NEON_AUTH_COOKIE_SECRET` — segredo estável de pelo menos 32 caracteres;
- `NEXT_PUBLIC_APP_URL` — endereço público do CRM.

Para gerar o segredo:

```bash
openssl rand -base64 32
```

Nunca envie `.env.local`, conexão do banco ou segredo de cookie ao GitHub.

## Publicação na Vercel

O site institucional e o CRM são dois projetos diferentes usando o mesmo repositório.

No projeto Vercel `nassus-crm`:

1. conecte o repositório `lucasnassuato2025-cloud/nassusinfo`;
2. defina **Root Directory** como `crm`;
3. configure as quatro variáveis descritas em `.env.example`;
4. faça um deployment de prévia;
5. valide login, cadastro e operações de clientes;
6. só depois promova para produção e associe `crm.nassusinfo.com.br`.

O projeto Vercel do site institucional deve continuar com a raiz do repositório e não deve apontar para `crm`.

## Banco de dados

A aplicação utiliza a tabela `public.clients` já existente no Neon. O arquivo `database/schema.sql` registra a estrutura esperada para documentação e recuperação, mas não deve ser executado automaticamente em produção.

## Observação sobre a recuperação

A Vercel possuía apenas o artefato compilado do deployment e não disponibilizou o código TypeScript original. Por isso, este diretório contém uma versão legível e manutenível reconstruída a partir da interface publicada, das chamadas de autenticação, das rotas do deployment e do esquema real do banco.
