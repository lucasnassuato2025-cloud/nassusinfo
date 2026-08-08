import { createHash, randomUUID } from "node:crypto";

import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const MAX_BODY_BYTES = 800_000;
const MAX_FAILURES_PER_IP = 5;
const MAX_FAILURES_PER_LINK = 20;
const FAILURE_WINDOW_MINUTES = 15;

type SigningRequest = {
  name?: "public_open_signing_document" | "public_submit_document_signature";
  payload?: Record<string, unknown>;
};

type DatabaseConnection = { sql: any; key: string };
type SigningLinkGuard = {
  id: string | number;
  owner_id: string;
  document_id: string | number;
  status: string;
  expires_at: string;
  access_code_hash: string;
};
type RequestEvidence = {
  ip_hash: string;
  user_agent: string;
  request_id: string;
  origin: string;
  captured_at: string;
};

class PublicSigningError extends Error {
  status: number;
  retryAfter?: number;

  constructor(message: string, status = 400, retryAfter?: number) {
    super(message);
    this.name = "PublicSigningError";
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

function text(value: unknown, maxLength = 500_000): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function digits(value: unknown): string {
  return text(value, 24).replace(/\D/g, "").slice(0, 14);
}

function connectionCandidates(): Array<[string, string]> {
  const keys = [
    "CRM_DATABASE_URL",
    "POSTGRES_URL",
    "DATABASE_URL_UNPOOLED",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_PRISMA_URL",
    "NEON_DATABASE_URL",
    "DATABASE_URL",
  ];
  const seen = new Set<string>();
  const result: Array<[string, string]> = [];
  for (const key of keys) {
    const value = process.env[key];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push([key, value]);
  }
  return result;
}

async function connectDatabase(): Promise<DatabaseConnection> {
  const candidates = connectionCandidates();
  if (!candidates.length) throw new Error("Conexão segura da assinatura não configurada.");

  for (const [key, url] of candidates) {
    try {
      const sql = neon(url);
      const rows = await sql`select to_regclass('public.document_signing_links')::text as relation`;
      if (rows[0]?.relation) return { sql, key };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason || "");
      console.warn(JSON.stringify({ level: "warning", msg: "public_signing_database_candidate_failed", connection: key, error: message.slice(0, 180) }));
    }
  }

  throw new Error("Conexão segura da assinatura não configurada para o banco do CRM.");
}

function requestEvidence(request: Request): RequestEvidence {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  const origin = request.headers.get("origin") || "";
  return {
    ip_hash: createHash("sha256").update(ip).digest("hex"),
    user_agent: text(request.headers.get("user-agent"), 350),
    request_id: text(request.headers.get("x-vercel-id"), 160) || randomUUID(),
    origin: text(origin, 250),
    captured_at: new Date().toISOString(),
  };
}

function validateRequestOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  try {
    const originUrl = new URL(origin);
    const host = request.headers.get("host") || new URL(request.url).host;
    const sameHost = originUrl.host === host;
    const canonical = origin === "https://crm.nassusinfo.com.br" || origin === "https://nassus-crm.vercel.app";
    if (!sameHost && !canonical) throw new Error("origin");
  } catch {
    throw new PublicSigningError("Origem da solicitação não autorizada.", 403);
  }
}

function errorMessage(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  const known = [
    "Link de assinatura inválido",
    "Este link não está disponível",
    "Este link expirou",
    "Código de acesso incorreto",
    "Link de assinatura inválido ou já utilizado",
    "É necessário aceitar a declaração de consentimento",
    "Informe o nome completo",
    "Método de assinatura inválido",
    "Assinatura inválida",
    "A versão do documento foi alterada",
    "Este documento já foi assinado",
    "Documento de identificação não confere",
    "Conexão segura da assinatura não configurada",
    "Muitas tentativas incorretas",
    "Origem da solicitação não autorizada",
  ];
  return known.find((item) => message.includes(item)) || "Não foi possível concluir a assinatura. Confira os dados e tente novamente.";
}

async function loadSigningLink(sql: any, tokenHash: string): Promise<SigningLinkGuard | null> {
  const rows = await sql`
    select id, owner_id, document_id, status, expires_at, access_code_hash
    from public.document_signing_links
    where token_hash = ${tokenHash}
    limit 1
  `;
  return (rows[0] as SigningLinkGuard | undefined) || null;
}

async function recordSecurityEvent(
  sql: any,
  link: SigningLinkGuard,
  eventType: string,
  description: string,
  evidence: RequestEvidence,
) {
  await sql`
    insert into public.document_events(owner_id, document_id, signing_link_id, event_type, description, evidence)
    values (${link.owner_id}, ${Number(link.document_id)}, ${Number(link.id)}, ${eventType}, ${description}, ${JSON.stringify(evidence)}::jsonb)
  `;
}

async function enforceAttemptLimit(sql: any, link: SigningLinkGuard, evidence: RequestEvidence) {
  const counts = await sql`
    select
      count(*) filter (where evidence->>'ip_hash' = ${evidence.ip_hash})::int as ip_failures,
      count(*)::int as link_failures
    from public.document_events
    where signing_link_id = ${Number(link.id)}
      and event_type in ('acesso_negado', 'identidade_recusada')
      and created_at >= now() - interval '15 minutes'
  `;
  const ipFailures = Number(counts[0]?.ip_failures || 0);
  const linkFailures = Number(counts[0]?.link_failures || 0);

  if (ipFailures >= MAX_FAILURES_PER_IP || linkFailures >= MAX_FAILURES_PER_LINK) {
    throw new PublicSigningError(
      `Muitas tentativas incorretas. Aguarde ${FAILURE_WINDOW_MINUTES} minutos e tente novamente.`,
      429,
      FAILURE_WINDOW_MINUTES * 60,
    );
  }
}

