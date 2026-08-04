export const CLIENT_STATUSES = [
  "novo",
  "contato",
  "proposta",
  "negociacao",
  "fechado",
  "perdido",
] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export type Client = {
  id: string;
  name: string;
  company: string;
  segment: string;
  phone: string;
  email: string;
  status: ClientStatus;
  estimatedValue: number;
  nextAction: string;
  nextActionDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ClientInput = {
  name: string;
  company: string;
  segment: string;
  phone: string;
  email: string;
  status: ClientStatus;
  estimatedValue: number;
  nextAction: string;
  nextActionDate: string | null;
  notes: string;
};

type ClientRow = {
  id: string | number | bigint;
  name: string;
  company: string;
  segment: string;
  phone: string;
  email: string;
  status: ClientStatus;
  estimated_value: number;
  next_action: string;
  next_action_date: string | Date | null;
  notes: string;
  created_at: string | Date;
  updated_at: string | Date;
};

function dateOnly(value: string | Date | null): string | null {
  if (!value) return null;
  return new Date(value).toISOString().slice(0, 10);
}

function iso(value: string | Date): string {
  return new Date(value).toISOString();
}

export function mapClient(row: ClientRow): Client {
  return {
    id: String(row.id),
    name: row.name,
    company: row.company,
    segment: row.segment,
    phone: row.phone,
    email: row.email,
    status: row.status,
    estimatedValue: Number(row.estimated_value),
    nextAction: row.next_action,
    nextActionDate: dateOnly(row.next_action_date),
    notes: row.notes,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function parseClientInput(value: unknown): ClientInput {
  if (!value || typeof value !== "object") {
    throw new Error("Dados do cliente inválidos.");
  }

  const source = value as Record<string, unknown>;
  const status = String(source.status || "novo") as ClientStatus;
  const estimatedValue = Number(source.estimatedValue || 0);
  const name = String(source.name || "").trim();

  if (!name) throw new Error("Informe o nome do cliente.");
  if (!CLIENT_STATUSES.includes(status)) throw new Error("Status inválido.");
  if (!Number.isFinite(estimatedValue) || estimatedValue < 0) {
    throw new Error("O valor estimado deve ser igual ou maior que zero.");
  }

  const nextActionDate = String(source.nextActionDate || "").trim();

  return {
    name,
    company: String(source.company || "").trim(),
    segment: String(source.segment || "").trim(),
    phone: String(source.phone || "").trim(),
    email: String(source.email || "").trim(),
    status,
    estimatedValue: Math.round(estimatedValue),
    nextAction: String(source.nextAction || "").trim(),
    nextActionDate: nextActionDate || null,
    notes: String(source.notes || "").trim(),
  };
}
