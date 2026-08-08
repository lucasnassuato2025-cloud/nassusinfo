"use client";

import { useEffect } from "react";

import { normalizeCrmError } from "@/lib/crm-errors";
import { reportClientIssue } from "@/lib/client-diagnostics";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const normalized = normalizeCrmError(error, "O módulo encontrou um erro inesperado.");

  useEffect(() => {
    reportClientIssue("route_error_boundary", error, { digest: error.digest || "" });
  }, [error]);

  return (
    <main className="pro-boot pro-boot-error">
      <div className="pro-boot-logo" aria-hidden="true" />
      <span>RECUPERAÇÃO SEGURA</span>
      <h1>{normalized.title}</h1>
      <p>{normalized.message}</p>
      <button type="button" className="pro-primary" onClick={reset}>Tentar novamente</button>
      <a href="/" style={{ marginTop: 10, color: "inherit" }}>Voltar à central</a>
    </main>
  );
}
