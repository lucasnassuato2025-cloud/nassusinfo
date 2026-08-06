"use client";

import { useEffect, useMemo, useState } from "react";

import CRMPro from "@/app/crm-pro";
import {
  AdministrationModule,
  AlertsModule,
  Client360Module,
  DocumentsModule,
  InfrastructureModule,
  InstallmentsPanel,
  ReportsModule,
  TasksModule,
} from "@/app/operations";
import { CRMIcon, CRMIconName } from "@/app/ui/crm-icons";
import {
  AUDIT_COLUMNS,
  CLIENT_COLUMNS,
  PAYMENT_COLUMNS,
  PROJECT_COLUMNS,
  Client,
  Payment,
  Project,
  SiteAudit,
  mapClient,
  mapPayment,
  mapProject,
  mapSiteAudit,
} from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";

type SuiteModule = "crm" | "client360" | "infrastructure" | "tasks" | "documents" | "installments" | "alerts" | "reports" | "admin";

type Props = {
  initialClients: Client[];
  initialProjects: Project[];
  initialPayments: Payment[];
  initialAudits: SiteAudit[];
  user: { name: string; email: string };
};

type DataRow = Record<string, unknown>;

type AccessProfile = {
  id?: number;
  workspaceOwnerId?: string;
  userId?: string;
  name?: string;
  email?: string;
  role: string;
  permissions: Record<string, boolean>;
  status: string;
  isOwner: boolean;
};

type ModuleDefinition = {
  id: SuiteModule;
  label: string;
  icon: CRMIconName;
  eyebrow: string;
  title: string;
  description: string;
  permission: string;
};

const MODULES: ModuleDefinition[] = [
  { id: "crm", label: "Central", icon: "home", eyebrow: "GESTÃO COMERCIAL", title: "Central de negócios", description: "Leads, clientes, projetos e financeiro.", permission: "clients.view" },
  { id: "client360", label: "Cliente 360°", icon: "user", eyebrow: "RELACIONAMENTO", title: "Ficha completa do cliente", description: "Toda a jornada em uma única visão.", permission: "clients.view" },
  { id: "infrastructure", label: "Infraestrutura", icon: "infrastructure", eyebrow: "SITES E TECNOLOGIA", title: "Infraestrutura digital", description: "Sites, acessos, renovações e custos.", permission: "infrastructure.view" },
  { id: "tasks", label: "Agenda", icon: "calendar", eyebrow: "OPERAÇÃO DIÁRIA", title: "Agenda operacional", description: "Prioridades, prazos e histórico.", permission: "tasks.view" },
  { id: "documents", label: "Documentos", icon: "document", eyebrow: "COMERCIAL", title: "Central de documentos", description: "Propostas, contratos e comprovantes de pagamento.", permission: "documents.view" },
  { id: "installments", label: "Parcelas", icon: "installments", eyebrow: "CONTROLE FINANCEIRO", title: "Cronograma financeiro", description: "Recebimentos e parcelas por vencimento.", permission: "finance.view" },
  { id: "alerts", label: "Alertas", icon: "bell", eyebrow: "CENTRAL DE ATENÇÃO", title: "Central de alertas", description: "Cobranças, entregas e renovações.", permission: "reports.view" },
  { id: "reports", label: "Relatórios", icon: "chart", eyebrow: "INTELIGÊNCIA DO NEGÓCIO", title: "Inteligência executiva", description: "Metas, tendências, riscos e exportação.", permission: "reports.view" },
  { id: "admin", label: "Administração", icon: "shield", eyebrow: "GOVERNANÇA DO CRM", title: "Administração e segurança", description: "Equipe, permissões, backup e lixeira.", permission: "admin.view" },
];

function rows(value: unknown): DataRow[] {
  return Array.isArray(value) ? value as DataRow[] : [];
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LN";
}

function fallbackAccess(user: Props["user"]): AccessProfile {
  const owner = user.email.toLocaleLowerCase("pt-BR") === "lucasnassuato2025@gmail.com";
  return { name: user.name, email: user.email, role: owner ? "owner" : "viewer", permissions: owner ? { "*": true } : {}, status: owner ? "active" : "loading", isOwner: owner };
}

