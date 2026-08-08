BEGIN;

-- Nassus Gestão 0.3.0 — pre-launch hardening.
-- Auth trusted origins / allow_localhost are environment settings in neon_auth.project_config
-- and are intentionally not versioned here.

CREATE OR REPLACE FUNCTION public.create_business(p_name text,p_slug text,p_business_type text DEFAULT 'services'::text,p_document text DEFAULT NULL::text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','neon_auth','auth' AS $function$
DECLARE v_user_id uuid;v_business_id uuid;v_type text;v_name text;v_slug text;
BEGIN
  v_user_id:=public.current_auth_user_id();IF v_user_id IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nassus:onboarding:'||v_user_id::text,0));
  IF EXISTS(SELECT 1 FROM public.business_members bm WHERE bm.user_id=v_user_id AND bm.role='owner') THEN RAISE EXCEPTION 'OWNER_BUSINESS_ALREADY_EXISTS';END IF;
  v_name:=trim(coalesce(p_name,''));v_slug:=lower(trim(coalesce(p_slug,'')));v_type:=lower(trim(coalesce(p_business_type,'services')));
  IF char_length(v_name)<2 OR char_length(v_name)>120 THEN RAISE EXCEPTION 'INVALID_BUSINESS_NAME';END IF;
  IF char_length(v_slug)<2 OR char_length(v_slug)>64 OR v_slug!~'^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN RAISE EXCEPTION 'INVALID_BUSINESS_SLUG';END IF;
  IF v_type NOT IN ('services','clinic','beauty','pet','workshop','professional','other') THEN RAISE EXCEPTION 'INVALID_BUSINESS_TYPE';END IF;
  IF char_length(coalesce(p_document,''))>40 THEN RAISE EXCEPTION 'INVALID_DOCUMENT';END IF;
  INSERT INTO public.businesses(name,slug,document,business_type,plan,status,trial_ends_at) VALUES(v_name,v_slug,nullif(trim(coalesce(p_document,'')),''),v_type,'essential','trial',now()+interval '7 days') RETURNING id INTO v_business_id;
  INSERT INTO public.business_members(business_id,user_id,role,active) VALUES(v_business_id,v_user_id,'owner',true);
  RETURN v_business_id;
END;$function$;

CREATE OR REPLACE FUNCTION public.enforce_client_limit() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_limit integer;v_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('nassus:client-limit:'||new.business_id::text,0));
  SELECT client_limit INTO v_limit FROM public.businesses WHERE id=new.business_id;IF v_limit IS NULL THEN RETURN new;END IF;
  SELECT count(*) INTO v_count FROM public.clients WHERE business_id=new.business_id;IF v_count>=v_limit THEN RAISE EXCEPTION 'CLIENT_LIMIT_REACHED';END IF;RETURN new;
END;$function$;

CREATE OR REPLACE FUNCTION public.enforce_user_limit() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE v_limit integer;v_count integer;v_status text;v_trial_ends_at timestamptz;
BEGIN
  IF new.active=false THEN RETURN new;END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nassus:user-limit:'||new.business_id::text,0));
  SELECT user_limit,status,trial_ends_at INTO v_limit,v_status,v_trial_ends_at FROM public.businesses WHERE id=new.business_id;IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_FOUND';END IF;
  IF NOT(v_status='active' OR(v_status='trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at>now())) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
  IF tg_op='UPDATE' AND old.active=true THEN RETURN new;END IF;
  SELECT count(*) INTO v_count FROM public.business_members WHERE business_id=new.business_id AND active=true;IF v_count>=v_limit THEN RAISE EXCEPTION 'USER_LIMIT_REACHED';END IF;RETURN new;
END;$function$;

CREATE OR REPLACE FUNCTION public.prevent_appointment_conflict() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_end timestamptz;
BEGIN
  IF new.professional_user_id IS NULL OR new.status IN ('cancelled','no_show') THEN RETURN new;END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('nassus:agenda:'||new.business_id::text||':'||new.professional_user_id::text,0));v_end:=coalesce(new.ends_at,new.starts_at+interval '30 minutes');
  IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.business_id=new.business_id AND a.professional_user_id=new.professional_user_id AND a.id<>new.id AND a.status NOT IN ('cancelled','no_show') AND tstzrange(a.starts_at,coalesce(a.ends_at,a.starts_at+interval '30 minutes'),'[)')&&tstzrange(new.starts_at,v_end,'[)')) THEN RAISE EXCEPTION 'APPOINTMENT_CONFLICT';END IF;RETURN new;
