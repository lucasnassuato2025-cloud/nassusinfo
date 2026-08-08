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

export function sessionUser(data: unknown): SessionUser | null {
  const payload = (data || null) as SessionPayload;
  return payload?.user ?? payload?.session?.user ?? null;
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const result = await neonClient.auth.getSession();
  if (result.error) throw result.error;
  return sessionUser(result.data);
}
