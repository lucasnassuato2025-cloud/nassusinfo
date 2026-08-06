"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  CLIENT_COLUMNS,
  PAYMENT_COLUMNS,
  PROJECT_COLUMNS,
  Client,
  Payment,
  PaymentMethod,
  Project,
  mapClient,
  mapPayment,
  mapProject,
} from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { openDocumentPrint } from "./contract-print";
import {
  BusinessProfile,
  CatalogService,
  ClauseItem,
  ClauseTemplate,
  CommercialDocument,
  ContractSnapshot,
  DocumentSignature,
  DocumentStatus,
  DocumentType,
  ServiceItem,
  SigningLink,
  STATUS_LABELS,
  TYPE_LABELS,
  buildContractSnapshot,
  businessProfileSnapshot,
  clientSnapshot,
  defaultNumber,
  formatCurrency,
  mapBusinessProfile,
  mapCatalogService,
  mapClauseTemplate,
  mapCommercialDocument,
  mapDocumentSignature,
  mapSigningLink,
  normalizeDocument,
  randomCode,
  randomToken,
  rows,
  sha256,
  stableStringify,
} from "./contract-utils";
import { clientLabel, dateLabel, errorMessage, recordActivity, today } from "./shared";

type Props = {
  clients?: Client[];
  projects?: Project[];
  userName: string;
};

type Tab = "documents" | "issuer" | "catalog";
type ReceiptKind = "servico" | "produto" | "servico_produto";
type Quittance = "total" | "parcial";

type ReceiptDraft = {
  clientId: string;
  paymentId: string | null;
  projectId: string | null;
  kind: ReceiptKind;
  description: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  quittance: Quittance;
};

type ContractDraft = {
  documentType: "contrato" | "proposta";
  clientId: string;
  projectId: string | null;
  title: string;
  amount: number;
  issueDate: string;
  validUntil: string | null;
  paymentTerms: string;
  scope: string;
  notes: string;
  selectedServiceIds: string[];
  serviceAmounts: Record<string, number>;
  selectedClauseIds: string[];
};

type ProfileDraft = Omit<BusinessProfile, "id">;
type EditorState =
  | { kind: "receipt"; editingId: string | null }
  | { kind: "commercial"; editingId: string | null; type: "contrato" | "proposta" }
  | null;

type ShareInfo = { documentId: string; url: string; code: string; expiresAt: string };

const DOCUMENT_COLUMNS = "id, client_id, project_id, issuer_profile_id, payment_id, document_type, number, title, status, issue_date, valid_until, amount, payment_terms, scope, terms, notes, service_items, clauses, client_snapshot, issuer_snapshot, receipt_type, amount_in_words, signature_status, current_version, sent_at, viewed_at, signed_at, document_hash, signed_hash, created_at, updated_at";
const PROFILE_COLUMNS = "id, profile_type, display_name, legal_name, trade_name, document_type, document_number, rg_number, state_registration, email, phone, whatsapp, address, address_number, complement, neighborhood, city, state, zip_code, pix_key, is_default, is_active";
const SERVICE_COLUMNS = "id, name, category, description, scope_template, base_price, default_days, active";
const CLAUSE_COLUMNS = "id, code, title, body, category, required, active, sort_order";
const LINK_COLUMNS = "id, document_id, document_version_id, status, expires_at, access_count, last_accessed_at, created_at";
const SIGNATURE_COLUMNS = "id, document_id, signer_name, signer_document_masked, signer_email, signer_phone, signature_method, signature_data, document_hash, evidence, signed_at";

const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  boleto: "Boleto bancário",
  dinheiro: "Dinheiro",
  transferencia: "Transferência bancária",
};

const RECEIPT_KIND_LABELS: Record<ReceiptKind, string> = {
  servico: "Serviço",
  produto: "Produto",
  servico_produto: "Serviço e produto",
};

function friendlyError(reason: unknown, fallback: string): string {
  const raw = errorMessage(reason, fallback);
  if (/permission|row-level security/i.test(raw)) return "Seu acesso ao workspace ainda não foi validado. Atualize a página e tente novamente.";
  if (/network|fetch|timeout/i.test(raw)) return "A conexão com o servidor falhou. Verifique a internet e tente novamente.";
  if (/duplicate|unique/i.test(raw)) return "Já existe um documento com esse número. Tente gerar novamente.";
  return raw;
}

function initialReceipt(): ReceiptDraft {
  return {
    clientId: "",
    paymentId: null,
    projectId: null,
    kind: "servico",
    description: "",
    amount: 0,
    method: "pix",
    paidAt: today(),
    quittance: "total",
  };
}

function initialContract(type: "contrato" | "proposta", clauses: ClauseTemplate[]): ContractDraft {
  return {
    documentType: type,
    clientId: "",
    projectId: null,
    title: TYPE_LABELS[type],
    amount: 0,
    issueDate: today(),
    validUntil: null,
    paymentTerms: type === "contrato" ? "50% na contratação e 50% antes da publicação ou entrega final." : "Condições a combinar com o cliente.",
    scope: "Descreva objetivamente o serviço, as entregas e os limites incluídos.",
    notes: "",
    selectedServiceIds: [],
    serviceAmounts: {},
    selectedClauseIds: clauses.filter((item) => item.required).map((item) => item.id),
  };
}

function emptyProfile(): ProfileDraft {
  return {
    profileType: "pf",
    displayName: "Lucas Nassuato da Silva",
    legalName: "Lucas Nassuato da Silva",
    tradeName: "Nassusinfo Soluções Tecnológicas",
    documentType: "cpf",
    documentNumber: "",
    rgNumber: "",
    stateRegistration: "",
    email: "",
    phone: "",
    whatsapp: "",
    address: "Waldery de Almeida",
    addressNumber: "604",
    complement: "",
    neighborhood: "",
    city: "Guarujá",
    state: "SP",
    zipCode: "",
    pixKey: "",
    isDefault: false,
    isActive: true,
  };
}