END;$function$;

CREATE OR REPLACE FUNCTION public.update_business_member_settings(p_business_id uuid,p_member_id uuid,p_role text,p_bookable boolean,p_job_title text DEFAULT NULL::text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth' AS $function$
DECLARE v_existing_role text;v_role text;v_status text;v_trial_ends_at timestamptz;
BEGIN
  IF NOT public.can_manage_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED';END IF;
  SELECT status,trial_ends_at INTO v_status,v_trial_ends_at FROM public.businesses WHERE id=p_business_id;IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_FOUND';END IF;
  IF NOT(v_status='active' OR(v_status='trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at>now())) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
  SELECT role INTO v_existing_role FROM public.business_members WHERE id=p_member_id AND business_id=p_business_id;IF v_existing_role IS NULL THEN RAISE EXCEPTION 'MEMBER_NOT_FOUND';END IF;IF v_existing_role='owner' THEN RAISE EXCEPTION 'OWNER_ROLE_LOCKED';END IF;
  v_role:=lower(trim(p_role));IF v_role NOT IN ('admin','member','reception','professional','finance') THEN RAISE EXCEPTION 'INVALID_ROLE';END IF;
  UPDATE public.business_members SET role=v_role,bookable=coalesce(p_bookable,false),job_title=nullif(left(trim(coalesce(p_job_title,'')),120),'') WHERE id=p_member_id AND business_id=p_business_id;RETURN true;
END;$function$;

CREATE OR REPLACE FUNCTION public.assign_quote_number() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN PERFORM pg_advisory_xact_lock(hashtextextended('nassus:quote-number:'||new.business_id::text,0));SELECT coalesce(max(q.number),0)+1 INTO new.number FROM public.quotes q WHERE q.business_id=new.business_id;RETURN new;END;$function$;
DROP TRIGGER IF EXISTS trg_quote_number ON public.quotes;
CREATE TRIGGER trg_quote_number BEFORE INSERT ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.assign_quote_number();
CREATE UNIQUE INDEX IF NOT EXISTS ux_quotes_business_number ON public.quotes(business_id,number);

CREATE OR REPLACE FUNCTION public.normalize_quote_item_total() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN new.description:=trim(new.description);new.total:=new.quantity*new.unit_price;RETURN new;END;$function$;
DROP TRIGGER IF EXISTS trg_quote_item_total ON public.quote_items;
CREATE TRIGGER trg_quote_item_total BEFORE INSERT OR UPDATE OF quantity,unit_price,total,description ON public.quote_items FOR EACH ROW EXECUTE FUNCTION public.normalize_quote_item_total();

CREATE OR REPLACE FUNCTION public.create_quote_with_items(p_business_id uuid,p_client_id uuid,p_discount numeric,p_notes text,p_valid_until date,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth' AS $function$
DECLARE v_quote_id uuid;v_subtotal numeric:=0;v_discount numeric:=coalesce(p_discount,0);v_item jsonb;v_description text;v_quantity numeric;v_unit_price numeric;v_service_id uuid;
BEGIN
  IF NOT public.can_commercial_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED';END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items)<1 OR jsonb_array_length(p_items)>50 THEN RAISE EXCEPTION 'INVALID_QUOTE_ITEMS';END IF;
  IF p_client_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clients c WHERE c.id=p_client_id AND c.business_id=p_business_id) THEN RAISE EXCEPTION 'TENANT_REFERENCE_MISMATCH';END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    v_description:=trim(coalesce(v_item->>'description',''));v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,0);v_unit_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,0);v_service_id:=nullif(v_item->>'service_id','')::uuid;
    IF char_length(v_description)<1 OR char_length(v_description)>250 THEN RAISE EXCEPTION 'INVALID_QUOTE_ITEM_DESCRIPTION';END IF;IF v_quantity<=0 OR v_quantity>100000 THEN RAISE EXCEPTION 'INVALID_QUOTE_ITEM_QUANTITY';END IF;IF v_unit_price<0 OR v_unit_price>100000000 THEN RAISE EXCEPTION 'INVALID_QUOTE_ITEM_PRICE';END IF;
    IF v_service_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.services s WHERE s.id=v_service_id AND s.business_id=p_business_id) THEN RAISE EXCEPTION 'TENANT_REFERENCE_MISMATCH';END IF;v_subtotal:=v_subtotal+(v_quantity*v_unit_price);
  END LOOP;
  IF v_discount<0 OR v_discount>v_subtotal THEN RAISE EXCEPTION 'INVALID_QUOTE_DISCOUNT';END IF;IF p_valid_until IS NOT NULL AND p_valid_until<current_date THEN RAISE EXCEPTION 'INVALID_QUOTE_VALIDITY';END IF;
  INSERT INTO public.quotes(business_id,client_id,status,subtotal,discount,total,notes,valid_until) VALUES(p_business_id,p_client_id,'draft',v_subtotal,v_discount,v_subtotal-v_discount,nullif(left(trim(coalesce(p_notes,'')),2000),''),p_valid_until) RETURNING id INTO v_quote_id;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items) LOOP v_description:=trim(coalesce(v_item->>'description',''));v_quantity:=coalesce(nullif(v_item->>'quantity','')::numeric,0);v_unit_price:=coalesce(nullif(v_item->>'unit_price','')::numeric,0);v_service_id:=nullif(v_item->>'service_id','')::uuid;INSERT INTO public.quote_items(quote_id,service_id,description,quantity,unit_price,total) VALUES(v_quote_id,v_service_id,v_description,v_quantity,v_unit_price,v_quantity*v_unit_price);END LOOP;RETURN v_quote_id;
