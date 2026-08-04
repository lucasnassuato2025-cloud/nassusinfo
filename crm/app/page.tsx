"use client";

import { useEffect, useState } from "react";

import DashboardClient from "@/app/dashboard-client";
import { Client, mapClient } from "@/lib/clients";
import { neonClient } from "@/lib/neon";

const CLIENT_COLUMNS =
  "id, name, company, segment, phone, email, status, estimated_value, next_action, next_action_date, notes, created_at, updated_at";

type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

type DashboardUser = {
  name: string;
  email: string;
};

export default function HomePage() {
  const [clients, setClients] = useState<Client[]>([]);
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

        const query = await neonClient
          .from("clients")
          .select(CLIENT_COLUMNS)
          .order("updated_at", { ascending: false })
          .order("id", { ascending: false });

        if (query.error) {
          throw new Error(query.error.message || "Não foi possível carregar os clientes.");
        }

        if (!active) return;

        const rows = (query.data ?? []) as Parameters<typeof mapClient>[0][];
        setClients(rows.map(mapClient));
        setUser({
          name: currentUser.name || currentUser.email.split("@")[0],
          email: currentUser.email,
        });
      } catch (reason) {
        if (!active) return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível abrir o CRM.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <main className="login-page">
        <section className="login-card">
          <small>CARREGANDO</small>
          <h2>Abrindo o Nassus CRM...</h2>
          <p>Validando seu acesso e buscando seus clientes.</p>
        </section>
      </main>
    );
  }

  if (error) {
    return (
      <main className="login-page">
        <section className="login-card">
          <small>ATENÇÃO</small>
          <h2>Não foi possível abrir o CRM</h2>
          <p className="login-error">{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Tentar novamente
          </button>
        </section>
      </main>
    );
  }

  if (!user) return null;

  return <DashboardClient initialClients={clients} user={user} />;
}
