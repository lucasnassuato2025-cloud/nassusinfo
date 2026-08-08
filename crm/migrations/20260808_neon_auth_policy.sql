-- Neon Auth hardening — 2026-08-08
-- Cadastro público já permanece desabilitado. E-mail verificado não é exigido até a conta administrativa ser verificada.
UPDATE neon_auth.project_config
SET email_and_password = jsonb_set(
  jsonb_set(coalesce(email_and_password,'{}'::jsonb),'{minPasswordLength}','12'::jsonb,true),
  '{maxPasswordLength}','128'::jsonb,true
),
updated_at = now();
