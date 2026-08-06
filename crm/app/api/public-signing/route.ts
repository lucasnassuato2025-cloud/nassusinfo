import { neon } from "@neondatabase/serverless";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const HASH_PATTERN = /^[a-f0-9]{64}$/i;

type SigningRequest = {
  name?: "public_open_signing_document" | "public_submit_document_signature";
  payload?: Record<string, unknown>;
};

type DatabaseConnection = { sql: any; key: string };

function text(value: unknown, maxLength = 500_000): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function connectionCandidates(): Array<[string, string]> {
  const keys = [
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
  if (!candidates.length) throw new Error("Configuração segura do banco não encontrada.");

  for (const [key, url] of candidates) {
    try {
      const sql = neon(url);
      const rows = await sql`select to_regclass('public.document_signing_links')::text as relation`;
      if (rows[0]?.relation) return { sql, key };
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : String(reason || "");
      console.warn(`[public-signing] conexão ${key} indisponível: ${message}`);
    }
  }

  throw new Error(`Banco de contratos não encontrado nas conexões configuradas.`);
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

export async function GET() {
  try {
    const { key } = await connectDatabase();
    return NextResponse.json({ ok: true, service: "public-signing", connection: key }, { headers: { "Cache-Control": "no-store" } });
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

    const { sql } = await connectDatabase();

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