function profileRow(draft: ProfileDraft) {
  return {
    profile_type: draft.profileType,
    display_name: draft.displayName.trim(),
    legal_name: draft.legalName.trim(),
    trade_name: draft.tradeName.trim(),
    document_type: draft.documentType,
    document_number: draft.documentNumber.trim(),
    rg_number: draft.rgNumber.trim(),
    state_registration: draft.stateRegistration.trim(),
    email: draft.email.trim(),
    phone: draft.phone.trim(),
    whatsapp: draft.whatsapp.trim(),
    address: draft.address.trim(),
    address_number: draft.addressNumber.trim(),
    complement: draft.complement.trim(),
    neighborhood: draft.neighborhood.trim(),
    city: draft.city.trim(),
    state: draft.state.trim().toUpperCase().slice(0, 2),
    zip_code: draft.zipCode.trim(),
    pix_key: draft.pixKey.trim(),
    is_default: draft.isDefault,
    is_active: draft.isActive,
    updated_at: new Date().toISOString(),
  };
}

function snapshotName(snapshot: Record<string, unknown>): string {
  return String(snapshot.tradeName || snapshot.company || snapshot.legalName || snapshot.name || "").trim();
}

function snapshotDocument(snapshot: Record<string, unknown>): string {
  return String(snapshot.documentNumber || "").trim();
}

function documentClientName(document: CommercialDocument, clientMap: Map<string, Client>): string {
  const client = clientMap.get(document.clientId);
  if (client) return clientLabel(client);
  return snapshotName(document.clientSnapshot) || "Cliente vinculado";
}

function paymentMethodFromText(text: string): PaymentMethod {
  const normalized = text.toLocaleLowerCase("pt-BR");
  if (normalized.includes("crédito") || normalized.includes("credito")) return "credito";
  if (normalized.includes("débito") || normalized.includes("debito")) return "debito";
  if (normalized.includes("boleto")) return "boleto";
  if (normalized.includes("dinheiro")) return "dinheiro";
  if (normalized.includes("transfer")) return "transferencia";
  return "pix";
}

function receiptDescription(document: CommercialDocument): string {
  return document.scope
    .replace(/^Recebimento referente a\s+/i, "")
    .replace(/^Pagamento referente a\s+/i, "")
    .replace(/\.$/, "")
    .trim();
}

function snapshotFromStored(
  document: CommercialDocument,
  project: Project | null,
  payment: Payment | null,
): ContractSnapshot | null {
  if (!Object.keys(document.clientSnapshot).length || !Object.keys(document.issuerSnapshot).length) return null;
  return {
    schema: "nassus-contract-v1",
    document: {
      id: document.id,
      number: document.number,
      type: document.documentType,
      title: document.title,
      issueDate: document.issueDate,
      validUntil: document.validUntil,
      amount: document.amount,
      amountInWords: document.amountInWords,
      paymentTerms: document.paymentTerms,
      scope: document.scope,
      terms: document.terms,
      notes: document.notes,
      version: document.currentVersion,
      ...({ receiptType: document.receiptType } as Record<string, unknown>),
    } as ContractSnapshot["document"],
    issuer: document.issuerSnapshot,
    client: document.clientSnapshot,
    project: project ? {
      id: project.id,
      name: project.name,
      serviceType: project.serviceType,
      totalValue: project.totalValue,
      websiteUrl: project.websiteUrl,
      domain: project.domain,
      description: project.description,
    } : null,
    payment: payment ? {
      id: payment.id,
      description: payment.description,
      totalAmount: payment.totalAmount,
      paidAmount: payment.paidAmount,
      method: payment.method,
      installments: payment.installments,
      dueDate: payment.dueDate,
      paidAt: payment.paidAt,
      status: payment.status,
    } : null,
    services: document.serviceItems,
    clauses: document.clauses,
  };
}