async function validateAccessCode(sql: any, link: SigningLinkGuard, codeHash: string, evidence: RequestEvidence) {
  await enforceAttemptLimit(sql, link, evidence);
  if (link.access_code_hash === codeHash) return;

  await recordSecurityEvent(sql, link, "acesso_negado", "Código de acesso incorreto no portal público.", evidence);
  throw new PublicSigningError("Link ou código de acesso inválido.", 400);
}

async function openDocument(sql: any, tokenHash: string, codeHash: string, signerDocument: string) {
  const rows = await sql`
    select public.public_open_signing_document(
      ${tokenHash},
      ${codeHash},
      ${signerDocument}
    ) as result
  `;
  return rows[0]?.result ?? null;
}

function responseHeaders(extra?: Record<string, string>) {
  return {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
    ...extra,
  };
}

export async function GET() {
  try {
    const { key } = await connectDatabase();
    return NextResponse.json({ ok: true, service: "public-signing", connection: key }, { headers: responseHeaders() });
  } catch (reason) {
    return NextResponse.json({ ok: false, message: errorMessage(reason) }, { status: 503, headers: responseHeaders() });
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const evidence = requestEvidence(request);
  let action = "unknown";
  let link: SigningLinkGuard | null = null;
  let sql: any = null;

  try {
    validateRequestOrigin(request);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > MAX_BODY_BYTES) throw new PublicSigningError("Solicitação de assinatura muito grande.", 413);

    const body = (await request.json()) as SigningRequest;
    const payload = body.payload || {};
    action = body.name || "unknown";
    const tokenHash = text(payload.p_token_hash, 64);
    const codeHash = text(payload.p_access_code_hash, 64);
    const signerDocument = digits(payload.p_signer_document);

    if (!HASH_PATTERN.test(tokenHash) || !HASH_PATTERN.test(codeHash)) {
      throw new PublicSigningError("Link ou código de acesso inválido.", 400);
    }
    if (![11, 14].includes(signerDocument.length)) {
      throw new PublicSigningError("Informe um CPF ou CNPJ válido para confirmar sua identidade.", 400);
    }

    const connection = await connectDatabase();
    sql = connection.sql;
    link = await loadSigningLink(sql, tokenHash);
    if (!link) throw new PublicSigningError("Link ou código de acesso inválido.", 400);

    await validateAccessCode(sql, link, codeHash, evidence);

    if (body.name === "public_open_signing_document") {
      try {
        const result = await openDocument(sql, tokenHash, codeHash, signerDocument);
        await recordSecurityEvent(sql, link, "acesso_validado", "Identidade validada no portal público de assinatura.", evidence);
        console.log(JSON.stringify({ level: "info", msg: "public_signing_open_success", requestId: evidence.request_id, ms: Date.now() - startedAt }));
        return NextResponse.json(result, { headers: responseHeaders() });
      } catch (reason) {
        if (/Documento de identificação não confere/i.test(reason instanceof Error ? reason.message : String(reason || ""))) {
          await recordSecurityEvent(sql, link, "identidade_recusada", "CPF/CNPJ informado não corresponde ao documento esperado.", evidence);
        }
        throw reason;
      }
    }

    if (body.name === "public_submit_document_signature") {
      const signerName = text(payload.p_signer_name, 250);
      const signerEmail = text(payload.p_signer_email, 250);
      const signerPhone = text(payload.p_signer_phone, 60);
      const signatureMethod = text(payload.p_signature_method, 20);
      const signatureData = text(payload.p_signature_data, 500_000);
      const documentHash = text(payload.p_document_hash, 64);
      const consent = payload.p_consent === true;

      try {
        const rows = await sql`
          select public.public_submit_document_signature(
            ${tokenHash},
            ${codeHash},
            ${signerDocument},
            ${signerName},
            ${signerEmail},
            ${signerPhone},
            ${signatureMethod},
            ${signatureData},
            ${consent},
            ${documentHash}
          ) as result
        `;
        const result = rows[0]?.result ?? null;
        await recordSecurityEvent(sql, link, "assinatura_confirmada_api", "Assinatura confirmada pelo gateway público protegido.", evidence);
        console.log(JSON.stringify({ level: "info", msg: "public_signing_submit_success", requestId: evidence.request_id, ms: Date.now() - startedAt }));
        return NextResponse.json(result, { headers: responseHeaders() });
      } catch (reason) {
        if (/Documento de identificação não confere/i.test(reason instanceof Error ? reason.message : String(reason || ""))) {
          await recordSecurityEvent(sql, link, "identidade_recusada", "CPF/CNPJ informado não corresponde ao documento esperado.", evidence);
        }
        throw reason;
      }
    }

    throw new PublicSigningError("Operação de assinatura inválida.", 400);
  } catch (reason) {
    const message = errorMessage(reason);
    const status = reason instanceof PublicSigningError ? reason.status : /Muitas tentativas/i.test(message) ? 429 : 400;
    const retryAfter = reason instanceof PublicSigningError ? reason.retryAfter : undefined;
    console.error(JSON.stringify({
      level: status >= 500 ? "error" : "warning",
      msg: "public_signing_request_failed",
      action,
      requestId: evidence.request_id,
      status,
      error: message,
      ms: Date.now() - startedAt,
    }));
    return NextResponse.json(
      { message },
      { status, headers: responseHeaders(retryAfter ? { "Retry-After": String(retryAfter) } : undefined) },
    );
  }
}
