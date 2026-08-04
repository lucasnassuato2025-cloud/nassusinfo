"use client";

import { useEffect, useState } from "react";

import CRMPro from "@/app/crm-pro";
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
  return Array.isArray(value) ? (value as unknown as DataRow[]) : [];
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
          | {
              user?: SessionUser | null;
              session?: { user?: SessionUser | null } | null;
            }
          | null;
        const currentUser = authData?.user ?? authData?.session?.user;

        if (!currentUser?.email) {
          window.location.replace("/sign-in");
          return;
        }

        const [clientQuery, projectQuery, paymentQuery, auditQuery] = await Promise.all([
          neonClient.from("clients").select(CLIENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("projects").select(PROJECT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("payments").select(PAYMENT_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
          neonClient.from("site_audits").select(AUDIT_COLUMNS).order("created_at", { ascending: false }).order("id", { ascending: false }),
        ]);

        const firstError = clientQuery.error || projectQuery.error || paymentQuery.error || auditQuery.error;
        if (firstError) throw new Error(firstError.message || "Não foi possível carregar os dados do CRM.");
        if (!active) return;

        setClients(rows(clientQuery.data).map(mapClient));
        setProjects(rows(projectQuery.data).map(mapProject));
        setPayments(rows(paymentQuery.data).map(mapPayment));
        setAudits(rows(auditQuery.data).map(mapSiteAudit));
        setUser({
          name: currentUser.name || currentUser.email.split("@")[0],
          email: currentUser.email,
        });
      } catch (reason) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Não foi possível abrir o CRM.");
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
        <h1>Preparando sua central de negócios...</h1>
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
    <CRMPro
      initialClients={clients}
      initialProjects={projects}
      initialPayments={payments}
      initialAudits={audits}
      user={user}
    />
  );
}
