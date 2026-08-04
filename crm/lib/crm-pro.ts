export type LeadStatus =
  | "novo"
  | "contato"
  | "proposta"
  | "negociacao"
  | "fechado"
  | "perdido";

export type ClientLifecycle = "lead" | "cliente";
export type ClientType = "pessoa_fisica" | "empresa" | "autonomo";
export type ProjectStatus =
  | "planejamento"
  | "aguardando_material"
  | "desenvolvimento"
  | "revisao"
  | "ajustes"
  | "publicado"
  | "finalizado"
  | "manutencao";
export type PaymentStatus = "pendente" | "pago" | "atrasado" | "cancelado";
export type PaymentMethod = "pix" | "credito" | "debito" | "boleto" | "dinheiro" | "transferencia";

export const CLIENT_COLUMNS = [
  "id",
  "lifecycle",
  "client_type",
  "name",
  "company",
  "document",
  "legal_name",
  "trade_name",
  "state_registration",
  "segment",
  "phone",
  "whatsapp",
  "email",
  "instagram",
  "website",
  "address",
  "address_number",
  "complement",
  "neighborhood",
  "city",
  "state",
  "zip_code",
  "source",
  "tags",
  "status",
  "estimated_value",
  "next_action",
  "next_action_date",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

export const PROJECT_COLUMNS = [
  "id",
  "client_id",
  "name",
  "service_type",
  "status",
  "progress",
  "total_value",
  "start_date",
  "due_date",
  "delivery_date",
  "website_url",
  "domain",
  "hosting",
  "domain_renewal_date",
  "hosting_renewal_date",
  "maintenance_enabled",
  "maintenance_value",
  "description",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

export const PAYMENT_COLUMNS = [
  "id",
  "client_id",
  "project_id",
  "description",
  "total_amount",
  "paid_amount",
  "method",
  "installments",
  "due_date",
  "paid_at",
  "status",
  "notes",
  "created_at",
  "updated_at",
].join(", ");

export const AUDIT_COLUMNS = [
  "id",
  "client_id",
  "project_id",
  "url",
  "title",
  "overall_score",
  "seo_score",
  "mobile_score",
  "conversion_score",
  "report",
  "created_at",
].join(", ");

export type Client = {
  id: string;
  lifecycle: ClientLifecycle;
  clientType: ClientType;
  name: string;
  company: string;
  document: string;
  legalName: string;
  tradeName: string;
  stateRegistration: string;
  segment: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  website: string;
  address: string;
  addressNumber: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipCode: string;
  source: string;
  tags: string;
  status: LeadStatus;
  estimatedValue: number;
  nextAction: string;
  nextActionDate: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  serviceType: string;
  status: ProjectStatus;
  progress: number;
  totalValue: number;
  startDate: string | null;
  dueDate: string | null;
  deliveryDate: string | null;
  websiteUrl: string;
  domain: string;
  hosting: string;
  domainRenewalDate: string | null;
  hostingRenewalDate: string | null;
  maintenanceEnabled: boolean;
  maintenanceValue: number;
  description: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  clientId: string;
  projectId: string | null;
  description: string;
  totalAmount: number;
  paidAmount: number;
  method: PaymentMethod;
  installments: number;
  dueDate: string | null;
  paidAt: string | null;
  status: PaymentStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type SiteAuditReport = {
  positives?: string[];
  issues?: string[];
  recommendations?: string[];
  details?: Record<string, string | number | boolean>;
};

export type SiteAudit = {
  id: string;
  clientId: string | null;
  projectId: string | null;
  url: string;
  title: string;
  overallScore: number;
  seoScore: number;
  mobileScore: number;
  conversionScore: number;
  report: SiteAuditReport;
  createdAt: string;
};

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function nullableDate(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString().slice(0, 10);
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

export function mapClient(row: Row): Client {
  return {
    id: text(row.id),
    lifecycle: text(row.lifecycle || "lead") as ClientLifecycle,
    clientType: text(row.client_type || "empresa") as ClientType,
    name: text(row.name),
    company: text(row.company),
    document: text(row.document),
    legalName: text(row.legal_name),
    tradeName: text(row.trade_name),
    stateRegistration: text(row.state_registration),
    segment: text(row.segment),
    phone: text(row.phone),
    whatsapp: text(row.whatsapp),
    email: text(row.email),
    instagram: text(row.instagram),
    website: text(row.website),
    address: text(row.address),
    addressNumber: text(row.address_number),
    complement: text(row.complement),
    neighborhood: text(row.neighborhood),
    city: text(row.city),
    state: text(row.state).toUpperCase(),
    zipCode: text(row.zip_code),
    source: text(row.source),
    tags: text(row.tags),
    status: text(row.status || "novo") as LeadStatus,
    estimatedValue: Number(row.estimated_value || 0),
    nextAction: text(row.next_action),
    nextActionDate: nullableDate(row.next_action_date),
    notes: text(row.notes),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapProject(row: Row): Project {
  return {
    id: text(row.id),
    clientId: text(row.client_id),
    name: text(row.name),
    serviceType: text(row.service_type),
    status: text(row.status || "planejamento") as ProjectStatus,
    progress: Number(row.progress || 0),
    totalValue: Number(row.total_value || 0),
    startDate: nullableDate(row.start_date),
    dueDate: nullableDate(row.due_date),
    deliveryDate: nullableDate(row.delivery_date),
    websiteUrl: text(row.website_url),
    domain: text(row.domain),
    hosting: text(row.hosting),
    domainRenewalDate: nullableDate(row.domain_renewal_date),
    hostingRenewalDate: nullableDate(row.hosting_renewal_date),
    maintenanceEnabled: Boolean(row.maintenance_enabled),
    maintenanceValue: Number(row.maintenance_value || 0),
    description: text(row.description),
    notes: text(row.notes),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapPayment(row: Row): Payment {
  return {
    id: text(row.id),
    clientId: text(row.client_id),
    projectId: row.project_id == null ? null : text(row.project_id),
    description: text(row.description),
    totalAmount: Number(row.total_amount || 0),
    paidAmount: Number(row.paid_amount || 0),
    method: text(row.method || "pix") as PaymentMethod,
    installments: Number(row.installments || 1),
    dueDate: nullableDate(row.due_date),
    paidAt: nullableDate(row.paid_at),
    status: text(row.status || "pendente") as PaymentStatus,
    notes: text(row.notes),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export function mapSiteAudit(row: Row): SiteAudit {
  const report = row.report && typeof row.report === "object" ? row.report : {};
  return {
    id: text(row.id),
    clientId: row.client_id == null ? null : text(row.client_id),
    projectId: row.project_id == null ? null : text(row.project_id),
    url: text(row.url),
    title: text(row.title),
    overallScore: Number(row.overall_score || 0),
    seoScore: Number(row.seo_score || 0),
    mobileScore: Number(row.mobile_score || 0),
    conversionScore: Number(row.conversion_score || 0),
    report: report as SiteAuditReport,
    createdAt: iso(row.created_at),
  };
}
