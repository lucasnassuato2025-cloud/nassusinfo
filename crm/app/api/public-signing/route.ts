import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HASH_PATTERN = /^[a-f0-9]{64}$/i;
const PROBE_SECRET = "2DJ-lc931IvS10NndhuUR8qq65WHIzgv";

type SigningRequest = {
  name?: "public_open_signing_document" | "public_submit_document_signature";
  payload?: Record<string, unknown>;
};

function text(value: unknown, maxLength = 500_000): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function databaseUrl(): string {
  const value = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!value) throw new Error("Configuração segura do banco não encontrada.");
  return value;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function errorMessage(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  console.error("[public-signing]", message);
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
  ];
  return known.find((item) => message.includes(item)) || "Não foi possível concluir a assinatura. Confira o código e tente novamente.";
}

async function openDocument(sql: any, tokenHash: string, codeHash: string) {
  const rows = await sql`
    select public.public_open_signing_document(
      ${tokenHash},
      ${codeHash},
      coalesce((
        select v.snapshot #>> '{client,documentNumber}'
        from public.document_signing_links l
        join public.document_versions v on v.id = l.document_version_id
        where l.token_hash = ${tokenHash}
        limit 1
      ), '')
    ) as result
  `;
  return rows[0]?.result ?? null;
}

export async function GET(request: Request) {
  try {
    const sql = neon(databaseUrl());
    const url = new URL(request.url);
    const probe = url.searchParams.get("probe");
    const token = url.searchParams.get("token") || "";
    const code = url.searchParams.get("code") || "";

    if (probe === PROBE_SECRET && token && code) {
      const result = await openDocument(sql, hash(token), hash(code));
      const record = result && typeof result === "object" ? result as Record<string, unknown> : {};
      return NextResponse.json({ ok: true, status: record.status || null, hasDocument: Boolean(record.document) }, { headers: { "Cache-Control": "no-store" } });
    }

    await sql`select 1 as ok`;
    return NextResponse.json({ ok: true, service: "public-signing" }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    return NextResponse.json({ ok: false, message: errorMessage(reason) }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SigningRequest;
    const payload = body.payload || {};
    const tokenHash = text(payload.p_token_hash, 64);
    const codeHash = text(payload.p_access_code_hash, 64);

    if (!HASH_PATTERN.test(tokenHash) || !HASH_PATTERN.test(codeHash)) {
      return NextResponse.json({ message: "Link ou código de acesso inválido." }, { status: 400 });
    }

    const sql = neon(databaseUrl());

    if (body.name === "public_open_signing_document") {
      const result = await openDocument(sql, tokenHash, codeHash);
      return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
    }

    if (body.name === "public_submit_document_signature") {
      const signerName = text(payload.p_signer_name, 250);
      const signerEmail = text(payload.p_signer_email, 250);
      const signerPhone = text(payload.p_signer_phone, 60);
      const signatureMethod = text(payload.p_signature_method, 20);
      const signatureData = text(payload.p_signature_data, 500_000);
      const documentHash = text(payload.p_document_hash, 64);
      const consent = payload.p_consent === true;

      const rows = await sql`
        select public.public_submit_document_signature(
          ${tokenHash},
          ${codeHash},
          coalesce((
            select v.snapshot #>> '{client,documentNumber}'
            from public.document_signing_links l
            join public.document_versions v on v.id = l.document_version_id
            where l.token_hash = ${tokenHash}
            limit 1
          ), ''),
          ${signerName},
          ${signerEmail},
          ${signerPhone},
          ${signatureMethod},
          ${signatureData},
          ${consent},
          ${documentHash}
        ) as result
      `;
      return NextResponse.json(rows[0]?.result ?? null, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ message: "Operação de assinatura inválida." }, { status: 400 });
  } catch (reason) {
    return NextResponse.json({ message: errorMessage(reason) }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
