"use client";

import { neonClient } from "@/lib/neon";
import { getCurrentUser, type SessionUser } from "@/lib/session";

export const ACTIVE_BUSINESS_KEY = "nassus_active_business_id";

export type WorkspaceBusiness = {
  id: string;
  name: string;
  slug: string;
  plan: "essential" | "professional";
  status: string;
  client_limit: number | null;
  user_limit: number;
  business_type: string;
  trial_ends_at?: string | null;
  phone?: string | null;
  email?: string | null;
  document?: string | null;
};

export type Workspace = {
  user: SessionUser;
  business: WorkspaceBusiness;
  businesses: WorkspaceBusiness[];
};

const BUSINESS_COLUMNS = "id,name,slug,plan,status,client_limit,user_limit,business_type,trial_ends_at,phone,email,document";

export async function loadWorkspace(): Promise<Workspace | null> {
  const user = await getCurrentUser();
  if (!user?.email) return null;

  const result = await neonClient
    .from("businesses")
    .select(BUSINESS_COLUMNS)
    .order("name", { ascending: true });

  if (result.error) throw result.error;
  const businesses = (Array.isArray(result.data) ? result.data : []) as WorkspaceBusiness[];
  if (!businesses.length) return { user, business: null as never, businesses: [] };

  const storedId = window.localStorage.getItem(ACTIVE_BUSINESS_KEY);
  const business = businesses.find((item) => item.id === storedId) || businesses[0];
  if (business.id !== storedId) window.localStorage.setItem(ACTIVE_BUSINESS_KEY, business.id);

  return { user, business, businesses };
}

export async function requireWorkspace(): Promise<Workspace | null> {
  const workspace = await loadWorkspace();
  if (!workspace) {
    window.location.replace("/sign-in");
    return null;
  }
  if (!workspace.business) {
    window.location.replace("/onboarding");
    return null;
  }
  return workspace;
}

export function setActiveBusiness(businessId: string) {
  window.localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
  window.location.reload();
}

export function trialDaysRemaining(business: WorkspaceBusiness): number | null {
  if (business.status !== "trial" || !business.trial_ends_at) return null;
  const remaining = new Date(business.trial_ends_at).getTime() - Date.now();
  return Math.max(0, Math.ceil(remaining / 86_400_000));
}

export function isTrialExpired(business: WorkspaceBusiness): boolean {
  return business.status === "trial" && Boolean(business.trial_ends_at) && new Date(business.trial_ends_at as string).getTime() <= Date.now();
}

export function friendlyWorkspaceError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String((reason as { message?: unknown } | null)?.message || "");
  if (/CLIENT_LIMIT_REACHED/.test(message)) return "Você atingiu o limite de 90 clientes do plano Essencial.";
  if (/USER_LIMIT_REACHED/.test(message)) return "Você atingiu o limite de usuários do seu plano.";
  if (/SUBSCRIPTION_REQUIRED/.test(message)) return "O período de teste terminou ou a assinatura precisa ser regularizada. Acesse Assinatura para continuar criando ou alterando dados.";
  if (/USER_NOT_FOUND/.test(message)) return "Esse e-mail ainda não possui uma conta no Nassus Gestão.";
  if (/ACCESS_DENIED|permission|row-level security/i.test(message)) return "Você não tem permissão para realizar esta ação.";
  if (/network|fetch|timeout/i.test(message)) return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  return message || "Não foi possível concluir a operação.";
}

export function formatMoney(value: number | string | null | undefined): string {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
}
