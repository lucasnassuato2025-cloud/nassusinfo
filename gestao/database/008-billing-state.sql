-- Camada administrativa de cobrança aplicada no Neon main e development.
-- A função NÃO é executável por PUBLIC/authenticated; deve ser chamada apenas
-- por backend confiável após validar o webhook oficial do provedor.

create or replace function public.apply_billing_state(
  p_business_id uuid,
  p_provider text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_plan text,
  p_status text,
  p_period_start timestamptz default null,
  p_period_end timestamptz default null
) returns void
language plpgsql security definer set search_path=public as $$
begin
  if p_plan not in ('essential','professional') then raise exception 'INVALID_PLAN'; end if;
  if p_status not in ('pending','active','past_due','cancelled','expired') then raise exception 'INVALID_SUBSCRIPTION_STATUS'; end if;

  insert into public.subscriptions(
    business_id,provider,provider_customer_id,provider_subscription_id,
    plan,status,current_period_start,current_period_end,updated_at
  ) values(
    p_business_id,coalesce(nullif(trim(p_provider),''),'cakto'),p_provider_customer_id,p_provider_subscription_id,
    p_plan,p_status,p_period_start,p_period_end,now()
  )
  on conflict (business_id) do update set
    provider=excluded.provider,
    provider_customer_id=excluded.provider_customer_id,
    provider_subscription_id=excluded.provider_subscription_id,
    plan=excluded.plan,
    status=excluded.status,
    current_period_start=excluded.current_period_start,
    current_period_end=excluded.current_period_end,
    updated_at=now();

  if p_status='active' then
    update public.businesses set plan=p_plan,status='active' where id=p_business_id;
  elsif p_status='past_due' then
    update public.businesses set status='past_due' where id=p_business_id;
  elsif p_status='cancelled' then
    update public.businesses set status='cancelled' where id=p_business_id;
  elsif p_status='expired' then
    update public.businesses set status='suspended' where id=p_business_id;
  end if;

  insert into public.audit_events(business_id,action,entity_type,metadata)
  values(p_business_id,'billing_state_applied','subscription',jsonb_build_object('provider',p_provider,'plan',p_plan,'status',p_status));
end; $$;

revoke all on function public.apply_billing_state(uuid,text,text,text,text,text,timestamptz,timestamptz) from public;
revoke all on function public.apply_billing_state(uuid,text,text,text,text,text,timestamptz,timestamptz) from authenticated;