END;$function$;

CREATE OR REPLACE FUNCTION public.update_business_settings(p_business_id uuid,p_name text,p_phone text,p_email text,p_document text,p_business_type text,p_address text,p_public_booking_enabled boolean,p_booking_notice text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth' AS $function$
DECLARE v_status text;v_trial_ends_at timestamptz;v_type text;v_name text;
BEGIN
 IF NOT public.can_manage_business(p_business_id) THEN RAISE EXCEPTION 'MANAGER_REQUIRED';END IF;SELECT status,trial_ends_at INTO v_status,v_trial_ends_at FROM public.businesses WHERE id=p_business_id;IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_FOUND';END IF;IF NOT(v_status='active' OR(v_status='trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at>now())) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 v_name:=trim(coalesce(p_name,''));v_type:=lower(trim(coalesce(p_business_type,'')));IF char_length(v_name)<2 OR char_length(v_name)>120 THEN RAISE EXCEPTION 'INVALID_BUSINESS_NAME';END IF;IF v_type NOT IN ('services','clinic','beauty','pet','workshop','professional','other') THEN RAISE EXCEPTION 'INVALID_BUSINESS_TYPE';END IF;IF char_length(coalesce(p_phone,''))>40 OR char_length(coalesce(p_email,''))>160 OR char_length(coalesce(p_document,''))>40 OR char_length(coalesce(p_address,''))>300 OR char_length(coalesce(p_booking_notice,''))>500 THEN RAISE EXCEPTION 'INVALID_BUSINESS_FIELD';END IF;
 UPDATE public.businesses SET name=v_name,phone=nullif(trim(coalesce(p_phone,'')),''),email=nullif(lower(trim(coalesce(p_email,''))),''),document=nullif(trim(coalesce(p_document,'')),''),business_type=v_type,address=nullif(trim(coalesce(p_address,'')),''),public_booking_enabled=coalesce(p_public_booking_enabled,false),booking_notice=nullif(trim(coalesce(p_booking_notice,'')),'') WHERE id=p_business_id;
