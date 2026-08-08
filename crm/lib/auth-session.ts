"use client";

import { reportClientIssue } from "@/lib/client-diagnostics";
import { neonClient } from "@/lib/neon";

export type AuthSessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

type SessionPayload = {
  user?: AuthSessionUser | null;
  session?: { user?: AuthSessionUser | null } | null;
} | null;

function pause(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function sessionUser(data: unknown): AuthSessionUser | null {
  const payload = (data || null) as SessionPayload;
  return payload?.user ?? payload?.session?.user ?? null;
}

export async function waitForAuthenticatedUser(expectedEmail?: string, attempts = 6): Promise<AuthSessionUser | null> {
  let lastError: unknown = null;
  const delays = [0, 80, 160, 260, 420, 650];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await pause(delays[Math.min(attempt, delays.length - 1)]);

    const result = await neonClient.auth.getSession();
    if (result.error) lastError = result.error;

    const user = sessionUser(result.data);
    if (user?.email && (!expectedEmail || user.email.toLocaleLowerCase("pt-BR") === expectedEmail.toLocaleLowerCase("pt-BR"))) {
      return user;
    }
  }

  if (lastError) {
    reportClientIssue("auth_session_unavailable", lastError);
    throw lastError;
  }
  return null;
}

export async function claimWorkspaceWithRetry(attempts = 5): Promise<unknown> {
  const delays = [0, 100, 220, 380, 600];
  let lastError: unknown = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await pause(delays[Math.min(attempt, delays.length - 1)]);

    const result = await (neonClient as any).rpc("crm_claim_membership");
    if (!result.error) return result.data;

    lastError = result.error;
    const message = String(result.error?.message || "");
    const isFreshSessionRace = /sess[aã]o inv[aá]lida|jwt|token|auth/i.test(message);
    if (!isFreshSessionRace) {
      reportClientIssue("workspace_claim_failed", result.error);
      throw result.error;
    }

    await neonClient.auth.getSession();
  }

  const finalError = lastError || new Error("Não foi possível validar a sessão do workspace.");
  reportClientIssue("workspace_claim_failed", finalError);
  throw finalError;
}
