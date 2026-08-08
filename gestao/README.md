# Nassus Gestão

SaaS multiempresa para prestadores de serviços, desenvolvido em Next.js e conectado ao Neon Auth + Data API.

## Pacote pré-Cakto implementado

- login, cadastro e recuperação de senha;
- onboarding com trial de 7 dias;
- múltiplas empresas por usuário e troca de workspace;
- Dashboard com dados reais;
- Clientes com busca, WhatsApp e perfil 360°;
- histórico do cliente com agenda, orçamentos e financeiro permitido pelo perfil;
- Serviços com preço, duração e status;
- Agenda por cliente, serviço e profissional;
- bloqueio de conflito de horário no PostgreSQL;
- confirmação de atendimento por WhatsApp sem API paga;
- página pública de agendamento sem login;
- horário comercial configurável e validado no banco;
- Financeiro com receitas, despesas, vencimentos e baixa;
- Orçamentos com múltiplos itens, desconto, validade e fluxo de aprovação;
- impressão e salvamento de orçamento em PDF pelo navegador;
- Equipe com Proprietário, Administrador, Equipe, Recepção, Profissional e Financeiro;
- permissões por módulo aplicadas por RLS, não apenas no menu;
- Relatórios com período e exportação CSV;
- Configurações da empresa, endereço e agendamento público;
- central de Assinatura preparada para os checkouts Cakto;
- Nassus Admin com empresas, trials, planos, usuários e MRR estimado;
- PWA instalável, manifesto, ícone, service worker e fallback offline seguro;
- endpoint `/api/health`;
- CI no GitHub com typecheck + build do Next.js.

## Planos

### Essencial — R$ 39,90/mês
- até 2 usuários;
- até 90 clientes.

### Profissional — R$ 139,90/mês
- até 10 usuários;
- clientes ilimitados.

Os limites são fiscalizados no PostgreSQL. O Essencial foi testado com 90 clientes e bloqueou o 91º cadastro.

## Perfis e permissões

- Proprietário / Administrador: gestão completa;
- Financeiro: Financeiro e Relatórios;
- Recepção: Clientes, Agenda, Serviços e Orçamentos;
- Profissional: Clientes, Agenda e Serviços;
- Equipe: operação geral e Orçamentos.

As políticas RLS usam funções específicas para operação, comercial e financeiro. Manipular o navegador ou a Data API não concede acesso a módulos proibidos.

## Agendamento público

A empresa pode ativar uma página como:

```text
/agendar/<slug-da-empresa>
```

O endpoint público expõe somente dados necessários ao agendamento. O banco valida empresa ativa/trial válido, serviço, profissional, limite de clientes, conflito de horário e horário de funcionamento.

## Segurança e cobrança

- isolamento por `business_id`;
- referências cruzadas entre tenants são recusadas;
- trial vencido mantém leitura dos dados e bloqueia novas escritas;
- plano, status e limites não podem ser alterados pelo cliente;
- `apply_billing_state` é reservada a backend confiável;
- billing pendente não promove plano; somente estado ativo validado pode liberar o plano;
- `platform_admins` controla o Nassus Admin fora das permissões das empresas;
- segredos e `DATABASE_URL` não são enviados ao navegador nem versionados.

## Banco e migrações

Projeto Neon: `nassus-gestao`.

- `main`: produção;
- `development`: testes e validação.

```text
database/schema.sql
database/002-team-access.sql
database/003-billing-guard.sql
database/004-trial-write-guard.sql
database/005-role-permissions.sql
database/006-team-trial-guard.sql
database/007-tenant-reference-guard.sql
database/008-billing-state.sql
database/009-public-booking-admin.sql
database/010-access-profiles.sql
database/011-public-booking-hours.sql
```

## Cakto

O front aceita os links oficiais através de:

```text
NEXT_PUBLIC_CAKTO_ESSENTIAL_CHECKOUT_URL
NEXT_PUBLIC_CAKTO_PROFESSIONAL_CHECKOUT_URL
```

O webhook final deve ser implementado somente com o payload e a validação de assinatura oficiais da conta Cakto.

## Desenvolvimento

```bash
cd gestao
npm install
npm run typecheck
npm run build
npm run dev
```

## Publicação

```text
Root Directory: gestao
Domínio planejado: app.nassusinfo.com.br
```

O site `nassusinfo.com.br` e o CRM `crm.nassusinfo.com.br` permanecem aplicações separadas.

## Bloqueios externos restantes

- criar/conectar o projeto `nassus-gestao` na hospedagem e associar `app.nassusinfo.com.br`;
- inserir os dois links reais de checkout Cakto;
- implementar o webhook após obter o contrato oficial dos eventos da Cakto;
- cadastrar a primeira conta real do Gestão antes de conceder o papel de administrador da plataforma. Nenhuma credencial administrativa artificial é criada pelo código.
