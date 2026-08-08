-- Permissões por perfil aplicadas no Neon main e development.
-- Equipe operacional não lê financeiro nem dados de assinatura.
-- Proprietário e administrador possuem acesso gerencial.

grant execute on function public.business_role(uuid) to authenticated;

drop policy if exists finance_select on public.financial_entries;
create policy finance_select on public.financial_entries
  for select to authenticated using(public.can_manage_business(business_id));

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select to authenticated using(public.can_manage_business(business_id));
