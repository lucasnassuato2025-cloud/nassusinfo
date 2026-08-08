-- Nassus Gestão — perfis de equipe e políticas por módulo.

alter table public.business_members drop constraint if exists business_members_role_check;
alter table public.business_members add constraint business_members_role_check
check (role in ('owner','admin','member','reception','professional','finance'));

create or replace function public.can_finance_business(p_business_id uuid) returns boolean
language sql stable as $$
  select coalesce(public.business_role(p_business_id) in ('owner','admin','finance'),false)
$$;

create or replace function public.can_operate_business(p_business_id uuid) returns boolean
language sql stable as $$
  select coalesce(public.business_role(p_business_id) in ('owner','admin','member','reception','professional'),false)
$$;

create or replace function public.can_commercial_business(p_business_id uuid) returns boolean
language sql stable as $$
  select coalesce(public.business_role(p_business_id) in ('owner','admin','member','reception'),false)
$$;

drop policy if exists finance_manage on public.financial_entries;
drop policy if exists finance_select on public.financial_entries;
create policy finance_select on public.financial_entries for select to authenticated
using(public.can_finance_business(business_id));
create policy finance_manage on public.financial_entries for all to authenticated
using(public.can_finance_business(business_id)) with check(public.can_finance_business(business_id));

drop policy if exists clients_member_access on public.clients;
create policy clients_member_access on public.clients for all to authenticated
using(public.can_operate_business(business_id)) with check(public.can_operate_business(business_id));

drop policy if exists services_member_access on public.services;
create policy services_member_access on public.services for all to authenticated
using(public.can_operate_business(business_id)) with check(public.can_operate_business(business_id));

drop policy if exists appointments_member_access on public.appointments;
create policy appointments_member_access on public.appointments for all to authenticated
using(public.can_operate_business(business_id)) with check(public.can_operate_business(business_id));

drop policy if exists quotes_member_access on public.quotes;
create policy quotes_member_access on public.quotes for all to authenticated
using(public.can_commercial_business(business_id)) with check(public.can_commercial_business(business_id));

create or replace function public.is_quote_member(p_quote_id uuid) returns boolean
language sql stable security definer set search_path=public,neon_auth,auth as $$
  select exists(select 1 from public.quotes q where q.id=p_quote_id and public.can_commercial_business(q.business_id))
$$;

create or replace function public.add_business_member_by_email(p_business_id uuid,p_email text,p_role text default 'member') returns uuid
language plpgsql security definer set search_path=public,neon_auth,auth as $$
declare v_user_id uuid; v_member_id uuid; v_role text; v_status text; v_trial_ends_at timestamptz;
begin
  if not public.can_manage_business(p_business_id) then raise exception 'ACCESS_DENIED'; end if;
  select status,trial_ends_at into v_status,v_trial_ends_at from public.businesses where id=p_business_id;
  if not (v_status='active' or (v_status='trial' and v_trial_ends_at is not null and v_trial_ends_at>now())) then raise exception 'SUBSCRIPTION_REQUIRED'; end if;
  v_role:=lower(trim(coalesce(p_role,'member')));
  if v_role not in ('admin','member','reception','professional','finance') then raise exception 'INVALID_ROLE'; end if;
  select u.id into v_user_id from neon_auth."user" u where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user_id is null then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.business_members(business_id,user_id,role,active,bookable)
  values(p_business_id,v_user_id,v_role,true,v_role in ('professional','member'))
  on conflict (business_id,user_id) do update
    set role=excluded.role,active=true,
        bookable=case when excluded.role='professional' then true else public.business_members.bookable end
  returning id into v_member_id;
  return v_member_id;
end $$;

create or replace function public.list_business_members_v2(p_business_id uuid)
returns table(member_id uuid,user_id uuid,name text,email text,role text,active boolean,bookable boolean,job_title text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,neon_auth,auth as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'ACCESS_DENIED'; end if;
  return query select bm.id,bm.user_id,u.name,u.email,bm.role,bm.active,bm.bookable,bm.job_title,bm.created_at
  from public.business_members bm join neon_auth."user" u on u.id=bm.user_id
  where bm.business_id=p_business_id
  order by case when bm.role='owner' then 0 else 1 end,u.name,u.email;
end $$;

create or replace function public.update_business_member_settings(
  p_business_id uuid,p_member_id uuid,p_role text,p_bookable boolean,p_job_title text default null
) returns boolean
language plpgsql security definer set search_path=public as $$
declare v_existing_role text; v_role text;
begin
  if not public.can_manage_business(p_business_id) then raise exception 'ACCESS_DENIED'; end if;
  select role into v_existing_role from public.business_members where id=p_member_id and business_id=p_business_id;
  if v_existing_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_existing_role='owner' then raise exception 'OWNER_ROLE_LOCKED'; end if;
  v_role:=lower(trim(p_role));
  if v_role not in ('admin','member','reception','professional','finance') then raise exception 'INVALID_ROLE'; end if;
  update public.business_members
  set role=v_role,bookable=coalesce(p_bookable,false),job_title=nullif(left(trim(coalesce(p_job_title,'')),80),'')
  where id=p_member_id and business_id=p_business_id;
  return true;
end $$;

grant execute on function public.list_business_members_v2(uuid) to authenticated;
grant execute on function public.update_business_member_settings(uuid,uuid,text,boolean,text) to authenticated;
