BEGIN;

CREATE OR REPLACE FUNCTION public.list_business_members_v2(p_business_id uuid)
RETURNS TABLE(member_id uuid,user_id uuid,name text,email text,role text,active boolean,bookable boolean,job_title text,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','neon_auth','auth'
AS $function$
BEGIN
  IF NOT public.can_manage_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  RETURN QUERY
  SELECT bm.id,bm.user_id,u.name,u.email,bm.role,bm.active,bm.bookable,bm.job_title,bm.created_at
  FROM public.business_members bm
  JOIN neon_auth."user" u ON u.id=bm.user_id
  WHERE bm.business_id=p_business_id
  ORDER BY CASE WHEN bm.role='owner' THEN 0 ELSE 1 END,u.name,u.email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_business_members(p_business_id uuid)
RETURNS TABLE(member_id uuid,user_id uuid,name text,email text,role text,active boolean,created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','neon_auth','auth'
AS $function$
BEGIN
  IF NOT public.can_manage_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  RETURN QUERY
  SELECT bm.id,bm.user_id,u.name,u.email,bm.role,bm.active,bm.created_at
  FROM public.business_members bm
  JOIN neon_auth."user" u ON u.id=bm.user_id
  WHERE bm.business_id=p_business_id
  ORDER BY CASE WHEN bm.role='owner' THEN 0 ELSE 1 END,u.name,u.email;
END;
$function$;

CREATE OR REPLACE FUNCTION public.list_bookable_members(p_business_id uuid)
RETURNS TABLE(user_id uuid,name text,job_title text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public','neon_auth','auth'
AS $function$
BEGIN
  IF NOT public.can_operate_business(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  RETURN QUERY
  SELECT bm.user_id,coalesce(nullif(trim(u.name),''),'Profissional')::text,bm.job_title
  FROM public.business_members bm
  JOIN neon_auth."user" u ON u.id=bm.user_id
  WHERE bm.business_id=p_business_id AND bm.active=true AND bm.bookable=true
  ORDER BY u.name;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_bookable_members(uuid) FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION public.list_bookable_members(uuid) TO authenticated;

COMMIT;
