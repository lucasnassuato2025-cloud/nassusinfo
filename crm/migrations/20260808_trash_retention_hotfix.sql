-- Hotfix da lixeira: nenhum lote pode ser expurgado antes do maior prazo
-- configurado nem quando contém evidência contratual protegida.
-- A função destrutiva anterior fica privada e só é chamada pela nova camada segura.

ALTER FUNCTION public.crm_purge_trash_batch(uuid)
  RENAME TO crm_purge_trash_batch_legacy;

REVOKE ALL ON FUNCTION public.crm_purge_trash_batch_legacy(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_purge_trash_batch_legacy(uuid) FROM anonymous;
REVOKE ALL ON FUNCTION public.crm_purge_trash_batch_legacy(uuid) FROM authenticated;

CREATE OR REPLACE FUNCTION public.crm_purge_trash_batch(p_batch uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF NOT public.crm_can('admin.manage') THEN
    RAISE EXCEPTION 'Você não possui permissão para apagar definitivamente.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.crm_list_trash_v2() t
    WHERE t.batch_id=p_batch
  ) THEN
    RETURN 0;
  END IF;

  -- Um lote que contém evidência assinada permanece preservado por inteiro.
  IF EXISTS (
    SELECT 1 FROM public.crm_list_trash_v2() t
    WHERE t.batch_id=p_batch
      AND t.protected_evidence
  ) THEN
    RETURN 0;
  END IF;

  -- O expurgo só é liberado quando todos os itens do lote atingiram retenção.
  IF EXISTS (
    SELECT 1 FROM public.crm_list_trash_v2() t
    WHERE t.batch_id=p_batch
      AND t.purge_at > now()
  ) THEN
    RETURN 0;
  END IF;

  PERFORM set_config('nassus.crm_authorized_purge','on',true);
  v_count := public.crm_purge_trash_batch_legacy(p_batch);
  PERFORM set_config('nassus.crm_authorized_purge','off',true);
  RETURN v_count;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('nassus.crm_authorized_purge','off',true);
  RAISE;
END;
$function$;

REVOKE ALL ON FUNCTION public.crm_purge_trash_batch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_purge_trash_batch(uuid) FROM anonymous;
GRANT EXECUTE ON FUNCTION public.crm_purge_trash_batch(uuid) TO authenticated;

-- Versões, assinaturas e eventos continuam imutáveis em uso normal.
-- Apenas o expurgo interno, já autorizado e após retenção, pode deixar a
-- cascata remover esses registros de um documento não assinado.
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
  WHERE p.oid='public.crm_purge_trash_batch_legacy(uuid)'::regprocedure;

  IF TG_OP='DELETE'
     AND current_user=v_purge_owner
     AND current_setting('nassus.crm_authorized_purge',true)='on' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Registro de auditoria imutável.';
END;
$function$;
