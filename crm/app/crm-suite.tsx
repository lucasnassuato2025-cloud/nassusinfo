"use client";

import { useState } from "react";

import CRMPro from "@/app/crm-pro";
import { InstallmentsPanel, ReportsModule, TasksModule } from "@/app/operations";
import { Client, Payment, Project, SiteAudit } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";

type SuiteModule = "crm" | "tasks" | "installments" | "reports";

type Props = {
  initialClients: Client[];
  initialProjects: Project[];
  initialPayments: Payment[];
  initialAudits: SiteAudit[];
  user: { name: string; email: string };
};

const MODULES: Array<{ id: SuiteModule; label: string; icon: string; eyebrow: string; title: string }> = [
  { id: "crm", label: "CRM principal", icon: "⌂", eyebrow: "GESTÃO COMERCIAL", title: "Central de negócios" },
  { id: "tasks", label: "Agenda", icon: "✓", eyebrow: "OPERAÇÃO DIÁRIA", title: "Tarefas e histórico" },
  { id: "installments", label: "Parcelas", icon: "R$", eyebrow: "CONTROLE FINANCEIRO", title: "Cronograma de recebimentos" },
  { id: "reports", label: "Relatórios", icon: "▥", eyebrow: "INTELIGÊNCIA DO NEGÓCIO", title: "Indicadores e exportação" },
];

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
  const [payments, setPayments] = useState(initialPayments);
  const definition = MODULES.find((item) => item.id === activeModule) || MODULES[0];

  async function signOut() {
    await neonClient.auth.signOut();
    window.location.replace("/sign-in");
  }

  function renderOperation() {
    if (activeModule === "tasks") {
      return <TasksModule clients={initialClients} projects={initialProjects} />;
    }
    if (activeModule === "installments") {
      return (
        <InstallmentsPanel
          payments={payments}
          clients={initialClients}
          projects={initialProjects}
          onPaymentChange={(payment) => setPayments((current) => current.map((item) => item.id === payment.id ? payment : item))}
        />
      );
    }
    return <ReportsModule clients={initialClients} projects={initialProjects} payments={payments} />;
  }

  if (activeModule === "crm") {
    return (
      <>
        <CRMPro
          initialClients={initialClients}
          initialProjects={initialProjects}
          initialPayments={payments}
          initialAudits={initialAudits}
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
        <div className="suite-help"><span>CENTRAL OPERACIONAL</span><strong>Organize o trabalho e receba no prazo.</strong><small>Agenda, parcelas e relatórios ligados aos dados do seu CRM.</small></div>
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
