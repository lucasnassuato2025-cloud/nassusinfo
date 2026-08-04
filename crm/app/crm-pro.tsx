"use client";

import { FormEvent, useMemo, useState } from "react";

import {
  AUDIT_COLUMNS,
  CLIENT_COLUMNS,
  PAYMENT_COLUMNS,
  PROJECT_COLUMNS,
  Client,
  ClientLifecycle,
  ClientType,
  LeadStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Project,
  ProjectStatus,
  SiteAudit,
  SiteAuditReport,
  mapClient,
  mapPayment,
  mapProject,
  mapSiteAudit,
} from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";

type Props = {
  initialClients: Client[];
  initialProjects: Project[];
  initialPayments: Payment[];
  initialAudits: SiteAudit[];
  user: { name: string; email: string };
};

type ModuleId = "dashboard" | "leads" | "clients" | "projects" | "finance" | "ai";
type ModalId = "client" | "project" | "payment" | null;

type ClientDraft = Omit<Client, "id" | "createdAt" | "updatedAt">;
type ProjectDraft = Omit<Project, "id" | "createdAt" | "updatedAt">;
type PaymentDraft = Omit<Payment, "id" | "createdAt" | "updatedAt">;

const LEAD_LABELS: Record<LeadStatus, string> = {
  novo: "Novo contato",
  contato: "Em contato",
  proposta: "Proposta enviada",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const PROJECT_LABELS: Record<ProjectStatus, string> = {
  planejamento: "Planejamento",
  aguardando_material: "Aguardando material",
  desenvolvimento: "Em desenvolvimento",
  revisao: "Revisão do cliente",
  ajustes: "Ajustes",
  publicado: "Publicado",
  finalizado: "Finalizado",
  manutencao: "Manutenção",
};

const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pendente: "Pendente",
  pago: "Pago",
  atrasado: "Atrasado",
  cancelado: "Cancelado",
};

const PAYMENT_METHODS: Record<PaymentMethod, string> = {
  pix: "Pix",
  credito: "Cartão de crédito",
  debito: "Cartão de débito",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  transferencia: "Transferência",
};

const MODULES: Array<{ id: ModuleId; label: string; icon: string; eyebrow: string }> = [
  { id: "dashboard", label: "Visão geral", icon: "⌂", eyebrow: "Central de comando" },
  { id: "leads", label: "Leads", icon: "◎", eyebrow: "Funil comercial" },
  { id: "clients", label: "Clientes", icon: "◉", eyebrow: "Carteira ativa" },
  { id: "projects", label: "Projetos", icon: "◇", eyebrow: "Produção e entregas" },
  { id: "finance", label: "Financeiro", icon: "R$", eyebrow: "Receitas e cobranças" },
  { id: "ai", label: "Sites & IA", icon: "✦", eyebrow: "Auditoria inteligente" },
];

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function dateLabel(value: string | null): string {
  if (!value) return "—";
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function clientEmpty(): ClientDraft {
  return {
    lifecycle: "lead",
    clientType: "empresa",
    name: "",
    company: "",
    document: "",
    legalName: "",
    tradeName: "",
    stateRegistration: "",
    segment: "",
    phone: "",
    whatsapp: "",
    email: "",
    instagram: "",
    website: "",
    address: "",
    addressNumber: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    source: "",
    tags: "",
    status: "novo",
    estimatedValue: 0,
    nextAction: "",
    nextActionDate: null,
    notes: "",
  };
}

function projectEmpty(clientId = ""): ProjectDraft {
  return {
    clientId,
    name: "",
    serviceType: "Site institucional",
    status: "planejamento",
    progress: 10,
    totalValue: 0,
    startDate: today(),
    dueDate: null,
    deliveryDate: null,
    websiteUrl: "",
    domain: "",
    hosting: "Vercel",
    domainRenewalDate: null,
    hostingRenewalDate: null,
    maintenanceEnabled: false,
    maintenanceValue: 0,
    description: "",
    notes: "",
  };
}

function paymentEmpty(clientId = "", projectId: string | null = null): PaymentDraft {
  return {
    clientId,
    projectId,
    description: "Pagamento de projeto",
    totalAmount: 0,
    paidAmount: 0,
    method: "pix",
    installments: 1,
    dueDate: today(),
    paidAt: null,
    status: "pendente",
    notes: "",
  };
}

function clientRow(draft: ClientDraft) {
  return {
    lifecycle: draft.lifecycle,
    client_type: draft.clientType,
    name: draft.name.trim(),
    company: draft.company.trim(),
    document: draft.document.trim(),
    legal_name: draft.legalName.trim(),
    trade_name: draft.tradeName.trim(),
    state_registration: draft.stateRegistration.trim(),
    segment: draft.segment.trim(),
    phone: draft.phone.trim(),
    whatsapp: draft.whatsapp.trim(),
    email: draft.email.trim(),
    instagram: draft.instagram.trim(),
    website: draft.website.trim(),
    address: draft.address.trim(),
    address_number: draft.addressNumber.trim(),
    complement: draft.complement.trim(),
    neighborhood: draft.neighborhood.trim(),
    city: draft.city.trim(),
    state: draft.state.trim().toUpperCase().slice(0, 2),
    zip_code: draft.zipCode.trim(),
    source: draft.source.trim(),
    tags: draft.tags.trim(),
    status: draft.status,
    estimated_value: Math.max(0, Number(draft.estimatedValue || 0)),
    next_action: draft.nextAction.trim(),
    next_action_date: draft.nextActionDate || null,
    notes: draft.notes.trim(),
    updated_at: new Date().toISOString(),
  };
}

function projectRow(draft: ProjectDraft) {
  return {
    client_id: Number(draft.clientId),
    name: draft.name.trim(),
    service_type: draft.serviceType.trim(),
    status: draft.status,
    progress: Math.max(0, Math.min(100, Number(draft.progress || 0))),
    total_value: Math.max(0, Number(draft.totalValue || 0)),
    start_date: draft.startDate || null,
    due_date: draft.dueDate || null,
    delivery_date: draft.deliveryDate || null,
    website_url: draft.websiteUrl.trim(),
    domain: draft.domain.trim(),
    hosting: draft.hosting.trim(),
    domain_renewal_date: draft.domainRenewalDate || null,
    hosting_renewal_date: draft.hostingRenewalDate || null,
    maintenance_enabled: draft.maintenanceEnabled,
    maintenance_value: Math.max(0, Number(draft.maintenanceValue || 0)),
    description: draft.description.trim(),
    notes: draft.notes.trim(),
    updated_at: new Date().toISOString(),
  };
}

function paymentRow(draft: PaymentDraft) {
  return {
    client_id: Number(draft.clientId),
    project_id: draft.projectId ? Number(draft.projectId) : null,
    description: draft.description.trim(),
    total_amount: Math.max(0, Number(draft.totalAmount || 0)),
    paid_amount: Math.max(0, Number(draft.paidAmount || 0)),
    method: draft.method,
    installments: Math.max(1, Math.min(12, Number(draft.installments || 1))),
    due_date: draft.dueDate || null,
    paid_at: draft.paidAt || null,
    status: draft.status,
    notes: draft.notes.trim(),
    updated_at: new Date().toISOString(),
  };
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function errorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === "object" && "message" in value) {
    const message = String((value as { message?: unknown }).message || "").trim();
    if (message) return message;
  }
  return fallback;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CL";
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <article className={`pro-metric pro-metric-${tone}`}>
      <div className="pro-metric-head"><span>{label}</span><i /></div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="pro-empty">
      <div className="pro-empty-icon">✦</div>
      <strong>{title}</strong>
      <p>{text}</p>
      {action && onAction && <button type="button" className="pro-primary" onClick={onAction}>{action}</button>}
    </div>
  );
}

