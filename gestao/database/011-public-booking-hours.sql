-- Nassus Gestão — criação pública de agendamento respeitando horário comercial.

create or replace function public.create_public_booking(
  p_slug text,
  p_client_name text,
  p_phone text,
  p_email text,
  p_service_id uuid,
  p_professional_user_id uuid,
  p_starts_at timestamptz,
  p_notes text default null
) returns uuid
language plpgsql security definer set search_path=public,neon_auth as $$
declare
  v_business public.businesses;
  v_client_id uuid;
  v_duration integer;
  v_appointment_id uuid;
  v_phone_digits text;
  v_local timestamp;
  v_key text;
  v_day jsonb;
  v_open time;
  v_close time;
begin
  if length(trim(coalesce(p_client_name,'')))<2 then raise exception 'CLIENT_NAME_REQUIRED'; end if;
  if p_starts_at<=now() or p_starts_at>now()+interval '180 days' then raise exception 'INVALID_APPOINTMENT_DATE'; end if;

  select * into v_business from public.businesses b
  where b.slug=p_slug and b.public_booking_enabled=true
    and (b.status='active' or (b.status='trial' and b.trial_ends_at>now()));
  if not found then raise exception 'PUBLIC_BOOKING_UNAVAILABLE'; end if;

  select duration_minutes into v_duration from public.services
  where id=p_service_id and business_id=v_business.id and active=true;
  if not found then raise exception 'SERVICE_UNAVAILABLE'; end if;

  if p_professional_user_id is not null and not exists(
    select 1 from public.business_members
    where business_id=v_business.id and user_id=p_professional_user_id and active=true and bookable=true
  ) then raise exception 'PROFESSIONAL_UNAVAILABLE'; end if;

  if coalesce(v_business.opening_hours,'{}'::jsonb)<>'{}'::jsonb then
    v_local:=p_starts_at at time zone coalesce(nullif(v_business.timezone,''),'America/Sao_Paulo');
    v_key:=case extract(isodow from v_local)::int
      when 1 then 'mon' when 2 then 'tue' when 3 then 'wed' when 4 then 'thu'
      when 5 then 'fri' when 6 then 'sat' else 'sun' end;
    v_day:=v_business.opening_hours->v_key;
    if v_day is null or coalesce((v_day->>'enabled')::boolean,false)=false then raise exception 'OUTSIDE_BUSINESS_HOURS'; end if;
    v_open:=coalesce(nullif(v_day->>'start',''),'08:00')::time;
    v_close:=coalesce(nullif(v_day->>'end',''),'18:00')::time;
    if v_local::time<v_open or (v_local+make_interval(mins=>coalesce(v_duration,30)))::time>v_close then
      raise exception 'OUTSIDE_BUSINESS_HOURS';
    end if;
  end if;

  v_phone_digits:=regexp_replace(coalesce(p_phone,''),'\D','','g');
  if length(v_phone_digits)>=8 then
    select id into v_client_id from public.clients
    where business_id=v_business.id and regexp_replace(coalesce(phone,''),'\D','','g')=v_phone_digits
    order by created_at desc limit 1;
  end if;
  if v_client_id is null and trim(coalesce(p_email,''))<>'' then
    select id into v_client_id from public.clients
    where business_id=v_business.id and lower(email)=lower(trim(p_email)) order by created_at desc limit 1;
  end if;
  if v_client_id is null then
    insert into public.clients(business_id,name,phone,email,status)
    values(v_business.id,left(trim(p_client_name),120),nullif(left(trim(coalesce(p_phone,'')),40),''),nullif(left(trim(coalesce(p_email,'')),160),''),'active')
    returning id into v_client_id;
  end if;

  insert into public.appointments(
    business_id,client_id,service_id,professional_user_id,starts_at,ends_at,status,notes
  ) values(
    v_business.id,v_client_id,p_service_id,p_professional_user_id,p_starts_at,
    p_starts_at+make_interval(mins=>coalesce(v_duration,30)),'scheduled',
    nullif(left(trim(coalesce(p_notes,'')),1000),'')
  ) returning id into v_appointment_id;
  return v_appointment_id;
end $$;

grant execute on function public.create_public_booking(text,text,text,text,uuid,uuid,timestamptz,text) to anonymous,authenticated;
