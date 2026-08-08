BEGIN;

-- This diagnostic helper enumerates database/schema/table/function names and must
-- never be callable from the Data API by application roles.
REVOKE EXECUTE ON FUNCTION public.show_db_tree() FROM PUBLIC,anonymous,authenticated;

COMMIT;
