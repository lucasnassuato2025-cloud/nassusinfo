-- Nassus Gestão — agendamento público, agenda por profissional e administração da plataforma.
-- Esta migração documenta alterações aplicadas no Neon main + development.

alter table public.businesses add column if not exists address text;
alter table public.businesses add column if not exists timezone text not null default 'America/Sao_Paulo';
alter table public.businesses add column if not exists opening_hours jsonb not null default '{}'::jsonb;
alter table public.businesses add column if not exists public_booking_enabled boolean not null default false;
alter table public.businesses add column if not exists booking_notice text;

alter table public.business_members add column if not exists bookable boolean not null default true;
alter table public.business_members add column if not exists job_title text;

grant update(name,document,phone,email,business_type,address,timezone,opening_hours,public_booking_enabled,booking_notice) on public.businesses to authenticated;
grant update(bookable,job_title) on public.business_members to authenticated;

create or replace function public.prevent_appointment_conflict() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_end timestamptz;
begin
  if new.professional_user_id is null or new.status in ('cancelled','no_show') then return new; end if;
  v_end:=coalesce(new.ends_at,new.starts_at+interval '30 minutes');
  if exists(
    select 1 from public.appointments a
    where a.business_id=new.business_id
      and a.professional_user_id=new.professional_user_id
      and a.id<>new.id
      and a.status not in ('cancelled','no_show')
      and tstzrange(a.starts_at,coalesce(a.ends_at,a.starts_at+interval '30 minutes'),'[)')
          && tstzrange(new.starts_at,v_end,'[)')
  ) then raise exception 'APPOINTMENT_CONFLICT'; end if;
  return new;
end $$;

drop trigger if exists trg_appointment_conflict on public.appointments;
create trigger trg_appointment_conflict
before insert or update of professional_user_id,starts_at,ends_at,status on public.appointments
for each row execute function public.prevent_appointment_conflict();

create or replace function public.public_booking_profile(p_slug text) returns jsonb
language plpgsql security definer set search_path=public,neon_auth as $$
declare v_business public.businesses;
begin
  select * into v_business from public.businesses b
  where b.slug=p_slug and b.public_booking_enabled=true
    and (b.status='active' or (b.status='trial' and b.trial_ends_at>now()));
  if not found then return null; end if;
  return jsonb_build_object(
    'business',jsonb_build_object(
      'id',v_business.id,'name',v_business.name,'slug',v_business.slug,
      'phone',v_business.phone,'email',v_business.email,'address',v_business.address,
      'timezone',v_business.timezone,'opening_hours',v_business.opening_hours,
      'booking_notice',v_business.booking_notice
    ),
    'services',coalesce((select jsonb_agg(jsonb_build_object(
      'id',s.id,'name',s.name,'description',s.description,
      'duration_minutes',s.duration_minutes,'price',s.price) order by s.name)
      from public.services s where s.business_id=v_business.id and s.active=true),'[]'::jsonb),
    'professionals',coalesce((select jsonb_agg(jsonb_build_object(
      'id',u.id,'name',u.name,'job_title',bm.job_title) order by u.name)
      from public.business_members bm join neon_auth."user" u on u.id=bm.user_id
      where bm.business_id=v_business.id and bm.active=true and bm.bookable=true),'[]'::jsonb)
  );
end $$;

grant execute on function public.public_booking_profile(text) to anonymous,authenticated;

create table if not exists public.platform_admins(
  user_id uuid primary key references neon_auth."user"(id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on public.platform_admins from public,anonymous,authenticated;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.platform_admins pa where pa.user_id=public.current_auth_user_id())
$$;

create or replace function public.admin_dashboard() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return jsonb_build_object(
    'businesses',(select count(*) from public.businesses),
    'trials',(select count(*) from public.businesses where status='trial' and trial_ends_at>now()),
    'active',(select count(*) from public.businesses where status='active'),
    'past_due',(select count(*) from public.businesses where status='past_due'),
    'users',(select count(*) from public.business_members where active=true),
    'mrr',(select coalesce(sum(case when plan='professional' then 139.90 else 39.90 end),0)
           from public.businesses where status='active')
  );
end $$;

create or replace function public.admin_list_businesses()
returns table(id uuid,name text,slug text,plan text,status text,client_count bigint,user_count bigint,trial_ends_at timestamptz,created_at timestamptz)
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  return query select b.id,b.name,b.slug,b.plan,b.status,
    (select count(*) from public.clients c where c.business_id=b.id),
    (select count(*) from public.business_members bm where bm.business_id=b.id and bm.active=true),
    b.trial_ends_at,b.created_at
  from public.businesses b order by b.created_at desc;
end $$;

create or replace function public.admin_set_business_state(p_business_id uuid,p_plan text,p_status text) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_plan not in ('essential','professional') or p_status not in ('trial','active','past_due','suspended','cancelled') then raise exception 'INVALID_STATE'; end if;
  update public.businesses set plan=p_plan,status=p_status,updated_at=now() where id=p_business_id;
end $$;

create or replace function public.admin_extend_trial(p_business_id uuid,p_days integer default 7) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not public.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if p_days<1 or p_days>60 then raise exception 'INVALID_TRIAL_DAYS'; end if;
  update public.businesses set status='trial',trial_ends_at=greatest(coalesce(trial_ends_at,now()),now())+make_interval(days=>p_days),updated_at=now()
  where id=p_business_id;
end $$;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.admin_dashboard() to authenticated;
grant execute on function public.admin_list_businesses() to authenticated;
grant execute on function public.admin_set_business_state(uuid,text,text) to authenticated;
grant execute on function public.admin_extend_trial(uuid,integer) to authenticated;
revoke all on function public.admin_dashboard() from public,anonymous;
revoke all on function public.admin_list_businesses() from public,anonymous;
revoke all on function public.admin_set_business_state(uuid,text,text) from public,anonymous;
revoke all on function public.admin_extend_trial(uuid,integer) from public,anonymous;
