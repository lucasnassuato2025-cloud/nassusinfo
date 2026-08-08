import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function databaseUrl(): string {
  return process.env.CRM_DATABASE_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";
}

export async function GET() {
  const started = Date.now();
  try {
    const url = databaseUrl();
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
    }, { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } });
  } catch {
    return NextResponse.json({ ok: false, service: "nassus-crm", database: "unavailable", timestamp: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex" } });
  }
}
