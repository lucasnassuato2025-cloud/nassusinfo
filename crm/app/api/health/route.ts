import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function databaseUrl(): string {
  return process.env.CRM_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
}

function headers() {
  return { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" };
}

export async function GET() {
  const started = Date.now();
  const url = databaseUrl();
  const isProduction = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" && Boolean(process.env.VERCEL);

  if (!url && !isProduction) {
    return NextResponse.json({
      ok: true,
      service: "nassus-crm",
      database: "not_configured",
      environment: "ci-or-local",
      version: process.env.npm_package_version || "1.2.0",
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    }, { headers: headers() });
  }

  try {
    if (!url) throw new Error("database_not_configured");
    const sql = neon(url);
    await sql`select 1 as ok`;
    const commit = (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 12);
    return NextResponse.json({
      ok: true,
      service: "nassus-crm",
      database: "ok",
      version: process.env.npm_package_version || "1.2.0",
      commit: commit || "manual-deploy",
      latencyMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    }, { headers: headers() });
  } catch {
    return NextResponse.json({ ok: false, service: "nassus-crm", database: "unavailable", timestamp: new Date().toISOString() }, { status: 503, headers: headers() });
  }
}
