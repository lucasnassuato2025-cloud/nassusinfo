type AuthMode = "signup" | "signin" | "password-reset";

function rawMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason) return String((reason as { message?: unknown }).message || "");
  return String(reason || "");
}

export function friendlyAuthError(reason: unknown, mode: AuthMode): string {
  const raw = rawMessage(reason);
  const text = raw.toLocaleLowerCase("pt-BR");

  if (/invalid origin|origin.*invalid|trusted origin/.test(text)) {
    return "O endereço deste aplicativo ainda não foi autorizado no serviço de autenticação. Atualize a página e tente novamente; se persistir, fale com o suporte.";
  }
  if (/network|fetch|failed to fetch|timeout|connection/.test(text)) {
    return "Não foi possível conectar ao serviço de autenticação. Verifique sua internet e tente novamente.";
  }
  if (/too many|rate.?limit|429/.test(text)) {
    return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  }
  if (mode === "signup" && /already|exists|duplicate|registered|user.*exist|email.*taken/.test(text)) {
    return "Já existe uma conta com este e-mail. Use Entrar ou Esqueci minha senha.";
  }
  if (mode === "signin" && /invalid|password|credential|not found|unauthorized|401/.test(text)) {
    return "E-mail ou senha inválidos.";
  }
  if (/password/.test(text) && /short|weak|min|length|character/.test(text)) {
    return "A senha não atende aos requisitos de segurança.";
  }
  if (mode === "password-reset" && /token|expired|invalid/.test(text)) {
    return "Este link de redefinição é inválido ou expirou. Solicite um novo link.";
  }
  return raw || "Não foi possível concluir a operação. Tente novamente.";
}
