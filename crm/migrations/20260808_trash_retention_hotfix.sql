-- Hotfix da lixeira: retenção obrigatória + expurgo controlado de evidências não assinadas.
-- Mantém DELETE/UPDATE direto de versões, assinaturas e eventos bloqueado.

CREATE OR REPLACE FUNCTION public.crm_trash_retention_due_internal(
  p_owner text,
  p_record_type text,
  p_deleted_at timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
  SELECT p_deleted_at IS NOT NULL
    AND p_deleted_at + make_interval(days => COALESCE(
      (
        SELECT rp.retention_days
        FROM public.crm_retention_policies rp
        WHERE rp.workspace_owner_id=p_owner::uuid
          AND rp.record_type=p_record_type
        LIMIT 1
      ),
      (
        SELECT s.trash_retention_days
        FROM public.crm_settings s
        WHERE s.workspace_owner_id=p_owner::uuid
        LIMIT 1
      ),
      30
    )) <= now()
$function$;

REVOKE ALL ON FUNCTION public.crm_trash_retention_due_internal(text,text,timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_trash_retention_due_internal(text,text,timestamptz) FROM anonymous;
REVOKE ALL ON FUNCTION public.crm_trash_retention_due_internal(text,text,timestamptz) FROM authenticated;

CREATE OR REPLACE FUNCTION public.crm_purge_trash_batch_internal(p_batch uuid, p_owner text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_count integer := 0;
  v_rows integer := 0;
BEGIN
  PERFORM set_config('nassus.crm_authorized_purge', 'on', true);

  DELETE FROM public.access_credentials t
  WHERE t.owner_id=p_owner AND t.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'access_credentials',t.deleted_at);
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.renewal_costs t
  WHERE t.owner_id=p_owner AND t.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'renewal_costs',t.deleted_at);
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.tasks t
  WHERE t.owner_id=p_owner AND t.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'tasks',t.deleted_at);
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.site_audits t
  WHERE t.owner_id=p_owner AND t.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'site_audits',t.deleted_at);
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.site_infrastructure t
  WHERE t.owner_id=p_owner AND t.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'site_infrastructure',t.deleted_at);
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.commercial_documents d
  WHERE d.owner_id=p_owner AND d.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'commercial_documents',d.deleted_at)
    AND d.signature_status<>'signed'
    AND d.signed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.document_signatures s WHERE s.document_id=d.id
    );
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.payments p
  WHERE p.owner_id=p_owner AND p.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'payments',p.deleted_at)
    AND NOT EXISTS (
      SELECT 1 FROM public.commercial_documents d WHERE d.payment_id=p.id
    );
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.projects p
  WHERE p.owner_id=p_owner AND p.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'projects',p.deleted_at)
    AND NOT EXISTS (SELECT 1 FROM public.payments x WHERE x.project_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.commercial_documents x WHERE x.project_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.tasks x WHERE x.project_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.access_credentials x WHERE x.project_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.renewal_costs x WHERE x.project_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.site_audits x WHERE x.project_id=p.id)
    AND NOT EXISTS (SELECT 1 FROM public.site_infrastructure x WHERE x.project_id=p.id);
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  DELETE FROM public.clients c
  WHERE c.owner_id=p_owner AND c.deleted_batch=p_batch
    AND public.crm_trash_retention_due_internal(p_owner,'clients',c.deleted_at)
    AND NOT EXISTS (SELECT 1 FROM public.projects x WHERE x.client_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.payments x WHERE x.client_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.commercial_documents x WHERE x.client_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.tasks x WHERE x.client_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.site_infrastructure x WHERE x.client_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.access_credentials x WHERE x.client_id=c.id)
    AND NOT EXISTS (SELECT 1 FROM public.renewal_costs x WHERE x.client_id=c.id);
  GET DIAGNOSTICS v_rows=ROW_COUNT; v_count:=v_count+v_rows;

  PERFORM set_config('nassus.crm_authorized_purge', 'off', true);
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('nassus.crm_authorized_purge', 'off', true);
  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_purge_trash_batch_internal(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_purge_trash_batch_internal(uuid,text) FROM anonymous;
REVOKE ALL ON FUNCTION public.crm_purge_trash_batch_internal(uuid,text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.crm_purge_trash_batch(p_batch uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_owner text := public.crm_workspace_owner_id()::text;
BEGIN
  IF NOT public.crm_can('admin.manage') THEN
    RAISE EXCEPTION 'Você não possui permissão para apagar definitivamente.';
  END IF;

  RETURN public.crm_purge_trash_batch_internal(p_batch, v_owner);
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_purge_trash_batch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_purge_trash_batch(uuid) FROM anonymous;
GRANT EXECUTE ON FUNCTION public.crm_purge_trash_batch(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.crm_immutable_record_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_purge_owner name;
BEGIN
  SELECT pg_get_userbyid(p.proowner)::name
    INTO v_purge_owner
  FROM pg_proc p
  WHERE p.oid='public.crm_purge_trash_batch_internal(uuid,text)'::regprocedure;

  IF TG_OP='DELETE'
     AND current_user=v_purge_owner
     AND current_setting('nassus.crm_authorized_purge', true)='on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Registro de auditoria imutável.';
END;
$function$;
