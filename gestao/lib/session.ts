"use client";

import { neonClient } from "@/lib/neon";

export type SessionUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
};

type SessionPayload = {
  user?: SessionUser | null;
  session?: { user?: SessionUser | null } | null;
} | null;

type WaitOptions = { attempts?: number; delayMs?: number };

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function sessionUser(data: unknown): SessionUser | null {
  const payload = (data || null) as SessionPayload;
  return payload?.user ?? payload?.session?.user ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const result = await neonClient.auth.getSession();
  if (result.error) throw result.error;
  return sessionUser(result.data);
}

/**
 * Neon Auth can finish sign-in before the fresh browser session is observable by
 * the next Data API request. Wait for the session instead of redirecting into a
 * transient error state. This is intentionally bounded: real auth errors still
 * surface after the retry window.
 */
export async function waitForCurrentUser(options: WaitOptions = {}): Promise<SessionUser | null> {
  const attempts = Math.max(1, options.attempts ?? 8);
  const delayMs = Math.max(80, options.delayMs ?? 160);
  let lastError: unknown = null;

  for (let index = 0; index < attempts; index += 1) {
    try {
      const user = await getCurrentUser();
      if (user?.email) return user;
      lastError = null;
    } catch (reason) {
      lastError = reason;
    }

    if (index < attempts - 1) {
      await sleep(Math.min(700, delayMs + index * 80));
    }
  }

  if (lastError) throw lastError;
  return null;
}
