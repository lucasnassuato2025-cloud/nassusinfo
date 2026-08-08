"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { neonClient } from "@/lib/neon";
import type { SessionUser } from "@/lib/session";
import { isTrialExpired, setActiveBusiness, trialDaysRemaining, type WorkspaceBusiness } from "@/lib/workspace";

type AppShellProps = {
  business: WorkspaceBusiness;
  user: SessionUser;
  clientCount?: number;
  memberCount?: number;
  children: ReactNode;
};

const NAV_ITEMS = [
  { href: "/", icon: "▣", label: "Dashboard" },
  { href: "/clientes", icon: "👥", label: "Clientes" },
  { href: "/agenda", icon: "▦", label: "Agenda" },
  { href: "/servicos", icon: "🛠", label: "Serviços" },
  { href: "/financeiro", icon: "R$", label: "Financeiro" },
  { href: "/orcamentos", icon: "▤", label: "Orçamentos" },
  { href: "/equipe", icon: "◉", label: "Equipe" },
  { href: "/relatorios", icon: "↗", label: "Relatórios" },
  { href: "/assinatura", icon: "◆", label: "Assinatura" },
  { href: "/configuracoes", icon: "⚙", label: "Configurações" },
];

export default function AppShell({ business, user, clientCount = 0, memberCount = 1, children }: AppShellProps) {
  const pathname = usePathname();
  const [businesses, setBusinesses] = useState<WorkspaceBusiness[]>([business]);
  const clientUsage = business.client_limit ? Math.min(100, (clientCount / business.client_limit) * 100) : 100;
  const userUsage = Math.min(100, (memberCount / business.user_limit) * 100);
  const trialDays = trialDaysRemaining(business);
  const trialExpired = isTrialExpired(business);

  useEffect(() => {
    let active = true;
    async function loadBusinesses() {
      const result = await neonClient.from("businesses").select("id,name,slug,plan,status,client_limit,user_limit,business_type,trial_ends_at,phone,email,document").order("name", { ascending: true });
      if (!active || result.error || !Array.isArray(result.data) || !result.data.length) return;
      setBusinesses(result.data as WorkspaceBusiness[]);
    }
    void loadBusinesses();
    return () => { active = false; };
  }, []);

  async function signOut() {
    await neonClient.auth.signOut();
    window.localStorage.removeItem("nassus_active_business_id");
    window.location.replace("/sign-in");
  }

  function BusinessSelect({ compact = false }: { compact?: boolean }) {
    if (businesses.length <= 1) return compact ? null : <strong>{business.name}</strong>;
    return <select className={compact ? "business-switch compact" : "business-switch"} value={business.id} onChange={(event) => setActiveBusiness(event.target.value)} aria-label="Selecionar empresa">{businesses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="side-brand" href="/" aria-label="Nassus Gestão — início">
          <div className="brand-mark">N</div>
          <div><strong>Nassus Gestão</strong><small>BUSINESS OS</small></div>
        </a>

        <div className="business-chip"><span>Empresa atual</span><BusinessSelect /></div>

        <nav className="nav" aria-label="Menu principal">
          {NAV_ITEMS.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <a key={item.href} className={active ? "active" : ""} href={item.href}><b>{item.icon}</b><span>{item.label}</span></a>;
          })}
        </nav>

        <div className="plan-box">
          <span>{business.plan === "essential" ? "Plano Essencial" : "Plano Profissional"}</span>
          <strong>{business.client_limit ? `${clientCount} / ${business.client_limit} clientes` : `${clientCount} clientes • ilimitado`}</strong>
          <div className="meter"><i style={{ width: `${clientUsage}%` }} /></div>
          <small>{memberCount}/{business.user_limit} usuários • {Math.round(userUsage)}% da capacidade</small>
          {business.plan === "essential" ? <a className="side-upgrade" href="/assinatura">Conhecer Profissional →</a> : null}
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="top-business"><strong>{business.name}</strong><small>{business.plan === "essential" ? "Essencial • 2 usuários • 90 clientes" : "Profissional • 10 usuários • clientes ilimitados"}</small></div>
          <BusinessSelect compact />
          <div className="top-actions">
            <a className="top-help" href="/configuracoes">Ajuda e configurações</a>
            <div className="top-user"><span>{(user.name || user.email || "U").slice(0, 1).toUpperCase()}</span><div><strong>{user.name || user.email}</strong><button type="button" onClick={signOut}>Sair</button></div></div>
          </div>
        </header>

        {business.status === "trial" ? <div className={trialExpired ? "trial-banner expired" : "trial-banner"}>{trialExpired ? <><strong>Seu período de teste terminou.</strong><span>Os dados continuam disponíveis para consulta, mas novas alterações estão bloqueadas.</span><a href="/assinatura">Escolher plano →</a></> : <><strong>Período de teste</strong><span>{trialDays === 1 ? "Último dia para testar todos os recursos." : `${trialDays} dias restantes para testar o Nassus Gestão.`}</span><a href="/assinatura">Ver planos →</a></>}</div> : null}

        <div className="mobile-nav" aria-label="Navegação móvel">
          {NAV_ITEMS.slice(0, 6).map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return <a key={item.href} className={active ? "active" : ""} href={item.href}><b>{item.icon}</b><span>{item.label}</span></a>;
          })}
        </div>

        {children}
      </div>
    </div>
  );
}