export function DocumentsCenterV2({ clients: initialClients = [], projects: initialProjects = [] }: Props) {
  const [tab, setTab] = useState<Tab>("documents");
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [projects, setProjects] = useState<Project[]>(initialProjects);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [clauses, setClauses] = useState<ClauseTemplate[]>([]);
  const [links, setLinks] = useState<SigningLink[]>([]);
  const [signatures, setSignatures] = useState<DocumentSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editor, setEditor] = useState<EditorState>(null);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft>(initialReceipt);
  const [contractDraft, setContractDraft] = useState<ContractDraft>(() => initialContract("contrato", []));
  const [share, setShare] = useState<ShareInfo | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyProfile);
  const signedIdsRef = useRef(new Set<string>());

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);
  const paymentMap = useMemo(() => new Map(payments.map((item) => [item.id, item])), [payments]);
  const profileMap = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const linkMap = useMemo(() => new Map(links.map((item) => [item.documentId, item])), [links]);
  const signatureMap = useMemo(() => new Map(signatures.map((item) => [item.documentId, item])), [signatures]);

  async function loadAll(showLoader = true) {
    if (showLoader) setLoading(true);
    setError("");
    try {
      const claim = await (neonClient as any).rpc("crm_claim_membership");
      if (claim.error) throw claim.error;

      const [clientQuery, projectQuery, paymentQuery, documentQuery, profileQuery, serviceQuery, clauseQuery, linkQuery, signatureQuery] = await Promise.all([
        neonClient.from("clients").select(CLIENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
        neonClient.from("projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
        neonClient.from("payments").select(PAYMENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
        neonClient.from("commercial_documents").select(DOCUMENT_COLUMNS).order("updated_at", { ascending: false }),
        neonClient.from("business_profiles").select(PROFILE_COLUMNS).order("is_default", { ascending: false }).order("id", { ascending: true }),
        neonClient.from("service_catalog").select(SERVICE_COLUMNS).eq("active", true).order("category", { ascending: true }).order("name", { ascending: true }),
        neonClient.from("contract_clause_templates").select(CLAUSE_COLUMNS).eq("active", true).order("sort_order", { ascending: true }),
        neonClient.from("document_signing_links").select(LINK_COLUMNS).order("created_at", { ascending: false }),
        neonClient.from("document_signatures").select(SIGNATURE_COLUMNS).order("signed_at", { ascending: false }),
      ]);

      const failure = clientQuery.error || projectQuery.error || paymentQuery.error || documentQuery.error || profileQuery.error || serviceQuery.error || clauseQuery.error || linkQuery.error || signatureQuery.error;
      if (failure) throw failure;

      const loadedClients = rows(clientQuery.data).map(mapClient);
      const loadedProjects = rows(projectQuery.data).map(mapProject);
      const loadedPayments = rows(paymentQuery.data).map(mapPayment);
      const loadedDocuments = rows(documentQuery.data).map(mapCommercialDocument);
      const loadedSignatures = rows(signatureQuery.data).map(mapDocumentSignature);
      const previousSigned = signedIdsRef.current;
      const newlySigned = loadedSignatures.find((item) => !previousSigned.has(item.documentId));

      setClients(loadedClients);
      setProjects(loadedProjects);
      setPayments(loadedPayments);
      setDocuments(loadedDocuments);
      setProfiles(rows(profileQuery.data).map(mapBusinessProfile));
      setServices(rows(serviceQuery.data).map(mapCatalogService));
      setClauses(rows(clauseQuery.data).map(mapClauseTemplate));
      setLinks(rows(linkQuery.data).map(mapSigningLink).reduce<SigningLink[]>((result, item) => result.some((current) => current.documentId === item.documentId) ? result : [...result, item], []));
      setSignatures(loadedSignatures);
      signedIdsRef.current = new Set(loadedSignatures.map((item) => item.documentId));
      if (!showLoader && newlySigned) setNotice(`Contrato assinado por ${newlySigned.signerName}.`);
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível carregar a central de documentos."));
    } finally {
      if (showLoader) setLoading(false);
    }
  }

  useEffect(() => { void loadAll(true); }, []);

  useEffect(() => {
    const pending = links.some((item) => ["active", "opened"].includes(item.status));
    if (!pending) return;
    const timer = window.setInterval(() => void loadAll(false), 15000);
    return () => window.clearInterval(timer);
  }, [links]);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredDocuments = useMemo(() => documents.filter((document) => [
    document.number,
    document.title,
    TYPE_LABELS[document.documentType],
    STATUS_LABELS[document.status],
    documentClientName(document, clientMap),
    projectMap.get(document.projectId || "")?.name || "",
  ].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch)), [documents, normalizedSearch, clientMap, projectMap]);

  const pendingSignatures = links.filter((item) => ["active", "opened"].includes(item.status)).length;
  const signedDocuments = documents.filter((item) => item.status === "assinado").length;
  const receipts = documents.filter((item) => item.documentType === "recibo").length;
  const defaultProfile = profiles.find((item) => item.isDefault && item.isActive) || profiles.find((item) => item.isActive);

  function openReceipt(document?: CommercialDocument) {
    if (!defaultProfile) {
      setTab("issuer");
      setError("Configure um perfil ativo do recebedor antes de emitir o comprovante.");
      return;
    }
    if (document) {
      const payment = document.paymentId ? paymentMap.get(document.paymentId) : undefined;
      setReceiptDraft({
        clientId: document.clientId,
        paymentId: document.paymentId,
        projectId: document.projectId,
        kind: (["servico", "produto", "servico_produto"].includes(document.receiptType) ? document.receiptType : "servico") as ReceiptKind,
        description: receiptDescription(document),
        amount: document.amount,
        method: payment?.method || paymentMethodFromText(document.paymentTerms),
        paidAt: payment?.paidAt || document.issueDate,
        quittance: document.terms.toLocaleLowerCase("pt-BR").includes("parcial") ? "parcial" : "total",
      });
      setEditor({ kind: "receipt", editingId: document.id });
      return;
    }
    setReceiptDraft(initialReceipt());
    setEditor({ kind: "receipt", editingId: null });
  }

  function openCommercial(type: "contrato" | "proposta", document?: CommercialDocument) {
    if (!defaultProfile) {
      setTab("issuer");
      setError("Configure um perfil ativo do prestador antes de criar documentos.");
      return;
    }
    if (document) {
      setContractDraft({
        documentType: type,
        clientId: document.clientId,
        projectId: document.projectId,
        title: document.title,
        amount: document.amount,
        issueDate: document.issueDate,
        validUntil: document.validUntil,
        paymentTerms: document.paymentTerms,
        scope: document.scope,
        notes: document.notes,
        selectedServiceIds: document.serviceItems.map((item) => item.serviceId).filter(Boolean) as string[],
        serviceAmounts: Object.fromEntries(document.serviceItems.filter((item) => item.serviceId).map((item) => [item.serviceId as string, item.amount])),
        selectedClauseIds: document.clauses.map((item) => item.clauseId).filter(Boolean) as string[],
      });
      setEditor({ kind: "commercial", editingId: document.id, type });
      return;
    }
    setContractDraft(initialContract(type, clauses));
    setEditor({ kind: "commercial", editingId: null, type });
  }

  function selectReceiptPayment(paymentId: string) {
    const payment = paymentMap.get(paymentId);
    if (!payment) {
      setReceiptDraft((current) => ({ ...current, paymentId: null }));
      return;
    }
    setReceiptDraft((current) => ({
      ...current,
      paymentId: payment.id,
      clientId: payment.clientId,
      projectId: payment.projectId,
      description: payment.description || current.description,
      amount: payment.paidAmount || payment.totalAmount,
      method: payment.method,
      paidAt: payment.paidAt || today(),
      quittance: payment.paidAmount > 0 && payment.paidAmount < payment.totalAmount ? "parcial" : "total",
    }));
  }

  function selectCommercialClient(clientId: string) {
    const firstProject = projects.find((item) => item.clientId === clientId);
    setContractDraft((current) => ({ ...current, clientId, projectId: firstProject?.id || null }));
  }

  function toggleService(serviceId: string) {
    const service = services.find((item) => item.id === serviceId);
    setContractDraft((current) => {
      const selected = current.selectedServiceIds.includes(serviceId);
      return {
        ...current,
        selectedServiceIds: selected ? current.selectedServiceIds.filter((id) => id !== serviceId) : [...current.selectedServiceIds, serviceId],
        serviceAmounts: selected ? current.serviceAmounts : { ...current.serviceAmounts, [serviceId]: service?.basePrice || 0 },
        scope: !selected && service?.scopeTemplate && !current.scope.includes(service.scopeTemplate)
          ? `${current.scope}\n\n${service.scopeTemplate}`.trim()
          : current.scope,
      };
    });
  }

  function toggleClause(clauseId: string) {
    const clause = clauses.find((item) => item.id === clauseId);
    if (clause?.required) return;
    setContractDraft((current) => ({
      ...current,
      selectedClauseIds: current.selectedClauseIds.includes(clauseId)
        ? current.selectedClauseIds.filter((id) => id !== clauseId)
        : [...current.selectedClauseIds, clauseId],
    }));
  }

  async function saveReceipt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = clientMap.get(receiptDraft.clientId);
    const profile = defaultProfile;
    if (!client) return setError("Selecione o cliente que efetuou o pagamento.");
    if (!profile) return setError("Configure o perfil do recebedor.");
    if (!receiptDraft.description.trim()) return setError("Informe o serviço ou produto pago.");
    if (!(receiptDraft.amount > 0)) return setError("Informe o valor efetivamente recebido.");

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const editingId = editor?.kind === "receipt" ? editor.editingId : null;
      const payment = receiptDraft.paymentId ? paymentMap.get(receiptDraft.paymentId) : undefined;
      const projectId = payment?.projectId || receiptDraft.projectId;
      const payload = {
        client_id: Number(client.id),
        project_id: projectId ? Number(projectId) : null,
        issuer_profile_id: Number(profile.id),
        payment_id: payment ? Number(payment.id) : null,
        document_type: "recibo",
        number: editingId ? documents.find((item) => item.id === editingId)?.number : defaultNumber("recibo"),
        title: "Comprovante de pagamento recebido",
        status: "concluido",
        issue_date: receiptDraft.paidAt,
        valid_until: null,
        amount: receiptDraft.amount,
        amount_in_words: "",
        payment_terms: `Pagamento efetuado por ${PAYMENT_METHODS[receiptDraft.method]} em ${receiptDraft.paidAt.split("-").reverse().join("/")}.`,
        scope: `Recebimento referente a ${receiptDraft.description.trim()}.`,
        terms: receiptDraft.quittance === "parcial" ? "Quitação parcial exclusivamente do valor indicado." : "Quitação total exclusivamente do valor indicado.",
        notes: "Comprovante particular de pagamento recebido. Documento não fiscal.",
        service_items: [],
        clauses: [],
        client_snapshot: clientSnapshot(client, client.clientType === "empresa" ? "cnpj" : "cpf", client.document),
        issuer_snapshot: businessProfileSnapshot(profile),
        receipt_type: receiptDraft.kind,
        signature_status: "not_required",
        updated_at: new Date().toISOString(),
      };
      const table = neonClient.from("commercial_documents") as any;
      const result = editingId
        ? await table.update(payload).eq("id", editingId).select(DOCUMENT_COLUMNS)
        : await table.insert(payload).select(DOCUMENT_COLUMNS);
      if (result.error) throw result.error;
      const saved = mapCommercialDocument(rows(result.data)[0] || result.data);
      setDocuments((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setEditor(null);
      setNotice(editingId ? "Comprovante atualizado e autenticado novamente." : "Comprovante de pagamento criado e autenticado.");
      void recordActivity({
        clientId: saved.clientId,
        projectId: saved.projectId,
        type: editingId ? "documento_atualizado" : "recibo_criado",
        title: editingId ? "Comprovante atualizado" : "Pagamento comprovado",
        description: `${saved.number} · ${formatCurrency(saved.amount)}`,
      });
      await loadAll(false);
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível criar o comprovante."));
    } finally {
      setSaving(false);
    }
  }

  async function saveCommercial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = clientMap.get(contractDraft.clientId);
    const profile = defaultProfile;
    if (!client) return setError("Selecione o cliente do documento.");
    if (!profile) return setError("Configure o perfil do prestador.");
    if (!contractDraft.title.trim()) return setError("Informe o título do documento.");

    setSaving(true);
    setError("");
    setNotice("");
    try {
      const editingId = editor?.kind === "commercial" ? editor.editingId : null;
      const serviceItems: ServiceItem[] = contractDraft.selectedServiceIds.map((id) => {
        const service = services.find((item) => item.id === id)!;
        return {
          serviceId: service.id,
          name: service.name,
          description: service.description || service.scopeTemplate,
          quantity: 1,
          amount: Number(contractDraft.serviceAmounts[id] || 0),
        };
      });
      const clauseItems: ClauseItem[] = contractDraft.selectedClauseIds.map((id) => {
        const clause = clauses.find((item) => item.id === id)!;
        return { clauseId: clause.id, code: clause.code, title: clause.title, body: clause.body };
      });
      const serviceTotal = serviceItems.reduce((sum, item) => sum + item.amount, 0);
      const amount = serviceTotal > 0 ? serviceTotal : Number(contractDraft.amount || 0);
      const existing = editingId ? documents.find((item) => item.id === editingId) : undefined;
      const payload = {
        client_id: Number(client.id),
        project_id: contractDraft.projectId ? Number(contractDraft.projectId) : null,
        issuer_profile_id: Number(profile.id),
        payment_id: null,
        document_type: contractDraft.documentType,
        number: existing?.number || defaultNumber(contractDraft.documentType),
        title: contractDraft.title.trim(),
        status: existing?.status === "assinado" ? "assinado" : "rascunho",
        issue_date: contractDraft.issueDate,
        valid_until: contractDraft.validUntil || null,
        amount,
        amount_in_words: "",
        payment_terms: contractDraft.paymentTerms.trim(),
        scope: contractDraft.scope.trim(),
        terms: "As cláusulas selecionadas integram este documento.",
        notes: contractDraft.notes.trim(),
        service_items: serviceItems,
        clauses: clauseItems,
        client_snapshot: clientSnapshot(client, client.clientType === "empresa" ? "cnpj" : "cpf", client.document),
        issuer_snapshot: businessProfileSnapshot(profile),
        receipt_type: "",
        signature_status: existing?.signatureStatus || "not_required",
        updated_at: new Date().toISOString(),
      };
      const table = neonClient.from("commercial_documents") as any;
      const result = editingId
        ? await table.update(payload).eq("id", editingId).select(DOCUMENT_COLUMNS)
        : await table.insert(payload).select(DOCUMENT_COLUMNS);
      if (result.error) throw result.error;
      const saved = mapCommercialDocument(rows(result.data)[0] || result.data);
      setDocuments((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setEditor(null);
      setNotice(editingId ? "Documento atualizado." : `${TYPE_LABELS[saved.documentType]} criado com sucesso.`);
      void recordActivity({ clientId: saved.clientId, projectId: saved.projectId, type: editingId ? "documento_atualizado" : "documento_criado", title: `${TYPE_LABELS[saved.documentType]} ${editingId ? "atualizado" : "criado"}`, description: `${saved.number} · ${formatCurrency(saved.amount)}` });
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível salvar o documento."));
    } finally {
      setSaving(false);
    }
  }

  async function generateSigningLink(document: CommercialDocument) {
    const client = clientMap.get(document.clientId);
    const profile = document.issuerProfileId ? profileMap.get(document.issuerProfileId) : defaultProfile;
    if (!client || !profile) return setError("Complete os dados do cliente e do prestador antes de gerar o link.");
    const project = document.projectId ? projectMap.get(document.projectId) || null : null;
    const payment = document.paymentId ? paymentMap.get(document.paymentId) || null : null;
    setSaving(true);
    setError("");
    try {
      const previous = linkMap.get(document.id);
      if (previous && ["active", "opened"].includes(previous.status)) {
        const revoke = await (neonClient.from("document_signing_links") as any).update({ status: "revoked" }).eq("id", previous.id);
        if (revoke.error) throw revoke.error;
      }
      const version = document.documentHash ? document.currentVersion + 1 : Math.max(1, document.currentVersion);
      const documentType = String(document.clientSnapshot.documentType || (client.clientType === "empresa" ? "cnpj" : "cpf"));
      const documentNumber = String(document.clientSnapshot.documentNumber || client.document || "");
      const snapshot = buildContractSnapshot({ document, issuer: profile, client, project, payment, clientDocumentType: documentType, clientDocumentNumber: documentNumber, services: document.serviceItems, clauses: document.clauses, amountInWords: document.amountInWords, version });
      const documentHash = await sha256(stableStringify(snapshot));
      const versionResult = await (neonClient.from("document_versions") as any).insert({ document_id: Number(document.id), version, snapshot, document_hash: documentHash }).select("id, version, document_hash");
      if (versionResult.error) throw versionResult.error;
      const versionId = String(rows(versionResult.data)[0]?.id || "");
      const token = randomToken();
      const code = randomCode();
      const [tokenHash, codeHash, expectedDocumentHash] = await Promise.all([
        sha256(token),
        sha256(code),
        documentNumber ? sha256(normalizeDocument(documentNumber)) : Promise.resolve(""),
      ]);
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      const linkResult = await (neonClient.from("document_signing_links") as any).insert({
        document_id: Number(document.id),
        document_version_id: Number(versionId),
        token_hash: tokenHash,
        access_code_hash: codeHash,
        expected_document_hash: expectedDocumentHash,
        status: "active",
        expires_at: expiresAt,
      }).select(LINK_COLUMNS);
      if (linkResult.error) throw linkResult.error;
      const updatedResult = await (neonClient.from("commercial_documents") as any).update({
        status: "enviado",
        signature_status: "pending",
        current_version: version,
        sent_at: new Date().toISOString(),
        document_hash: documentHash,
        client_snapshot: snapshot.client,
        issuer_snapshot: snapshot.issuer,
        updated_at: new Date().toISOString(),
      }).eq("id", document.id).select(DOCUMENT_COLUMNS);
      if (updatedResult.error) throw updatedResult.error;
      const updated = mapCommercialDocument(rows(updatedResult.data)[0] || updatedResult.data);
      const link = mapSigningLink(rows(linkResult.data)[0] || linkResult.data);
      setDocuments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setLinks((current) => [link, ...current.filter((item) => item.documentId !== document.id)]);
      setShare({ documentId: document.id, url: `${window.location.origin}/assinar/${token}`, code, expiresAt });
      setNotice("Link privado criado. Envie o link e o código em mensagens separadas.");
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível gerar o link de assinatura."));
    } finally {
      setSaving(false);
    }
  }

  async function revokeLink(documentId: string) {
    const link = linkMap.get(documentId);
    if (!link) return;
    setSaving(true);
    try {
      const result = await (neonClient.from("document_signing_links") as any).update({ status: "revoked" }).eq("id", link.id).select(LINK_COLUMNS);
      if (result.error) throw result.error;
      await (neonClient.from("commercial_documents") as any).update({ signature_status: "revoked" }).eq("id", documentId);
      setLinks((current) => current.map((item) => item.id === link.id ? mapSigningLink(rows(result.data)[0] || result.data) : item));
      setNotice("Link de assinatura revogado.");
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível revogar o link."));
    } finally {
      setSaving(false);
    }
  }

  async function printDocument(document: CommercialDocument) {
    setError("");
    try {
      const versionQuery = await neonClient.from("document_versions").select("snapshot, document_hash").eq("document_id", Number(document.id)).order("version", { ascending: false }).limit(1);
      if (versionQuery.error) throw versionQuery.error;
      const versionRow = rows(versionQuery.data)[0];
      let snapshot = versionRow?.snapshot as ContractSnapshot | undefined;
      if (!snapshot) {
        snapshot = snapshotFromStored(
          document,
          document.projectId ? projectMap.get(document.projectId) || null : null,
          document.paymentId ? paymentMap.get(document.paymentId) || null : null,
        ) || undefined;
      }
      if (!snapshot) throw new Error("Os dados deste documento estão incompletos para gerar o PDF.");
      openDocumentPrint(snapshot, String(versionRow?.document_hash || document.documentHash || "RASCUNHO"), signatureMap.get(document.id));
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível gerar o PDF."));
    }
  }

  function editDocument(document: CommercialDocument) {
    if (document.documentType === "recibo") openReceipt(document);
    else openCommercial(document.documentType, document);
  }

  function openProfile(profile?: BusinessProfile) {
    if (profile) {
      const { id: _id, ...draft } = profile;
      setEditingProfileId(profile.id);
      setProfileDraft(draft);
    } else {
      setEditingProfileId(null);
      setProfileDraft(emptyProfile());
    }
    setProfileOpen(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileDraft.displayName.trim() || !profileDraft.legalName.trim()) return setError("Informe o nome e a identificação do recebedor/prestador.");
    setSaving(true);
    setError("");
    try {
      if (profileDraft.isDefault) {
        const reset = await (neonClient.from("business_profiles") as any).update({ is_default: false });
        if (reset.error) throw reset.error;
      }
      const table = neonClient.from("business_profiles") as any;
      const result = editingProfileId
        ? await table.update(profileRow(profileDraft)).eq("id", editingProfileId).select(PROFILE_COLUMNS)
        : await table.insert(profileRow(profileDraft)).select(PROFILE_COLUMNS);
      if (result.error) throw result.error;
      setProfileOpen(false);
      setNotice("Perfil do emitente salvo.");
      await loadAll(false);
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível salvar o perfil."));
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  }

  if (loading) return <div className="suite-loading"><i /><strong>Carregando clientes e documentos</strong><span>Validando o workspace antes de montar o gerador.</span></div>;

  return (
    <div className="documents-v2">
      <nav className="document-tabs">
        <button type="button" className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>Documentos</button>
        <button type="button" className={tab === "issuer" ? "active" : ""} onClick={() => setTab("issuer")}>Emitente</button>
        <button type="button" className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>Serviços e cláusulas</button>
      </nav>

      {notice && <div className="business-notice">{notice}</div>}
      {error && <div className="documents-error"><strong>Ação não concluída</strong><span>{error}</span><button type="button" onClick={() => setError("")}>Fechar</button></div>}

      {tab === "documents" && <>
        <section className="document-kpis">
          <article><span>DOCUMENTOS</span><strong>{documents.length}</strong><small>Propostas, contratos e comprovantes</small></article>
          <article><span>AGUARDANDO ASSINATURA</span><strong>{pendingSignatures}</strong><small>Atualização automática a cada 15 segundos</small></article>
          <article><span>ASSINADOS</span><strong>{signedDocuments}</strong><small>Com trilha de auditoria</small></article>
          <article><span>COMPROVANTES</span><strong>{receipts}</strong><small>Pagamento recebido · não fiscal</small></article>
        </section>

        <section className="pro-panel document-center-panel">
          <header className="document-toolbar">
            <div className="business-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento, cliente ou projeto" /></div>
            <div><button type="button" className="receipt-primary" onClick={() => openReceipt()}>+ Comprovante</button><button type="button" className="business-secondary" onClick={() => openCommercial("proposta")}>+ Proposta</button><button type="button" className="pro-primary" onClick={() => openCommercial("contrato")}>+ Contrato</button></div>
          </header>

          {!clients.length && <div className="documents-warning"><strong>Nenhum cliente disponível</strong><p>Cadastre um cliente na Central ou atualize a página. O gerador consulta o cadastro diretamente do workspace.</p><button type="button" className="business-secondary" onClick={() => void loadAll(true)}>Recarregar clientes</button></div>}

          {filteredDocuments.length ? <div className="document-cards">{filteredDocuments.map((document) => {
            const link = linkMap.get(document.id);
            const signature = signatureMap.get(document.id);
            const project = document.projectId ? projectMap.get(document.projectId) : null;
            const isReceipt = document.documentType === "recibo";
            return <article className="document-card-pro" key={document.id}>
              <header><span className={`document-type type-${document.documentType}`}>{isReceipt ? "COMPROVANTE NÃO FISCAL" : TYPE_LABELS[document.documentType]}</span><b className={`document-status status-${document.status}`}>{STATUS_LABELS[document.status]}</b></header>
              <small>{document.number}</small>
              <h3>{document.title}</h3>
              <p>{documentClientName(document, clientMap)}{project ? ` · ${project.name}` : ""}</p>
              <dl>
                <div><dt>Valor</dt><dd>{formatCurrency(document.amount)}</dd></div>
                <div><dt>Emissão</dt><dd>{dateLabel(document.issueDate)}</dd></div>
                <div><dt>{isReceipt ? "Autenticação" : "Assinatura"}</dt><dd>{isReceipt ? "Emissor eletrônico" : signature ? "Concluída" : link ? link.status : "Não enviada"}</dd></div>
              </dl>
              {signature && <div className="document-signer"><span>ASSINADO POR</span><strong>{signature.signerName}</strong><small>{signature.signerDocumentMasked} · {new Date(signature.signedAt).toLocaleString("pt-BR")}</small></div>}
              <footer>
                <button type="button" onClick={() => editDocument(document)} disabled={document.status === "assinado"}>Editar</button>
                <button type="button" onClick={() => void printDocument(document)}>PDF</button>
                {document.documentType === "contrato" && document.status !== "assinado" && <button type="button" className="positive" disabled={saving} onClick={() => void generateSigningLink(document)}>{link && ["active", "opened"].includes(link.status) ? "Novo link" : "Gerar link"}</button>}
                {link && ["active", "opened"].includes(link.status) && <button type="button" className="danger" disabled={saving} onClick={() => void revokeLink(document.id)}>Revogar</button>}
              </footer>
            </article>;
          })}</div> : <div className="business-empty"><div>▤</div><h2>Nenhum documento encontrado</h2><p>Crie um comprovante de pagamento, proposta ou contrato vinculado a um cliente.</p><button type="button" className="receipt-primary" onClick={() => openReceipt()}>Criar comprovante</button></div>}
        </section>
      </>}

      {tab === "issuer" && <section className="pro-panel document-settings-panel">
        <header><div><span>EMITENTE / RECEBEDOR</span><h2>Perfis da Nassusinfo</h2><p>O perfil padrão é usado automaticamente, sem ocupar espaço no gerador.</p></div><button type="button" className="pro-primary" onClick={() => openProfile()}>+ Novo perfil</button></header>
        <div className="profile-cards">{profiles.map((profile) => <article key={profile.id}><div><span className={`profile-kind profile-${profile.profileType}`}>{profile.profileType === "pf" ? "PESSOA FÍSICA" : "PESSOA JURÍDICA"}</span>{profile.isDefault && <b>PADRÃO</b>}</div><h3>{profile.displayName}</h3><p>{profile.tradeName || profile.legalName}</p><dl><div><dt>Documento</dt><dd>{profile.documentType.toUpperCase()} · {profile.documentNumber || "preencher"}</dd></div><div><dt>Local</dt><dd>{[profile.city, profile.state].filter(Boolean).join(" / ")}</dd></div><div><dt>Pix</dt><dd>{profile.pixKey || "não informado"}</dd></div></dl><button type="button" onClick={() => openProfile(profile)}>Editar dados</button></article>)}</div>
      </section>}

      {tab === "catalog" && <div className="document-catalog-grid">
        <section className="pro-panel document-settings-panel"><header><div><span>CATÁLOGO DE SERVIÇOS</span><h2>Serviços disponíveis</h2><p>Utilizados apenas em propostas e contratos.</p></div></header><div className="catalog-list">{services.map((service) => <article key={service.id}><div><strong>{service.name}</strong><span>{service.category}</span></div><p>{service.description}</p><small>{service.defaultDays} dias sugeridos · base {formatCurrency(service.basePrice)}</small></article>)}</div></section>
        <section className="pro-panel document-settings-panel"><header><div><span>BIBLIOTECA CONTRATUAL</span><h2>Cláusulas</h2><p>Recibos não utilizam cláusulas contratuais.</p></div></header><div className="clause-list">{clauses.map((clause) => <article key={clause.id}><div><strong>{clause.title}</strong>{clause.required && <span>OBRIGATÓRIA</span>}</div><p>{clause.body}</p></article>)}</div></section>
      </div>}

      {editor?.kind === "receipt" && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><section className="business-modal receipt-editor-v2">
        <header><div><span>COMPROVANTE NÃO FISCAL</span><h2>{editor.editingId ? "Editar pagamento recebido" : "Registrar pagamento recebido"}</h2><p>Preencha somente o essencial. Número, emitente, autenticação e hash são automáticos.</p></div><button type="button" onClick={() => setEditor(null)}>×</button></header>
        <form onSubmit={saveReceipt}>
          <div className="receipt-quick-fill"><label>Usar pagamento já cadastrado<select value={receiptDraft.paymentId || ""} onChange={(event) => selectReceiptPayment(event.target.value)}><option value="">Preencher manualmente</option>{payments.filter((payment) => payment.status === "pago" || payment.paidAmount > 0).map((payment) => <option key={payment.id} value={payment.id}>{clientLabel(clientMap.get(payment.clientId))} · {payment.description} · {formatCurrency(payment.paidAmount || payment.totalAmount)}</option>)}</select></label></div>
          <div className="receipt-minimal-grid">
            <label className="span-2">Cliente / pagador *<select required value={receiptDraft.clientId} onChange={(event) => setReceiptDraft((current) => ({ ...current, clientId: event.target.value, paymentId: null, projectId: projects.find((project) => project.clientId === event.target.value)?.id || null }))}><option value="">Selecione um cliente cadastrado</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientLabel(client)}{client.document ? ` · ${client.document}` : ""}</option>)}</select></label>
            <label>Natureza *<select value={receiptDraft.kind} onChange={(event) => setReceiptDraft((current) => ({ ...current, kind: event.target.value as ReceiptKind }))}>{Object.entries(RECEIPT_KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Valor recebido *<input required type="number" min="0.01" step="0.01" value={receiptDraft.amount || ""} onChange={(event) => setReceiptDraft((current) => ({ ...current, amount: Number(event.target.value || 0) }))} placeholder="0,00" /></label>
            <label className="span-2">Serviço ou produto pago *<input required value={receiptDraft.description} onChange={(event) => setReceiptDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Ex.: desenvolvimento e entrega do site profissional" /></label>
            <label>Forma de pagamento *<select value={receiptDraft.method} onChange={(event) => setReceiptDraft((current) => ({ ...current, method: event.target.value as PaymentMethod }))}>{Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Data do pagamento *<input required type="date" value={receiptDraft.paidAt} onChange={(event) => setReceiptDraft((current) => ({ ...current, paidAt: event.target.value }))} /></label>
          </div>
          <details className="receipt-optional"><summary>Detalhe opcional</summary><label>Tipo de quitação<select value={receiptDraft.quittance} onChange={(event) => setReceiptDraft((current) => ({ ...current, quittance: event.target.value as Quittance }))}><option value="total">Quitação total do valor</option><option value="parcial">Quitação parcial do valor</option></select></label></details>
          <div className="receipt-preview-line"><span>O PDF será emitido como</span><strong>Comprovante particular de pagamento recebido — não fiscal</strong></div>
          <footer><button type="button" className="business-secondary" onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="receipt-primary" disabled={saving}>{saving ? "Autenticando..." : "Gerar comprovante"}</button></footer>
        </form>
      </section></div>}

      {editor?.kind === "commercial" && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditor(null); }}><section className="business-modal contract-editor contract-editor-v2">
        <header><div><span>GERADOR COMERCIAL</span><h2>{editor.editingId ? "Editar documento" : `Novo ${TYPE_LABELS[editor.type].toLowerCase()}`}</h2><p>Clientes e projetos são carregados diretamente do cadastro atual.</p></div><button type="button" onClick={() => setEditor(null)}>×</button></header>
        <form onSubmit={saveCommercial}>
          <div className="contract-form-grid">
            <label className="span-2">Cliente *<select required value={contractDraft.clientId} onChange={(event) => selectCommercialClient(event.target.value)}><option value="">Selecione um cliente cadastrado</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientLabel(client)}{client.document ? ` · ${client.document}` : ""}</option>)}</select></label>
            <label className="span-2">Projeto<select value={contractDraft.projectId || ""} onChange={(event) => setContractDraft((current) => ({ ...current, projectId: event.target.value || null }))}><option value="">Sem projeto específico</option>{projects.filter((project) => project.clientId === contractDraft.clientId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
            <label className="span-2">Título *<input required value={contractDraft.title} onChange={(event) => setContractDraft((current) => ({ ...current, title: event.target.value }))} /></label>
            <label>Valor<input type="number" min="0" step="0.01" value={contractDraft.amount} onChange={(event) => setContractDraft((current) => ({ ...current, amount: Number(event.target.value || 0) }))} /></label>
            <label>Emissão<input type="date" value={contractDraft.issueDate} onChange={(event) => setContractDraft((current) => ({ ...current, issueDate: event.target.value }))} /></label>
            <label>Validade<input type="date" value={contractDraft.validUntil || ""} onChange={(event) => setContractDraft((current) => ({ ...current, validUntil: event.target.value || null }))} /></label>
            <label className="span-2">Condições de pagamento<textarea value={contractDraft.paymentTerms} onChange={(event) => setContractDraft((current) => ({ ...current, paymentTerms: event.target.value }))} /></label>
            <label className="span-2">Escopo e entregas<textarea rows={5} value={contractDraft.scope} onChange={(event) => setContractDraft((current) => ({ ...current, scope: event.target.value }))} /></label>
          </div>
          <section className="contract-selector"><header><div><span>SERVIÇOS</span><h3>Selecione os itens incluídos</h3></div></header><div className="service-selector">{services.map((service) => <article className={contractDraft.selectedServiceIds.includes(service.id) ? "selected" : ""} key={service.id}><label><input type="checkbox" checked={contractDraft.selectedServiceIds.includes(service.id)} onChange={() => toggleService(service.id)} /><span><strong>{service.name}</strong><small>{service.description}</small></span></label>{contractDraft.selectedServiceIds.includes(service.id) && <input type="number" min="0" step="0.01" value={contractDraft.serviceAmounts[service.id] || 0} onChange={(event) => setContractDraft((current) => ({ ...current, serviceAmounts: { ...current.serviceAmounts, [service.id]: Number(event.target.value || 0) } }))} />}</article>)}</div></section>
          <section className="contract-selector"><header><div><span>CLÁUSULAS</span><h3>Condições do documento</h3></div></header><div className="clause-selector">{clauses.map((clause) => <label className={contractDraft.selectedClauseIds.includes(clause.id) ? "selected" : ""} key={clause.id}><input type="checkbox" checked={contractDraft.selectedClauseIds.includes(clause.id)} disabled={clause.required} onChange={() => toggleClause(clause.id)} /><span><strong>{clause.title}{clause.required ? " · obrigatória" : ""}</strong><small>{clause.body}</small></span></label>)}</div></section>
          <label className="document-notes">Observações opcionais<textarea rows={3} value={contractDraft.notes} onChange={(event) => setContractDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
          <footer><button type="button" className="business-secondary" onClick={() => setEditor(null)}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar documento"}</button></footer>
        </form>
      </section></div>}

      {share && <div className="business-modal-backdrop"><section className="business-modal share-modal"><header><div><span>LINK CRIADO</span><h2>Enviar para assinatura</h2></div><button type="button" onClick={() => setShare(null)}>×</button></header><div className="share-security"><strong>Envie em mensagens separadas</strong><p>Primeiro o link. Depois, envie o código de seis dígitos.</p></div><label>Link privado<div><input readOnly value={share.url} /><button type="button" onClick={() => void copy(share.url, "Link copiado.")}>Copiar</button></div></label><label>Código de acesso<div><input readOnly value={share.code} /><button type="button" onClick={() => void copy(share.code, "Código copiado.")}>Copiar</button></div></label><p>Expira em {new Date(share.expiresAt).toLocaleString("pt-BR")}.</p><footer><button type="button" className="business-secondary" onClick={() => void copy(`Olá! Segue o link privado para leitura e assinatura do contrato: ${share.url}\n\nPor segurança, enviarei o código de acesso em outra mensagem.`, "Mensagem copiada.")}>Copiar mensagem</button><button type="button" className="pro-primary" onClick={() => setShare(null)}>Concluir</button></footer></section></div>}

      {profileOpen && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="business-modal profile-editor"><header><div><span>EMITENTE</span><h2>{editingProfileId ? "Editar perfil" : "Novo perfil"}</h2></div><button type="button" onClick={() => setProfileOpen(false)}>×</button></header><form onSubmit={saveProfile}><div className="contract-form-grid"><label>Tipo<select value={profileDraft.profileType} onChange={(event) => setProfileDraft((current) => ({ ...current, profileType: event.target.value as "pf" | "pj", documentType: event.target.value === "pj" ? "cnpj" : "cpf" }))}><option value="pf">Pessoa física</option><option value="pj">Pessoa jurídica</option></select></label><label>Documento<select value={profileDraft.documentType} onChange={(event) => setProfileDraft((current) => ({ ...current, documentType: event.target.value as "cpf" | "cnpj" | "rg" }))}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="rg">RG</option></select></label><label className="span-2">Nome de exibição<input required value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))} /></label><label className="span-2">Nome/Razão social<input required value={profileDraft.legalName} onChange={(event) => setProfileDraft((current) => ({ ...current, legalName: event.target.value }))} /></label><label className="span-2">Nome fantasia<input value={profileDraft.tradeName} onChange={(event) => setProfileDraft((current) => ({ ...current, tradeName: event.target.value }))} /></label><label>Número do documento<input required value={profileDraft.documentNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, documentNumber: event.target.value }))} /></label><label>Chave Pix<input value={profileDraft.pixKey} onChange={(event) => setProfileDraft((current) => ({ ...current, pixKey: event.target.value }))} /></label><label>E-mail<input value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} /></label><label>WhatsApp<input value={profileDraft.whatsapp} onChange={(event) => setProfileDraft((current) => ({ ...current, whatsapp: event.target.value }))} /></label><label className="span-2">Endereço<input value={profileDraft.address} onChange={(event) => setProfileDraft((current) => ({ ...current, address: event.target.value }))} /></label><label>Número<input value={profileDraft.addressNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, addressNumber: event.target.value }))} /></label><label>Cidade<input value={profileDraft.city} onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))} /></label><label>Estado<input maxLength={2} value={profileDraft.state} onChange={(event) => setProfileDraft((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></label><label className="profile-default"><input type="checkbox" checked={profileDraft.isDefault} onChange={(event) => setProfileDraft((current) => ({ ...current, isDefault: event.target.checked }))} /><span>Usar automaticamente como perfil padrão</span></label></div><footer><button type="button" className="business-secondary" onClick={() => setProfileOpen(false)}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>Salvar perfil</button></footer></form></section></div>}
    </div>
  );
}
