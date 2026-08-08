-- Nassus CRM hardening — 2026-08-08
-- Validado primeiro em branch temporária Neon antes da aplicação em produção.

UPDATE neon_auth.project_config
SET email_and_password = jsonb_set(
      coalesce(email_and_password, '{}'::jsonb),
      '{disableSignUp}',
      'true'::jsonb,
      true
    ),
    updated_at = now();

CREATE OR REPLACE FUNCTION public.crm_immutable_record_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RAISE EXCEPTION 'Registro de auditoria imutável.';
END;
$$;

DROP TRIGGER IF EXISTS trg_document_versions_immutable ON public.document_versions;
CREATE TRIGGER trg_document_versions_immutable
BEFORE UPDATE OR DELETE ON public.document_versions
FOR EACH ROW EXECUTE FUNCTION public.crm_immutable_record_guard();

DROP TRIGGER IF EXISTS trg_document_signatures_immutable ON public.document_signatures;
CREATE TRIGGER trg_document_signatures_immutable
BEFORE UPDATE OR DELETE ON public.document_signatures
FOR EACH ROW EXECUTE FUNCTION public.crm_immutable_record_guard();

DROP TRIGGER IF EXISTS trg_document_events_immutable ON public.document_events;
CREATE TRIGGER trg_document_events_immutable
BEFORE UPDATE OR DELETE ON public.document_events
FOR EACH ROW EXECUTE FUNCTION public.crm_immutable_record_guard();

CREATE OR REPLACE FUNCTION public.crm_guard_signed_document_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_frozen boolean;
  v_has_signature boolean;
BEGIN
  v_has_signature := EXISTS (
    SELECT 1 FROM public.document_signatures s WHERE s.document_id = OLD.id
  );

  IF TG_OP = 'DELETE' THEN
    IF OLD.signature_status = 'signed' OR OLD.signed_at IS NOT NULL OR v_has_signature THEN
      RAISE EXCEPTION 'Documento assinado deve ser preservado como evidência.';
    END IF;
    RETURN OLD;
  END IF;

  v_frozen := OLD.signature_status = 'signed' OR OLD.signed_at IS NOT NULL;

  IF v_frozen THEN
    IF NEW.client_id IS DISTINCT FROM OLD.client_id
      OR NEW.project_id IS DISTINCT FROM OLD.project_id
      OR NEW.document_type IS DISTINCT FROM OLD.document_type
      OR NEW.number IS DISTINCT FROM OLD.number
      OR NEW.title IS DISTINCT FROM OLD.title
      OR NEW.status IS DISTINCT FROM OLD.status
      OR NEW.issue_date IS DISTINCT FROM OLD.issue_date
      OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
      OR NEW.amount IS DISTINCT FROM OLD.amount
      OR NEW.payment_terms IS DISTINCT FROM OLD.payment_terms
      OR NEW.scope IS DISTINCT FROM OLD.scope
      OR NEW.terms IS DISTINCT FROM OLD.terms
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.issuer_profile_id IS DISTINCT FROM OLD.issuer_profile_id
      OR NEW.payment_id IS DISTINCT FROM OLD.payment_id
      OR NEW.service_items IS DISTINCT FROM OLD.service_items
      OR NEW.clauses IS DISTINCT FROM OLD.clauses
      OR NEW.client_snapshot IS DISTINCT FROM OLD.client_snapshot
      OR NEW.issuer_snapshot IS DISTINCT FROM OLD.issuer_snapshot
      OR NEW.receipt_type IS DISTINCT FROM OLD.receipt_type
      OR NEW.amount_in_words IS DISTINCT FROM OLD.amount_in_words
      OR NEW.signature_status IS DISTINCT FROM OLD.signature_status
      OR NEW.current_version IS DISTINCT FROM OLD.current_version
      OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
      OR NEW.viewed_at IS DISTINCT FROM OLD.viewed_at
      OR NEW.signed_at IS DISTINCT FROM OLD.signed_at
      OR NEW.completed_at IS DISTINCT FROM OLD.completed_at
      OR NEW.document_hash IS DISTINCT FROM OLD.document_hash
      OR NEW.signed_hash IS DISTINCT FROM OLD.signed_hash
    THEN
      RAISE EXCEPTION 'Documento assinado é imutável; somente metadados de lixeira podem ser alterados.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_commercial_documents_signed_guard ON public.commercial_documents;
CREATE TRIGGER trg_commercial_documents_signed_guard
BEFORE UPDATE OR DELETE ON public.commercial_documents
FOR EACH ROW EXECUTE FUNCTION public.crm_guard_signed_document_changes();

