import { Client } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";

export type TaskPriority = "baixa" | "media" | "alta" | "urgente";
export type TaskStatus = "pendente" | "concluida" | "cancelada";
export type InstallmentStatus = "pendente" | "pago" | "atrasado" | "cancelado";

export type CRMTask = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientActivity = {
  id: string;
  clientId: string;
  projectId: string | null;
  activityType: string;
  title: string;
  description: string;
  activityAt: string;
};

export type PaymentInstallment = {
  id: string;
  paymentId: string;
  clientId: string;
  installmentNumber: number;
  amount: number;
  paidAmount: number;
  dueDate: string | null;
  paidAt: string | null;
  status: InstallmentStatus;
  createdAt: string;
  updatedAt: string;
};

export type ActivityInput = {
  clientId: string;
  projectId?: string | null;
  type: string;
  title: string;
  description?: string;
};

export const TASK_COLUMNS = "id, client_id, project_id, title, description, priority, status, due_date, completed_at, created_at, updated_at";
export const ACTIVITY_COLUMNS = "id, client_id, project_id, activity_type, title, description, activity_at, created_at";
export const INSTALLMENT_COLUMNS = "id, payment_id, client_id, installment_number, amount, paid_amount, due_date, paid_at, status, created_at, updated_at";

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

export const METHOD_LABELS: Record<string, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento",
  aguardando_material: "Aguardando material",
  desenvolvimento: "Desenvolvimento",
  revisao: "Revisão",
  ajustes: "Ajustes",
  publicado: "Publicado",
  finalizado: "Finalizado",
  manutencao: "Manutenção",
};

export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});

export const compactCurrency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function dateOnly(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString().slice(0, 10);
}

export function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

export function dateLabel(value: string | null): string {
  if (!value) return "Sem data";
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

export function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as unknown as Record<string, unknown>[]) : [];
}

export function mapTask(row: Record<string, unknown>): CRMTask {
  return {
    id: text(row.id),
    clientId: row.client_id == null ? null : text(row.client_id),
    projectId: row.project_id == null ? null : text(row.project_id),
    title: text(row.title),
    description: text(row.description),
    priority: text(row.priority || "media") as TaskPriority,
    status: text(row.status || "pendente") as TaskStatus,
    dueDate: dateOnly(row.due_date),
    completedAt: row.completed_at ? iso(row.completed_at) : null,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapActivity(row: Record<string, unknown>): ClientActivity {
  return {
    id: text(row.id),
    clientId: text(row.client_id),
    projectId: row.project_id == null ? null : text(row.project_id),
    activityType: text(row.activity_type || "nota"),
    title: text(row.title),
    description: text(row.description),
    activityAt: iso(row.activity_at || row.created_at),
  };
}

export function mapInstallment(row: Record<string, unknown>): PaymentInstallment {
  return {
    id: text(row.id),
    paymentId: text(row.payment_id),
    clientId: text(row.client_id),
    installmentNumber: Number(row.installment_number || 1),
    amount: Number(row.amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    dueDate: dateOnly(row.due_date),
    paidAt: dateOnly(row.paid_at),
    status: text(row.status || "pendente") as InstallmentStatus,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "message" in value) {
    const message = String((value as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

export function clientLabel(client?: Client): string {
  if (!client) return "Sem cliente";
  return client.tradeName || client.company || client.name;
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  if (!input.clientId) return;
  try {
    await (neonClient.from("client_activities") as any).insert({
      client_id: Number(input.clientId),
      project_id: input.projectId ? Number(input.projectId) : null,
      activity_type: input.type,
      title: input.title,
      description: input.description || "",
      activity_at: new Date().toISOString(),
    });
  } catch {
    // O histórico não deve impedir a ação principal do CRM.
  }
}
