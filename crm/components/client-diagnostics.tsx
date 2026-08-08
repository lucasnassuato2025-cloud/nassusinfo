"use client";

import { useEffect } from "react";

import { reportClientIssue } from "@/lib/client-diagnostics";

export function ClientDiagnostics() {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reportClientIssue("ui_error", event.error || event.message);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      reportClientIssue("unhandled_rejection", event.reason);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}
