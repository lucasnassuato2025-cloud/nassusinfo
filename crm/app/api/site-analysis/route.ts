import { lookup as dnsLookup } from "node:dns";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { isIP } from "node:net";

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 20;

const MAX_HTML_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const MAX_REQUEST_BYTES = 4_096;

type Finding = {
  positives: string[];
  issues: string[];
  recommendations: string[];
};

type SafeFetchResult = {
  status: number;
  contentType: string;
  url: string;
  html: string;
};

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function compact(value: string): string {
  return decodeEntities(value.replace(/\s+/g, " ").trim());
}

function firstMatch(html: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return compact(match[1]);
  }
  return "";
}

function countMatches(value: string, pattern: RegExp): number {
  return (value.match(pattern) || []).length;
}

function ipv4IsPrivate(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return true;
  const [a, b, c] = octets;

  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function ipv6IsPrivate(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, "");
  const mapped = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/)?.[1];
  if (mapped) return ipv4IsPrivate(mapped);

  return normalized === "::"
    || normalized === "::1"
    || normalized === "0:0:0:0:0:0:0:0"
    || normalized === "0:0:0:0:0:0:0:1"
    || normalized.startsWith("fc")
    || normalized.startsWith("fd")
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith("ff")
    || normalized.startsWith("2001:db8");
}

function addressIsPrivate(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return ipv4IsPrivate(address);
  if (family === 6) return ipv6IsPrivate(address);
  return true;
}

function ensurePublicUrl(input: string): URL {
  if (!input || input.length > 2_048) throw new Error("Informe uma URL pública válida.");
  const parsed = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Use uma URL http ou https.");
  if (parsed.username || parsed.password) throw new Error("URLs com usuário ou senha não podem ser analisadas.");

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blockedName = hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname === "metadata.google.internal";
  if (blockedName) throw new Error("Endereços locais, internos ou de metadados não podem ser analisados.");
  if (isIP(hostname) && addressIsPrivate(hostname)) throw new Error("Endereços locais, reservados ou privados não podem ser analisados.");

  parsed.hash = "";
  return parsed;
}

function safeLookup(hostname: string, options: any, callback: any) {
  dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    if (!addresses.length || addresses.some((item) => addressIsPrivate(item.address))) {
      return callback(new Error("O domínio resolve para uma rede local, reservada ou privada."));
    }

    const requestedFamily = typeof options === "object" ? Number(options.family || 0) : 0;
    const selected = addresses.find((item) => !requestedFamily || item.family === requestedFamily) || addresses[0];
    if (typeof options === "object" && options.all) return callback(null, addresses);
    return callback(null, selected.address, selected.family);
  });
}

async function safeFetchHtml(initialUrl: URL, redirectCount = 0): Promise<SafeFetchResult> {
  if (redirectCount > MAX_REDIRECTS) throw new Error("O site realizou redirecionamentos demais.");
  const url = ensurePublicUrl(initialUrl.toString());
  const requestImpl = url.protocol === "https:" ? httpsRequest : httpRequest;

  return new Promise<SafeFetchResult>((resolve, reject) => {
    const request = requestImpl(url, {
      method: "GET",
      lookup: safeLookup,
      headers: {
        "user-agent": "NassusCRM-Audit/1.1 (+https://nassusinfo.com.br)",
        accept: "text/html,application/xhtml+xml",
        "accept-encoding": "identity",
        connection: "close",
      },
    }, (response) => {
      const status = response.statusCode || 0;
      const location = Array.isArray(response.headers.location) ? response.headers.location[0] : response.headers.location;
      if ([301, 302, 303, 307, 308].includes(status) && location) {
        response.resume();
        let nextUrl: URL;
        try {
          nextUrl = ensurePublicUrl(new URL(location, url).toString());
        } catch (reason) {
          reject(reason);
          return;
        }
        void safeFetchHtml(nextUrl, redirectCount + 1).then(resolve, reject);
        return;
      }

      if (status < 200 || status >= 300) {
        response.resume();
        reject(new Error(`O site respondeu com status ${status}.`));
        return;
      }

      const contentType = String(response.headers["content-type"] || "");
      if (!contentType.toLowerCase().includes("text/html") && !contentType.toLowerCase().includes("application/xhtml+xml")) {
        response.resume();
        reject(new Error("A URL não retornou uma página HTML."));
        return;
      }

      const encoding = String(response.headers["content-encoding"] || "identity").toLowerCase();
      if (encoding !== "identity") {
        response.resume();
        reject(new Error("O servidor não permitiu uma leitura HTML segura sem compressão."));
        return;
      }

      const declaredLength = Number(response.headers["content-length"] || 0);
      if (declaredLength > MAX_HTML_BYTES) {
        response.resume();
        reject(new Error("A página é grande demais para uma análise segura."));
        return;
      }

      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > MAX_HTML_BYTES) {
          response.destroy(new Error("A página excedeu o limite seguro de análise."));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => {
        resolve({ status, contentType, url: url.toString(), html: Buffer.concat(chunks).toString("utf8") });
      });
      response.on("error", reject);
    });

    request.setTimeout(12_000, () => request.destroy(new Error("A consulta ao site excedeu o tempo limite.")));
    request.on("error", reject);
    request.end();
  });
}

function validateBrowserOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("host") || request.nextUrl.host;
  try {
    if (new URL(origin).host !== host) throw new Error("origin");
  } catch {
    throw new Error("Origem da solicitação não autorizada.");
  }
}

