"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Client, Project } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { clientLabel, compactCurrency, dateLabel, errorMessage, recordActivity, rows, text, today } from "./shared";

type DocumentType = "proposta" | "contrato" | "recibo";
type DocumentStatus = "rascunho" | "enviado" | "aceito" | "assinado" | "cancelado";

type CommercialDocument = {
  id: string;
  clientId: string;
  projectId: string | null;
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
  createdAt: string;
  updatedAt: string;
};

type DocumentDraft = Omit<CommercialDocument, "id" | "createdAt" | "updatedAt">;

type Props = {
  clients: Client[];
  projects: Project[];
  userName: string;
};

const DOCUMENT_COLUMNS = "id, client_id, project_id, document_type, number, title, status, issue_date, valid_until, amount, payment_terms, scope, terms, notes, created_at, updated_at";

const TYPE_LABELS: Record<DocumentType, string> = {
  proposta: "Proposta comercial",
  contrato: "Contrato de prestação de serviços",
  recibo: "Recibo de pagamento",
};

const STATUS_LABELS: Record<DocumentStatus, string> = {
  rascunho: "Rascunho",
  enviado: "Enviado",
  aceito: "Aceito",
  assinado: "Assinado",
  cancelado: "Cancelado",
};

function dateOnly(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString().slice(0, 10);
}

