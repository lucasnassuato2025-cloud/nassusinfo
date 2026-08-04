# Nassus CRM

Aplicação privada de gestão comercial da Nassusinfo, desenvolvida em Next.js e integrada ao Neon.

## Recursos

- login e cadastro por e-mail e senha com Neon Auth;
- clientes isolados por usuário por meio de Row-Level Security;
- cadastro, edição e exclusão de oportunidades;
- status comercial: novo, contato, proposta, negociação, fechado e perdido;
- valor estimado, próxima ação, data e observações;
- pesquisa, filtros e indicadores do funil;
- layout responsivo para computador e celular.

## Arquitetura

O navegador utiliza `@neondatabase/neon-js` para acessar:

- Neon Auth, responsável pelo cadastro, login, sessão e JWT;
- Neon Data API, responsável pelas operações na tabela `public.clients`;
- políticas RLS do PostgreSQL, que garantem que cada usuário veja e altere somente seus próprios clientes.

Não é necessário armazenar `DATABASE_URL`, senha do banco ou segredo de cookie na Vercel. As URLs públicas do Neon Auth e da Data API estão centralizadas em `lib/neon.ts`.

## Desenvolvimento local

```bash
cd crm
npm install
npm run dev
```

## Publicação na Vercel

O site institucional e o CRM são projetos diferentes usando o mesmo repositório.

No projeto Vercel `nassus-crm`:

1. conecte o repositório `lucasnassuato2025-cloud/nassusinfo`;
2. defina **Root Directory** como `crm`;
3. publique a branch `main`;
4. associe o domínio `crm.nassusinfo.com.br`.

O site institucional deve continuar apontando para a raiz do repositório.

## Banco de dados e segurança

A aplicação utiliza a tabela `public.clients`. O campo `owner_id` recebe automaticamente o identificador do usuário autenticado por `auth.user_id()`. A tabela possui RLS habilitado e uma política para leitura, criação, edição e exclusão apenas das linhas pertencentes ao usuário atual.

O arquivo `database/schema.sql` documenta a estrutura e as regras de segurança esperadas. Não execute automaticamente em produção sem revisar o estado atual do banco.
