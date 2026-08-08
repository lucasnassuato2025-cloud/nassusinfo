-- Proteção comercial aplicada no Neon main e development.
-- Usuários autenticados podem editar somente dados cadastrais da empresa.
-- Plano, status, limites e trial ficam reservados ao backend administrativo/cobrança.

revoke update on table public.businesses from authenticated;
grant update (name,document,phone,email,business_type) on table public.businesses to authenticated;