function mapDocument(row: Record<string, unknown>): CommercialDocument {
  return {
    id: text(row.id),
    clientId: text(row.client_id),
    projectId: row.project_id == null ? null : text(row.project_id),
    documentType: text(row.document_type || "proposta") as DocumentType,
    number: text(row.number),
    title: text(row.title),
    status: text(row.status || "rascunho") as DocumentStatus,
    issueDate: dateOnly(row.issue_date) || today(),
    validUntil: dateOnly(row.valid_until),
    amount: Number(row.amount || 0),
    paymentTerms: text(row.payment_terms),
    scope: text(row.scope),
    terms: text(row.terms),
    notes: text(row.notes),
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function defaultNumber(): string {
  const year = new Date().getFullYear();
  return `NS-${year}-${String(Date.now()).slice(-6)}`;
}

function emptyDraft(clientId = "", projectId: string | null = null): DocumentDraft {
  return {
    clientId,
    projectId,
    documentType: "proposta",
    number: defaultNumber(),
    title: TYPE_LABELS.proposta,
    status: "rascunho",
    issueDate: today(),
    validUntil: null,
    amount: 0,
    paymentTerms: "50% na aprovação e 50% na entrega, via Pix ou cartão.",
    scope: "Descreva aqui os serviços, páginas, integrações e entregas incluídas.",
    terms: "O prazo começa após o envio de todos os materiais necessários pelo cliente. Alterações fora do escopo poderão ser orçadas separadamente.",
    notes: "",
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function paragraphs(value: string): string {
  return escapeHtml(value)
    .split(/\n+/)
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

export function DocumentsModule({ clients, projects, userName }: Props) {
  const [documents, setDocuments] = useState<CommercialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DocumentDraft>(() => emptyDraft(clients[0]?.id || ""));

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  useEffect(() => {
    let active = true;
    async function loadDocuments() {
      setLoading(true);
      const query = await neonClient
        .from("commercial_documents")
        .select(DOCUMENT_COLUMNS)
        .order("updated_at", { ascending: false })
        .order("id", { ascending: false });
      if (!active) return;
      if (query.error) setNotice(query.error.message || "Não foi possível carregar os documentos.");
      else setDocuments(rows(query.data).map(mapDocument));
      setLoading(false);
    }
    void loadDocuments();
    return () => {
      active = false;
    };
  }, []);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredDocuments = documents.filter((document) => {
    const client = clientMap.get(document.clientId);
    const project = document.projectId ? projectMap.get(document.projectId) : null;
    return [document.number, document.title, TYPE_LABELS[document.documentType], STATUS_LABELS[document.status], clientLabel(client), project?.name || ""]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(normalizedSearch);
  });

  const totalProposals = documents.filter((document) => document.documentType === "proposta").length;
  const accepted = documents.filter((document) => ["aceito", "assinado"].includes(document.status)).length;
  const signedValue = documents.filter((document) => ["aceito", "assinado"].includes(document.status)).reduce((sum, document) => sum + document.amount, 0);

  function openNew(type: DocumentType = "proposta") {
    const firstClient = clients[0];
    const clientProjects = projects.filter((project) => project.clientId === firstClient?.id);
    const project = clientProjects[0];
    setEditingId(null);
    setDraft({
      ...emptyDraft(firstClient?.id || "", project?.id || null),
      documentType: type,
      title: TYPE_LABELS[type],
      amount: project?.totalValue || 0,
      scope: project?.description || project?.serviceType || emptyDraft().scope,
      paymentTerms: type === "recibo" ? "Pagamento recebido conforme identificação acima." : emptyDraft().paymentTerms,
    });
    setFormOpen(true);
  }

  function openEdit(document: CommercialDocument) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...value } = document;
    setEditingId(document.id);
    setDraft(value);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function selectClient(clientId: string) {
    const firstProject = projects.find((project) => project.clientId === clientId);
    setDraft((current) => ({
      ...current,
      clientId,
      projectId: firstProject?.id || null,
      amount: current.amount || firstProject?.totalValue || 0,
      scope: current.scope === emptyDraft().scope && firstProject ? (firstProject.description || firstProject.serviceType) : current.scope,
    }));
  }

  function selectProject(projectId: string) {
    const project = projects.find((item) => item.id === projectId);
    setDraft((current) => ({
      ...current,
      projectId: projectId || null,
      amount: project?.totalValue || current.amount,
      scope: project ? (project.description || project.serviceType) : current.scope,
    }));
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.clientId || !draft.title.trim()) {
      setNotice("Selecione o cliente e informe o título do documento.");
      return;
    }
    setSaving(true);
    setNotice("");
    const payload = {
      client_id: Number(draft.clientId),
      project_id: draft.projectId ? Number(draft.projectId) : null,
      document_type: draft.documentType,
      number: draft.number.trim() || defaultNumber(),
      title: draft.title.trim(),
      status: draft.status,
      issue_date: draft.issueDate,
      valid_until: draft.validUntil || null,
      amount: Math.max(0, Number(draft.amount || 0)),
      payment_terms: draft.paymentTerms.trim(),
      scope: draft.scope.trim(),
      terms: draft.terms.trim(),
      notes: draft.notes.trim(),
      updated_at: new Date().toISOString(),
    };
    try {
      const table = neonClient.from("commercial_documents") as any;
      const result = editingId
        ? await table.update(payload).eq("id", editingId).select(DOCUMENT_COLUMNS)
        : await table.insert(payload).select(DOCUMENT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível salvar o documento."));
      const saved = mapDocument(rows(result.data)[0] || result.data);
      setDocuments((current) => editingId ? current.map((document) => document.id === editingId ? saved : document) : [saved, ...current]);
      void recordActivity({
        clientId: saved.clientId,
        projectId: saved.projectId,
        type: editingId ? "documento_atualizado" : "documento_criado",
        title: editingId ? "Documento comercial atualizado" : "Documento comercial criado",
        description: `${TYPE_LABELS[saved.documentType]} ${saved.number} · ${compactCurrency.format(saved.amount)}`,
      });
      closeForm();
      setNotice(editingId ? "Documento atualizado." : "Documento criado com sucesso.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Erro ao salvar o documento.");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(document: CommercialDocument, status: DocumentStatus) {
    const result = await (neonClient.from("commercial_documents") as any)
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", document.id)
      .select(DOCUMENT_COLUMNS);
    if (result.error) {
      setNotice(errorMessage(result.error, "Não foi possível atualizar o documento."));
      return;
    }
    const saved = mapDocument(rows(result.data)[0] || result.data);
    setDocuments((current) => current.map((item) => item.id === document.id ? saved : item));
    void recordActivity({ clientId: saved.clientId, projectId: saved.projectId, type: "status_documento", title: `${TYPE_LABELS[saved.documentType]} ${STATUS_LABELS[status].toLowerCase()}`, description: `${saved.number} · ${compactCurrency.format(saved.amount)}` });
    setNotice(`Documento marcado como ${STATUS_LABELS[status].toLowerCase()}.`);
  }

  function printDocument(document: CommercialDocument) {
    const client = clientMap.get(document.clientId);
    const project = document.projectId ? projectMap.get(document.projectId) : null;
    if (!client) return setNotice("O cliente deste documento não foi encontrado.");
    const popup = window.open("", "_blank", "width=960,height=760");
    if (!popup) return setNotice("O navegador bloqueou a janela de impressão. Libere os pop-ups e tente novamente.");

    const clientAddress = [client.address, client.addressNumber, client.neighborhood, client.city, client.state].filter(Boolean).join(", ");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title><style>
      @page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:14px/1.55 Arial,sans-serif;background:#fff}.page{max-width:780px;margin:0 auto}.head{display:flex;justify-content:space-between;gap:30px;padding-bottom:22px;border-bottom:3px solid #1d63ff}.brand{display:flex;align-items:center;gap:12px}.mark{width:48px;height:48px;border-radius:14px;background:linear-gradient(145deg,#09152d,#1d63ff);display:grid;place-items:center;color:#fff;font-weight:900;font-size:20px}.brand strong{display:block;font-size:19px}.brand small{color:#647087}.doc-meta{text-align:right}.doc-meta b{display:block;font-size:12px;color:#1d63ff;letter-spacing:.12em}.doc-meta strong{display:block;font-size:20px;margin:4px 0}.doc-meta span{color:#647087}.title{padding:32px 0 18px}.title span{font-size:11px;font-weight:800;letter-spacing:.14em;color:#1d63ff}.title h1{font-size:28px;line-height:1.15;margin:8px 0}.parties{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:0 0 24px}.box{border:1px solid #dbe2ef;border-radius:12px;padding:16px}.box span{font-size:10px;font-weight:800;letter-spacing:.12em;color:#69758a}.box strong{display:block;margin:5px 0;font-size:16px}.box p{margin:2px 0;color:#4d586d}.value{display:flex;justify-content:space-between;align-items:center;background:#eff5ff;border:1px solid #cbdcff;border-radius:14px;padding:17px 20px;margin:18px 0 24px}.value span{font-weight:700;color:#4d586d}.value strong{font-size:24px;color:#0a3d9c}.section{margin:24px 0}.section h2{font-size:15px;border-bottom:1px solid #dbe2ef;padding-bottom:8px}.section p{white-space:pre-wrap;margin:8px 0;color:#344056}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:70px}.signature{border-top:1px solid #657086;padding-top:8px;text-align:center}.footer{margin-top:46px;border-top:1px solid #dbe2ef;padding-top:14px;text-align:center;color:#7a8496;font-size:11px}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body><main class="page"><header class="head"><div class="brand"><div class="mark">NS</div><div><strong>Nassusinfo</strong><small>Soluções Tecnológicas</small></div></div><div class="doc-meta"><b>${escapeHtml(TYPE_LABELS[document.documentType].toUpperCase())}</b><strong>${escapeHtml(document.number)}</strong><span>Emissão: ${escapeHtml(dateLabel(document.issueDate))}${document.validUntil ? `<br>Validade: ${escapeHtml(dateLabel(document.validUntil))}` : ""}</span></div></header><section class="title"><span>DOCUMENTO COMERCIAL</span><h1>${escapeHtml(document.title)}</h1></section><section class="parties"><div class="box"><span>CONTRATADA</span><strong>Nassusinfo Soluções Tecnológicas</strong><p>Responsável: ${escapeHtml(userName)}</p><p>Guarujá – SP</p></div><div class="box"><span>CLIENTE</span><strong>${escapeHtml(clientLabel(client))}</strong><p>Responsável: ${escapeHtml(client.name)}</p><p>${escapeHtml(client.document || "CPF/CNPJ não informado")}</p><p>${escapeHtml(clientAddress || "Endereço não informado")}</p></div></section>${project ? `<section class="box"><span>PROJETO VINCULADO</span><strong>${escapeHtml(project.name)}</strong><p>${escapeHtml(project.serviceType)}</p></section>` : ""}<section class="value"><span>Valor do documento</span><strong>${escapeHtml(compactCurrency.format(document.amount))}</strong></section><section class="section"><h2>Escopo e entregas</h2>${paragraphs(document.scope)}</section><section class="section"><h2>Forma e condições de pagamento</h2>${paragraphs(document.paymentTerms)}</section><section class="section"><h2>Condições gerais</h2>${paragraphs(document.terms)}</section>${document.notes ? `<section class="section"><h2>Observações</h2>${paragraphs(document.notes)}</section>` : ""}<section class="signatures"><div class="signature">${escapeHtml(userName)}<br>Nassusinfo</div><div class="signature">${escapeHtml(client.name)}<br>Cliente</div></section><footer class="footer">Documento gerado pelo Nassus CRM Pro · ${escapeHtml(TYPE_LABELS[document.documentType])}</footer></main><script>window.onload=()=>setTimeout(()=>window.print(),300)<\/script></body></html>`);
    popup.document.close();
  }

  return (
    <div className="documents-module">
      <section className="business-metrics documents-metrics">
        <article><span>DOCUMENTOS</span><strong>{documents.length}</strong><small>Total registrado</small></article>
        <article><span>PROPOSTAS</span><strong>{totalProposals}</strong><small>Comerciais emitidas</small></article>
        <article><span>ACEITOS</span><strong>{accepted}</strong><small>Aceitos ou assinados</small></article>
        <article><span>VALOR APROVADO</span><strong>{compactCurrency.format(signedValue)}</strong><small>Documentos confirmados</small></article>
      </section>

      {notice && <div className="business-notice">{notice}</div>}

      <section className="pro-panel documents-panel">
        <header className="documents-toolbar">
          <div className="business-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar número, cliente, projeto ou situação" /></div>
          <div><button type="button" className="business-secondary" onClick={() => openNew("recibo")}>+ Recibo</button><button type="button" className="business-secondary" onClick={() => openNew("contrato")}>+ Contrato</button><button type="button" className="pro-primary" onClick={() => openNew("proposta")}>+ Proposta</button></div>
        </header>

        {loading ? <p className="business-muted">Carregando documentos...</p> : filteredDocuments.length ? (
          <div className="documents-grid">
            {filteredDocuments.map((document) => {
              const client = clientMap.get(document.clientId);
              const project = document.projectId ? projectMap.get(document.projectId) : null;
              return (
                <article className="document-card" key={document.id}>
                  <header><span className={`document-type type-${document.documentType}`}>{TYPE_LABELS[document.documentType]}</span><b className={`document-status status-${document.status}`}>{STATUS_LABELS[document.status]}</b></header>
                  <small>{document.number}</small>
                  <h3>{document.title}</h3>
                  <p>{clientLabel(client)}{project ? ` · ${project.name}` : ""}</p>
                  <dl><div><dt>Valor</dt><dd>{compactCurrency.format(document.amount)}</dd></div><div><dt>Emissão</dt><dd>{dateLabel(document.issueDate)}</dd></div><div><dt>Validade</dt><dd>{dateLabel(document.validUntil)}</dd></div></dl>
                  <footer><button type="button" onClick={() => openEdit(document)}>Editar</button><button type="button" onClick={() => printDocument(document)}>Imprimir / PDF</button>{document.status === "rascunho" && <button type="button" onClick={() => updateStatus(document, "enviado")}>Marcar enviado</button>}{document.status === "enviado" && <button type="button" className="positive" onClick={() => updateStatus(document, document.documentType === "contrato" ? "assinado" : "aceito")}>{document.documentType === "contrato" ? "Assinado" : "Aceito"}</button>}</footer>
                </article>
              );
            })}
          </div>
        ) : <section className="business-empty"><div>▤</div><h2>Nenhum documento encontrado</h2><p>Crie propostas, contratos e recibos vinculados aos seus clientes.</p><button type="button" className="pro-primary" onClick={() => openNew("proposta")}>Criar proposta</button></section>}
      </section>

      {formOpen && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeForm(); }}><section className="business-modal"><header><div><span>DOCUMENTO COMERCIAL</span><h2>{editingId ? "Editar documento" : `Nova ${TYPE_LABELS[draft.documentType].toLowerCase()}`}</h2></div><button type="button" onClick={closeForm}>×</button></header><form onSubmit={saveDocument}>
        <div className="business-form-grid"><label>Tipo<select value={draft.documentType} onChange={(event) => { const documentType = event.target.value as DocumentType; setDraft((current) => ({ ...current, documentType, title: TYPE_LABELS[documentType], paymentTerms: documentType === "recibo" ? "Pagamento recebido conforme identificação acima." : current.paymentTerms })); }}><option value="proposta">Proposta comercial</option><option value="contrato">Contrato de serviços</option><option value="recibo">Recibo</option></select></label><label>Número<input value={draft.number} onChange={(event) => setDraft((current) => ({ ...current, number: event.target.value }))} /></label><label className="span-2">Cliente *<select required value={draft.clientId} onChange={(event) => selectClient(event.target.value)}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientLabel(client)}</option>)}</select></label><label className="span-2">Projeto<select value={draft.projectId || ""} onChange={(event) => selectProject(event.target.value)}><option value="">Sem projeto específico</option>{projects.filter((project) => project.clientId === draft.clientId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="span-2">Título *<input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Situação<select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as DocumentStatus }))}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Valor<input type="number" min="0" value={draft.amount} onChange={(event) => setDraft((current) => ({ ...current, amount: Number(event.target.value || 0) }))} /></label><label>Data de emissão<input type="date" value={draft.issueDate} onChange={(event) => setDraft((current) => ({ ...current, issueDate: event.target.value }))} /></label><label>Validade<input type="date" value={draft.validUntil || ""} onChange={(event) => setDraft((current) => ({ ...current, validUntil: event.target.value || null }))} /></label><label className="span-2">Escopo e entregas<textarea rows={5} value={draft.scope} onChange={(event) => setDraft((current) => ({ ...current, scope: event.target.value }))} /></label><label className="span-2">Condições de pagamento<textarea rows={3} value={draft.paymentTerms} onChange={(event) => setDraft((current) => ({ ...current, paymentTerms: event.target.value }))} /></label><label className="span-2">Condições gerais<textarea rows={4} value={draft.terms} onChange={(event) => setDraft((current) => ({ ...current, terms: event.target.value }))} /></label><label className="span-2">Observações<textarea rows={3} value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div>
        <footer><button type="button" className="business-secondary" onClick={closeForm}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar documento"}</button></footer>
      </form></section></div>}
    </div>
  );
}
