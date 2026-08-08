-- Hardening de ACL das RPCs administrativas da lixeira.
REVOKE ALL ON FUNCTION public.crm_soft_delete(text,bigint,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_soft_delete(text,bigint,text) FROM anonymous;
GRANT EXECUTE ON FUNCTION public.crm_soft_delete(text,bigint,text) TO authenticated;

REVOKE ALL ON FUNCTION public.crm_list_trash() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_list_trash() FROM anonymous;
GRANT EXECUTE ON FUNCTION public.crm_list_trash() TO authenticated;

REVOKE ALL ON FUNCTION public.crm_restore_trash_batch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_restore_trash_batch(uuid) FROM anonymous;
GRANT EXECUTE ON FUNCTION public.crm_restore_trash_batch(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.crm_purge_trash_batch(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_purge_trash_batch(uuid) FROM anonymous;
GRANT EXECUTE ON FUNCTION public.crm_purge_trash_batch(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.crm_purge_expired_trash() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.crm_purge_expired_trash() FROM anonymous;
GRANT EXECUTE ON FUNCTION public.crm_purge_expired_trash() TO authenticated;
