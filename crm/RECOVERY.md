# Registro de recuperação

Data: 4 de agosto de 2026.

## Origem analisada

- projeto Vercel: `nassus-crm`;
- domínio: `crm.nassusinfo.com.br`;
- framework identificado: Next.js 16.2.6;
- autenticação identificada: Neon Auth com API compatível com Better Auth;
- rotas identificadas: `/`, `/sign-in`, `/api/auth/[...path]`, `/api/clients` e `/api/clients/[id]`;
- banco identificado: Neon Postgres, tabela `public.clients`.

## Limitação da recuperação

O deployment da Vercel disponibilizava os artefatos compilados, mas não o projeto TypeScript original. Os arquivos desta pasta foram reconstruídos em código legível a partir da interface publicada, do JavaScript compilado do login, dos logs de build e execução, das rotas e do esquema real do banco.

## Segurança

Nenhuma senha, token, conexão do banco ou segredo de cookie foi copiado para o GitHub. Esses valores devem permanecer nas variáveis de ambiente da Vercel.
