-- Complemento aplicado no Neon main e development.
-- Impede inclusão/reativação de usuários quando o trial venceu ou a assinatura não está ativa.
-- Desativar usuários permanece permitido.

create or replace function public.add_business_member_by_email(p_business_id uuid,p_email text,p_role text default 'member')
returns uuid language plpgsql security definer set search_path=public,neon_auth,auth as $$
declare
  v_user_id uuid;
  v_member_id uuid;
  v_role text;
  v_status text;
  v_trial_ends_at timestamptz;
begin
  if not public.can_manage_business(p_business_id) then raise exception 'ACCESS_DENIED'; end if;
  select status,trial_ends_at into v_status,v_trial_ends_at from public.businesses where id=p_business_id;
  if not (v_status='active' or (v_status='trial' and v_trial_ends_at is not null and v_trial_ends_at>now())) then
    raise exception 'SUBSCRIPTION_REQUIRED';
  end if;
  v_role:=lower(trim(coalesce(p_role,'member')));
  if v_role not in ('admin','member') then raise exception 'INVALID_ROLE'; end if;
  select u.id into v_user_id from neon_auth."user" u where lower(u.email)=lower(trim(p_email)) limit 1;
  if v_user_id is null then raise exception 'USER_NOT_FOUND'; end if;
  insert into public.business_members(business_id,user_id,role,active)
  values(p_business_id,v_user_id,v_role,true)
  on conflict (business_id,user_id) do update set role=excluded.role,active=true
  returning id into v_member_id;
  return v_member_id;
end; $$;
