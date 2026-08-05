import type { Client, Payment, Project } from "@/lib/crm-pro";

export type DocumentType = "proposta" | "contrato" | "recibo";
export type DocumentStatus = "rascunho" | "enviado" | "visualizado" | "aceito" | "assinado" | "concluido" | "cancelado" | "vencido";

export type BusinessProfile = {
  id: string;
  profileType: "pf" | "pj";
  displayName: string;
  legalName: string;
  tradeName: string;
  documentType: "cpf" | "cnpj" | "rg";
  documentNumber: string;
  rgNumber: string;
  stateRegistration: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  pixKey: string;
  isDefault: boolean;
  isActive: boolean;
};

export type CatalogService = {
  id: string;
  name: string;
  category: string;
  description: string;
  scopeTemplate: string;
  basePrice: number;
  defaultDays: number;
  active: boolean;
};

export type ClauseTemplate = {
  id: string;
  code: string;
  title: string;
  body: string;
  category: string;
  required: boolean;
  active: boolean;
  sortOrder: number;
};

export type ServiceItem = {
  serviceId: string | null;
  name: string;
  description: string;
  quantity: number;
  amount: number;
};

export type ClauseItem = {
  clauseId: string | null;
  code: string;
  title: string;
  body: string;
};

export type CommercialDocument = {
  id: string;
  clientId: string;
  projectId: string | null;
  issuerProfileId: string | null;
  paymentId: string | null;
  documentType: DocumentType;
  number: string;
  title: string;
  status: DocumentStatus;
  issueDate: string;
  validUntil: string | null;
  amount: number;
  paymentTerms: string;
  scope: string;
  terms: string;
  notes: string;
  serviceItems: ServiceItem[];
  clauses: ClauseItem[];
  clientSnapshot: Record<string, unknown>;
  issuerSnapshot: Record<string, unknown>;
  receiptType: string;
  amountInWords: string;
  signatureStatus: "not_required" | "pending" | "signed" | "expired" | "revoked";
  currentVersion: number;
  sentAt: string | null;
  viewedAt: string | null;
  signedAt: string | null;
  documentHash: string;
  signedHash: string;
  createdAt: string;
  updatedAt: string;
};

export type SigningLink = {
  id: string;
  documentId: string;
  documentVersionId: string;
  status: "active" | "opened" | "signed" | "expired" | "revoked";
  expiresAt: string;
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
};

export type DocumentSignature = {
  id: string;
  documentId: string;
  signerName: string;
  signerDocumentMasked: string;
  signerEmail: string;
  signerPhone: string;
  signatureMethod: "typed" | "drawn";
  signatureData: string;
  documentHash: string;
  evidence: Record<string, unknown>;
  signedAt: string;
};

export type ContractSnapshot = {
  schema: "nassus-contract-v1";
  document: {
    id: string;
    number: string;
    type: DocumentType;
    title: string;
    issueDate: string;
    validUntil: string | null;
    amount: number;
    amountInWords: string;
    paymentTerms: string;
    scope: string;
    terms: string;
    notes: string;
    version: number;
  };
  issuer: Record<string, unknown>;
  client: Record<string, unknown>;
  project: Record<string, unknown> | null;
  payment: Record<string, unknown> | null;
  services: ServiceItem[];
  clauses: ClauseItem[];
};

export const TYPE_LABELS: Record<DocumentType, string> = {
  proposta: "Proposta comercial",
  contrato: "Contrato de prestação de serviços",
  recibo: "Recibo de pagamento",
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  visualizado: "Visualizado",
  aceito: "Aceito",
  assinado: "Assinado",
  concluido: "Concluído",
  cancelado: "Cancelado",
  vencido: "Vencido",
};

export function text(value: unknown): string {
  return value == null ? "" : String(value);
}

export function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value as Record<string, unknown>[] : [];
}

export function dateOnly(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString().slice(0, 10);
}

export function iso(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

export function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskDocument(value: string): string {
  const clean = normalizeDocument(value);
  return clean.length <= 4 ? "*".repeat(clean.length) : `${"*".repeat(clean.length - 4)}${clean.slice(-4)}`;
}

export function defaultNumber(type: DocumentType): string {
  const prefix = type === "contrato" ? "CTR" : type === "recibo" ? "REC" : "PROP";
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "