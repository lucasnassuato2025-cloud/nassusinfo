-- Integridade multiempresa aplicada no Neon main e development.
-- Impede relacionar IDs de clientes, serviços ou profissionais de outro tenant.

create or replace function public.validate_appointment_tenant() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.client_id is not null and not exists(select 1 from public.clients c where c.id=new.client_id and c.business_id=new.business_id) then raise exception 'TENANT_REFERENCE_MISMATCH'; end if;
  if new.service_id is not null and not exists(select 1 from public.services s where s.id=new.service_id and s.business_id=new.business_id) then raise exception 'TENANT_REFERENCE_MISMATCH'; end if;
  if new.professional_user_id is not null and not exists(select 1 from public.business_members bm where bm.business_id=new.business_id and bm.user_id=new.professional_user_id and bm.active=true) then raise exception 'TENANT_REFERENCE_MISMATCH'; end if;
  return new;
end; $$;
drop trigger if exists trg_appointments_tenant on public.appointments;
create trigger trg_appointments_tenant before insert or update of business_id,client_id,service_id,professional_user_id on public.appointments for each row execute function public.validate_appointment_tenant();

create or replace function public.validate_financial_tenant() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.client_id is not null and not exists(select 1 from public.clients c where c.id=new.client_id and c.business_id=new.business_id) then raise exception 'TENANT_REFERENCE_MISMATCH'; end if;
  return new;
end; $$;
drop trigger if exists trg_financial_tenant on public.financial_entries;
create trigger trg_financial_tenant before insert or update of business_id,client_id on public.financial_entries for each row execute function public.validate_financial_tenant();

create or replace function public.validate_quote_tenant() returns trigger
language plpgsql security definer set search_path=public as $$
begin
  if new.client_id is not null and not exists(select 1 from public.clients c where c.id=new.client_id and c.business_id=new.business_id) then raise exception 'TENANT_REFERENCE_MISMATCH'; end if;
  return new;
end; $$;
drop trigger if exists trg_quotes_tenant on public.quotes;
create trigger trg_quotes_tenant before insert or update of business_id,client_id on public.quotes for each row execute function public.validate_quote_tenant();

create or replace function public.validate_quote_item_tenant() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_business_id uuid;
begin
  if new.service_id is null then return new; end if;
  select business_id into v_business_id from public.quotes where id=new.quote_id;
  if v_business_id is null or not exists(select 1 from public.services s where s.id=new.service_id and s.business_id=v_business_id) then raise exception 'TENANT_REFERENCE_MISMATCH'; end if;
  return new;
end; $$;
drop trigger if exists trg_quote_items_tenant on public.quote_items;
create trigger trg_quote_items_tenant before insert or update of quote_id,service_id on public.quote_items for each row execute function public.validate_quote_item_tenant();

-- Permite deletes em cascata quando o pai já foi removido, sem liberar escrita normal após trial.
create or replace function public.enforce_business_write_access() returns trigger
language plpgsql security definer set search_path=public,auth as $$
declare v_business_id uuid; v_status text; v_trial_ends_at timestamptz;
begin
  v_business_id:=case when tg_op='DELETE' then old.business_id else new.business_id end;
  select status,trial_ends_at into v_status,v_trial_ends_at from public.businesses where id=v_business_id;
  if not found and tg_op='DELETE' then return old; end if;
  if v_status='active' or (v_status='trial' and v_trial_ends_at is not null and v_trial_ends_at>now()) then if tg_op='DELETE' then return old; else return new; end if; end if;
  raise exception 'SUBSCRIPTION_REQUIRED';
end; $$;

create or replace function public.enforce_quote_item_write_access() returns trigger
language plpgsql security definer set search_path=public,auth as $$
declare v_quote_id uuid; v_status text; v_trial_ends_at timestamptz;
begin
  v_quote_id:=case when tg_op='DELETE' then old.quote_id else new.quote_id end;
  select b.status,b.trial_ends_at into v_status,v_trial_ends_at from public.quotes q join public.businesses b on b.id=q.business_id where q.id=v_quote_id;
  if not found and tg_op='DELETE' then return old; end if;
  if v_status='active' or (v_status='trial' and v_trial_ends_at is not null and v_trial_ends_at>now()) then if tg_op='DELETE' then return old; else return new; end if; end if;
  raise exception 'SUBSCRIPTION_REQUIRED';
end; $$;