END;$function$;

CREATE OR REPLACE FUNCTION public.update_business_hours(p_business_id uuid,p_opening_hours jsonb,p_timezone text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth','pg_catalog' AS $function$
DECLARE v_status text;v_trial_ends_at timestamptz;v_key text;v_day jsonb;v_enabled boolean;v_start time;v_end time;v_timezone text;
BEGIN
 IF NOT public.can_manage_business(p_business_id) THEN RAISE EXCEPTION 'MANAGER_REQUIRED';END IF;SELECT status,trial_ends_at INTO v_status,v_trial_ends_at FROM public.businesses WHERE id=p_business_id;IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_NOT_FOUND';END IF;IF NOT(v_status='active' OR(v_status='trial' AND v_trial_ends_at IS NOT NULL AND v_trial_ends_at>now())) THEN RAISE EXCEPTION 'SUBSCRIPTION_REQUIRED';END IF;
 v_timezone:=trim(coalesce(p_timezone,''));IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=v_timezone) THEN RAISE EXCEPTION 'INVALID_TIMEZONE';END IF;IF p_opening_hours IS NULL OR jsonb_typeof(p_opening_hours)<>'object' THEN RAISE EXCEPTION 'INVALID_BUSINESS_HOURS';END IF;
 FOREACH v_key IN ARRAY ARRAY['mon','tue','wed','thu','fri','sat','sun'] LOOP v_day:=p_opening_hours->v_key;IF v_day IS NULL OR jsonb_typeof(v_day)<>'object' THEN RAISE EXCEPTION 'INVALID_BUSINESS_HOURS';END IF;BEGIN v_enabled:=coalesce((v_day->>'enabled')::boolean,false);v_start:=nullif(v_day->>'start','')::time;v_end:=nullif(v_day->>'end','')::time;EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'INVALID_BUSINESS_HOURS';END;IF v_enabled AND(v_start IS NULL OR v_end IS NULL OR v_start>=v_end) THEN RAISE EXCEPTION 'INVALID_BUSINESS_HOURS';END IF;END LOOP;
 UPDATE public.businesses SET opening_hours=p_opening_hours,timezone=v_timezone WHERE id=p_business_id;
END;$function$;

