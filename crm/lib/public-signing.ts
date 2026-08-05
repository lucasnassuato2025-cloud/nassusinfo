const DATA_API_URL = "https://ep-jolly-snow-awbq15u7.apirest.c-12.us-east-1.aws.neon.tech/neondb/rest/v1";

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function callPublicSigningRpc<T>(name: "public_open_signing_document" | "public_submit_document_signature", payload: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${DATA_API_URL}/rpc/${name}`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  const raw = await response.text();
  let parsed: unknown = null;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { parsed = raw; }
  if (!response.ok) {
    const candidate = parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
    throw new Error(String(candidate.message || candidate.details || candidate.hint || "Não foi possível concluir a assinatura."));
  }
  return parsed as T;
}