function ScoreRing({ value, label }: { value: number; label: string }) {
  return (
    <div className="score-ring" style={{ "--score": `${Math.max(0, Math.min(100, value)) * 3.6}deg` } as React.CSSProperties}>
      <div><strong>{value}</strong><span>{label}</span></div>
    </div>
  );
}

export default function CRMPro({ initialClients, initialProjects, initialPayments, initialAudits, user }: Props) {
  const [clients, setClients] = useState(initialClients);
  const [projects, setProjects] = useState(initialProjects);
  const [payments, setPayments] = useState(initialPayments);
  const [audits, setAudits] = useState(initialAudits);
  const [activeModule, setActiveModule] = useState<ModuleId>("dashboard");
  const [modal, setModal] = useState<ModalId>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [clientDraft, setClientDraft] = useState<ClientDraft>(clientEmpty);
  const [projectDraft, setProjectDraft] = useState<ProjectDraft>(() => projectEmpty());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(() => paymentEmpty());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [auditUrl, setAuditUrl] = useState("");
  const [auditClientId, setAuditClientId] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);
  const [currentAudit, setCurrentAudit] = useState<SiteAudit | null>(initialAudits[0] || null);

  const activeDefinition = MODULES.find((item) => item.id === activeModule) || MODULES[0];

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const leads = useMemo(() => clients.filter((client) => client.lifecycle === "lead"), [clients]);
  const activeClients = useMemo(() => clients.filter((client) => client.lifecycle === "cliente"), [clients]);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

  const filteredLeads = useMemo(
    () => leads.filter((client) => [client.name, client.company, client.segment, client.phone, client.email].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch)),
    [leads, normalizedSearch],
  );
  const filteredClients = useMemo(
    () => activeClients.filter((client) => [client.name, client.company, client.document, client.city, client.email].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch)),
    [activeClients, normalizedSearch],
  );
  const filteredProjects = useMemo(
    () => projects.filter((project) => [project.name, project.serviceType, clientMap.get(project.clientId)?.name || ""].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch)),
    [projects, clientMap, normalizedSearch],
  );

  const pipelineValue = leads
    .filter((client) => client.status !== "perdido")
    .reduce((sum, client) => sum + client.estimatedValue, 0);
  const received = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const receivable = payments
    .filter((payment) => !["pago", "cancelado"].includes(payment.status))
    .reduce((sum, payment) => sum + Math.max(0, payment.totalAmount - payment.paidAmount), 0);
  const recurring = projects
    .filter((project) => project.maintenanceEnabled)
    .reduce((sum, project) => sum + project.maintenanceValue, 0);
  const activeProjects = projects.filter((project) => !["finalizado"].includes(project.status));

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function openNewClient(lifecycle: ClientLifecycle) {
    setEditingId(null);
    setClientDraft({ ...clientEmpty(), lifecycle, status: lifecycle === "cliente" ? "fechado" : "novo" });
    setModal("client");
  }

  function openEditClient(client: Client) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = client;
    setEditingId(client.id);
    setClientDraft(draft);
    setModal("client");
  }

  function openNewProject(clientId = "") {
    setEditingId(null);
    setProjectDraft(projectEmpty(clientId || activeClients[0]?.id || clients[0]?.id || ""));
    setModal("project");
  }

  function openEditProject(project: Project) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = project;
    setEditingId(project.id);
    setProjectDraft(draft);
    setModal("project");
  }

  function openNewPayment(clientId = "", projectId: string | null = null) {
    const project = projectId ? projectMap.get(projectId) : null;
    setEditingId(null);
    setPaymentDraft({
      ...paymentEmpty(clientId || project?.clientId || activeClients[0]?.id || clients[0]?.id || "", projectId),
      description: project ? `Projeto: ${project.name}` : "Pagamento de projeto",
      totalAmount: project?.totalValue || 0,
    });
    setModal("payment");
  }

  function openEditPayment(payment: Payment) {
    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = payment;
    setEditingId(payment.id);
    setPaymentDraft(draft);
    setModal("payment");
  }

  function closeModal() {
    setModal(null);
    setEditingId(null);
  }

  async function saveClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientDraft.name.trim()) return flash("Informe o nome do cliente ou responsável.");
    setSaving(true);
    try {
      const table = neonClient.from("clients") as any;
      const result = editingId
        ? await table.update(clientRow(clientDraft)).eq("id", editingId).select(CLIENT_COLUMNS)
        : await table.insert(clientRow(clientDraft)).select(CLIENT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível salvar o cadastro."));
      const saved = mapClient(result.data?.[0] || result.data);
      setClients((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [saved, ...current]);
      closeModal();
      flash(editingId ? "Cadastro atualizado." : "Cadastro criado com sucesso.");
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "Erro ao salvar cadastro.");
    } finally {
      setSaving(false);
    }
  }

  async function convertLead(client: Client) {
    try {
      const table = neonClient.from("clients") as any;
      const result = await table
        .update({ lifecycle: "cliente", status: "fechado", updated_at: new Date().toISOString() })
        .eq("id", client.id)
        .select(CLIENT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível converter o lead."));
      const saved = mapClient(result.data?.[0] || result.data);
      setClients((current) => current.map((item) => item.id === client.id ? saved : item));
      setActiveModule("clients");
      flash("Lead convertido em cliente. Agora você pode criar o projeto e a cobrança.");
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "Erro ao converter lead.");
    }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectDraft.clientId || !projectDraft.name.trim()) return flash("Selecione o cliente e informe o nome do projeto.");
    setSaving(true);
    try {
      const table = neonClient.from("projects") as any;
      const result = editingId
        ? await table.update(projectRow(projectDraft)).eq("id", editingId).select(PROJECT_COLUMNS)
        : await table.insert(projectRow(projectDraft)).select(PROJECT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível salvar o projeto."));
      const saved = mapProject(result.data?.[0] || result.data);
      setProjects((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [saved, ...current]);
      closeModal();
      flash(editingId ? "Projeto atualizado." : "Projeto criado com sucesso.");
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "Erro ao salvar projeto.");
    } finally {
      setSaving(false);
    }
  }

  async function savePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!paymentDraft.clientId) return flash("Selecione o cliente da cobrança.");
    setSaving(true);
    try {
      const table = neonClient.from("payments") as any;
      const result = editingId
        ? await table.update(paymentRow(paymentDraft)).eq("id", editingId).select(PAYMENT_COLUMNS)
        : await table.insert(paymentRow(paymentDraft)).select(PAYMENT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível salvar a cobrança."));
      const saved = mapPayment(result.data?.[0] || result.data);
      setPayments((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [saved, ...current]);
      closeModal();
      flash(editingId ? "Cobrança atualizada." : "Cobrança registrada com sucesso.");
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "Erro ao salvar cobrança.");
    } finally {
      setSaving(false);
    }
  }

  async function markPaymentPaid(payment: Payment) {
    try {
      const table = neonClient.from("payments") as any;
      const result = await table
        .update({ status: "pago", paid_amount: payment.totalAmount, paid_at: today(), updated_at: new Date().toISOString() })
        .eq("id", payment.id)
        .select(PAYMENT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "Não foi possível confirmar o pagamento."));
      const saved = mapPayment(result.data?.[0] || result.data);
      setPayments((current) => current.map((item) => item.id === payment.id ? saved : item));
      flash("Pagamento marcado como recebido.");
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "Erro ao confirmar pagamento.");
    }
  }

  async function analyzeSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!auditUrl.trim()) return flash("Informe a URL do site.");
    setAuditLoading(true);
    try {
      const response = await fetch("/api/site-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: auditUrl.trim() }),
      });
      const analysis = await response.json();
      if (!response.ok) throw new Error(analysis.error || "Não foi possível analisar o site.");

      const result = await (neonClient.from("site_audits") as any)
        .insert({
          client_id: auditClientId ? Number(auditClientId) : null,
          project_id: null,
          url: analysis.url,
          title: analysis.title,
          overall_score: analysis.overallScore,
          seo_score: analysis.seoScore,
          mobile_score: analysis.mobileScore,
          conversion_score: analysis.conversionScore,
          report: analysis.report,
        })
        .select(AUDIT_COLUMNS);
      if (result.error) throw new Error(errorMessage(result.error, "A análise foi concluída, mas não pôde ser salva."));
      const saved = mapSiteAudit(result.data?.[0] || result.data);
      setAudits((current) => [saved, ...current]);
      setCurrentAudit(saved);
      setAuditUrl(saved.url);
      flash("Auditoria concluída e salva no CRM.");
    } catch (reason) {
      flash(reason instanceof Error ? reason.message : "Erro ao analisar o site.");
    } finally {
      setAuditLoading(false);
    }
  }

  async function signOut() {
    await neonClient.auth.signOut();
    window.location.replace("/sign-in");
  }

  function quickAction() {
    if (activeModule === "leads") openNewClient("lead");
    else if (activeModule === "clients") openNewClient("cliente");
    else if (activeModule === "projects") openNewProject();
    else if (activeModule === "finance") openNewPayment();
    else if (activeModule === "ai") document.getElementById("audit-url")?.focus();
    else openNewClient("lead");
  }

  function dashboardModule() {
    const statusOrder: LeadStatus[] = ["novo", "contato", "proposta", "negociacao", "fechado"];
    return (
      <div className="pro-stack">
        <section className="pro-metrics">
          <MetricCard label="Funil aberto" value={currency.format(pipelineValue)} detail={`${leads.length} oportunidades registradas`} tone="blue" />
          <MetricCard label="Recebido" value={currency.format(received)} detail="Total confirmado no financeiro" tone="green" />
          <MetricCard label="A receber" value={currency.format(receivable)} detail="Cobranças pendentes ou atrasadas" tone="amber" />
          <MetricCard label="Receita mensal" value={currency.format(recurring)} detail="Manutenções recorrentes" tone="violet" />
        </section>

        <section className="pro-dashboard-grid">
          <article className="pro-panel pro-panel-wide">
            <div className="pro-panel-head"><div><span>FUNIL COMERCIAL</span><h2>Oportunidades por estágio</h2></div><button type="button" className="pro-link" onClick={() => setActiveModule("leads")}>Abrir leads</button></div>
            <div className="pipeline-list">
              {statusOrder.map((status) => {
                const group = leads.filter((lead) => lead.status === status);
                const value = group.reduce((sum, lead) => sum + lead.estimatedValue, 0);
                const max = Math.max(1, leads.length);
                return (
                  <div className="pipeline-row" key={status}>
                    <div><strong>{LEAD_LABELS[status]}</strong><small>{group.length} oportunidade(s)</small></div>
                    <div className="pipeline-track"><i style={{ width: `${Math.max(4, (group.length / max) * 100)}%` }} /></div>
                    <b>{currency.format(value)}</b>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="pro-panel">
            <div className="pro-panel-head"><div><span>AGENDA COMERCIAL</span><h2>Próximas ações</h2></div></div>
            <div className="activity-list">
              {leads.filter((lead) => lead.nextAction || lead.nextActionDate).slice(0, 6).map((lead) => (
                <button type="button" key={lead.id} onClick={() => openEditClient(lead)}>
                  <i className={`status-dot status-${lead.status}`} />
                  <div><strong>{lead.nextAction || "Acompanhar oportunidade"}</strong><small>{lead.name} · {dateLabel(lead.nextActionDate)}</small></div>
                </button>
              ))}
              {!leads.some((lead) => lead.nextAction || lead.nextActionDate) && <p className="pro-muted">Nenhuma próxima ação cadastrada.</p>}
            </div>
          </article>
        </section>

        <section className="pro-dashboard-grid">
          <article className="pro-panel pro-panel-wide">
            <div className="pro-panel-head"><div><span>PRODUÇÃO</span><h2>Projetos em andamento</h2></div><button type="button" className="pro-link" onClick={() => setActiveModule("projects")}>Ver projetos</button></div>
            {activeProjects.length ? (
              <div className="compact-table-wrap"><table className="compact-table"><thead><tr><th>Projeto</th><th>Cliente</th><th>Status</th><th>Progresso</th><th>Valor</th></tr></thead><tbody>
                {activeProjects.slice(0, 6).map((project) => <tr key={project.id} onClick={() => openEditProject(project)}><td><strong>{project.name}</strong><small>{project.serviceType}</small></td><td>{clientMap.get(project.clientId)?.name || "Cliente"}</td><td><span className={`project-pill project-${project.status}`}>{PROJECT_LABELS[project.status]}</span></td><td><div className="mini-progress"><i style={{ width: `${project.progress}%` }} /></div><small>{project.progress}%</small></td><td>{currency.format(project.totalValue)}</td></tr>)}
              </tbody></table></div>
            ) : <EmptyState title="Nenhum projeto em andamento" text="Crie o primeiro projeto após fechar uma oportunidade." action="Novo projeto" onAction={() => openNewProject()} />}
          </article>

          <article className="pro-panel">
            <div className="pro-panel-head"><div><span>FINANCEIRO</span><h2>Últimas cobranças</h2></div></div>
            <div className="finance-mini-list">
              {payments.slice(0, 6).map((payment) => <button type="button" key={payment.id} onClick={() => openEditPayment(payment)}><div><strong>{clientMap.get(payment.clientId)?.name || "Cliente"}</strong><small>{PAYMENT_METHODS[payment.method]} · {payment.installments}x</small></div><div><b>{currency.format(payment.totalAmount)}</b><span className={`payment-pill payment-${payment.status}`}>{PAYMENT_LABELS[payment.status]}</span></div></button>)}
              {!payments.length && <p className="pro-muted">Nenhuma cobrança registrada.</p>}
            </div>
          </article>
        </section>
      </div>
    );
  }

  function leadsModule() {
    return (
      <section className="pro-panel pro-list-panel">
        <div className="pro-toolbar"><div className="pro-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lead, empresa, segmento ou contato" /></div><button type="button" className="pro-primary" onClick={() => openNewClient("lead")}>+ Novo lead</button></div>
        {filteredLeads.length ? <div className="compact-table-wrap"><table className="compact-table leads-table"><thead><tr><th>Contato</th><th>Etapa</th><th>Próxima ação</th><th>Valor estimado</th><th>Contato rápido</th><th /></tr></thead><tbody>
          {filteredLeads.map((lead) => {
            const phone = normalizePhone(lead.whatsapp || lead.phone);
            return <tr key={lead.id}><td><div className="person-cell"><span>{initials(lead.name)}</span><div><strong>{lead.name}</strong><small>{lead.company || lead.segment || "Contato direto"}</small></div></div></td><td><span className={`lead-pill lead-${lead.status}`}>{LEAD_LABELS[lead.status]}</span></td><td><strong>{lead.nextAction || "Não definida"}</strong><small>{dateLabel(lead.nextActionDate)}</small></td><td>{currency.format(lead.estimatedValue)}</td><td><div className="quick-links">{phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">WhatsApp</a>}{lead.email && <a href={`mailto:${lead.email}`}>E-mail</a>}</div></td><td><div className="row-actions"><button type="button" onClick={() => openEditClient(lead)}>Editar</button>{lead.status !== "perdido" && <button type="button" className="action-positive" onClick={() => convertLead(lead)}>Fechar</button>}</div></td></tr>;
          })}
        </tbody></table></div> : <EmptyState title="Nenhum lead encontrado" text="Cadastre oportunidades e acompanhe cada negociação em um funil organizado." action="Cadastrar lead" onAction={() => openNewClient("lead")} />}
      </section>
    );
  }

  function clientsModule() {
    return (
      <section className="pro-panel pro-list-panel">
        <div className="pro-toolbar"><div className="pro-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, empresa, CPF/CNPJ, cidade ou e-mail" /></div><button type="button" className="pro-primary" onClick={() => openNewClient("cliente")}>+ Novo cliente</button></div>
        {filteredClients.length ? <div className="compact-table-wrap"><table className="compact-table"><thead><tr><th>Cliente</th><th>Documento</th><th>Localização</th><th>Projetos</th><th>Valor contratado</th><th>Contato</th><th /></tr></thead><tbody>
          {filteredClients.map((client) => {
            const clientProjects = projects.filter((project) => project.clientId === client.id);
            const contracted = clientProjects.reduce((sum, project) => sum + project.totalValue, 0);
            return <tr key={client.id}><td><div className="person-cell"><span>{initials(client.name)}</span><div><strong>{client.tradeName || client.company || client.name}</strong><small>{client.name}{client.segment ? ` · ${client.segment}` : ""}</small></div></div></td><td><strong>{client.document || "Não informado"}</strong><small>{client.clientType === "empresa" ? "CNPJ" : "CPF"}</small></td><td>{[client.city, client.state].filter(Boolean).join(" / ") || "Não informado"}</td><td><strong>{clientProjects.length}</strong><small>projeto(s)</small></td><td>{currency.format(contracted)}</td><td><div className="quick-links">{(client.whatsapp || client.phone) && <a href={`https://wa.me/${normalizePhone(client.whatsapp || client.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a>}{client.website && <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer">Site</a>}</div></td><td><div className="row-actions"><button type="button" onClick={() => openEditClient(client)}>Editar</button><button type="button" onClick={() => openNewProject(client.id)}>Projeto</button></div></td></tr>;
          })}
        </tbody></table></div> : <EmptyState title="Nenhum cliente cadastrado" text="Converta um lead fechado ou crie o cadastro completo diretamente." action="Cadastrar cliente" onAction={() => openNewClient("cliente")} />}
      </section>
    );
  }

  function projectsModule() {
    return (
      <div className="pro-stack">
        <section className="pro-panel pro-list-panel"><div className="pro-toolbar"><div className="pro-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projeto, serviço ou cliente" /></div><button type="button" className="pro-primary" onClick={() => openNewProject()}>+ Novo projeto</button></div></section>
        {filteredProjects.length ? <section className="project-grid">{filteredProjects.map((project) => {
          const client = clientMap.get(project.clientId);
          return <article className="project-card" key={project.id}><div className="project-card-top"><span className={`project-pill project-${project.status}`}>{PROJECT_LABELS[project.status]}</span><button type="button" onClick={() => openEditProject(project)}>•••</button></div><div className="project-client"><span>{initials(client?.name || "Cliente")}</span><div><small>CLIENTE</small><strong>{client?.tradeName || client?.company || client?.name || "Cliente"}</strong></div></div><h3>{project.name}</h3><p>{project.description || project.serviceType}</p><div className="project-progress-head"><span>Progresso</span><strong>{project.progress}%</strong></div><div className="project-progress"><i style={{ width: `${project.progress}%` }} /></div><dl><div><dt>Valor</dt><dd>{currency.format(project.totalValue)}</dd></div><div><dt>Entrega</dt><dd>{dateLabel(project.dueDate)}</dd></div><div><dt>Mensalidade</dt><dd>{project.maintenanceEnabled ? currency.format(project.maintenanceValue) : "—"}</dd></div></dl><div className="project-card-actions"><button type="button" onClick={() => openEditProject(project)}>Editar projeto</button><button type="button" className="pro-primary" onClick={() => openNewPayment(project.clientId, project.id)}>Cobrança</button></div></article>;
        })}</section> : <EmptyState title="Nenhum projeto encontrado" text="Organize prazos, valores, domínios, hospedagem e manutenção de cada entrega." action="Criar projeto" onAction={() => openNewProject()} />}
      </div>
    );
  }

  function financeModule() {
    const overdue = payments.filter((payment) => payment.status !== "pago" && payment.dueDate && payment.dueDate < today());
    return (
      <div className="pro-stack">
        <section className="pro-metrics pro-metrics-three"><MetricCard label="Recebido" value={currency.format(received)} detail="Pagamentos confirmados" tone="green" /><MetricCard label="A receber" value={currency.format(receivable)} detail={`${payments.filter((item) => item.status === "pendente").length} cobrança(s) pendente(s)`} tone="blue" /><MetricCard label="Em atraso" value={currency.format(overdue.reduce((sum, item) => sum + Math.max(0, item.totalAmount - item.paidAmount), 0))} detail={`${overdue.length} cobrança(s) vencida(s)`} tone="red" /></section>
        <section className="pro-panel pro-list-panel"><div className="pro-toolbar"><div><span className="pro-eyebrow">MOVIMENTAÇÕES</span><h2>Controle financeiro</h2></div><button type="button" className="pro-primary" onClick={() => openNewPayment()}>+ Nova cobrança</button></div>
          {payments.length ? <div className="compact-table-wrap"><table className="compact-table"><thead><tr><th>Cliente / projeto</th><th>Forma</th><th>Parcelas</th><th>Vencimento</th><th>Total</th><th>Recebido</th><th>Status</th><th /></tr></thead><tbody>{payments.map((payment) => {
            const project = payment.projectId ? projectMap.get(payment.projectId) : null;
            const isOverdue = payment.status === "pendente" && payment.dueDate && payment.dueDate < today();
            return <tr key={payment.id}><td><strong>{clientMap.get(payment.clientId)?.name || "Cliente"}</strong><small>{project?.name || payment.description}</small></td><td>{PAYMENT_METHODS[payment.method]}</td><td>{payment.installments}x de {currency.format(payment.installments ? payment.totalAmount / payment.installments : payment.totalAmount)}</td><td>{dateLabel(payment.dueDate)}</td><td>{currency.format(payment.totalAmount)}</td><td>{currency.format(payment.paidAmount)}</td><td><span className={`payment-pill payment-${isOverdue ? "atrasado" : payment.status}`}>{isOverdue ? "Atrasado" : PAYMENT_LABELS[payment.status]}</span></td><td><div className="row-actions"><button type="button" onClick={() => openEditPayment(payment)}>Editar</button>{payment.status !== "pago" && <button type="button" className="action-positive" onClick={() => markPaymentPaid(payment)}>Receber</button>}</div></td></tr>;
          })}</tbody></table></div> : <EmptyState title="Nenhuma cobrança registrada" text="Registre Pix, cartão, boleto e parcelamento em até 12 vezes." action="Nova cobrança" onAction={() => openNewPayment()} />}
        </section>
      </div>
    );
  }

  function aiModule() {
    const report = currentAudit?.report as SiteAuditReport | undefined;
    return (
      <div className="pro-stack">
        <section className="ai-hero">
          <div><span className="pro-eyebrow">AUDITORIA INTELIGENTE</span><h2>Analise qualquer site em segundos.</h2><p>O CRM verifica SEO, estrutura mobile, contatos, conversão, títulos, imagens e chamadas para ação. Cada relatório fica salvo no histórico.</p></div>
          <form onSubmit={analyzeSite} className="audit-form"><label>URL do site<input id="audit-url" value={auditUrl} onChange={(event) => setAuditUrl(event.target.value)} placeholder="https://site-do-cliente.com.br" /></label><label>Vincular ao cliente<select value={auditClientId} onChange={(event) => setAuditClientId(event.target.value)}><option value="">Sem vínculo</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.tradeName || client.company || client.name}</option>)}</select></label><button type="submit" className="pro-primary" disabled={auditLoading}>{auditLoading ? "Analisando..." : "✦ Analisar site"}</button></form>
        </section>

        {currentAudit ? <section className="audit-results"><article className="pro-panel audit-score-panel"><div><span className="pro-eyebrow">RESULTADO MAIS RECENTE</span><h2>{currentAudit.title}</h2><a href={currentAudit.url} target="_blank" rel="noreferrer">{currentAudit.url}</a></div><div className="score-grid"><ScoreRing value={currentAudit.overallScore} label="Geral" /><ScoreRing value={currentAudit.seoScore} label="SEO" /><ScoreRing value={currentAudit.mobileScore} label="Mobile" /><ScoreRing value={currentAudit.conversionScore} label="Conversão" /></div></article>
          <article className="pro-panel audit-findings"><div className="finding-column finding-positive"><h3>Pontos positivos</h3>{report?.positives?.length ? report.positives.map((item) => <p key={item}>✓ {item}</p>) : <p>Nenhum ponto positivo identificado.</p>}</div><div className="finding-column finding-issue"><h3>Problemas encontrados</h3>{report?.issues?.length ? report.issues.map((item) => <p key={item}>! {item}</p>) : <p>Nenhum problema crítico identificado.</p>}</div><div className="finding-column finding-recommendation"><h3>Próximos ajustes</h3>{report?.recommendations?.length ? report.recommendations.map((item) => <p key={item}>→ {item}</p>) : <p>O site está bem configurado nos itens analisados.</p>}</div></article>
        </section> : <EmptyState title="Nenhuma auditoria realizada" text="Cole uma URL acima para gerar o primeiro diagnóstico técnico e comercial." />}

        <section className="pro-panel pro-list-panel"><div className="pro-panel-head"><div><span>HISTÓRICO</span><h2>Sites analisados</h2></div></div>{audits.length ? <div className="audit-history">{audits.map((audit) => <button type="button" key={audit.id} onClick={() => { setCurrentAudit(audit); setAuditUrl(audit.url); }}><span className={`audit-grade grade-${audit.overallScore >= 80 ? "good" : audit.overallScore >= 55 ? "medium" : "low"}`}>{audit.overallScore}</span><div><strong>{audit.title}</strong><small>{audit.url}</small></div><time>{dateFormatter.format(new Date(audit.createdAt))}</time></button>)}</div> : <p className="pro-muted">As análises salvas aparecerão aqui.</p>}</section>
      </div>
    );
  }

  function renderModule() {
    if (activeModule === "dashboard") return dashboardModule();
    if (activeModule === "leads") return leadsModule();
    if (activeModule === "clients") return clientsModule();
    if (activeModule === "projects") return projectsModule();
    if (activeModule === "finance") return financeModule();
    return aiModule();
  }

  return (
    <div className="pro-app">
      <aside className="pro-sidebar">
        <div className="pro-brand"><span aria-hidden="true">N</span><div><strong>Nassus CRM</strong><small>PRO BUSINESS</small></div></div>
        <nav>{MODULES.map((item) => <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => { setActiveModule(item.id); setSearch(""); }}><i>{item.icon}</i><span>{item.label}</span>{item.id === "leads" && leads.length > 0 && <b>{leads.length}</b>}</button>)}</nav>
        <div className="pro-sidebar-card"><span>RECEITA RECORRENTE</span><strong>{currency.format(recurring)}</strong><small>por mês em manutenção</small></div>
        <div className="pro-profile"><div className="pro-avatar">{initials(user.name)}</div><div><strong>{user.name}</strong><small>{user.email}</small></div><button type="button" onClick={signOut} aria-label="Sair">↗</button></div>
      </aside>

      <main className="pro-main">
        <header className="pro-topbar"><div><span className="pro-eyebrow">{activeDefinition.eyebrow}</span><h1>{activeDefinition.label}</h1></div><div className="pro-top-actions"><button type="button" className="pro-icon-button" title="Pesquisar" onClick={() => document.querySelector<HTMLInputElement>(".pro-search input")?.focus()}>⌕</button><button type="button" className="pro-primary" onClick={quickAction}>+ Adicionar</button></div></header>
        {notice && <div className="pro-notice">{notice}</div>}
        <div className="pro-content">{renderModule()}</div>
      </main>

      <nav className="pro-mobile-nav">{MODULES.slice(0, 5).map((item) => <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => setActiveModule(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>)}</nav>

      {modal === "client" && <div className="pro-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="pro-modal pro-modal-wide"><header><div><span className="pro-eyebrow">{editingId ? "EDITAR CADASTRO" : "NOVO CADASTRO"}</span><h2>{clientDraft.lifecycle === "lead" ? "Lead comercial" : "Cliente"}</h2></div><button type="button" onClick={closeModal}>×</button></header><form onSubmit={saveClient} className="pro-form">
        <div className="form-section"><div className="form-section-title"><strong>Identificação</strong><small>Dados principais do contato ou empresa</small></div><div className="form-grid"><label>Tipo de cadastro<select value={clientDraft.lifecycle} onChange={(event) => setClientDraft((current) => ({ ...current, lifecycle: event.target.value as ClientLifecycle }))}><option value="lead">Lead</option><option value="cliente">Cliente</option></select></label><label>Tipo de pessoa<select value={clientDraft.clientType} onChange={(event) => setClientDraft((current) => ({ ...current, clientType: event.target.value as ClientType }))}><option value="empresa">Empresa</option><option value="pessoa_fisica">Pessoa física</option><option value="autonomo">Autônomo</option></select></label><label className="span-2">Nome do responsável *<input required value={clientDraft.name} onChange={(event) => setClientDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Nome completo" /></label><label>Empresa / marca<input value={clientDraft.company} onChange={(event) => setClientDraft((current) => ({ ...current, company: event.target.value }))} placeholder="Empresa ou marca" /></label><label>CPF ou CNPJ<input value={clientDraft.document} onChange={(event) => setClientDraft((current) => ({ ...current, document: event.target.value }))} placeholder="Documento" /></label><label>Razão social<input value={clientDraft.legalName} onChange={(event) => setClientDraft((current) => ({ ...current, legalName: event.target.value }))} /></label><label>Nome fantasia<input value={clientDraft.tradeName} onChange={(event) => setClientDraft((current) => ({ ...current, tradeName: event.target.value }))} /></label><label>Inscrição estadual<input value={clientDraft.stateRegistration} onChange={(event) => setClientDraft((current) => ({ ...current, stateRegistration: event.target.value }))} /></label><label>Segmento<input value={clientDraft.segment} onChange={(event) => setClientDraft((current) => ({ ...current, segment: event.target.value }))} placeholder="Ex.: Clínica, engenharia" /></label></div></div>
        <div className="form-section"><div className="form-section-title"><strong>Contato e presença digital</strong><small>Canais usados no atendimento</small></div><div className="form-grid"><label>Telefone<input value={clientDraft.phone} onChange={(event) => setClientDraft((current) => ({ ...current, phone: event.target.value }))} /></label><label>WhatsApp<input value={clientDraft.whatsapp} onChange={(event) => setClientDraft((current) => ({ ...current, whatsapp: event.target.value }))} /></label><label>E-mail<input type="email" value={clientDraft.email} onChange={(event) => setClientDraft((current) => ({ ...current, email: event.target.value }))} /></label><label>Instagram<input value={clientDraft.instagram} onChange={(event) => setClientDraft((current) => ({ ...current, instagram: event.target.value }))} /></label><label className="span-2">Site<input value={clientDraft.website} onChange={(event) => setClientDraft((current) => ({ ...current, website: event.target.value }))} placeholder="https://" /></label></div></div>
        <div className="form-section"><div className="form-section-title"><strong>Endereço</strong><small>Localização completa do cliente</small></div><div className="form-grid"><label>CEP<input value={clientDraft.zipCode} onChange={(event) => setClientDraft((current) => ({ ...current, zipCode: event.target.value }))} /></label><label className="span-2">Endereço<input value={clientDraft.address} onChange={(event) => setClientDraft((current) => ({ ...current, address: event.target.value }))} /></label><label>Número<input value={clientDraft.addressNumber} onChange={(event) => setClientDraft((current) => ({ ...current, addressNumber: event.target.value }))} /></label><label>Complemento<input value={clientDraft.complement} onChange={(event) => setClientDraft((current) => ({ ...current, complement: event.target.value }))} /></label><label>Bairro<input value={clientDraft.neighborhood} onChange={(event) => setClientDraft((current) => ({ ...current, neighborhood: event.target.value }))} /></label><label>Cidade<input value={clientDraft.city} onChange={(event) => setClientDraft((current) => ({ ...current, city: event.target.value }))} /></label><label>Estado<input maxLength={2} value={clientDraft.state} onChange={(event) => setClientDraft((current) => ({ ...current, state: event.target.value.toUpperCase() }))} /></label></div></div>
        <div className="form-section"><div className="form-section-title"><strong>Comercial</strong><small>Funil, valor e próximos passos</small></div><div className="form-grid"><label>Etapa<select value={clientDraft.status} onChange={(event) => setClientDraft((current) => ({ ...current, status: event.target.value as LeadStatus }))}>{Object.entries(LEAD_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Valor estimado<input type="number" min="0" value={clientDraft.estimatedValue} onChange={(event) => setClientDraft((current) => ({ ...current, estimatedValue: Number(event.target.value || 0) }))} /></label><label>Origem<input value={clientDraft.source} onChange={(event) => setClientDraft((current) => ({ ...current, source: event.target.value }))} placeholder="Instagram, indicação..." /></label><label>Tags<input value={clientDraft.tags} onChange={(event) => setClientDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="prioridade, clínica" /></label><label>Próxima ação<input value={clientDraft.nextAction} onChange={(event) => setClientDraft((current) => ({ ...current, nextAction: event.target.value }))} /></label><label>Data da próxima ação<input type="date" value={clientDraft.nextActionDate || ""} onChange={(event) => setClientDraft((current) => ({ ...current, nextActionDate: event.target.value || null }))} /></label><label className="span-2">Observações<textarea value={clientDraft.notes} onChange={(event) => setClientDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div></div>
        <footer><button type="button" className="pro-secondary" onClick={closeModal}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar cadastro"}</button></footer></form></section></div>}

      {modal === "project" && <div className="pro-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="pro-modal"><header><div><span className="pro-eyebrow">PRODUÇÃO</span><h2>{editingId ? "Editar projeto" : "Novo projeto"}</h2></div><button type="button" onClick={closeModal}>×</button></header><form onSubmit={saveProject} className="pro-form"><div className="form-grid"><label className="span-2">Cliente *<select required value={projectDraft.clientId} onChange={(event) => setProjectDraft((current) => ({ ...current, clientId: event.target.value }))}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.tradeName || client.company || client.name}</option>)}</select></label><label className="span-2">Nome do projeto *<input required value={projectDraft.name} onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Site institucional da clínica" /></label><label>Tipo de serviço<select value={projectDraft.serviceType} onChange={(event) => setProjectDraft((current) => ({ ...current, serviceType: event.target.value }))}><option>Site institucional</option><option>Landing page</option><option>Loja virtual</option><option>Sistema web</option><option>Manutenção</option><option>Automação de WhatsApp</option><option>Identidade visual</option><option>Outro</option></select></label><label>Status<select value={projectDraft.status} onChange={(event) => setProjectDraft((current) => ({ ...current, status: event.target.value as ProjectStatus }))}>{Object.entries(PROJECT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Progresso (%)<input type="number" min="0" max="100" value={projectDraft.progress} onChange={(event) => setProjectDraft((current) => ({ ...current, progress: Number(event.target.value || 0) }))} /></label><label>Valor fechado<input type="number" min="0" value={projectDraft.totalValue} onChange={(event) => setProjectDraft((current) => ({ ...current, totalValue: Number(event.target.value || 0) }))} /></label><label>Data de início<input type="date" value={projectDraft.startDate || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, startDate: event.target.value || null }))} /></label><label>Prazo de entrega<input type="date" value={projectDraft.dueDate || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, dueDate: event.target.value || null }))} /></label><label>Data de entrega<input type="date" value={projectDraft.deliveryDate || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, deliveryDate: event.target.value || null }))} /></label><label>URL publicada<input value={projectDraft.websiteUrl} onChange={(event) => setProjectDraft((current) => ({ ...current, websiteUrl: event.target.value }))} /></label><label>Domínio<input value={projectDraft.domain} onChange={(event) => setProjectDraft((current) => ({ ...current, domain: event.target.value }))} /></label><label>Hospedagem<input value={projectDraft.hosting} onChange={(event) => setProjectDraft((current) => ({ ...current, hosting: event.target.value }))} /></label><label>Renovação do domínio<input type="date" value={projectDraft.domainRenewalDate || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, domainRenewalDate: event.target.value || null }))} /></label><label>Renovação da hospedagem<input type="date" value={projectDraft.hostingRenewalDate || ""} onChange={(event) => setProjectDraft((current) => ({ ...current, hostingRenewalDate: event.target.value || null }))} /></label><label className="checkbox-label span-2"><input type="checkbox" checked={projectDraft.maintenanceEnabled} onChange={(event) => setProjectDraft((current) => ({ ...current, maintenanceEnabled: event.target.checked }))} /> Este projeto possui manutenção mensal</label>{projectDraft.maintenanceEnabled && <label className="span-2">Valor mensal<input type="number" min="0" value={projectDraft.maintenanceValue} onChange={(event) => setProjectDraft((current) => ({ ...current, maintenanceValue: Number(event.target.value || 0) }))} /></label>}<label className="span-2">Descrição do escopo<textarea value={projectDraft.description} onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))} /></label><label className="span-2">Observações internas<textarea value={projectDraft.notes} onChange={(event) => setProjectDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div><footer><button type="button" className="pro-secondary" onClick={closeModal}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar projeto"}</button></footer></form></section></div>}

      {modal === "payment" && <div className="pro-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="pro-modal"><header><div><span className="pro-eyebrow">FINANCEIRO</span><h2>{editingId ? "Editar cobrança" : "Nova cobrança"}</h2></div><button type="button" onClick={closeModal}>×</button></header><form onSubmit={savePayment} className="pro-form"><div className="form-grid"><label className="span-2">Cliente *<select required value={paymentDraft.clientId} onChange={(event) => setPaymentDraft((current) => ({ ...current, clientId: event.target.value, projectId: null }))}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.tradeName || client.company || client.name}</option>)}</select></label><label className="span-2">Projeto<select value={paymentDraft.projectId || ""} onChange={(event) => { const projectId = event.target.value || null; const project = projectId ? projectMap.get(projectId) : null; setPaymentDraft((current) => ({ ...current, projectId, description: project ? `Projeto: ${project.name}` : current.description, totalAmount: project?.totalValue || current.totalAmount })); }}><option value="">Sem projeto vinculado</option>{projects.filter((project) => !paymentDraft.clientId || project.clientId === paymentDraft.clientId).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label><label className="span-2">Descrição<input value={paymentDraft.description} onChange={(event) => setPaymentDraft((current) => ({ ...current, description: event.target.value }))} /></label><label>Valor total<input type="number" min="0" value={paymentDraft.totalAmount} onChange={(event) => setPaymentDraft((current) => ({ ...current, totalAmount: Number(event.target.value || 0) }))} /></label><label>Valor recebido<input type="number" min="0" value={paymentDraft.paidAmount} onChange={(event) => setPaymentDraft((current) => ({ ...current, paidAmount: Number(event.target.value || 0) }))} /></label><label>Forma de pagamento<select value={paymentDraft.method} onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value as PaymentMethod, installments: event.target.value === "credito" ? current.installments : 1 }))}>{Object.entries(PAYMENT_METHODS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Parcelas<select value={paymentDraft.installments} disabled={paymentDraft.method !== "credito"} onChange={(event) => setPaymentDraft((current) => ({ ...current, installments: Number(event.target.value) }))}>{Array.from({ length: 12 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}x {paymentDraft.totalAmount > 0 ? `de ${currency.format(paymentDraft.totalAmount / value)}` : ""}</option>)}</select></label><label>Vencimento<input type="date" value={paymentDraft.dueDate || ""} onChange={(event) => setPaymentDraft((current) => ({ ...current, dueDate: event.target.value || null }))} /></label><label>Data do pagamento<input type="date" value={paymentDraft.paidAt || ""} onChange={(event) => setPaymentDraft((current) => ({ ...current, paidAt: event.target.value || null }))} /></label><label>Status<select value={paymentDraft.status} onChange={(event) => setPaymentDraft((current) => ({ ...current, status: event.target.value as PaymentStatus }))}>{Object.entries(PAYMENT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="span-2">Observações<textarea value={paymentDraft.notes} onChange={(event) => setPaymentDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div><footer><button type="button" className="pro-secondary" onClick={closeModal}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar cobrança"}</button></footer></form></section></div>}
    </div>
  );
}