CREATE OR REPLACE FUNCTION public.finance_client_options(p_business_id uuid) RETURNS TABLE(id uuid,name text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth' AS $function$
BEGIN IF NOT public.can_finance_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED';END IF;RETURN QUERY SELECT c.id,c.name FROM public.clients c WHERE c.business_id=p_business_id ORDER BY c.name;END;$function$;

CREATE OR REPLACE FUNCTION public.report_operational_metrics(p_business_id uuid,p_since timestamptz DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth' AS $function$
DECLARE v_result jsonb;
BEGIN
 IF NOT public.can_finance_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED';END IF;
 SELECT jsonb_build_object('client_count',(SELECT count(*) FROM public.clients c WHERE c.business_id=p_business_id),'member_count',(SELECT count(*) FROM public.business_members m WHERE m.business_id=p_business_id AND m.active=true),'appointment_count',(SELECT count(*) FROM public.appointments a WHERE a.business_id=p_business_id AND(p_since IS NULL OR a.starts_at>=p_since)),'completed_count',(SELECT count(*) FROM public.appointments a WHERE a.business_id=p_business_id AND a.status='completed' AND(p_since IS NULL OR a.starts_at>=p_since)),'quote_count',(SELECT count(*) FROM public.quotes q WHERE q.business_id=p_business_id AND(p_since IS NULL OR q.created_at>=p_since)),'approved_quote_count',(SELECT count(*) FROM public.quotes q WHERE q.business_id=p_business_id AND q.status IN('approved','converted') AND(p_since IS NULL OR q.created_at>=p_since)),'approved_quote_total',(SELECT coalesce(sum(q.total),0) FROM public.quotes q WHERE q.business_id=p_business_id AND q.status IN('approved','converted') AND(p_since IS NULL OR q.created_at>=p_since)),'service_count',(SELECT count(*) FROM public.services s WHERE s.business_id=p_business_id),'service_usage',coalesce((SELECT jsonb_agg(jsonb_build_object('name',x.name,'count',x.usage_count) ORDER BY x.usage_count DESC,x.name) FROM(SELECT s.name,count(a.id)::int AS usage_count FROM public.services s LEFT JOIN public.appointments a ON a.business_id=p_business_id AND a.service_id=s.id AND a.status<>'cancelled' AND(p_since IS NULL OR a.starts_at>=p_since) WHERE s.business_id=p_business_id GROUP BY s.id,s.name ORDER BY usage_count DESC,s.name LIMIT 8)x),'[]'::jsonb)) INTO v_result;RETURN v_result;
END;$function$;

CREATE OR REPLACE FUNCTION public.create_public_booking(p_slug text,p_client_name text,p_phone text,p_email text,p_service_id uuid,p_professional_user_id uuid,p_starts_at timestamptz,p_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','neon_auth' AS $function$
DECLARE v_business public.businesses;v_client_id uuid;v_duration integer;v_appointment_id uuid;v_phone_digits text;v_email text;v_local timestamp;v_key text;v_day jsonb;v_open time;v_close time;v_open_at timestamp;v_close_at timestamp;
BEGIN
 IF length(trim(coalesce(p_client_name,'')))<2 OR length(trim(coalesce(p_client_name,'')))>120 THEN RAISE EXCEPTION 'CLIENT_NAME_REQUIRED';END IF;v_phone_digits:=regexp_replace(coalesce(p_phone,''),'\D','','g');v_email:=lower(trim(coalesce(p_email,'')));IF length(v_phone_digits)<8 AND(v_email='' OR position('@' in v_email)<2 OR length(v_email)>160) THEN RAISE EXCEPTION 'CONTACT_REQUIRED';END IF;IF length(v_phone_digits)>20 THEN RAISE EXCEPTION 'INVALID_CONTACT';END IF;IF p_starts_at<=now()+interval '5 minutes' OR p_starts_at>now()+interval '180 days' THEN RAISE EXCEPTION 'INVALID_APPOINTMENT_DATE';END IF;
 SELECT * INTO v_business FROM public.businesses b WHERE b.slug=lower(trim(p_slug)) AND b.public_booking_enabled=true AND(b.status='active' OR(b.status='trial' AND b.trial_ends_at>now()));IF NOT FOUND THEN RAISE EXCEPTION 'PUBLIC_BOOKING_UNAVAILABLE';END IF;SELECT duration_minutes INTO v_duration FROM public.services WHERE id=p_service_id AND business_id=v_business.id AND active=true;IF NOT FOUND THEN RAISE EXCEPTION 'SERVICE_UNAVAILABLE';END IF;IF p_professional_user_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.business_members WHERE business_id=v_business.id AND user_id=p_professional_user_id AND active=true AND bookable=true) THEN RAISE EXCEPTION 'PROFESSIONAL_UNAVAILABLE';END IF;
 IF coalesce(v_business.opening_hours,'{}'::jsonb)<>'{}'::jsonb THEN v_local:=p_starts_at AT TIME ZONE coalesce(nullif(v_business.timezone,''),'America/Sao_Paulo');v_key:=CASE extract(isodow FROM v_local)::int WHEN 1 THEN 'mon' WHEN 2 THEN 'tue' WHEN 3 THEN 'wed' WHEN 4 THEN 'thu' WHEN 5 THEN 'fri' WHEN 6 THEN 'sat' ELSE 'sun' END;v_day:=v_business.opening_hours->v_key;IF v_day IS NULL OR coalesce((v_day->>'enabled')::boolean,false)=false THEN RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS';END IF;v_open:=coalesce(nullif(v_day->>'start',''),'08:00')::time;v_close:=coalesce(nullif(v_day->>'end',''),'18:00')::time;v_open_at:=date_trunc('day',v_local)+v_open;v_close_at:=date_trunc('day',v_local)+v_close;IF v_close_at<=v_open_at OR v_local<v_open_at OR v_local+make_interval(mins=>coalesce(v_duration,30))>v_close_at THEN RAISE EXCEPTION 'OUTSIDE_BUSINESS_HOURS';END IF;END IF;
 IF length(v_phone_digits)>=8 THEN SELECT id INTO v_client_id FROM public.clients WHERE business_id=v_business.id AND regexp_replace(coalesce(phone,''),'\D','','g')=v_phone_digits ORDER BY created_at DESC LIMIT 1;END IF;IF v_client_id IS NULL AND v_email<>'' THEN SELECT id INTO v_client_id FROM public.clients WHERE business_id=v_business.id AND lower(email)=v_email ORDER BY created_at DESC LIMIT 1;END IF;IF v_client_id IS NULL THEN INSERT INTO public.clients(business_id,name,phone,email,status) VALUES(v_business.id,left(trim(p_client_name),120),nullif(left(trim(coalesce(p_phone,'')),40),''),nullif(left(v_email,160),''),'active') RETURNING id INTO v_client_id;END IF;
 IF EXISTS(SELECT 1 FROM public.appointments a WHERE a.business_id=v_business.id AND a.client_id=v_client_id AND a.service_id=p_service_id AND a.starts_at=p_starts_at AND a.status NOT IN('cancelled','no_show')) THEN RAISE EXCEPTION 'DUPLICATE_BOOKING';END IF;INSERT INTO public.appointments(business_id,client_id,service_id,professional_user_id,starts_at,ends_at,status,notes) VALUES(v_business.id,v_client_id,p_service_id,p_professional_user_id,p_starts_at,p_starts_at+make_interval(mins=>coalesce(v_duration,30)),'scheduled',nullif(left(trim(coalesce(p_notes,'')),1000),'')) RETURNING id INTO v_appointment_id;RETURN v_appointment_id;
END;$function$;

-- Data integrity constraints (migration is applied once).
ALTER TABLE public.businesses ADD CONSTRAINT businesses_name_length_check CHECK(char_length(trim(name)) BETWEEN 2 AND 120);
ALTER TABLE public.businesses ADD CONSTRAINT businesses_slug_format_check CHECK(char_length(slug) BETWEEN 2 AND 64 AND slug~'^[a-z0-9]+(?:-[a-z0-9]+)*$');
ALTER TABLE public.businesses ADD CONSTRAINT businesses_type_check CHECK(business_type IN('services','clinic','beauty','pet','workshop','professional','other'));
ALTER TABLE public.businesses ADD CONSTRAINT businesses_fields_length_check CHECK(char_length(coalesce(phone,''))<=40 AND char_length(coalesce(email,''))<=160 AND char_length(coalesce(document,''))<=40 AND char_length(coalesce(address,''))<=300 AND char_length(coalesce(booking_notice,''))<=500);
ALTER TABLE public.clients ADD CONSTRAINT clients_name_length_check CHECK(char_length(trim(name)) BETWEEN 1 AND 120);
ALTER TABLE public.clients ADD CONSTRAINT clients_fields_length_check CHECK(char_length(coalesce(phone,''))<=40 AND char_length(coalesce(email,''))<=160 AND char_length(coalesce(document,''))<=40 AND char_length(coalesce(notes,''))<=5000);
ALTER TABLE public.services ADD CONSTRAINT services_name_length_check CHECK(char_length(trim(name)) BETWEEN 1 AND 120);
ALTER TABLE public.services ADD CONSTRAINT services_description_length_check CHECK(char_length(coalesce(description,''))<=2000);
ALTER TABLE public.appointments ADD CONSTRAINT appointments_notes_length_check CHECK(char_length(coalesce(notes,''))<=1000);
ALTER TABLE public.business_members ADD CONSTRAINT business_members_job_title_length_check CHECK(char_length(coalesce(job_title,''))<=120);
ALTER TABLE public.financial_entries DROP CONSTRAINT financial_entries_amount_check;
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_amount_check CHECK(amount>0);
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_description_check CHECK(char_length(trim(description)) BETWEEN 1 AND 250);
ALTER TABLE public.financial_entries ADD CONSTRAINT financial_entries_text_fields_check CHECK(char_length(coalesce(category,''))<=120 AND char_length(coalesce(payment_method,''))<=80);
ALTER TABLE public.quotes ADD CONSTRAINT quotes_discount_lte_subtotal_check CHECK(discount<=subtotal);
ALTER TABLE public.quotes ADD CONSTRAINT quotes_total_consistency_check CHECK(total=subtotal-discount);
ALTER TABLE public.quotes ADD CONSTRAINT quotes_notes_length_check CHECK(char_length(coalesce(notes,''))<=2000);
ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_description_check CHECK(char_length(trim(description)) BETWEEN 1 AND 250);

-- Least-privilege RPC access.
REVOKE EXECUTE ON FUNCTION public.add_business_member_by_email(uuid,text,text) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.business_role(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.create_business(text,text,text,text) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.deactivate_business_member(uuid,uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.is_business_member(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin() FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.is_quote_member(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.list_business_members(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.list_business_members_v2(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.update_business_member_settings(uuid,uuid,text,boolean,text) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.can_manage_business(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.can_operate_business(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.can_commercial_business(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.can_finance_business(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.current_auth_user_id() FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.create_quote_with_items(uuid,uuid,numeric,text,date,jsonb) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.update_business_settings(uuid,text,text,text,text,text,text,boolean,text) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.update_business_hours(uuid,jsonb,text) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.finance_client_options(uuid) FROM PUBLIC,anonymous;
REVOKE EXECUTE ON FUNCTION public.report_operational_metrics(uuid,timestamptz) FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION public.add_business_member_by_email(uuid,text,text),public.business_role(uuid),public.create_business(text,text,text,text),public.deactivate_business_member(uuid,uuid),public.is_business_member(uuid),public.is_platform_admin(),public.is_quote_member(uuid),public.list_business_members(uuid),public.list_business_members_v2(uuid),public.update_business_member_settings(uuid,uuid,text,boolean,text),public.can_manage_business(uuid),public.can_operate_business(uuid),public.can_commercial_business(uuid),public.can_finance_business(uuid),public.current_auth_user_id(),public.create_quote_with_items(uuid,uuid,numeric,text,date,jsonb),public.update_business_settings(uuid,text,text,text,text,text,text,boolean,text),public.update_business_hours(uuid,jsonb,text),public.finance_client_options(uuid),public.report_operational_metrics(uuid,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_booking_profile(text),public.create_public_booking(text,text,text,text,uuid,uuid,timestamptz,text) TO anonymous,authenticated;

-- Remove direct bypass paths; front-end uses validated RPCs or narrow column updates.
REVOKE UPDATE(name,phone,email,document,business_type,address,public_booking_enabled,booking_notice,opening_hours,timezone) ON public.businesses FROM authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.business_members FROM authenticated;
REVOKE INSERT,UPDATE ON public.quotes FROM authenticated;GRANT UPDATE(status) ON public.quotes TO authenticated;
REVOKE INSERT,UPDATE,DELETE ON public.quote_items FROM authenticated;
REVOKE UPDATE ON public.clients FROM authenticated;GRANT UPDATE(name,phone,email,document,birth_date,notes,status) ON public.clients TO authenticated;
REVOKE UPDATE ON public.services FROM authenticated;GRANT UPDATE(name,description,duration_minutes,price,active) ON public.services TO authenticated;
REVOKE UPDATE ON public.appointments FROM authenticated;GRANT UPDATE(status) ON public.appointments TO authenticated;
REVOKE UPDATE ON public.financial_entries FROM authenticated;GRANT UPDATE(paid_at) ON public.financial_entries TO authenticated;

-- Finance receives only minimum client identifiers and aggregate operational metrics.
DROP POLICY IF EXISTS clients_finance_read ON public.clients;
DROP POLICY IF EXISTS appointments_finance_read ON public.appointments;
DROP POLICY IF EXISTS services_finance_read ON public.services;
DROP POLICY IF EXISTS quotes_finance_read ON public.quotes;
DROP POLICY IF EXISTS finance_select ON public.financial_entries;

COMMIT;