DROP POLICY IF EXISTS commercial_documents_workspace_update ON public.commercial_documents;
CREATE POLICY commercial_documents_workspace_update
ON public.commercial_documents
FOR UPDATE TO public
USING (
  owner_id = public.crm_workspace_owner_id()::text
  AND public.crm_can('documents.write')
  AND deleted_at IS NULL
  AND signature_status <> 'signed'
  AND signed_at IS NULL
)
WITH CHECK (
  owner_id = public.crm_workspace_owner_id()::text
  AND public.crm_can('documents.write')
  AND signature_status <> 'signed'
  AND signed_at IS NULL
);

DROP POLICY IF EXISTS document_versions_workspace_update ON public.document_versions;
DROP POLICY IF EXISTS document_signatures_workspace_update ON public.document_signatures;
DROP POLICY IF EXISTS document_events_workspace_update ON public.document_events;

REVOKE ALL ON FUNCTION public.public_open_signing_document(text, text, text)
FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.public_open_signing_document(text, text, text)
TO neondb_owner;

REVOKE ALL ON FUNCTION public.public_submit_document_signature(
  text, text, text, text, text, text, text, text, boolean, text
)
FROM PUBLIC, anonymous, authenticated;
GRANT EXECUTE ON FUNCTION public.public_submit_document_signature(
  text, text, text, text, text, text, text, text, boolean, text
)
TO neondb_owner;

CREATE INDEX IF NOT EXISTS document_events_signing_attempt_idx
ON public.document_events (signing_link_id, created_at DESC)
WHERE event_type = 'acesso_negado';

ALTER TABLE public.document_signing_links
ADD CONSTRAINT document_signing_links_token_hash_format
CHECK (token_hash ~ '^[0-9A-Fa-f]{64}$') NOT VALID;
ALTER TABLE public.document_signing_links
VALIDATE CONSTRAINT document_signing_links_token_hash_format;

ALTER TABLE public.document_signing_links
ADD CONSTRAINT document_signing_links_code_hash_format
CHECK (access_code_hash ~ '^[0-9A-Fa-f]{64}$') NOT VALID;
ALTER TABLE public.document_signing_links
VALIDATE CONSTRAINT document_signing_links_code_hash_format;

ALTER TABLE public.document_signing_links
ADD CONSTRAINT document_signing_links_expected_document_hash_format
CHECK (expected_document_hash = '' OR expected_document_hash ~ '^[0-9A-Fa-f]{64}$') NOT VALID;
ALTER TABLE public.document_signing_links
VALIDATE CONSTRAINT document_signing_links_expected_document_hash_format;

ALTER TABLE public.document_versions
ADD CONSTRAINT document_versions_hash_format
CHECK (document_hash ~ '^[0-9A-Fa-f]{64}$') NOT VALID;
ALTER TABLE public.document_versions
VALIDATE CONSTRAINT document_versions_hash_format;

ALTER TABLE public.document_signatures
ADD CONSTRAINT document_signatures_document_hash_format
CHECK (document_hash ~ '^[0-9A-Fa-f]{64}$') NOT VALID;
ALTER TABLE public.document_signatures
VALIDATE CONSTRAINT document_signatures_document_hash_format;

ALTER TABLE public.document_signatures
ADD CONSTRAINT document_signatures_signer_hash_format
CHECK (signer_document_hash ~ '^[0-9A-Fa-f]{64}$') NOT VALID;
ALTER TABLE public.document_signatures
VALIDATE CONSTRAINT document_signatures_signer_hash_format;

CREATE OR REPLACE FUNCTION public.crm_purge_trash_batch(p_batch uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_owner text := public.crm_workspace_owner_id()::text;
  v_count integer := 0;
  v_rows integer;
BEGIN
  IF NOT public.crm_can('admin.manage') THEN
    RAISE EXCEPTION 'Você não possui permissão para apagar definitivamente.';
  END IF;

  DELETE FROM public.access_credentials WHERE owner_id = v_owner AND deleted_batch = p_batch;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.renewal_costs WHERE owner_id = v_owner AND deleted_batch = p_batch;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.tasks WHERE owner_id = v_owner AND deleted_batch = p_batch;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.site_audits WHERE owner_id = v_owner AND deleted_batch = p_batch;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.site_infrastructure WHERE owner_id = v_owner AND deleted_batch = p_batch;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.commercial_documents d
  WHERE d.owner_id = v_owner
    AND d.deleted_batch = p_batch
    AND d.signature_status <> 'signed'
    AND d.signed_at IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.document_signatures s WHERE s.document_id = d.id
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.payments WHERE owner_id = v_owner AND deleted_batch = p_batch;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.projects WHERE owner_id = v_owner AND deleted_batch = p_batch;
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  DELETE FROM public.clients c
  WHERE c.owner_id = v_owner
    AND c.deleted_batch = p_batch
    AND NOT EXISTS (
      SELECT 1 FROM public.commercial_documents d WHERE d.client_id = c.id
    );
  GET DIAGNOSTICS v_rows = ROW_COUNT; v_count := v_count + v_rows;

  RETURN v_count;
END;
$$;
