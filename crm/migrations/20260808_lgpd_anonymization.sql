-- Anonimização automática LGPD — permitida apenas quando não há documento comercial vinculado.
CREATE OR REPLACE FUNCTION public.crm_anonymize_data_subject(p_client_id bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth','pg_temp' AS $function$
DECLARE v_owner text:=public.crm_workspace_owner_id()::text; v_docs bigint;
BEGIN
  IF NOT public.crm_can('admin.manage') THEN RAISE EXCEPTION 'Sem permissão para anonimizar dados.'; END IF;
  SELECT count(*) INTO v_docs FROM public.commercial_documents WHERE client_id=p_client_id AND owner_id=v_owner;
  IF v_docs>0 THEN
    RAISE EXCEPTION 'Anonimização automática bloqueada: o titular possui documentos comerciais que devem ser avaliados antes da remoção de dados.';
  END IF;
  UPDATE public.clients SET
    name='Titular anonimizado #'||id,company='',phone='',email='',next_action='',next_action_date=NULL,notes='',document='',legal_name='',trade_name='',state_registration='',whatsapp='',instagram='',website='',address='',address_number='',complement='',neighborhood='',city='',state='',zip_code='',source='anonimizado',tags='',status='inativo',updated_at=now(),deleted_reason='Dados pessoais anonimizados por solicitação LGPD'
  WHERE id=p_client_id AND owner_id=v_owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Titular não encontrado.'; END IF;
  PERFORM public.crm_record_audit_event('lgpd_subject_anonymized','client',p_client_id::text,'critical','success','Dados pessoais do titular foram anonimizados','{}'::jsonb);
  RETURN true;
END $function$;
REVOKE ALL ON FUNCTION public.crm_anonymize_data_subject(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.crm_anonymize_data_subject(bigint) TO authenticated;
