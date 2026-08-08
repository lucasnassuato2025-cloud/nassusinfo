export type CrmErrorCode =
  | "auth"
  | "permission"
  | "network"
  | "conflict"
  | "dependency"
  | "validation"
  | "not_found"
  | "unknown";

export type NormalizedCrmError = {
  code: CrmErrorCode;
  title: string;
  message: string;
  retryable: boolean;
  technical: string;
};

function rawMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message;
  if (reason && typeof reason === "object" && "message" in reason) return String((reason as { message?: unknown }).message || "");
  return typeof reason === "string" ? reason : "";
}

export function normalizeCrmError(reason: unknown, fallback = "Não foi possível concluir a operação."): NormalizedCrmError {
  const technical = rawMessage(reason).trim().slice(0, 500);
  const value = technical.toLocaleLowerCase("pt-BR");

  if (/sess[aã]o|jwt|token expir|unauth|not authenticated/.test(value)) return { code: "auth", title: "Sessão precisa ser renovada", message: "Sua sessão não está mais válida. Entre novamente no CRM.", retryable: false, technical };
  if (/permission|permissão|row-level security|rls|forbidden/.test(value)) return { code: "permission", title: "Ação não autorizada", message: "Seu perfil não possui permissão para concluir esta ação.", retryable: false, technical };
  if (/network|fetch|timeout|failed to fetch|connection/.test(value)) return { code: "network", title: "Falha de conexão", message: "Não foi possível conectar ao serviço. Confira a internet e tente novamente.", retryable: true, technical };
  if (/duplicate|unique|already exists|já existe/.test(value)) return { code: "conflict", title: "Registro duplicado", message: "Já existe um registro com esses dados.", retryable: false, technical };
  if (/foreign key|constraint|vinculad/.test(value)) return { code: "dependency", title: "Registro possui vínculos", message: "Esta ação foi bloqueada para proteger informações relacionadas.", retryable: false, technical };
  if (/invalid|inválid|required|obrigat|formato/.test(value)) return { code: "validation", title: "Dados inválidos", message: technical || "Confira os campos informados.", retryable: false, technical };
  if (/not found|não encontrad/.test(value)) return { code: "not_found", title: "Registro não encontrado", message: "O registro pode ter sido alterado, removido ou não estar mais disponível.", retryable: true, technical };
  return { code: "unknown", title: "Ação não concluída", message: technical || fallback, retryable: true, technical };
}

export function publicSafeError(reason: unknown, fallback = "Não foi possível concluir a solicitação."): string {
  return normalizeCrmError(reason, fallback).message;
}
