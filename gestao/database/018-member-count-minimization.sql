BEGIN;

CREATE OR REPLACE FUNCTION public.business_member_count(p_business_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public','auth'
AS $function$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_business_member(p_business_id) THEN RAISE EXCEPTION 'ACCESS_DENIED'; END IF;
  SELECT count(*)::integer INTO v_count
  FROM public.business_members
  WHERE business_id=p_business_id AND active=true;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.business_member_count(uuid) FROM PUBLIC,anonymous;
GRANT EXECUTE ON FUNCTION public.business_member_count(uuid) TO authenticated;

DROP POLICY IF EXISTS members_select ON public.business_members;
CREATE POLICY members_select ON public.business_members
  FOR SELECT TO authenticated
  USING (public.can_operate_business(business_id));

COMMIT;
