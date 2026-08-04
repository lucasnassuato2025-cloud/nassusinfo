export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `[nassus-crm] Variável obrigatória ausente: ${name}. ` +
        "Configure-a na Vercel antes de gerar o deployment.",
    );
  }

  return value;
}

export function validateCookieSecret(secret: string): string {
  if (secret.length < 32) {
    throw new Error(
      "[nassus-crm] NEON_AUTH_COOKIE_SECRET deve possuir pelo menos 32 caracteres.",
    );
  }

  return secret;
}
