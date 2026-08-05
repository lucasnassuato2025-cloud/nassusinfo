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

const MODULES: Array<{ id: SuiteModule; label: string; icon: string; eyebrow: string; title: string }> = [
  { id: "crm", label: "CRM principal", icon: "⌂", eyebrow: "GESTÃO COMERCIAL", title: "Central de negócios" },
  { id: "client360", label: "Cliente 360°", icon: "◉", eyebrow: "RELACIONAMENTO", title: "Ficha completa do cliente" },
  { id: "infrastructure", label: "Infraestrutura", icon: "◈", eyebrow: "SITES E TECNOLOGIA", title: "Sites, acessos, renovações e custos" },
  { id: "tasks", label: "Agenda", icon: "✓", eyebrow: "OPERAÇÃO DIÁRIA", title: "Tarefas e histórico" },
  { id: "documents", label: "Documentos", icon: "▤", eyebrow: "COMERCIAL", title: "Propostas, contratos e recibos" },
  { id: "installments", label: "Parcelas", icon: "R$", eyebrow: "CONTROLE FINANCEIRO", title: "Cronograma de recebimentos" },
  { id: "alerts", label: "Alertas", icon: "!", eyebrow: "CENTRAL DE ATENÇÃO", title: "Prazos, cobranças e renovações" },
  { id: "reports", label: "Relatórios", icon: "▥", eyebrow: "INTELIGÊNCIA DO NEGÓCIO", title: "Indicadores e exportação" },
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
      return <div className="suite-loading"><i /><strong>Atualizando informações...</strong><span>Buscando os dados mais recentes do CRM.</span></div>;
    }
    if (refreshError) {
      return <div className="suite-loading suite-loading-error"><strong>Não foi possível atualizar</strong><span>{refreshError}</span><button type="button" className="pro-primary" onClick={() => setActiveModule("crm")}>Voltar ao CRM</button></div>;
    }
    if (activeModule === "client360") {
      return <Client360Module clients={clients} projects={projects} payments={payments} audits={audits} />;
    }
    if (activeModule === "infrastructure") {
      return <InfrastructureModule clients={clients} projects={projects} />;
    }
    if (activeModule === "tasks") {
      return <TasksModule clients={clients} projects={projects} />;
    }
    if (activeModule === "documents") {
      return <DocumentsModule clients={clients} projects={projects} userName={user.name} />;
    }
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
    if (activeModule === "alerts") {
      return <AlertsModule clients={clients} projects={projects} payments={payments} />;
    }
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
        <nav className="suite-dock" aria-label="Central operacional">
          {MODULES.slice(1).map((item) => (
            <button type="button" key={item.id} onClick={() => setActiveModule(item.id)}>
              <i>{item.icon}</i><span>{item.label}</span>
            </button>
          ))}
        </nav>
      </>
    );
  }

  return (
    <div className="suite-app">
      <aside className="suite-sidebar">
        <div className="suite-brand"><span aria-hidden="true" /><div><strong>Nassus CRM</strong><small>PRO BUSINESS</small></div></div>
        <nav>
          {MODULES.map((item) => (
            <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => setActiveModule(item.id)}>
              <i>{item.icon}</i><span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="suite-help"><span>CENTRAL OPERACIONAL</span><strong>Do primeiro contato à renovação.</strong><small>Clientes, sites, acessos, documentos, agenda, parcelas, alertas e relatórios ligados aos dados do CRM.</small></div>
        <div className="suite-user"><div>{initials(user.name)}</div><section><strong>{user.name}</strong><small>{user.email}</small></section><button type="button" onClick={signOut} aria-label="Sair">↗</button></div>
      </aside>

      <main className="suite-main">
        <header className="suite-topbar"><div><span>{definition.eyebrow}</span><h1>{definition.title}</h1></div><button type="button" className="suite-back" onClick={() => setActiveModule("crm")}>← Voltar ao CRM</button></header>
        <div className="suite-content">{renderOperation()}</div>
      </main>

      <nav className="suite-mobile-nav">
        {MODULES.map((item) => (
          <button type="button" key={item.id} className={activeModule === item.id ? "active" : ""} onClick={() => setActiveModule(item.id)}><i>{item.icon}</i><span>{item.label}</span></button>
        ))}
      </nav>
    </div>
  );
}
