-- Bloqueio de escrita aplicado no Neon main e development.
-- Após o fim do trial, os dados continuam legíveis, mas a operação fica somente leitura
-- até a empresa voltar ao status ativo pela camada de cobrança.

create or replace function public.enforce_business_write_access()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_business_id uuid; v_status text; v_trial_ends_at timestamptz;
begin
  v_business_id:=case when tg_op='DELETE' then old.business_id else new.business_id end;
  select status,trial_ends_at into v_status,v_trial_ends_at from public.businesses where id=v_business_id;
  if v_status='active' or (v_status='trial' and v_trial_ends_at is not null and v_trial_ends_at>now()) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  raise exception 'SUBSCRIPTION_REQUIRED';
end; $$;

drop trigger if exists trg_clients_subscription on public.clients;
create trigger trg_clients_subscription before insert or update or delete on public.clients for each row execute function public.enforce_business_write_access();
drop trigger if exists trg_services_subscription on public.services;
create trigger trg_services_subscription before insert or update or delete on public.services for each row execute function public.enforce_business_write_access();
drop trigger if exists trg_appointments_subscription on public.appointments;
create trigger trg_appointments_subscription before insert or update or delete on public.appointments for each row execute function public.enforce_business_write_access();
drop trigger if exists trg_financial_subscription on public.financial_entries;
create trigger trg_financial_subscription before insert or update or delete on public.financial_entries for each row execute function public.enforce_business_write_access();
drop trigger if exists trg_quotes_subscription on public.quotes;
create trigger trg_quotes_subscription before insert or update or delete on public.quotes for each row execute function public.enforce_business_write_access();

create or replace function public.enforce_quote_item_write_access()
returns trigger language plpgsql security definer set search_path=public,auth as $$
declare v_quote_id uuid; v_status text; v_trial_ends_at timestamptz;
begin
  v_quote_id:=case when tg_op='DELETE' then old.quote_id else new.quote_id end;
  select b.status,b.trial_ends_at into v_status,v_trial_ends_at
  from public.quotes q join public.businesses b on b.id=q.business_id where q.id=v_quote_id;
  if v_status='active' or (v_status='trial' and v_trial_ends_at is not null and v_trial_ends_at>now()) then
    if tg_op='DELETE' then return old; else return new; end if;
  end if;
  raise exception 'SUBSCRIPTION_REQUIRED';
end; $$;

drop trigger if exists trg_quote_items_subscription on public.quote_items;
create trigger trg_quote_items_subscription before insert or update or delete on public.quote_items for each row execute function public.enforce_quote_item_write_access();
