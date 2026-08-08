# Nassus Gestão

SaaS multiempresa para prestadores de serviços, com autenticação, isolamento de dados por empresa, limites por plano e base preparada para cobrança recorrente.

## Estado atual do MVP

- login e cadastro com Neon Auth;
- onboarding para criação da empresa;
- arquitetura multiempresa (`businesses` + `business_members`);
- Row Level Security para impedir acesso aos dados de outra empresa;
- dashboard conectado ao Neon Data API;
- cadastro de clientes real;
- estrutura de agenda, serviços, financeiro, orçamentos e equipe;
- estrutura de assinaturas e webhooks preparada para Cakto;
- plano Essencial: 2 usuários e até 90 clientes;
- plano Profissional: até 10 usuários e clientes ilimitados;
- layout responsivo inspirado em painéis administrativos premium.

## Estrutura

```text
gestao/
├── app/
│   ├── cadastro/
│   ├── onboarding/
│   ├── sign-in/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── database/
│   └── schema.sql
├── lib/
│   ├── neon.ts
│   └── session.ts
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Neon

O aplicativo usa um projeto Neon dedicado chamado `nassus-gestao`, separado do `nassus-crm` existente.

Ambientes:

- `main`: produção;
- `development`: desenvolvimento e testes.

Neon Auth e Neon Data API estão provisionados nos dois ambientes. A aplicação usa apenas URLs públicas no cliente. Credenciais de banco nunca devem ser colocadas no GitHub.

## Segurança multiempresa

Todas as entidades principais possuem vínculo com uma empresa. As políticas RLS verificam se o usuário autenticado pertence à empresa antes de permitir leitura ou alteração.

Os limites comerciais também são protegidos no banco:

- Essencial: 90 clientes e 2 usuários;
- Profissional: clientes ilimitados e 10 usuários.

Assim, alterar a interface do navegador não permite ultrapassar os limites do plano.

## Desenvolvimento

```bash
cd gestao
npm install
npm run dev
```

As variáveis públicas opcionais estão documentadas em `.env.example`. Sem elas, o projeto usa os endpoints públicos do ambiente principal configurados em `lib/neon.ts`.

## Publicação

O site institucional, o CRM e o Nassus Gestão podem permanecer no mesmo repositório como aplicações separadas.

Para publicar o Nassus Gestão, configure o provedor de hospedagem com **Root Directory** igual a `gestao` e associe o domínio:

```text
app.nassusinfo.com.br
```

O domínio principal `nassusinfo.com.br` e o CRM existente não precisam ser alterados.

## Cakto

O banco já contém as tabelas `subscriptions` e `webhook_events`. A próxima etapa é configurar checkout/assinatura e o endpoint de webhook da Cakto para atualizar automaticamente o plano e o status de cada empresa.
