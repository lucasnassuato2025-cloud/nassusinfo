"use client";

import { useEffect, useState } from "react";

import CRMSuite from "@/app/crm-suite";
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

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

type DashboardUser = {
  name: string;
  email: string;
};

type DataRow = Record<string, unknown>;

function rows(value: unknown): DataRow[] {
  return Array.isArray(value) ? value as DataRow[] : [];
}

function friendlyError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String((reason as { message?: unknown } | null)?.message || "");
  if (/not authorized|não foi autorizado/i.test(message)) return "Este e-mail ainda não foi autorizado no workspace do CRM.";
  if (/permission|row-level security/i.test(message)) return "O acesso ao workspace não foi concluído. Saia e entre novamente no CRM.";
  if (/network|fetch|timeout/i.test(message)) return "Não foi possível conectar ao servidor. Verifique a internet e tente novamente.";
  return message || "Não foi possível abrir o CRM.";
}

export default function HomePage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [audits, setAudits] = useState<SiteAudit[]>([]);
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadDashboard() {
      try {
        const sessionResult = await neonClient.auth.getSession();
        const authData = sessionResult.data as
          | { user?: SessionUser | null; session?: { user?: SessionUser | null } | null }
          | null;
        const currentUser = authData?.user ?? authData?.session?.user;

        if (!currentUser?.email) {
          window.location.replace("/sign-in");
          return;
        }

        const claim = await (neonClient as any).rpc("crm_claim_membership");
        if (claim.error) throw new Error(claim.error.message || "Não foi possível validar o workspace.");

        const [clientQuery, projectQuery, paymentQuery, auditQuery] = await Promise.all([
          neonClient.from("clients").select(CLIENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("payments").select(PAYMENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("site_audits").select(AUDIT_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false }),
        ]);

        // Clientes são a base do CRM. Falhas em módulos auxiliares não devem impedir a abertura do workspace.
        if (clientQuery.error) throw new Error(clientQuery.error.message || "Não foi possível carregar os clientes.");
        if (!active) return;

        setClients(rows(clientQuery.data).map(mapClient));
        if (!projectQuery.error) setProjects(rows(projectQuery.data).map(mapProject));
        if (!paymentQuery.error) setPayments(rows(paymentQuery.data).map(mapPayment));
        if (!auditQuery.error) setAudits(rows(auditQuery.data).map(mapSiteAudit));
        setUser({
          name: currentUser.name || currentUser.email.split("@")[0],
          email: currentUser.email,
        });
      } catch (reason) {
        if (active) setError(friendlyError(reason));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <main className="pro-boot">
        <div className="pro-boot-logo" aria-hidden="true" />
        <span>NASSUS CRM PRO</span>
        <h1>Validando o workspace e carregando seus dados...</h1>
        <div className="pro-boot-line"><i /></div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="pro-boot pro-boot-error">
        <div className="pro-boot-logo" aria-hidden="true" />
        <span>ATENÇÃO</span>
        <h1>Não foi possível abrir o CRM</h1>
        <p>{error}</p>
        <button type="button" className="pro-primary" onClick={() => window.location.reload()}>Tentar novamente</button>
      </main>
    );
  }

  if (!user) return null;

  return (
    <CRMSuite
      initialClients={clients}
      initialProjects={projects}
      initialPayments={payments}
      initialAudits={audits}
      user={user}
    />
  );
}
