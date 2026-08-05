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
  return value ? new Date(String(value)).toISOString().slice(0, 10) : null;
}

export function iso(value: unknown): string | null {
  return value ? new Date(String(value)).toISOString() : null;
}

export function normalizeDocument(value: string): string {
  return value.replace(/\D/g, "");
}

export function maskDocument(value: string): string {
  const clean = normalizeDocument(value);
  return clean.length <= 4 ? "*".repeat(clean.length) : `${"*".repeat(clean.length - 4)}${clean.slice(-4)}`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
}

export function defaultNumber(type: DocumentType): string {
  const prefix = type === "contrato" ? "CTR" : type === "recibo" ? "REC" : "PROP";
  return `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
}

export function mapBusinessProfile(row: Record<string, unknown>): BusinessProfile {
  return {
    id: text(row.id),
    profileType: text(row.profile_type || "pf") as "pf" | "pj",
    displayName: text(row.display_name),
    legalName: text(row.legal_name),
    tradeName: text(row.trade_name),
    documentType: text(row.document_type || "cpf") as "cpf" | "cnpj" | "rg",
    documentNumber: text(row.document_number),
    rgNumber: text(row.rg_number),
    stateRegistration: text(row.state_registration),
    email: text(row.email),
    phone: text(row.phone),
    whatsapp: text(row.whatsapp),
    address: text(row.address),
    addressNumber: text(row.address_number),
    complement: text(row.complement),
    neighborhood: text(row.neighborhood),
    city: text(row.city),
    state: text(row.state),
    zipCode: text(row.zip_code),
    pixKey: text(row.pix_key),
    isDefault: Boolean(row.is_default),
    isActive: Boolean(row.is_active),
  };
}

export function mapCatalogService(row: Record<string, unknown>): CatalogService {
  return {
    id: text(row.id),
    name: text(row.name),
    category: text(row.category),
    description: text(row.description),
    scopeTemplate: text(row.scope_template),
    basePrice: Number(row.base_price || 0),
    defaultDays: Number(row.default_days || 0),
    active: Boolean(row.active),
  };
}

export function mapClauseTemplate(row: Record<string, unknown>): ClauseTemplate {
  return {
    id: text(row.id),
    code: text(row.code),
    title: text(row.title),
    body: text(row.body),
    category: text(row.category),
    required: Boolean(row.required),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order || 0),
  };
}

export function mapCommercialDocument(row: Record<string, unknown>): CommercialDocument {
  return {
    id: text(row.id),
    clientId: text(row.client_id),
    projectId: row.project_id == null ? null : text(row.project_id),
    issuerProfileId: row.issuer_profile_id == null ? null : text(row.issuer_profile_id),
    paymentId: row.payment_id == null ? null : text(row.payment_id),
    documentType: text(row.document_type || "proposta") as DocumentType,
    number: text(row.number),
    title: text(row.title),
    status: text(row.status || "rascunho") as DocumentStatus,
    issueDate: dateOnly(row.issue_date) || new Date().toISOString().slice(0, 10),
    validUntil: dateOnly(row.valid_until),
    amount: Number(row.amount || 0),
    paymentTerms: text(row.payment_terms),
    scope: text(row.scope),
    terms: text(row.terms),
    notes: text(row.notes),
    serviceItems: Array.isArray(row.service_items) ? row.service_items as ServiceItem[] : [],
    clauses: Array.isArray(row.clauses) ? row.clauses as ClauseItem[] : [],
    clientSnapshot: row.client_snapshot && typeof row.client_snapshot === "object" ? row.client_snapshot as Record<string, unknown> : {},
    issuerSnapshot: row.issuer_snapshot && typeof row.issuer_snapshot === "object" ? row.issuer_snapshot as Record<string, unknown> : {},
    receiptType: text(row.receipt_type),
    amountInWords: text(row.amount_in_words),
    signatureStatus: text(row.signature_status || "not_required") as CommercialDocument["signatureStatus"],
    currentVersion: Number(row.current_version || 1),
    sentAt: iso(row.sent_at),
    viewedAt: iso(row.viewed_at),
    signedAt: iso(row.signed_at),
    documentHash: text(row.document_hash),
    signedHash: text(row.signed_hash),
    createdAt: iso(row.created_at) || new Date().toISOString(),
    updatedAt: iso(row.updated_at) || new Date().toISOString(),
  };
}

export function mapSigningLink(row: Record<string, unknown>): SigningLink {
  return {
    id: text(row.id),
    documentId: text(row.document_id),
    documentVersionId: text(row.document_version_id),
    status: text(row.status || "active") as SigningLink["status"],
    expiresAt: iso(row.expires_at) || new Date().toISOString(),
    accessCount: Number(row.access_count || 0),
    lastAccessedAt: iso(row.last_accessed_at),
    createdAt: iso(row.created_at) || new Date().toISOString(),
  };
}

export function mapDocumentSignature(row: Record<string, unknown>): DocumentSignature {
  return {
    id: text(row.id),
    documentId: text(row.document_id),
    signerName: text(row.signer_name),
    signerDocumentMasked: text(row.signer_document_masked),
    signerEmail: text(row.signer_email),
    signerPhone: text(row.signer_phone),
    signatureMethod: text(row.signature_method || "typed") as "typed" | "drawn",
    signatureData: text(row.signature_data),
    documentHash: text(row.document_hash),
    evidence: row.evidence && typeof row.evidence === "object" ? row.evidence as Record<string, unknown> : {},
    signedAt: iso(row.signed_at) || new Date().toISOString(),
  };
}

export function businessProfileSnapshot(profile: BusinessProfile): Record<string, unknown> {
  return {
    profileType: profile.profileType,
    displayName: profile.displayName,
    legalName: profile.legalName,
    tradeName: profile.tradeName,
    documentType: profile.documentType,
    documentNumber: profile.documentNumber,
    rgNumber: profile.rgNumber,
    stateRegistration: profile.stateRegistration,
    email: profile.email,
    phone: profile.phone,
    whatsapp: profile.whatsapp,
    address: profile.address,
    addressNumber: profile.addressNumber,
    complement: profile.complement,
    neighborhood: profile.neighborhood,
    city: profile.city,
    state: profile.state,
    zipCode: profile.zipCode,
    pixKey: profile.pixKey,
  };
}

export function clientSnapshot(client: Client, documentType: string, documentNumber: string): Record<string, unknown> {
  return {
    id: client.id,
    clientType: client.clientType,
    name: client.name,
    company: client.company,
    legalName: client.legalName,
    tradeName: client.tradeName,
    documentType,
    documentNumber,
    email: client.email,
    phone: client.phone,
    whatsapp: client.whatsapp,
    address: client.address,
    addressNumber: client.addressNumber,
    complement: client.complement,
    neighborhood: client.neighborhood,
    city: client.city,
    state: client.state,
    zipCode: client.zipCode,
  };
}

export function projectSnapshot(project: Project | null): Record<string, unknown> | null {
  if (!project) return null;
  return {
    id: project.id,
    name: project.name,
    serviceType: project.serviceType,
    totalValue: project.totalValue,
    startDate: project.startDate,
    dueDate: project.dueDate,
    websiteUrl: project.websiteUrl,
    domain: project.domain,
    hosting: project.hosting,
    maintenanceEnabled: project.maintenanceEnabled,
    maintenanceValue: project.maintenanceValue,
    description: project.description,
  };
}

export function paymentSnapshot(payment: Payment | null): Record<string, unknown> | null {
  if (!payment) return null;
  return {
    id: payment.id,
    description: payment.description,
    totalAmount: payment.totalAmount,
    paidAmount: payment.paidAmount,
    method: payment.method,
    installments: payment.installments,
    dueDate: payment.dueDate,
    paidAt: payment.paidAt,
    status: payment.status,
  };
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, sortValue(item)]));
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return btoa(String.fromCharCode(...value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function randomCode(): string {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return String(100000 + (value[0] % 900000));
}

export function buildContractSnapshot(args: {
  document: CommercialDocument;
  issuer: BusinessProfile;
  client: Client;
  project: Project | null;
  payment: Payment | null;
  clientDocumentType: string;
  clientDocumentNumber: string;
  services: ServiceItem[];
  clauses: ClauseItem[];
  amountInWords: string;
  version: number;
}): ContractSnapshot {
  return {
    schema: "nassus-contract-v1",
    document: {
      id: args.document.id,
      number: args.document.number,
      type: args.document.documentType,
      title: args.document.title,
      issueDate: args.document.issueDate,
      validUntil: args.document.validUntil,
      amount: args.document.amount,
      amountInWords: args.amountInWords,
      paymentTerms: args.document.paymentTerms,
      scope: args.document.scope,
      terms: args.document.terms,
      notes: args.document.notes,
      version: args.version,
    },
    issuer: businessProfileSnapshot(args.issuer),
    client: clientSnapshot(args.client, args.clientDocumentType, args.clientDocumentNumber),
    project: projectSnapshot(args.project),
    payment: paymentSnapshot(args.payment),
    services: args.services,
    clauses: args.clauses,
  };
}