function permissionAllowed(access: AccessProfile, permission: string) {
  if (access.isOwner || access.role === "admin" || access.permissions?.["*"] === true) return true;
  const explicit = access.permissions?.[permission];
  if (typeof explicit === "boolean") return explicit;
  if (permission.endsWith(".view")) return ["viewer", "commercial", "operations", "finance"].includes(access.role);
  if (access.role === "commercial") return ["clients.write", "documents.write"].includes(permission);
  if (access.role === "operations") return ["projects.write", "tasks.write", "infrastructure.write"].includes(permission);
  if (access.role === "finance") return permission === "finance.write";
  return false;
}

function dataKey(clients: Client[], projects: Project[], payments: Payment[], audits: SiteAudit[]) {
  return [
    clients.map((item) => `${item.id}:${item.updatedAt}`).join("|"),
    projects.map((item) => `${item.id}:${item.updatedAt}`).join("|"),
    payments.map((item) => `${item.id}:${item.updatedAt}`).join("|"),
    audits.map((item) => item.id).join("|"),
  ].join("::");
}

export default function CRMSuite({ initialClients, initialProjects, initialPayments, initialAudits, user }: Props) {
  const [access, setAccess] = useState<AccessProfile>(() => fallbackAccess(user));
  const [accessLoading, setAccessLoading] = useState(true);
  const [activeModule, setActiveModule] = useState<SuiteModule>("crm");
  const [clients, setClients] = useState(initialClients);
  const [projects, setProjects] = useState(initialProjects);
  const [payments, setPayments] = useState(initialPayments);
  const [audits, setAudits] = useState(initialAudits);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [dataVersion, setDataVersion] = useState(0);

  const allowedModules = useMemo(() => MODULES.filter((item) => permissionAllowed(access, item.permission)), [access]);
  const definition = allowedModules.find((item) => item.id === activeModule) || allowedModules[0] || MODULES[0];
  const canManageAdmin = permissionAllowed(access, "admin.manage");
  const crmDataKey = useMemo(() => dataKey(clients, projects, payments, audits), [clients, projects, payments, audits]);

  useEffect(() => {
    let active = true;
    async function loadAccess() {
      try {
        const claim = await (neonClient as any).rpc("crm_claim_membership");
        if (claim.error) throw claim.error;
        const query = await (neonClient as any).rpc("crm_my_access");
        if (!active) return;
        if (query.error || !query.data || query.data.status === "unauthorized") {
          const fallback = fallbackAccess(user);
          setAccess(fallback);
          if (!fallback.isOwner) setRefreshError("Este e-mail ainda não foi autorizado na equipe do CRM.");
        } else {
          setAccess({ ...query.data, permissions: query.data.permissions || {} } as AccessProfile);
        }
      } catch {
        if (active) setAccess(fallbackAccess(user));
      } finally {
        if (active) setAccessLoading(false);
      }
    }
    void loadAccess();
    return () => { active = false; };
  }, [user.email]);

  useEffect(() => {
    if (!allowedModules.some((item) => item.id === activeModule)) setActiveModule(allowedModules[0]?.id || "crm");
  }, [allowedModules, activeModule]);

  useEffect(() => {
    if (activeModule === "crm" && dataVersion === 0) return;
    let active = true;
    async function refreshData() {
      setRefreshing(true);
      setRefreshError("");
      try {
        const claim = await (neonClient as any).rpc("crm_claim_membership");
        if (claim.error) throw claim.error;
        const [clientQuery, projectQuery, paymentQuery, auditQuery] = await Promise.all([
          neonClient.from("clients").select(CLIENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("payments").select(PAYMENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("site_audits").select(AUDIT_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false }),
        ]);
        if (!active) return;
        const error = clientQuery.error || projectQuery.error || paymentQuery.error || auditQuery.error;
        if (error) throw error;
        setClients(rows(clientQuery.data).map(mapClient));
        setProjects(rows(projectQuery.data).map(mapProject));
        setPayments(rows(paymentQuery.data).map(mapPayment));
        setAudits(rows(auditQuery.data).map(mapSiteAudit));
      } catch (reason) {
        if (!active) return;
        const message = reason && typeof reason === "object" && "message" in reason ? String((reason as { message?: unknown }).message || "") : "";
        setRefreshError(/permission|row-level security/i.test(message) ? "Seu cargo não possui acesso aos dados necessários para este módulo." : message || "Não foi possível atualizar os dados.");
      } finally {
        if (active) setRefreshing(false);
      }
    }
    void refreshData();
    return () => { active = false; };
  }, [activeModule, dataVersion]);

  async function signOut() {
    await neonClient.auth.signOut();
    window.location.replace("/sign-in");
  }

  function renderOperation() {
    if (refreshing) return <div className="suite-loading"><i /><strong>Sincronizando sua operação</strong><span>Carregando clientes, projetos e pagamentos atuais.</span></div>;
    if (refreshError) return <div className="suite-loading suite-loading-error"><strong>Não foi possível atualizar</strong><span>{refreshError}</span><button type="button" className="pro-primary" onClick={() => setActiveModule("crm")}>Voltar à central</button></div>;
    if (activeModule === "client360") return <Client360Module clients={clients} projects={projects} payments={payments} audits={audits} />;
    if (activeModule === "infrastructure") return <InfrastructureModule clients={clients} projects={projects} />;
    if (activeModule === "tasks") return <TasksModule clients={clients} projects={projects} />;
    if (activeModule === "documents") return <DocumentsModule clients={clients} projects={projects} userName={user.name} />;
    if (activeModule === "installments") return <InstallmentsPanel payments={payments} clients={clients} projects={projects} onPaymentChange={(payment) => setPayments((current) => current.map((item) => item.id === payment.id ? payment : item))} />;
    if (activeModule === "alerts") return <AlertsModule clients={clients} projects={projects} payments={payments} />;
    if (activeModule === "reports") return <ReportsModule clients={clients} projects={projects} payments={payments} canManage={canManageAdmin} />;
    return <AdministrationModule access={access} clients={clients} projects={projects} payments={payments} onDataChanged={() => setDataVersion((value) => value + 1)} />;
  }

  if (accessLoading) return <div className="suite-loading suite-loading-full"><i /><strong>Validando seu acesso</strong><span>Aplicando cargo e permissões do workspace.</span></div>;

  if (activeModule === "crm") {
    return <><CRMPro key={crmDataKey} initialClients={clients} initialProjects={projects} initialPayments={payments} initialAudits={audits} user={user} /><nav className="suite-dock" aria-label="Acesso rápido aos módulos operacionais">{allowedModules.filter((item) => item.id !== "crm").map((item) => <button type="button" key={item.id} title={item.description} onClick={() => setActiveModule(item.id)}><i><CRMIcon name={item.icon} /></i><span>{item.label}</span></button>)}</nav></>;
  }

  return (
    <div className="suite-app">
      <aside className="suite-sidebar">
        <div className="suite-brand"><span aria-hidden="true" /><div><strong>Nassus CRM</strong><small>BLACK EDITION</small></div></div>
        <div className="suite-nav-label">WORKSPACE</div>
        <nav>{allowedModules.map((item) => <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => setActiveModule(item.id)}><i><CRMIcon name={item.icon} /></i><span>{item.label}</span></button>)}</nav>
        <div className="suite-help"><span>ACESSO {String(access.role || "viewer").toUpperCase()}</span><strong>{ROLE_LABEL(access.role)}</strong><small>As permissões são validadas no banco antes de cada alteração.</small></div>
        <div className="suite-user"><div>{initials(user.name)}</div><section><strong>{user.name}</strong><small>{user.email}</small></section><button type="button" onClick={signOut} aria-label="Sair do CRM"><CRMIcon name="logout" /></button></div>
      </aside>
      <main className="suite-main">
        <header className="suite-topbar"><div className="suite-title-block"><span>{definition.eyebrow}</span><h1>{definition.title}</h1><p>{definition.description}</p></div><div className="suite-topbar-actions"><div className="suite-live"><i />Dados sincronizados</div><button type="button" className="suite-back" onClick={() => setActiveModule("crm")}><CRMIcon name="arrow-left" /><span>Voltar à central</span></button></div></header>
        <div className="suite-content">{renderOperation()}</div>
      </main>
      <nav className="suite-mobile-nav" aria-label="Navegação móvel">{allowedModules.map((item) => <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => setActiveModule(item.id)}><i><CRMIcon name={item.icon} /></i><span>{item.label}</span></button>)}</nav>
    </div>
  );
}

function ROLE_LABEL(role: string) {
  if (role === "owner") return "Proprietário do workspace";
  if (role === "admin") return "Administrador com acesso total";
  if (role === "commercial") return "Equipe comercial";
  if (role === "operations") return "Equipe de operações";
  if (role === "finance") return "Equipe financeira";
  return "Acesso somente para consulta";
}
