-- Nassus Gestão — leitura operacional necessária ao perfil Financeiro.
-- Financeiro pode compor relatórios e vincular lançamentos a clientes,
-- sem receber permissão de escrita nos módulos operacionais/comerciais.

drop policy if exists clients_finance_read on public.clients;
create policy clients_finance_read on public.clients for select to authenticated
using(public.can_finance_business(business_id));

drop policy if exists services_finance_read on public.services;
create policy services_finance_read on public.services for select to authenticated
using(public.can_finance_business(business_id));

drop policy if exists appointments_finance_read on public.appointments;
create policy appointments_finance_read on public.appointments for select to authenticated
using(public.can_finance_business(business_id));

drop policy if exists quotes_finance_read on public.quotes;
create policy quotes_finance_read on public.quotes for select to authenticated
using(public.can_finance_business(business_id));
