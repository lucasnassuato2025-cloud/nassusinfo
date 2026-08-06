"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { PAYMENT_COLUMNS, Client, Payment, Project, mapPayment } from "@/lib/crm-pro";
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
  paymentSnapshot,
  projectSnapshot,
  randomCode,
  randomToken,
  rows,
  sha256,
  stableStringify,
} from "./contract-utils";
import { clientLabel, dateLabel, errorMessage, recordActivity, today } from "./shared";

type CenterTab = "documents" | "profiles" | "catalog";

type DocumentDraft = {
  documentType: DocumentType;
  number: string;
  title: string;
  status: DocumentStatus;
  clientId: string;
  clientDocumentType: "cpf" | "cnpj" | "rg";
  clientDocumentNumber: string;
  projectId: string | null;
  issuerProfileId: string | null;
  paymentId: string | null;
  issueDate: string;
  validUntil: string | null;
  amount: number;
  amountInWords: string;
  paymentTerms: string;
  scope: string;
  terms: string;
  notes: string;
  receiptType: string;
  selectedServiceIds: string[];
  serviceAmounts: Record<string, number>;
  selectedClauseIds: string[];
};

type ProfileDraft = Omit<BusinessProfile, "id">;
type ShareInfo = { documentId: string; url: string; code: string; expiresAt: string };

const DOCUMENT_COLUMNS = "id, client_id, project_id, issuer_profile_id, payment_id, document_type, number, title, status, issue_date, valid_until, amount, payment_terms, scope, terms, notes, service_items, clauses, client_snapshot, issuer_snapshot, receipt_type, amount_in_words, signature_status, current_version, sent_at, viewed_at, signed_at, document_hash, signed_hash, created_at, updated_at";
const PROFILE_COLUMNS = "id, profile_type, display_name, legal_name, trade_name, document_type, document_number, rg_number, state_registration, email, phone, whatsapp, address, address_number, complement, neighborhood, city, state, zip_code, pix_key, is_default, is_active";
const SERVICE_COLUMNS = "id, name, category, description, scope_template, base_price, default_days, active";
const CLAUSE_COLUMNS = "id, code, title, body, category, required, active, sort_order";
const LINK_COLUMNS = "id, document_id, document_version_id, status, expires_at, access_count, last_accessed_at, created_at";
const SIGNATURE_COLUMNS = "id, document_id, signer_name, signer_document_masked, signer_email, signer_phone, signature_method, signature_data, document_hash, evidence, signed_at";

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

function emptyDocument(client: Client | undefined, profile: BusinessProfile | undefined, type: DocumentType, clauses: ClauseTemplate[]): DocumentDraft {
  const requiredClauses = clauses.filter((item) => item.required).map((item) => item.id);
  return {
    documentType: type,
    number: defaultNumber(type),
    title: TYPE_LABELS[type],
    status: "rascunho",
    clientId: client?.id || "",
    clientDocumentType: client?.clientType === "empresa" ? "cnpj" : "cpf",
    clientDocumentNumber: client?.document || "",
    projectId: null,
    issuerProfileId: profile?.id || null,
    paymentId: null,
    issueDate: today(),
    validUntil: null,
    amount: 0,
    amountInWords: "",
    paymentTerms: type === "recibo" ? "Pagamento recebido e confirmado." : "50% na contratação e 50% antes da publicação ou entrega final.",
    scope: type === "recibo" ? "Recebimento referente aos serviços identificados neste documento." : "Descreva os serviços, entregas, páginas, integrações e limites incluídos.",
    terms: "Não há cláusula de eleição de foro neste modelo. As demais condições selecionadas abaixo integram o documento.",
    notes: "",
    receiptType: type === "recibo" ? "pagamento" : "",
    selectedServiceIds: [],
    serviceAmounts: {},
    selectedClauseIds: requiredClauses,
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

function snapshotFromStored(document: CommercialDocument): ContractSnapshot | null {
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
    },
    issuer: document.issuerSnapshot,
    client: document.clientSnapshot,
    project: null,
    payment: null,
    services: document.serviceItems,
    clauses: document.clauses,
  };
}

