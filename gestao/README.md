# Nassus Gestão

SaaS multiempresa para prestadores de serviços, desenvolvido em Next.js e conectado ao Neon Auth + Data API.

## MVP funcional

Já estão implementados:

- login, cadastro e recuperação de senha;
- onboarding e criação de empresa;
- usuário participando de várias empresas com seletor de workspace;
- Dashboard com dados reais;
- Clientes: cadastro, busca, status e exclusão;
- Serviços: catálogo, preço, duração e status;
- Agenda: cliente + serviço + profissional, confirmação, conclusão e cancelamento;
- Financeiro: receitas, despesas, vencimentos e baixa de pagamento;
- Orçamentos: múltiplos itens, numeração, cliente, desconto, validade e status;
- Equipe: inclusão por e-mail, perfis e desativação de acesso;
- Relatórios operacionais e financeiros;
- Configurações da empresa;
- central de Assinatura com planos Essencial e Profissional;
- PWA instalável, manifesto, ícone, service worker e fallback offline seguro;
- endpoint `/api/health` para monitoramento;
- CI no GitHub com typecheck + build do Next.js.

## Planos

### Essencial — R$ 39,90/mês

- até 2 usuários;
- até 90 clientes;
- clientes, agenda, serviços, financeiro e orçamentos;
- PWA para computador e celular.

### Profissional — R$ 139,90/mês

- até 10 usuários;
- clientes ilimitados;
- recursos do Essencial;
- maior capacidade operacional e base para automações avançadas.

Os limites são aplicados no PostgreSQL. Alterar a interface do navegador não permite ultrapassá-los.

## Segurança

O projeto usa RLS e funções do PostgreSQL para isolar empresas. Cada registro operacional possui vínculo com um `business_id` e só pode ser acessado por membros daquela empresa.

Regras adicionais:

- proprietário e administrador possuem recursos gerenciais;
- equipe operacional não lê financeiro nem assinatura;
- usuários autenticados não podem alterar `plan`, `status`, limites ou validade do trial diretamente;
- trial de 7 dias é fiscalizado no banco;
- depois do trial, os dados permanecem legíveis, mas novas escritas ficam bloqueadas até a assinatura ficar ativa;
- referências cruzadas entre empresas são bloqueadas no banco (cliente, serviço e profissional precisam pertencer ao mesmo tenant);
- segredos, API keys e `DATABASE_URL` não devem ser enviados ao navegador nem versionados.

## Banco e migrações

Projeto Neon dedicado: `nassus-gestao`.

Ambientes:

- `main`: produção;
- `development`: testes e validação.

Arquivos:

```text
database/schema.sql
database/002-team-access.sql
database/003-billing-guard.sql
database/004-trial-write-guard.sql
database/005-role-permissions.sql
database/006-team-trial-guard.sql
database/007-tenant-reference-guard.sql
database/008-billing-state.sql
```

As migrações 002+ documentam evoluções já aplicadas nos ambientes Neon.

## Cakto

A aplicação já aceita links públicos de checkout através de:

```text
NEXT_PUBLIC_CAKTO_ESSENTIAL_CHECKOUT_URL
NEXT_PUBLIC_CAKTO_PROFESSIONAL_CHECKOUT_URL
```

O banco possui `subscriptions` e `webhook_events`, além de uma função administrativa `apply_billing_state` que só pode ser executada por backend confiável. Ela não concede plano Profissional enquanto o estado estiver pendente; somente um evento validado como ativo libera o plano e os limites correspondentes.

O webhook deve ser implementado quando o formato oficial do evento e a validação de assinatura da conta Cakto estiverem disponíveis. Não deve ser criado um webhook baseado em payload presumido.

## Desenvolvimento

```bash
cd gestao
npm install
npm run typecheck
npm run build
npm run dev
```

## Publicação

O repositório contém aplicações independentes. Para o Nassus Gestão, a hospedagem deve usar:

```text
Root Directory: gestao
Domínio: app.nassusinfo.com.br
```

Isso mantém `nassusinfo.com.br` e `crm.nassusinfo.com.br` separados do novo SaaS.
