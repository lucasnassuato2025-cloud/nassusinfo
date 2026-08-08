"use client";

type ClientDiagnosticEvent = "ui_error" | "unhandled_rejection" | "auth_session_unavailable" | "workspace_claim_failed" | "route_error_boundary";

function safeRoute(): string {
  if (typeof window === "undefined") return "/";
  const path = window.location.pathname;
  return path.startsWith("/assinar/") ? "/assinar/[token]" : path.slice(0, 160);
}

export function reportClientIssue(event: ClientDiagnosticEvent, reason: unknown, digest = "") {
  if (typeof window === "undefined") return;
  const message = reason instanceof Error
    ? reason.message
    : String((reason as { message?: unknown } | null)?.message || reason || "Erro não identificado");

  void fetch("/api/client-diagnostics", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ event, message, digest: String(digest || "").slice(0, 160), route: safeRoute() }),
    keepalive: true,
    cache: "no-store",
  }).catch(() => undefined);
}
