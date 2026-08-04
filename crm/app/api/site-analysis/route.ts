import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

type Finding = {
  positives: string[];
  issues: string[];
  recommendations: string[];
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

function ensurePublicUrl(input: string): URL {
  const parsed = new URL(input.startsWith("http") ? input : `https://${input}`);
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error("Use uma URL http ou https.");

  const hostname = parsed.hostname.toLowerCase();
  const blocked =
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname === "0.0.0.0" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

  if (blocked) throw new Error("Endereços locais ou privados não podem ser analisados.");
  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { url?: string };
    const url = ensurePublicUrl(String(body.url || "").trim());

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": "NassusCRM-Audit/1.0 (+https://nassusinfo.com.br)",
        accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      throw new Error(`O site respondeu com status ${response.status}.`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) throw new Error("A URL não retornou uma página HTML.");

    const html = (await response.text()).slice(0, 2_000_000);
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
    const usesHttps = response.url.startsWith("https://");

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
      url: response.url,
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
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Não foi possível analisar o site.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