export async function POST(request: NextRequest) {
  try {
    validateBrowserOrigin(request);
    const requestSize = Number(request.headers.get("content-length") || 0);
    if (requestSize > MAX_REQUEST_BYTES) return NextResponse.json({ error: "Solicitação muito grande." }, { status: 413 });

    const body = (await request.json()) as { url?: string };
    const url = ensurePublicUrl(String(body.url || "").trim());
    const fetched = await safeFetchHtml(url);
    const html = fetched.html;
    const lower = html.toLowerCase();

    const title = firstMatch(html, [/<title[^>]*>([\s\S]*?)<\/title>/i]);
    const description = firstMatch(html, [
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+name=["']description["'][^>]*>/i,
    ]);
    const canonical = firstMatch(html, [
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']*)["'][^>]*>/i,
      /<link[^>]+href=["']([^"']*)["'][^>]+rel=["']canonical["'][^>]*>/i,
    ]);
    const ogTitle = firstMatch(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i,
      /<meta[^>]+content=["']([^"']*)["'][^>]+property=["']og:title["'][^>]*>/i,
    ]);

    const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    const h1Count = countMatches(html, /<h1\b/gi);
    const imageCount = countMatches(html, /<img\b/gi);
    const imagesWithoutAlt = countMatches(html, /<img\b(?![^>]*\balt\s*=)[^>]*>/gi);
    const formCount = countMatches(html, /<form\b/gi);
    const hasWhatsapp = /wa\.me|api\.whatsapp\.com|whatsapp/i.test(lower);
    const hasInstagram = /instagram\.com/i.test(lower);
    const hasPhone = /(tel:|\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4})/i.test(html);
    const hasEmail = /(mailto:|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i.test(html);
    const hasCta = /(solicite|fale conosco|entre em contato|agende|orçamento|comprar|começar|saiba mais)/i.test(lower);
    const hasResponsiveCss = /@media\s*\(/i.test(html);
    const hasStructuredData = /application\/ld\+json/i.test(html);
    const usesHttps = fetched.url.startsWith("https://");

    let seoScore = 0;
    seoScore += title.length >= 20 && title.length <= 65 ? 20 : title ? 10 : 0;
    seoScore += description.length >= 70 && description.length <= 180 ? 20 : description ? 10 : 0;
    seoScore += canonical ? 12 : 0;
    seoScore += h1Count === 1 ? 15 : h1Count > 0 ? 7 : 0;
    seoScore += ogTitle ? 10 : 0;
    seoScore += hasStructuredData ? 8 : 0;
    seoScore += imageCount === 0 || imagesWithoutAlt === 0 ? 8 : imagesWithoutAlt / imageCount < 0.25 ? 5 : 0;
    seoScore += usesHttps ? 7 : 0;

    let mobileScore = 0;
    mobileScore += hasViewport ? 50 : 0;
    mobileScore += hasResponsiveCss ? 25 : 0;
    mobileScore += usesHttps ? 15 : 0;
    mobileScore += /width\s*:\s*100%|max-width/i.test(html) ? 10 : 0;

    let conversionScore = 0;
    conversionScore += hasWhatsapp ? 25 : 0;
    conversionScore += hasCta ? 25 : 0;
    conversionScore += hasPhone ? 15 : 0;
    conversionScore += hasEmail ? 10 : 0;
    conversionScore += formCount > 0 ? 15 : 0;
    conversionScore += hasInstagram ? 10 : 0;

    seoScore = Math.min(100, seoScore);
    mobileScore = Math.min(100, mobileScore);
    conversionScore = Math.min(100, conversionScore);
    const overallScore = Math.round(seoScore * 0.42 + mobileScore * 0.28 + conversionScore * 0.3);

    const findings: Finding = { positives: [], issues: [], recommendations: [] };
    if (title) findings.positives.push("A página possui título configurado.");
    else findings.issues.push("A página não possui um título identificável.");
    if (description) findings.positives.push("Existe uma descrição para mecanismos de busca.");
    else findings.issues.push("Meta description ausente.");
    if (hasViewport) findings.positives.push("A página declara suporte a dispositivos móveis.");
    else findings.issues.push("Meta viewport não encontrada.");
    if (hasWhatsapp) findings.positives.push("Há um caminho de contato pelo WhatsApp.");
    else findings.issues.push("Não foi encontrado um link claro para WhatsApp.");
    if (h1Count !== 1) findings.issues.push(`Foram encontrados ${h1Count} títulos H1; o ideal é um título principal claro.`);
    if (imageCount > 0 && imagesWithoutAlt > 0) findings.issues.push(`${imagesWithoutAlt} de ${imageCount} imagens parecem não ter texto alternativo.`);

    if (!canonical) findings.recommendations.push("Adicionar URL canônica para fortalecer o SEO.");
    if (!ogTitle) findings.recommendations.push("Configurar Open Graph para melhorar compartilhamentos em redes sociais.");
    if (!hasStructuredData) findings.recommendations.push("Adicionar dados estruturados adequados ao negócio.");
    if (!hasCta) findings.recommendations.push("Criar chamadas para ação mais visíveis e específicas.");
    if (formCount === 0) findings.recommendations.push("Considerar um formulário rápido de contato ou orçamento.");

    return NextResponse.json({
      url: fetched.url,
      title: title || url.hostname,
      overallScore,
      seoScore,
      mobileScore,
      conversionScore,
      report: {
        ...findings,
        details: {
          title,
          description,
          canonical,
          h1Count,
          imageCount,
          imagesWithoutAlt,
          hasViewport,
          hasWhatsapp,
          hasInstagram,
          hasPhone,
          hasEmail,
          formCount,
          usesHttps,
        },
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Não foi possível analisar o site.";
    return NextResponse.json({ error: message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
}
