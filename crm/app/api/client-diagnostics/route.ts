import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_EVENTS = new Set([
  "ui_error",
  "unhandled_rejection",
  "auth_session_unavailable",
  "workspace_claim_failed",
]);

function text(value: unknown, max = 300): string {
  return String(value ?? "").trim().slice(0, max);
}

function redact(value: unknown): string {
  return text(value, 500)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/\b\d{11,14}\b/g, "[document]")
    .replace(/\b[a-f0-9]{48,}\b/gi, "[token]")
    .replace(/\/assinar\/[^\s?#/]+/gi, "/assinar/[token]")
    .slice(0, 300);
}

function normalizeRoute(value: unknown): string {
  const route = text(value, 160);
  if (route.startsWith("/assinar/")) return "/assinar/[token]";
  return route.startsWith("/") ? route : "/";
}

function validateOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("host") || new URL(request.url).host;
    if (originUrl.host !== host) throw new Error("origin");
  } catch {
    throw new Error("Origem não autorizada");
  }
}

export async function POST(request: Request) {
  const requestId = text(request.headers.get("x-vercel-id"), 160) || randomUUID();
  try {
    validateOrigin(request);
    const size = Number(request.headers.get("content-length") || 0);
    if (size > 8_192) return NextResponse.json({ ok: false }, { status: 413 });

    const body = await request.json() as Record<string, unknown>;
    const event = text(body.event, 60);
    if (!ALLOWED_EVENTS.has(event)) return NextResponse.json({ ok: false }, { status: 400 });

    console.error(JSON.stringify({
      level: "error",
      msg: "crm_client_diagnostic",
      event,
      route: normalizeRoute(body.route),
      digest: text(body.digest, 120),
      error: redact(body.message),
      requestId,
    }));

    return NextResponse.json({ ok: true, requestId }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, requestId }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
