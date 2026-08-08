BEGIN;

CREATE OR REPLACE FUNCTION public.add_business_member_by_email(p_business_id uuid,p_email text,p_role text DEFAULT 'member'::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','neon_auth','auth'
AS $function$
DECLARE v_user_id uuid;v_member_id uuid;v_role text;v_status text;v_trial_ends_at timestamptz;v_verified boolean;
BEGIN
  IF NOT public.can_manage_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT status,trial_ends_at INTO v_status,v_trial_ends_at FROM public.businesses WHERE id=p_business_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_FOUND'; END IF;
  IF NOT(v_status='active' OR(v_status='trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at>now())) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED'; END IF;
  v_role:=lower(trim(coalesce(p_role,'member')));
  IF v_role NOT IN ('admin','member','reception','professional','finance') THEN RAISE EXCEPTION 'INVALID_ROLE'; END IF;
  SELECT u.id,u."emailVerified" INTO v_user_id,v_verified FROM neon_auth."user" u WHERE lower(u.email)=lower(trim(p_email)) LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'USER_NOT_FOUND'; END IF;
  IF coalesce(v_verified,false)=false THEN RAISE EXCEPTION 'EMAIL_NOT_VERIFIED'; END IF;
  INSERT INTO public.business_members(business_id,user_id,role,active,bookable)
  VALUES(p_business_id,v_user_id,v_role,true,v_role IN ('professional','member'))
  ON CONFLICT(business_id,user_id) DO UPDATE SET role=excluded.role,active=true,bookable=CASE WHEN excluded.role='professional' THEN true ELSE public.business_members.bookable END
  RETURNING id INTO v_member_id;
  RETURN v_member_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.team_identity_ready(p_business_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','neon_auth','auth'
AS $function$
DECLARE v_email_password jsonb;v_provider jsonb;
BEGIN
  IF NOT public.can_manage_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT email_and_password,email_provider INTO v_email_password,v_provider FROM neon_auth.project_config WHERE name='nassus-gestao' LIMIT 1;
  RETURN coalesce((v_email_password->>'requireEmailVerification')::boolean,false)
    AND coalesce(v_provider->>'type','shared') <> 'shared';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.team_identity_ready(uuid) FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION public.team_identity_ready(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.public_booking_rate_events(
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  contact_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_public_booking_rate_business_created ON public.public_booking_rate_events(business_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_booking_rate_contact_created ON public.public_booking_rate_events(business_id,contact_key,created_at DESC);
ALTER TABLE public.public_booking_rate_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.public_booking_rate_events FROM anonymous,authenticated;

CREATE OR REPLACE FUNCTION public.create_public_booking(p_slug text,p_client_name text,p_phone text,p_email text,p_service_id uuid,p_professional_user_id uuid,p_starts_at timestamptz,p_notes text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','neon_auth'
AS $function$
DECLARE
 v_business public.businesses;v_client_id uuid;v_duration integer;v_appointment_id uuid;v_phone_digits text;v_email text;v_local timestamp;v_key text;v_day jsonb;v_open time;v_close time;v_open_at timestamp;v_close_at timestamp;v_contact_key text;v_hour_limit integer;v_day_limit integer;
BEGIN
 IF length(trim(coalesce(p_client_name,'')))<2 OR length(trim(coalesce(p_client_name,'')))>120 THEN RAISE EXCEPTION 'CLIENT_NAME_REQUIRED';END IF;
 v_phone_digits:=regexp_replace(coalesce(p_phone,''),'\D','','g');v_email:=lower(trim(coalesce(p_email,'')));
 IF length(v_phone_digits)<8 AND(v_email='' OR position('@' in v_email)<2 OR length(v_email)>160) THEN RAISE EXCEPTION 'CONTACT_REQUIRED';END IF;
 IF length(v_phone_digits)>20 THEN RAISE EXCEPTION 'INVALID_CONTACT';END IF;
 IF p_starts_at<=now()+interval '5 minutes' OR p_starts_at>now()+interval '180 days' THEN RAISE EXCEPTION 'INVALID_APPOINTMENT_DATE';END IF;
 SELECT * INTO v_business FROM public.businesses b WHERE b.slug=lower(trim(p_slug)) AND b.public_booking_enabled=true AND(b.status='active' OR(b.status='trial' AND b.trial_ends_at>now()));
 IF NOT FOUND THEN RAISE EXCEPTION 'PUBLIC_BOOKING_UNAVAILABLE';END IF;
 SELECT duration_minutes INTO v_duration FROM public.services WHERE id=p_service_id AND business_id=v_business.id AND active=true;
 IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_UNAVAILABLE';END IF;
 IF p_professional_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=v_business.id AND user_id=p_professional_user_id AND active=true AND bookable=true) THEN RAISE EXCEPTION 'PROFESSIONAL_UNAVAILABLE';END IF;
 IF coalesce(v_business.opening_hours,'{}'::jsonb)<>'{}'::jsonb THEN
   v_local:=p_starts_at AT TIME ZONE coalesce(nullif(v_business.timezone,''),'America/Sao_Paulo');
   v_key:=CASE extract(isodow FROM v_local)::int WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed' WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' WHEN 6 THEN 'sat' ELSE 'sun' END;
   v_day:=v_business.opening_hours->v_key;
   IF v_day IS NULL OR coalesce((v_day->>'enabled')::boolean,false)=false THEN RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS';END IF;
   v_open:=coalesce(nullif(v_day->>'start',''),'08:00')::time;v_close:=coalesce(nullif(v_day->>'end',''),'18:00')::time;
   v_open_at:=date_trunc('day',v_local)+v_open;v_close_at:=date_trunc('day',v_local)+v_close;
   IF v_close_at<=v_open_at OR v_local<v_open_at OR v_local+make_interval(mins=>coalesce(v_duration,30))>v_close_at THEN RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS';END IF;
 END IF;
 v_contact_key:=md5(v_business.id::text||':'||coalesce(v_phone_digits,'')||':'||v_email);
 v_hour_limit:=CASE WHEN v_business.plan='professional' THEN 100 ELSE 20 END;
 v_day_limit:=CASE WHEN v_business.plan='professional' THEN 500 ELSE 50 END;
 PERFORM pg_advisory_xact_lock(hashtextextended('nassus:public-booking-rate:'||v_business.id::text,0));
 DELETE FROM public.public_booking_rate_events WHERE business_id=v_business.id AND created_at<now()-interval '2 days';
 IF (SELECT count(*) FROM public.public_booking_rate_events WHERE business_id=v_business.id AND created_at>=now()-interval '1 hour')>=v_hour_limit
    OR (SELECT count(*) FROM public.public_booking_rate_events WHERE business_id=v_business.id AND created_at>=now()-interval '24 hours')>=v_day_limit THEN RAISE EXCEPTION 'PUBLIC_BOOKING_RATE_LIMIT';END IF;
 IF (SELECT count(*) FROM public.public_booking_rate_events WHERE business_id=v_business.id AND contact_key=v_contact_key AND created_at>=now()-interval '24 hours')>=5 THEN RAISE EXCEPTION 'PUBLIC_BOOKING_CONTACT_LIMIT';END IF;
 IF length(v_phone_digits)>=8 THEN SELECT id INTO v_client_id FROM public.clients WHERE business_id=v_business.id AND regexp_replace(coalesce(phone,''),'\D','','g')=v_phone_digits ORDER BY created_at DESC LIMIT 1;END IF;
 IF v_client_id IS NULL AND v_email<>'' THEN SELECT id INTO v_client_id FROM public.clients WHERE business_id=v_business.id AND lower(email)=v_email ORDER BY created_at DESC LIMIT 1;END IF;
 IF v_client_id IS NULL THEN INSERT INTO public.clients(business_id,name,phone,email,status) VALUES(v_business.id,left(trim(p_client_name),120),nullif(left(trim(coalesce(p_phone,'')),40),''),nullif(left(v_email,160),''),'active') RETURNING id INTO v_client_id;END IF;
 IF (SELECT count(*) FROM public.appointments a WHERE a.business_id=v_business.id AND a.client_id=v_client_id AND a.status IN('scheduled','confirmed') AND a.starts_at>now())>=5 THEN RAISE EXCEPTION 'PUBLIC_BOOKING_CONTACT_LIMIT';END IF;
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.business_id=v_business.id AND a.client_id=v_client_id AND a.service_id=p_service_id AND a.starts_at=p_starts_at AND a.status NOT IN('cancelled','no_show')) THEN RAISE EXCEPTION 'DUPLICATE_BOOKING';END IF;
 INSERT INTO public.public_booking_rate_events(business_id,contact_key) VALUES(v_business.id,v_contact_key);
 INSERT INTO public.appointments(business_id,client_id,service_id,professional_user_id,starts_at,ends_at,status,notes)
 VALUES(v_business.id,v_client_id,p_service_id,p_professional_user_id,p_starts_at,p_starts_at+make_interval(mins=>coalesce(v_duration,30)),'scheduled',nullif(left(trim(coalesce(p_notes,'')),1000),''))
 RETURNING id INTO v_appointment_id;
 RETURN v_appointment_id;
END;
$function$;

COMMIT;
