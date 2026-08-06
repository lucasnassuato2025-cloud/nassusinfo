import { neonClient } from "@/lib/neon";

type AuthResult = {
  error?: { message?: string } | null;
};

type PasswordAuthClient = {
  requestPasswordReset?: (input: { email: string; redirectTo: string }) => Promise<AuthResult>;
  resetPassword?: (input: { token: string; newPassword: string }) => Promise<AuthResult>;
};

function authClient(): PasswordAuthClient {
  return neonClient.auth as unknown as PasswordAuthClient;
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  const auth = authClient();
  if (!auth.requestPasswordReset) {
    throw new Error("A recuperação de senha ainda não está disponível neste ambiente.");
  }

  const result = await auth.requestPasswordReset({
    email: email.trim().toLocaleLowerCase("pt-BR"),
    redirectTo,
  });

  if (result.error) {
    throw new Error(result.error.message || "Não foi possível enviar o link de redefinição.");
  }
}

export async function resetPassword(token: string, newPassword: string) {
  const auth = authClient();
  if (!auth.resetPassword) {
    throw new Error("A redefinição de senha ainda não está disponível neste ambiente.");
  }

  const result = await auth.resetPassword({ token, newPassword });
  if (result.error) {
    throw new Error(result.error.message || "Não foi possível redefinir a senha.");
  }
}
