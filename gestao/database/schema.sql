-- Nassus Gestão — schema multiempresa para Neon Auth + Data API + RLS.

create extension if not exists pgcrypto;

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  document text,
  phone text,
  email text,
  business_type text not null default 'services',
  plan text not null default 'essential' check (plan in ('essential','professional')),
  status text not null default 'trial' check (status in ('trial','active','past_due','suspended','cancelled')),
  client_limit integer,
  user_limit integer not null,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  user_id uuid not null references neon_auth."user"(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id,user_id)
);
create index if not exists idx_business_members_user on business_members(user_id,active);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  document text,
  birth_date date,
  notes text,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_clients_business_created on clients(business_id,created_at desc);
create index if not exists idx_clients_business_name on clients(business_id,name);

create table if not exists services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  name text not null,
  description text,
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  price numeric(12,2) not null default 0 check (price >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_services_business_active on services(business_id,active);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  service_id uuid references services(id) on delete set null,
  professional_user_id uuid references neon_auth."user"(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','confirmed','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at > starts_at)
);
create index if not exists idx_appointments_business_start on appointments(business_id,starts_at);

create table if not exists financial_entries (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  type text not null check (type in ('income','expense')),
  category text,
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  paid_at timestamptz,
  payment_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_financial_business_due on financial_entries(business_id,due_date);

create table if not exists quotes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  number bigint generated always as identity,
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected','expired','converted')),
  subtotal numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  valid_until date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  service_id uuid references services(id) on delete set null,
  description text not null,
  quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null unique references businesses(id) on delete cascade,
  provider text not null default 'cakto',
  provider_customer_id text,
  provider_subscription_id text,
  plan text not null check (plan in ('essential','professional')),
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(provider,provider_event_id)
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references businesses(id) on delete cascade,
  user_id uuid references neon_auth."user"(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function set_business_plan_limits() returns trigger language plpgsql as $$
begin
  if new.plan='essential' then new.client_limit:=90; new.user_limit:=2;
  elsif new.plan='professional' then new.client_limit:=null; new.user_limit:=10;
  end if;
  new.updated_at:=now();
  return new;
end; $$;

drop trigger if exists trg_business_plan_limits on businesses;
create trigger trg_business_plan_limits before insert or update of plan on businesses for each row execute function set_business_plan_limits();

create or replace function enforce_client_limit() returns trigger language plpgsql as $$
declare v_limit integer; v_count integer;
begin
  select client_limit into v_limit from businesses where id=new.business_id;
  if v_limit is null then return new; end if;
  select count(*) into v_count from clients where business_id=new.business_id;
  if v_count>=v_limit then raise exception 'CLIENT_LIMIT_REACHED'; end if;
  return new;
end; $$;

drop trigger if exists trg_client_limit on clients;
create trigger trg_client_limit before insert on clients for each row execute function enforce_client_limit();

create or replace function enforce_user_limit() returns trigger language plpgsql as $$
declare v_limit integer; v_count integer;
begin
  if new.active=false then return new; end if;
  select user_limit into v_limit from businesses where id=new.business_id;
  select count(*) into v_count from business_members where business_id=new.business_id and active=true;
  if v_count>=v_limit then raise exception 'USER_LIMIT_REACHED'; end if;
  return new;
end; $$;

drop trigger if exists trg_user_limit on business_members;
create trigger trg_user_limit before insert on business_members for each row execute function enforce_user_limit();

create or replace function public.current_auth_user_id() returns uuid language sql stable as $$ select nullif(auth.user_id(),'')::uuid $$;
create or replace function public.is_business_member(p_business_id uuid) returns boolean language sql stable security definer set search_path=public,neon_auth,auth as $$ select exists(select 1 from public.business_members bm where bm.business_id=p_business_id and bm.user_id=public.current_auth_user_id() and bm.active=true) $$;
create or replace function public.business_role(p_business_id uuid) returns text language sql stable security definer set search_path=public,neon_auth,auth as $$ select bm.role from public.business_members bm where bm.business_id=p_business_id and bm.user_id=public.current_auth_user_id() and bm.active=true limit 1 $$;
create or replace function public.can_manage_business(p_business_id uuid) returns boolean language sql stable as $$ select coalesce(public.business_role(p_business_id) in ('owner','admin'),false) $$;
create or replace function public.is_quote_member(p_quote_id uuid) returns boolean language sql stable security definer set search_path=public,neon_auth,auth as $$ select exists(select 1 from public.quotes q where q.id=p_quote_id and public.is_business_member(q.business_id)) $$;

create or replace function public.create_business(p_name text,p_slug text,p_business_type text default 'services',p_document text default null) returns uuid language plpgsql security definer set search_path=public,neon_auth,auth as $$
declare v_user_id uuid; v_business_id uuid;
begin
  v_user_id:=public.current_auth_user_id();
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  insert into public.businesses(name,slug,document,business_type,plan,status,trial_ends_at)
  values(trim(p_name),lower(trim(p_slug)),nullif(trim(coalesce(p_document,'')),''),coalesce(nullif(trim(p_business_type),''),'services'),'essential','trial',now()+interval '7 days')
  returning id into v_business_id;
  insert into public.business_members(business_id,user_id,role,active) values(v_business_id,v_user_id,'owner',true);
  return v_business_id;
end; $$;

grant usage on schema public to authenticated;
grant select,update on businesses to authenticated;
grant select,insert,update,delete on business_members,clients,services,appointments,financial_entries,quotes,quote_items to authenticated;
grant select on subscriptions,audit_events to authenticated;
grant usage,select on all sequences in schema public to authenticated;
grant execute on function public.create_business(text,text,text,text) to authenticated;

alter table businesses enable row level security;
alter table business_members enable row level security;
alter table clients enable row level security;
alter table services enable row level security;
alter table appointments enable row level security;
alter table financial_entries enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table subscriptions enable row level security;
alter table audit_events enable row level security;

create policy businesses_select on businesses for select to authenticated using(public.is_business_member(id));
create policy businesses_update on businesses for update to authenticated using(public.can_manage_business(id)) with check(public.can_manage_business(id));
create policy members_select on business_members for select to authenticated using(public.is_business_member(business_id));
create policy members_insert on business_members for insert to authenticated with check(public.can_manage_business(business_id));
create policy members_update on business_members for update to authenticated using(public.can_manage_business(business_id)) with check(public.can_manage_business(business_id));
create policy members_delete on business_members for delete to authenticated using(public.can_manage_business(business_id));
create policy clients_member_access on clients for all to authenticated using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy services_member_access on services for all to authenticated using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy appointments_member_access on appointments for all to authenticated using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy finance_select on financial_entries for select to authenticated using(public.is_business_member(business_id));
create policy finance_manage on financial_entries for all to authenticated using(public.can_manage_business(business_id)) with check(public.can_manage_business(business_id));
create policy quotes_member_access on quotes for all to authenticated using(public.is_business_member(business_id)) with check(public.is_business_member(business_id));
create policy quote_items_member_access on quote_items for all to authenticated using(public.is_quote_member(quote_id)) with check(public.is_quote_member(quote_id));
create policy subscriptions_select on subscriptions for select to authenticated using(public.is_business_member(business_id));
create policy audit_select on audit_events for select to authenticated using(public.can_manage_business(business_id));
