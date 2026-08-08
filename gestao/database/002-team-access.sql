-- Evolução aplicada no Neon main e development.
-- Adiciona gerenciamento de equipe por e-mail e corrige reativação no limite do plano.

create or replace function public.enforce_user_limit() returns trigger language plpgsql as $$
declare v_limit integer; v_count integer;
begin
  if new.active=false then return new; end if;
  if tg_op='UPDATE' and old.active=true then return new; end if;
  select user_limit into v_limit from public.businesses where id=new.business_id;
  select count(*) into v_count from public.business_members where business_id=new.business_id and active=true;
  if v_count>=v_limit then raise exception 'USER_LIMIT_REACHED'; end if;
  return new;
end; $$;

drop trigger if exists trg_user_limit on public.business_members;
create trigger trg_user_limit before insert or update of active on public.business_members for each row when (new.active=true) execute function public.enforce_user_limit();

create or replace function public.list_business_members(p_business_id uuid)
returns table(member_id uuid,user_id uuid,name text,email text,role text,active boolean,created_at timestamptz)
language plpgsql stable security definer set search_path=public,neon_auth,auth as $$
begin
  if not public.is_business_member(p_business_id) then raise exception 'ACCESS_DENIED'; end if;
  return query select bm.id,bm.user_id,u.name,u.email,bm.role,bm.active,bm.created_at
  from public.business_members bm join neon_auth."user" u on u.id=bm.user_id
  where bm.business_id=p_business_id
  order by case when bm.role='owner' then 0 else 1 end,u.name,u.email;
end; $$;

create or replace function public.add_business_member_by_email(p_business_id uuid,p_email text,p_role text default 'member')
returns uuid language plpgsql security definer set search_path=public,neon_auth,auth as $$
declare v_user_id uuid; v_member_id uuid; v_role text;
begin
  if not public.can_manage_business(p_business_id) then raise exception 'ACCESS_DENIED'; end if;
  v_role:=lower(trim(coalesce(p_role,'member')));
  if v_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
  select u.id into v_user_id from neon_auth."user" u where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user_id is null then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.business_members(business_id,user_id,role,active) values(p_business_id,v_user_id,v_role,true)
  on conflict (business_id,user_id) do update set role=excluded.role,active=true returning id into v_member_id;
  return v_member_id;
end; $$;

create or replace function public.deactivate_business_member(p_business_id uuid,p_member_id uuid)
returns boolean language plpgsql security definer set search_path=public,neon_auth,auth as $$
declare v_role text;
begin
  if not public.can_manage_business(p_business_id) then raise exception 'ACCESS_DENIED'; end if;
  select role into v_role from public.business_members where id=p_member_id and business_id=p_business_id;
  if v_role is null then raise exception 'MEMBER_NOT_FOUND'; end if;
  if v_role='owner' then raise exception 'OWNER_CANNOT_BE_DEACTIVATED'; end if;
  update public.business_members set active=false where id=p_member_id and business_id=p_business_id;
  return true;
end; $$;

grant execute on function public.list_business_members(uuid) to authenticated;
grant execute on function public.add_business_member_by_email(uuid,text,text) to authenticated;
grant execute on function public.deactivate_business_member(uuid,uuid) to authenticated;
