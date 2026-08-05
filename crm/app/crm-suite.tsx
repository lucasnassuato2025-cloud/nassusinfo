"use client";

import { useEffect, useState } from "react";

import CRMPro from "@/app/crm-pro";
import {
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

type SuiteModule = "crm" | "client360" | "infrastructure" | "tasks" | "documents" | "installments" | "alerts" | "reports";

type Props = {
  initialClients: Client[];
  initialProjects: Project[];
  initialPayments: Payment[];
  initialAudits: SiteAudit[];
  user: { name: string; email: string };
};

type DataRow = Record<string, unknown>;

type ModuleDefinition = {
  id: SuiteModule;
  label: string;
  icon: CRMIconName;
  eyebrow: string;
  title: string;
  description: string;
};

const MODULES: ModuleDefinition[] = [
  { id: "crm", label: "Central", icon: "home", eyebrow: "GESTÃO COMERCIAL", title: "Central de negócios", description: "Leads, clientes, projetos e financeiro." },
  { id: "client360", label: "Cliente 360°", icon: "user", eyebrow: "RELACIONAMENTO", title: "Ficha completa do cliente", description: "Toda a jornada em uma única visão." },
  { id: "infrastructure", label: "Infraestrutura", icon: "infrastructure", eyebrow: "SITES E TECNOLOGIA", title: "Infraestrutura digital", description: "Sites, acessos, renovações e custos." },
  { id: "tasks", label: "Agenda", icon: "calendar", eyebrow: "OPERAÇÃO DIÁRIA", title: "Agenda operacional", description: "Prioridades, prazos e histórico." },
  { id: "documents", label: "Documentos", icon: "document", eyebrow: "COMERCIAL", title: "Central de documentos", description: "Propostas, contratos e recibos." },
  { id: "installments", label: "Parcelas", icon: "installments", eyebrow: "CONTROLE FINANCEIRO", title: "Cronograma financeiro", description: "Recebimentos e parcelas por vencimento." },
  { id: "alerts", label: "Alertas", icon: "bell", eyebrow: "CENTRAL DE ATENÇÃO", title: "Central de alertas", description: "Cobranças, entregas e renovações." },
  { id: "reports", label: "Relatórios", icon: "chart", eyebrow: "INTELIGÊNCIA DO NEGÓCIO", title: "Inteligência executiva", description: "Indicadores, tendências e exportação." },
];

function rows(value: unknown): DataRow[] {
  return Array.isArray(value) ? (value as unknown as DataRow[]) : [];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "LN";
}

export default function CRMSuite({ initialClients, initialProjects, initialPayments, initialAudits, user }: Props) {
  const [activeModule, setActiveModule] = useState<SuiteModule>("crm");
  const [clients, setClients] = useState(initialClients);
  const [projects, setProjects] = useState(initialProjects);
  const [payments, setPayments] = useState(initialPayments);
  const [audits, setAudits] = useState(initialAudits);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const definition = MODULES.find((item) => item.id === activeModule) || MODULES[0];

  useEffect(() => {
    if (activeModule === "crm") return;
    let active = true;

    async function refreshData() {
      setRefreshing(true);
      setRefreshError("");
      const [clientQuery, projectQuery, paymentQuery, auditQuery] = await Promise.all([
        neonClient.from("clients").select(CLIENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
        neonClient.from("projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
        neonClient.from("payments").select(PAYMENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
        neonClient.from("site_audits").select(AUDIT_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false }),
      ]);
      if (!active) return;
      const error = clientQuery.error || projectQuery.error || paymentQuery.error || auditQuery.error;
      if (error) {
        setRefreshError(error.message || "Não foi possível atualizar os dados.");
      } else {
        setClients(rows(clientQuery.data).map(mapClient));
        setProjects(rows(projectQuery.data).map(mapProject));
        setPayments(rows(paymentQuery.data).map(mapPayment));
        setAudits(rows(auditQuery.data).map(mapSiteAudit));
      }
      setRefreshing(false);
    }

    void refreshData();
    return () => {
      active = false;
    };
  }, [activeModule]);

  async function signOut() {
    await neonClient.auth.signOut();
    window.location.replace("/sign-in");
  }

  function renderOperation() {
    if (refreshing) {
      return (
        <div className="suite-loading">
          <i />
          <strong>Sincronizando sua operação</strong>
          <span>Carregando os dados mais recentes com segurança.</span>
        </div>
      );
    }
    if (refreshError) {
      return (
        <div className="suite-loading suite-loading-error">
          <strong>Não foi possível atualizar</strong>
          <span>{refreshError}</span>
          <button type="button" className="pro-primary" onClick={() => setActiveModule("crm")}>Voltar à central</button>
        </div>
      );
    }
    if (activeModule === "client360") return <Client360Module clients={clients} projects={projects} payments={payments} audits={audits} />;
    if (activeModule === "infrastructure") return <InfrastructureModule clients={clients} projects={projects} />;
    if (activeModule === "tasks") return <TasksModule clients={clients} projects={projects} />;
    if (activeModule === "documents") return <DocumentsModule clients={clients} projects={projects} userName={user.name} />;
    if (activeModule === "installments") {
      return (
        <InstallmentsPanel
          payments={payments}
          clients={clients}
          projects={projects}
          onPaymentChange={(payment) => setPayments((current) => current.map((item) => item.id === payment.id ? payment : item))}
        />
      );
    }
    if (activeModule === "alerts") return <AlertsModule clients={clients} projects={projects} payments={payments} />;
    return <ReportsModule clients={clients} projects={projects} payments={payments} />;
  }

  if (activeModule === "crm") {
    return (
      <>
        <CRMPro
          initialClients={clients}
          initialProjects={projects}
          initialPayments={payments}
          initialAudits={audits}
          user={user}
        />
        <nav className="suite-dock" aria-label="Acesso rápido aos módulos operacionais">
          {MODULES.slice(1).map((item) => (
            <button type="button" key={item.id} title={item.description} onClick={() => setActiveModule(item.id)}>
              <i><CRMIcon name={item.icon} /></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </>
    );
  }

  return (
    <div className="suite-app">
      <aside className="suite-sidebar">
        <div className="suite-brand">
          <span aria-hidden="true" />
          <div><strong>Nassus CRM</strong><small>BLACK EDITION</small></div>
        </div>
        <div className="suite-nav-label">WORKSPACE</div>
        <nav>
          {MODULES.map((item) => (
            <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => setActiveModule(item.id)}>
              <i><CRMIcon name={item.icon} /></i>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="suite-help">
          <span>OPERAÇÃO NASSUSINFO</span>
          <strong>Um sistema. Toda a empresa.</strong>
          <small>Comercial, entrega, financeiro e infraestrutura conectados em tempo real.</small>
        </div>
        <div className="suite-user">
          <div>{initials(user.name)}</div>
          <section><strong>{user.name}</strong><small>{user.email}</small></section>
          <button type="button" onClick={signOut} aria-label="Sair do CRM"><CRMIcon name="logout" /></button>
        </div>
      </aside>

      <main className="suite-main">
        <header className="suite-topbar">
          <div className="suite-title-block">
            <span>{definition.eyebrow}</span>
            <h1>{definition.title}</h1>
            <p>{definition.description}</p>
          </div>
          <div className="suite-topbar-actions">
            <div className="suite-live"><i />Dados sincronizados</div>
            <button type="button" className="suite-back" onClick={() => setActiveModule("crm")}>
              <CRMIcon name="arrow-left" />
              <span>Voltar à central</span>
            </button>
          </div>
        </header>
        <div className="suite-content">{renderOperation()}</div>
      </main>

      <nav className="suite-mobile-nav" aria-label="Navegação móvel">
        {MODULES.map((item) => (
          <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => setActiveModule(item.id)}>
            <i><CRMIcon name={item.icon} /></i>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