export function DocumentsModule({ clients, projects, userName: _userName }: { clients: Client[]; projects: Project[]; userName: string }) {
  const [tab, setTab] = useState<CenterTab>("documents");
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [profiles, setProfiles] = useState<BusinessProfile[]>([]);
  const [services, setServices] = useState<CatalogService[]>([]);
  const [clauses, setClauses] = useState<ClauseTemplate[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [links, setLinks] = useState<SigningLink[]>([]);
  const [signatures, setSignatures] = useState<DocumentSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DocumentDraft>(() => emptyDocument(clients[0], undefined, "contrato", []));
  const [profileOpen, setProfileOpen] = useState(false);
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileDraft>(emptyProfile);
  const [share, setShare] = useState<ShareInfo | null>(null);

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);
  const paymentMap = useMemo(() => new Map(payments.map((item) => [item.id, item])), [payments]);
  const profileMap = useMemo(() => new Map(profiles.map((item) => [item.id, item])), [profiles]);
  const linkMap = useMemo(() => new Map(links.map((item) => [item.documentId, item])), [links]);
  const signatureMap = useMemo(() => new Map(signatures.map((item) => [item.documentId, item])), [signatures]);

  async function loadAll() {
    setLoading(true);
    const [documentQuery, profileQuery, serviceQuery, clauseQuery, paymentQuery, linkQuery, signatureQuery] = await Promise.all([
      neonClient.from("commercial_documents").select(DOCUMENT_COLUMNS).order("updated_at", { ascending: false }),
      neonClient.from("business_profiles").select(PROFILE_COLUMNS).order("is_default", { ascending: false }).order("id", { ascending: true }),
      neonClient.from("service_catalog").select(SERVICE_COLUMNS).eq("active", true).order("category", { ascending: true }).order("name", { ascending: true }),
      neonClient.from("contract_clause_templates").select(CLAUSE_COLUMNS).eq("active", true).order("sort_order", { ascending: true }),
      neonClient.from("payments").select(PAYMENT_COLUMNS).order("updated_at", { ascending: false }),
      neonClient.from("document_signing_links").select(LINK_COLUMNS).order("created_at", { ascending: false }),
      neonClient.from("document_signatures").select(SIGNATURE_COLUMNS).order("signed_at", { ascending: false }),
    ]);
    const failure = documentQuery.error || profileQuery.error || serviceQuery.error || clauseQuery.error || paymentQuery.error || linkQuery.error || signatureQuery.error;
    if (failure) setNotice(failure.message || "Não foi possível carregar a central de documentos.");
    else {
      setDocuments(rows(documentQuery.data).map(mapCommercialDocument));
      setProfiles(rows(profileQuery.data).map(mapBusinessProfile));
      setServices(rows(serviceQuery.data).map(mapCatalogService));
      setClauses(rows(clauseQuery.data).map(mapClauseTemplate));
      setPayments(rows(paymentQuery.data).map(mapPayment));
      const latestLinks = rows(linkQuery.data).map(mapSigningLink).reduce<SigningLink[]>((result, item) => result.some((current) => current.documentId === item.documentId) ? result : [...result, item], []);
      setLinks(latestLinks);
      setSignatures(rows(signatureQuery.data).map(mapDocumentSignature));
    }
    setLoading(false);
  }

  useEffect(() => { void loadAll(); }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filtered = documents.filter((document) => [document.number, document.title, TYPE_LABELS[document.documentType], STATUS_LABELS[document.status], clientLabel(clientMap.get(document.clientId)), projectMap.get(document.projectId || "")?.name || ""].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  const signedDocuments = documents.filter((item) => item.status === "assinado");
  const pendingSignatures = links.filter((item) => ["active", "opened"].includes(item.status)).length;
  const receipts = documents.filter((item) => item.documentType === "recibo").length;

  function openNew(type: DocumentType) {
    const profile = profiles.find((item) => item.isDefault) || profiles[0];
    const value = emptyDocument(clients[0], profile, type, clauses);
    if (type === "recibo") {
      const paid = payments.find((item) => item.status === "pago");
      if (paid) {
        const client = clientMap.get(paid.clientId);
        value.clientId = paid.clientId;
        value.clientDocumentType = client?.clientType === "empresa" ? "cnpj" : "cpf";
        value.clientDocumentNumber = client?.document || "";
        value.projectId = paid.projectId;
        value.paymentId = paid.id;
        value.amount = paid.paidAmount || paid.totalAmount;
        value.scope = `Recebimento referente a ${paid.description || "serviços contratados"}.`;
      }
    }
    setEditingId(null);
    setDraft(value);
    setEditorOpen(true);
  }

  function openEdit(document: CommercialDocument) {
    const client = clientMap.get(document.clientId);
    setEditingId(document.id);
    setDraft({
      documentType: document.documentType,
      number: document.number,
      title: document.title,
      status: document.status,
      clientId: document.clientId,
      clientDocumentType: String(document.clientSnapshot.documentType || (client?.clientType === "empresa" ? "cnpj" : "cpf")) as "cpf" | "cnpj" | "rg",
      clientDocumentNumber: String(document.clientSnapshot.documentNumber || client?.document || ""),
      projectId: document.projectId,
      issuerProfileId: document.issuerProfileId,
      paymentId: document.paymentId,
      issueDate: document.issueDate,
      validUntil: document.validUntil,
      amount: document.amount,
      amountInWords: document.amountInWords,
      paymentTerms: document.paymentTerms,
      scope: document.scope,
      terms: document.terms,
      notes: document.notes,
      receiptType: document.receiptType,
      selectedServiceIds: document.serviceItems.map((item) => item.serviceId).filter(Boolean) as string[],
      serviceAmounts: Object.fromEntries(document.serviceItems.filter((item) => item.serviceId).map((item) => [item.serviceId as string, item.amount])),
      selectedClauseIds: document.clauses.map((item) => item.clauseId).filter(Boolean) as string[],
    });
    setEditorOpen(true);
  }

  function selectClient(clientId: string) {
    const client = clientMap.get(clientId);
    const firstProject = projects.find((item) => item.clientId === clientId);
    setDraft((current) => ({ ...current, clientId, clientDocumentType: client?.clientType === "empresa" ? "cnpj" : "cpf", clientDocumentNumber: client?.document || "", projectId: firstProject?.id || null }));
  }

  function selectPayment(paymentId: string) {
    const payment = paymentMap.get(paymentId);
    if (!payment) return setDraft((current) => ({ ...current, paymentId: null }));
    const client = clientMap.get(payment.clientId);
    setDraft((current) => ({ ...current, paymentId, clientId: payment.clientId, clientDocumentType: client?.clientType === "empresa" ? "cnpj" : "cpf", clientDocumentNumber: client?.document || "", projectId: payment.projectId, amount: payment.paidAmount || payment.totalAmount, scope: `Recebimento referente a ${payment.description || "serviços contratados"}.` }));
  }

  function toggleService(serviceId: string) {
    const service = services.find((item) => item.id === serviceId);
    setDraft((current) => {
      const selected = current.selectedServiceIds.includes(serviceId);
      return {
        ...current,
        selectedServiceIds: selected ? current.selectedServiceIds.filter((id) => id !== serviceId) : [...current.selectedServiceIds, serviceId],
        serviceAmounts: selected ? current.serviceAmounts : { ...current.serviceAmounts, [serviceId]: service?.basePrice || 0 },
        scope: !selected && service?.scopeTemplate && !current.scope.includes(service.scopeTemplate) ? `${current.scope}\n\n${service.scopeTemplate}`.trim() : current.scope,
      };
    });
  }

  function toggleClause(clauseId: string) {
    const clause = clauses.find((item) => item.id === clauseId);
    if (clause?.required) return;
    setDraft((current) => ({ ...current, selectedClauseIds: current.selectedClauseIds.includes(clauseId) ? current.selectedClauseIds.filter((id) => id !== clauseId) : [...current.selectedClauseIds, clauseId] }));
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const client = clientMap.get(draft.clientId);
    const profile = draft.issuerProfileId ? profileMap.get(draft.issuerProfileId) : undefined;
    if (!client || !profile || !draft.title.trim()) return setNotice("Selecione cliente, perfil do prestador e informe o título.");
    setSaving(true);
    setNotice("");
    try {
      const serviceItems: ServiceItem[] = draft.selectedServiceIds.map((id) => {
        const service = services.find((item) => item.id === id)!;
        return { serviceId: service.id, name: service.name, description: service.description || service.scopeTemplate, quantity: 1, amount: Number(draft.serviceAmounts[id] || 0) };
      });
      const clauseItems: ClauseItem[] = draft.selectedClauseIds.map((id) => {
        const clause = clauses.find((item) => item.id === id)!;
        return { clauseId: clause.id, code: clause.code, title: clause.title, body: clause.body };
      });
      const serviceTotal = serviceItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
      const amount = serviceTotal > 0 ? serviceTotal : Number(draft.amount || 0);
      const payload = {
        client_id: Number(client.id),
        project_id: draft.projectId ? Number(draft.projectId) : null,
        issuer_profile_id: Number(profile.id),
        payment_id: draft.paymentId ? Number(draft.paymentId) : null,
        document_type: draft.documentType,
        number: draft.number.trim() || defaultNumber(draft.documentType),
        title: draft.title.trim(),
        status: draft.status,
        issue_date: draft.issueDate,
        valid_until: draft.validUntil || null,
        amount,
        amount_in_words: draft.amountInWords.trim(),
        payment_terms: draft.paymentTerms.trim(),
        scope: draft.scope.trim(),
        terms: draft.terms.trim(),
        notes: draft.notes.trim(),
        service_items: serviceItems,
        clauses: clauseItems,
        client_snapshot: clientSnapshot(client, draft.clientDocumentType, draft.clientDocumentNumber),
        issuer_snapshot: businessProfileSnapshot(profile),
        receipt_type: draft.receiptType,
        signature_status: draft.documentType === "contrato" ? "not_required" : "not_required",
        updated_at: new Date().toISOString(),
      };
      const table = neonClient.from("commercial_documents") as any;
      const result = editingId ? await table.update(payload).eq("id", editingId).select(DOCUMENT_COLUMNS) : await table.insert(payload).select(DOCUMENT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível salvar o documento."));
      const saved = mapCommercialDocument(rows(result.data)[0] || result.data);
      setDocuments((current) => editingId ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setEditorOpen(false);
      void recordActivity({ clientId: saved.clientId, projectId: saved.projectId, type: editingId ? "documento_atualizado" : "documento_criado", title: `${TYPE_LABELS[saved.documentType]} ${editingId ? "atualizado" : "criado"}`, description: `${saved.number} · ${formatCurrency(saved.amount)}` });
      setNotice(editingId ? "Documento atualizado." : "Documento criado com sucesso.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Erro ao salvar o documento.");
    } finally {
      setSaving(false);
    }
  }

  async function generateSigningLink(document: CommercialDocument) {
    const client = clientMap.get(document.clientId);
    const profile = document.issuerProfileId ? profileMap.get(document.issuerProfileId) : undefined;
    if (!client || !profile) return setNotice("Complete os dados do cliente e do prestador antes de gerar o link.");
    const project = document.projectId ? projectMap.get(document.projectId) || null : null;
    const payment = document.paymentId ? paymentMap.get(document.paymentId) || null : null;
    setSaving(true);
    setNotice("");
    try {
      const previous = linkMap.get(document.id);
      if (previous && ["active", "opened"].includes(previous.status)) await (neonClient.from("document_signing_links") as any).update({ status: "revoked" }).eq("id", previous.id);
      const version = document.documentHash ? document.currentVersion + 1 : Math.max(1, document.currentVersion);
      const clientDocType = String(document.clientSnapshot.documentType || (client.clientType === "empresa" ? "cnpj" : "cpf"));
      const clientDocNumber = String(document.clientSnapshot.documentNumber || client.document || "");
      const snapshot = buildContractSnapshot({ document, issuer: profile, client, project, payment, clientDocumentType: clientDocType, clientDocumentNumber: clientDocNumber, services: document.serviceItems, clauses: document.clauses, amountInWords: document.amountInWords, version });
      const documentHash = await sha256(stableStringify(snapshot));
      const versionResult = await (neonClient.from("document_versions") as any).insert({ document_id: Number(document.id), version, snapshot, document_hash: documentHash }).select("id, version, document_hash");
      if (versionResult.error) throw new Error(errorMessage(versionResult.error, "Não foi possível congelar a versão do documento."));
      const versionId = String(rows(versionResult.data)[0]?.id || "");
      const token = randomToken();
      const code = randomCode();
      const [tokenHash, codeHash, expectedDocumentHash] = await Promise.all([sha256(token), sha256(code), clientDocNumber ? sha256(normalizeDocument(clientDocNumber)) : Promise.resolve("")]);
      const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
      const linkResult = await (neonClient.from("document_signing_links") as any).insert({ document_id: Number(document.id), document_version_id: Number(versionId), token_hash: tokenHash, access_code_hash: codeHash, expected_document_hash: expectedDocumentHash, status: "active", expires_at: expiresAt }).select(LINK_COLUMNS);
      if (linkResult.error) throw new Error(errorMessage(linkResult.error, "Não foi possível criar o link de assinatura."));
      const updatedResult = await (neonClient.from("commercial_documents") as any).update({ status: "enviado", signature_status: "pending", current_version: version, sent_at: new Date().toISOString(), document_hash: documentHash, client_snapshot: snapshot.client, issuer_snapshot: snapshot.issuer, updated_at: new Date().toISOString() }).eq("id", document.id).select(DOCUMENT_COLUMNS);
      if (updatedResult.error) throw new Error(errorMessage(updatedResult.error, "O link foi criado, mas o documento não foi atualizado."));
      const updated = mapCommercialDocument(rows(updatedResult.data)[0] || updatedResult.data);
      const link = mapSigningLink(rows(linkResult.data)[0] || linkResult.data);
      setDocuments((current) => current.map((item) => item.id === updated.id ? updated : item));
      setLinks((current) => [link, ...current.filter((item) => item.documentId !== document.id)]);
      setShare({ documentId: document.id, url: `${window.location.origin}/assinar/${token}`, code, expiresAt });
      void recordActivity({ clientId: document.clientId, projectId: document.projectId, type: "contrato_enviado", title: "Link de assinatura criado", description: `${document.number} · validade de 7 dias` });
      setNotice("Link privado criado. Envie o link e o código em mensagens separadas.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Erro ao gerar o link de assinatura.");
    } finally {
      setSaving(false);
    }
  }

  async function revokeLink(documentId: string) {
    const link = linkMap.get(documentId);
    if (!link) return;
    const result = await (neonClient.from("document_signing_links") as any).update({ status: "revoked" }).eq("id", link.id).select(LINK_COLUMNS);
    if (result.error) return setNotice(errorMessage(result.error, "Não foi possível revogar o link."));
    setLinks((current) => current.map((item) => item.id === link.id ? mapSigningLink(rows(result.data)[0] || result.data) : item));
    await (neonClient.from("commercial_documents") as any).update({ signature_status: "revoked" }).eq("id", documentId);
    setNotice("Link de assinatura revogado.");
  }

  async function printDocument(document: CommercialDocument) {
    try {
      const versionQuery = await neonClient.from("document_versions").select("snapshot, document_hash").eq("document_id", Number(document.id)).order("version", { ascending: false }).limit(1);
      const versionRow = rows(versionQuery.data)[0];
      let snapshot = versionRow?.snapshot as ContractSnapshot | undefined;
      if (!snapshot) snapshot = snapshotFromStored(document) || undefined;
      if (!snapshot) throw new Error("Salve os dados completos do documento antes de imprimir.");
      openDocumentPrint(snapshot, String(versionRow?.document_hash || document.documentHash || "RASCUNHO"), signatureMap.get(document.id));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Não foi possível gerar o PDF.");
    }
  }

  function openProfile(profile?: BusinessProfile) {
    if (profile) {
      const { id: _id, ...value } = profile;
      setEditingProfileId(profile.id);
      setProfileDraft(value);
    } else {
      setEditingProfileId(null);
      setProfileDraft(emptyProfile());
    }
    setProfileOpen(true);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profileDraft.displayName.trim() || !profileDraft.legalName.trim()) return setNotice("Informe o nome e a identificação do prestador.");
    setSaving(true);
    try {
      if (profileDraft.isDefault) await (neonClient.from("business_profiles") as any).update({ is_default: false });
      const table = neonClient.from("business_profiles") as any;
      const result = editingProfileId ? await table.update(profileRow(profileDraft)).eq("id", editingProfileId).select(PROFILE_COLUMNS) : await table.insert(profileRow(profileDraft)).select(PROFILE_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível salvar o perfil."));
      const saved = mapBusinessProfile(rows(result.data)[0] || result.data);
      setProfiles((current) => editingProfileId ? current.map((item) => item.id === saved.id ? saved : { ...item, isDefault: profileDraft.isDefault ? false : item.isDefault }) : [saved, ...current.map((item) => profileDraft.isDefault ? { ...item, isDefault: false } : item)]);
      setProfileOpen(false);
      setNotice("Perfil do prestador salvo.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Erro ao salvar perfil.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setNotice(message);
  }

  function renderDocuments() {
    return (
      <>
        <section className="document-kpis">
          <article><span>DOCUMENTOS</span><strong>{documents.length}</strong><small>Propostas, contratos e recibos</small></article>
          <article><span>AGUARDANDO ASSINATURA</span><strong>{pendingSignatures}</strong><small>Links ativos ou visualizados</small></article>
          <article><span>ASSINADOS</span><strong>{signedDocuments.length}</strong><small>Com trilha de auditoria</small></article>
          <article><span>RECIBOS</span><strong>{receipts}</strong><small>Incluindo geração automática</small></article>
        </section>
        <section className="pro-panel document-center-panel">
          <header className="document-toolbar"><div className="business-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento, cliente ou projeto" /></div><div><button type="button" className="business-secondary" onClick={() => openNew("recibo")}>+ Recibo</button><button type="button" className="business-secondary" onClick={() => openNew("proposta")}>+ Proposta</button><button type="button" className="pro-primary" onClick={() => openNew("contrato")}>+ Contrato</button></div></header>
          {loading ? <p className="business-muted">Carregando central de documentos...</p> : filtered.length ? <div className="document-cards">{filtered.map((document) => {
            const link = linkMap.get(document.id);
            const signature = signatureMap.get(document.id);
            const client = clientMap.get(document.clientId);
            const project = document.projectId ? projectMap.get(document.projectId) : null;
            return <article className="document-card-pro" key={document.id}><header><span className={`document-type type-${document.documentType}`}>{TYPE_LABELS[document.documentType]}</span><b className={`document-status status-${document.status}`}>{STATUS_LABELS[document.status]}</b></header><small>{document.number}</small><h3>{document.title}</h3><p>{clientLabel(client)}{project ? ` · ${project.name}` : ""}</p><dl><div><dt>Valor</dt><dd>{formatCurrency(document.amount)}</dd></div><div><dt>Emissão</dt><dd>{dateLabel(document.issueDate)}</dd></div><div><dt>Assinatura</dt><dd>{signature ? "Concluída" : link ? link.status : "Não enviada"}</dd></div></dl>{signature && <div className="document-signer"><span>ASSINADO POR</span><strong>{signature.signerName}</strong><small>{signature.signerDocumentMasked} · {new Date(signature.signedAt).toLocaleString("pt-BR")}</small></div>}<footer><button type="button" onClick={() => openEdit(document)} disabled={document.status === "assinado"}>Editar</button><button type="button" onClick={() => void printDocument(document)}>PDF</button>{document.documentType === "contrato" && document.status !== "assinado" && <button type="button" className="positive" disabled={saving} onClick={() => void generateSigningLink(document)}>{link && ["active", "opened"].includes(link.status) ? "Novo link" : "Gerar link"}</button>}{link && ["active", "opened"].includes(link.status) && <button type="button" className="danger" onClick={() => void revokeLink(document.id)}>Revogar</button>}</footer></article>;
          })}</div> : <div className="business-empty"><div>▤</div><h2>Nenhum documento encontrado</h2><p>Crie o primeiro contrato ou recibo vinculado a um cliente.</p><button type="button" className="pro-primary" onClick={() => openNew("contrato")}>Criar contrato</button></div>}
        </section>
      </>
    );
  }

  function renderProfiles() {
    return <section className="pro-panel document-settings-panel"><header><div><span>PERFIS DO PRESTADOR</span><h2>Lucas / Nassusinfo</h2><p>Escolha se cada documento será emitido como pessoa física ou jurídica.</p></div><button type="button" className="pro-primary" onClick={() => openProfile()}>+ Novo perfil</button></header><div className="profile-cards">{profiles.map((profile) => <article key={profile.id}><div><span className={`profile-kind profile-${profile.profileType}`}>{profile.profileType === "pf" ? "PESSOA FÍSICA" : "PESSOA JURÍDICA"}</span>{profile.isDefault && <b>PADRÃO</b>}</div><h3>{profile.displayName}</h3><p>{profile.tradeName || profile.legalName}</p><dl><div><dt>Documento</dt><dd>{profile.documentType.toUpperCase()} · {profile.documentNumber || "preencher"}</dd></div><div><dt>Local</dt><dd>{[profile.city, profile.state].filter(Boolean).join(" / ")}</dd></div><div><dt>Pix</dt><dd>{profile.pixKey || "não informado"}</dd></div></dl><button type="button" onClick={() => openProfile(profile)}>Editar dados</button></article>)}</div></section>;
  }

  function renderCatalog() {
    return <div className="document-catalog-grid"><section className="pro-panel document-settings-panel"><header><div><span>CATÁLOGO DE SERVIÇOS</span><h2>Serviços disponíveis</h2><p>Esses itens podem ser selecionados no contrato.</p></div></header><div className="catalog-list">{services.map((service) => <article key={service.id}><div><strong>{service.name}</strong><span>{service.category}</span></div><p>{service.description}</p><small>{service.defaultDays} dias sugeridos · base {formatCurrency(service.basePrice)}</small></article>)}</div></section><section className="pro-panel document-settings-panel"><header><div><span>BIBLIOTECA CONTRATUAL</span><h2>Cláusulas</h2><p>As cláusulas obrigatórias já entram selecionadas.</p></div></header><div className="clause-list">{clauses.map((clause) => <article key={clause.id}><div><strong>{clause.title}</strong>{clause.required && <span>OBRIGATÓRIA</span>}</div><p>{clause.body}</p></article>)}</div></section></div>;
  }

  return (
    <div className="documents-center">
      <nav className="document-tabs"><button type="button" className={tab === "documents" ? "active" : ""} onClick={() => setTab("documents")}>Documentos</button><button type="button" className={tab === "profiles" ? "active" : ""} onClick={() => setTab("profiles")}>Prestador PF/PJ</button><button type="button" className={tab === "catalog" ? "active" : ""} onClick={() => setTab("catalog")}>Serviços e cláusulas</button></nav>
      {notice && <div className="business-notice">{notice}</div>}
      {tab === "documents" ? renderDocuments() : tab === "profiles" ? renderProfiles() : renderCatalog()}

      {share && <div className="business-modal-backdrop"><section className="business-modal share-modal"><header><div><span>LINK CRIADO</span><h2>Enviar para assinatura</h2></div><button type="button" onClick={() => setShare(null)}>×</button></header><div className="share-security"><strong>Envie em mensagens separadas</strong><p>Primeiro o link. Depois, envie o código de seis dígitos.</p></div><label>Link privado<div><input readOnly value={share.url} /><button type="button" onClick={() => void copy(share.url, "Link copiado.")}>Copiar</button></div></label><label>Código de acesso<div><input readOnly value={share.code} /><button type="button" onClick={() => void copy(share.code, "Código copiado.")}>Copiar</button></div></label><p>Expira em {new Date(share.expiresAt).toLocaleString("pt-BR")}.</p><footer><button type="button" className="business-secondary" onClick={() => void copy(`Olá! Segue o link privado para leitura e assinatura do contrato: ${share.url}\n\nPor segurança, enviarei o código de acesso em outra mensagem.`, "Mensagem copiada.")}>Copiar mensagem</button><button type="button" className="pro-primary" onClick={() => setShare(null)}>Concluir</button></footer></section></div>}

      {editorOpen && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setEditorOpen(false); }}><section className="business-modal contract-editor"><header><div><span>GERADOR COMERCIAL</span><h2>{editingId ? "Editar documento" : `Novo ${TYPE_LABELS[draft.documentType].toLowerCase()}`}</h2></div><button type="button" onClick={() => setEditorOpen(false)}>×</button></header><form onSubmit={saveDocument}><div className="contract-form-grid"><label>Tipo<select value={draft.documentType} onChange={(event) => { const type = event.target.value as DocumentType; setDraft((current) => ({ ...current, documentType: type, number: defaultNumber(type), title: TYPE_LABELS[type] })); }}><option value="contrato">Contrato</option><option value="proposta">Proposta</option><option value="recibo">Recibo</option></select></label><label>Número<input value={draft.number} onChange={(event) => setDraft((current) => ({ ...current, number: event.target.value }))} /></label><label className="span-2">Prestador *<select required value={draft.issuerProfileId || ""} onChange={(event) => setDraft((current) => ({ ...current, issuerProfileId: event.target.value || null }))}><option value="">Selecione</option>{profiles.filter((item) => item.isActive).map((profile) => <option key={profile.id} value={profile.id}>{profile.profileType.toUpperCase()} · {profile.displayName}</option>)}</select></label><label className="span-2">Cliente *<select required value={draft.clientId} onChange={(event) => selectClient(event.target.value)}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientLabel(client)}</option>)}</select></label><label>Documento do cliente<select value={draft.clientDocumentType} onChange={(event) => setDraft((current) => ({ ...current, clientDocumentType: event.target.value as "cpf" | "cnpj" | "rg" }))}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="rg">RG</option></select></label><label>Número do documento<input required value={draft.clientDocumentNumber} onChange={(event) => setDraft((current) => ({ ...current, clientDocumentNumber: event.target.value }))} /></label><label className="span-2">Projeto<select value={draft.projectId || ""} onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value || null }))}><option value="">Sem projeto</option>{projects.filter((project) => project.clientId === draft.clientId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>{draft.documentType === "recibo" && <label className="span-2">Pagamento recebido<select value={draft.paymentId || ""} onChange={(event) => selectPayment(event.target.value)}><option value="">Recibo avulso</option>{payments.filter((payment) => payment.status === "pago").map((payment) => <option key={payment.id} value={payment.id}>{clientLabel(clientMap.get(payment.clientId))} · {payment.description} · {formatCurrency(payment.paidAmount || payment.totalAmount)}</option>)}</select></label>}<label className="span-2">Título<input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Situação<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as DocumentStatus }))}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Valor<input type="number" min="0" step="0.01" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value || 0) }))} /></label><label>Emissão<input type="date" value={draft.issueDate} onChange={(event) => setDraft((current) => ({ ...current, issueDate: event.target.value }))} /></label><label>Validade<input type="date" value={draft.validUntil || ""} onChange={(event) => setDraft((current) => ({ ...current, validUntil: event.target.value || null }))} /></label><label className="span-2">Valor por extenso<input value={draft.amountInWords} onChange={(event) => setDraft((current) => ({ ...current, amountInWords: event.target.value }))} placeholder="Ex.: um mil e quatrocentos reais" /></label></div><section className="contract-selector"><header><div><span>SERVIÇOS</span><h3>Selecione o que será contratado</h3></div></header><div className="service-selector">{services.map((service) => { const checked = draft.selectedServiceIds.includes(service.id); return <article className={checked ? "selected" : ""} key={service.id}><label><input type="checkbox" checked={checked} onChange={() => toggleService(service.id)} /><span><strong>{service.name}</strong><small>{service.description}</small></span></label>{checked && <input type="number" min="0" step="0.01" value={draft.serviceAmounts[service.id] || 0} onChange={(event) => setDraft((current) => ({ ...current, serviceAmounts: { ...current.serviceAmounts, [service.id]: Number(event.target.value || 0) } }))} />}</article>; })}</div></section><section className="contract-selector"><header><div><span>CLÁUSULAS</span><h3>Condições do contrato</h3></div></header><div className="clause-selector">{clauses.map((clause) => <label className={draft.selectedClauseIds.includes(clause.id) ? "selected" : ""} key={clause.id}><input type="checkbox" checked={draft.selectedClauseIds.includes(clause.id)} disabled={clause.required} onChange={() => toggleClause(clause.id)} /><span><strong>{clause.title}{clause.required ? " · obrigatória" : ""}</strong><small>{clause.body}</small></span></label>)}</div></section><div className="contract-form-grid"><label className="span-2">Escopo e entregas<textarea rows={7} value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))} /></label><label className="span-2">Condições de pagamento<textarea rows={4} value={draft.paymentTerms} onChange={(event) => setDraft((current) => ({ ...current, paymentTerms: event.target.value }))} /></label><label className="span-2">Condições complementares<textarea rows={4} value={draft.terms} onChange={(event) => setDraft((current) => ({ ...current, terms: event.target.value }))} /></label><label className="span-2">Observações<textarea rows={3} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div><footer><button type="button" className="business-secondary" onClick={() => setEditorOpen(false)}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar documento"}</button></footer></form></section></div>}

      {profileOpen && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileOpen(false); }}><section className="business-modal profile-editor"><header><div><span>PRESTADOR</span><h2>{editingProfileId ? "Editar perfil" : "Novo perfil"}</h2></div><button type="button" onClick={() => setProfileOpen(false)}>×</button></header><form onSubmit={saveProfile}><div className="contract-form-grid"><label>Tipo<select value={profileDraft.profileType} onChange={(event) => setProfileDraft((current) => ({ ...current, profileType: event.target.value as "pf" | "pj", documentType: event.target.value === "pj" ? "cnpj" : "cpf" }))}><option value="pf">Pessoa física</option><option value="pj">Pessoa jurídica</option></select></label><label>Documento<select value={profileDraft.documentType} onChange={(event) => setProfileDraft((current) => ({ ...current, documentType: event.target.value as "cpf" | "cnpj" | "rg" }))}><option value="cpf">CPF</option><option value="cnpj">CNPJ</option><option value="rg">RG</option></select></label><label className="span-2">Nome de exibição<input required value={profileDraft.displayName} onChange={(event) => setProfileDraft((current) => ({ ...current, displayName: event.target.value }))} /></label><label className="span-2">Nome completo / razão social<input required value={profileDraft.legalName} onChange={(event) => setProfileDraft((current) => ({ ...current, legalName: event.target.value }))} /></label><label className="span-2">Nome comercial<input value={profileDraft.tradeName} onChange={(event) => setProfileDraft((current) => ({ ...current, tradeName: event.target.value }))} /></label><label>Número do documento<input value={profileDraft.documentNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, documentNumber: event.target.value }))} /></label><label>RG complementar<input value={profileDraft.rgNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, rgNumber: event.target.value }))} /></label><label>E-mail<input type="email" value={profileDraft.email} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} /></label><label>WhatsApp<input value={profileDraft.whatsapp} onChange={(event) => setProfileDraft((current) => ({ ...current, whatsapp: event.target.value }))} /></label><label className="span-2">Endereço<input value={profileDraft.address} onChange={(event) => setProfileDraft((current) => ({ ...current, address: event.target.value }))} /></label><label>Número<input value={profileDraft.addressNumber} onChange={(event) => setProfileDraft((current) => ({ ...current, addressNumber: event.target.value }))} /></label><label>Bairro<input value={profileDraft.neighborhood} onChange={(event) => setProfileDraft((current) => ({ ...current, neighborhood: event.target.value }))} /></label><label>Cidade<input value={profileDraft.city} onChange={(event) => setProfileDraft((current) => ({ ...current, city: event.target.value }))} /></label><label>Estado<input maxLength={2} value={profileDraft.state} onChange={(event) => setProfileDraft((current) => ({ ...current, state: event.target.value }))} /></label><label className="span-2">Chave Pix<input value={profileDraft.pixKey} onChange={(event) => setProfileDraft((current) => ({ ...current, pixKey: event.target.value }))} /></label><label className="check-line"><input type="checkbox" checked={profileDraft.isDefault} onChange={(event) => setProfileDraft((current) => ({ ...current, isDefault: event.target.checked }))} /><span>Usar como perfil padrão</span></label><label className="check-line"><input type="checkbox" checked={profileDraft.isActive} onChange={(event) => setProfileDraft((current) => ({ ...current, isActive: event.target.checked }))} /><span>Perfil ativo</span></label></div><footer><button type="button" className="business-secondary" onClick={() => setProfileOpen(false)}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar perfil"}</button></footer></form></section></div>}
    </div>
  );
}
