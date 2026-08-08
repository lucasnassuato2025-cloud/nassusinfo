# Nassus Gestão

SaaS multiempresa para prestadores de serviços, desenvolvido em Next.js e conectado ao Neon Auth + Data API.

## Versão 0.3.0 — auditoria pré-lançamento

- login, cadastro e recuperação de senha;
- Neon Auth com `app.nassusinfo.com.br` autorizado em produção e localhost desativado na branch principal;
- onboarding com trial de 7 dias e bloqueio de repetição de trial self-service;
- múltiplas empresas por usuário e troca de workspace;
- Dashboard com dados reais e conteúdo ajustado por perfil;
- Clientes com busca, WhatsApp e perfil 360°;
- Serviços com preço, duração e status;
- Agenda por cliente, serviço e profissional;
- bloqueio de conflito de horário serializado no PostgreSQL;
- confirmação de atendimento por WhatsApp sem API paga;
- página pública de agendamento com validação de contato, duplicidade, horário comercial e tenant;
- Financeiro com receitas, despesas, vencimentos e baixa;
- Orçamentos com múltiplos itens, numeração automática por empresa, totais calculados no servidor e criação transacional;
- Equipe com Proprietário, Administrador, Equipe, Recepção, Profissional e Financeiro;
- princípio do menor privilégio: Financeiro recebe somente nomes necessários e métricas agregadas;
- permissões por módulo aplicadas por RLS/RPCs, não apenas no menu;
- Relatórios por período e exportação CSV;
- Configurações e horários da empresa atualizados por RPCs validadas;
- central de Assinatura preparada para os checkouts Cakto;
- Nassus Admin protegido por `platform_admins`;
- PWA instalável e fallback offline seguro;
- `/api/health` alinhado à versão 0.3.0;
- CSP e headers de segurança na Vercel;
- CI com `npm audit --audit-level=high`, TypeScript e `next build`.

## Planos

### Essencial — R$ 39,90/mês
- até 2 usuários;
- até 90 clientes.

### Profissional — R$ 139,90/mês
- até 10 usuários;
- clientes ilimitados.

Os limites são fiscalizados no PostgreSQL e protegidos contra concorrência. O Essencial foi testado com 90 clientes e bloqueou o 91º cadastro; o terceiro usuário também é recusado.

## Perfis e permissões

- Proprietário / Administrador: gestão completa;
- Financeiro: Financeiro e Relatórios com dados operacionais minimizados;
- Recepção: Clientes, Agenda, Serviços e Orçamentos;
- Profissional: Clientes, Agenda e Serviços;
- Equipe: operação geral e Orçamentos.

As políticas RLS usam funções específicas para operação, comercial e financeiro. Manipular o navegador ou a Data API não concede acesso a módulos proibidos.

## Agendamento público

A empresa pode ativar uma página como:

```text
/agendar/<slug-da-empresa>
```

O banco valida empresa ativa/trial válido, serviço, profissional, limite de clientes, conflito de horário, contato, duplicidade e horário de funcionamento.

## Segurança e cobrança

- isolamento por `business_id`;
- referências cruzadas entre tenants são recusadas;
- trial vencido mantém leitura dos dados e bloqueia novas escritas;
- plano, status e limites não podem ser alterados pelo cliente;
- `apply_billing_state` é reservada a backend confiável;
- billing pendente não promove plano; somente estado ativo validado pode liberar o plano;
- `platform_admins` controla o Nassus Admin fora das permissões das empresas;
- RPCs privadas não são executáveis pelo papel anônimo;
- segredos e `DATABASE_URL` não são enviados ao navegador nem versionados;
- dependências transitivas vulneráveis encontradas na auditoria foram substituídas por overrides corrigidos e o gate de segurança passou.

## Banco e migrações

Projeto Neon: `nassus-gestao`.

- `main`: produção;
- `development`: testes e validação;
- `backup-pre-gestao-0-3-0-20260808`: snapshot criado antes da promoção 0.3.0.

Migrações novas da auditoria:

```text
database/013-prelaunch-hardening.sql
database/014-team-data-minimization.sql
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
Domínio: https://app.nassusinfo.com.br
```

O site `nassusinfo.com.br` e o CRM `crm.nassusinfo.com.br` permanecem aplicações separadas.

## Pendências antes da venda em escala

- inserir os dois links reais de checkout Cakto e implementar o webhook oficial;
- configurar SMTP próprio no Neon Auth e habilitar verificação de e-mail antes de abertura ampla ao público;
- cadastrar a primeira conta real antes de conceder o papel de administrador da plataforma.
