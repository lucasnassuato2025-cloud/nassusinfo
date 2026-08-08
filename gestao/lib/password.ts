export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_HINT = "Use 10 ou mais caracteres com letra maiúscula, minúscula, número e símbolo.";

export function passwordValidationError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return PASSWORD_HINT;
  if (!/[A-Z]/.test(password)) return PASSWORD_HINT;
  if (!/[a-z]/.test(password)) return PASSWORD_HINT;
  if (!/[0-9]/.test(password)) return PASSWORD_HINT;
  if (!/[^A-Za-z0-9]/.test(password)) return PASSWORD_HINT;
  return null;
}
