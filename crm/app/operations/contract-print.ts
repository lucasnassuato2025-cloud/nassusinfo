import type { ContractSnapshot, DocumentSignature } from "./contract-utils";
import { formatCurrency } from "./contract-utils";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function value(record: Record<string, unknown>, key: string): string {
  return record[key] == null ? "" : String(record[key]);
}

function paragraphs(text: string): string {
  return escapeHtml(text)
    .split(/\n+/)
    .filter(Boolean)
    .map((item) => `<p>${item}</p>`)
    .join("");
}

function address(record: Record<string, unknown>): string {
  return [
    value(record, "address"),
    value(record, "addressNumber"),
    value(record, "complement"),
    value(record, "neighborhood"),
    value(record, "city"),
    value(record, "state"),
    value(record, "zipCode"),
  ].filter(Boolean).join(", ");
}

export function openDocumentPrint(
  snapshot: ContractSnapshot,
  hash: string,
  signature?: DocumentSignature | null,
) {
  const popup = window.open("", "_blank", "width=980,height=800");
  if (!popup) throw new Error("O navegador bloqueou a janela de impressão.");

  const issuer = snapshot.issuer;
  const client = snapshot.client;
  const logoUrl = new URL("/api/brand-logo?v=9", window.location.origin).href;
  const signatureMarkup = signature
    ? signature.signatureMethod === "drawn"
      ? `<img class="signature-image" src="${escapeHtml(signature.signatureData)}" alt="Assinatura"/>`
      : `<div class="signature-typed">${escapeHtml(signature.signatureData)}</div>`
    : "";

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(snapshot.document.title)}</title>
  <style>
    @page{size:A4;margin:15mm}
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#172033;font:13px/1.55 Arial,sans-serif}
    .page{max-width:790px;margin:auto}
    .head{display:flex;justify-content:space-between;gap:24px;padding-bottom:18px;border-bottom:3px solid #315cff}
    .brand{display:flex;align-items:center;gap:12px}
    .brand-logo{width:58px;height:58px;display:block;object-fit:contain}
    .brand strong{display:block;font-size:18px}
    .brand small,.meta span{color:#667085}
    .meta{text-align:right}
    .meta b{display:block;color:#315cff;font-size:10px;letter-spacing:.13em}
    .meta strong{display:block;font-size:17px}
    .title{padding:25px 0 15px}
    .title span,.box span,.project span{font-size:9px;font-weight:800;letter-spacing:.13em;color:#315cff}
    .title h1{margin:6px 0;font-size:25px;line-height:1.2}
    .parties{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .box,.project{border:1px solid #dce3ee;border-radius:11px;padding:14px}
    .box strong,.project strong{display:block;margin:5px 0;font-size:14px}
    .box p,.project p{margin:2px 0;color:#48556b}
    .value{margin:17px 0;padding:15px 18px;border:1px solid #cbdcff;border-radius:12px;background:#eff5ff}
    .value strong{display:block;color:#183f9c;font-size:22px}
    .value p{margin:3px 0 0}
    .section{margin:20px 0}
    .section h2{margin:0 0 8px;padding-bottom:6px;border-bottom:1px solid #dce3ee;font-size:14px}
    .section p{margin:7px 0}
    .services{display:grid;gap:7px}
    .service{display:flex;justify-content:space-between;gap:18px;padding:9px 0;border-bottom:1px solid #edf0f5}
    .service p{margin:2px 0;color:#5f6b7e}
    .signature-area{display:grid;grid-template-columns:1fr 1fr;gap:45px;margin-top:55px}
    .signature{min-height:100px;border-top:1px solid #657086;padding-top:7px;text-align:center}
    .signature-image{display:block;max-width:190px;max-height:70px;margin:-80px auto 6px}
    .signature-typed{margin:-52px 0 18px;font:italic 24px cursive}
    .audit{margin-top:32px;padding-top:10px;border-top:1px solid #dce3ee;color:#707b8c;font-size:9px}
    .audit code{display:block;word-break:break-all;color:#3f4a5d}
    .footer{text-align:center;margin-top:20px;color:#8892a2;font-size:9px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head>
<body>
<main class="page">
  <header class="head">
    <div class="brand">
      <img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="Logo oficial da Nassusinfo"/>
      <div><strong>Nassusinfo</strong><small>Soluções Tecnológicas</small></div>
    </div>
    <div class="meta">
      <b>${escapeHtml(snapshot.document.type.toUpperCase())}</b>
      <strong>${escapeHtml(snapshot.document.number)}</strong>
      <span>Versão ${snapshot.document.version}</span>
    </div>
  </header>
  <section class="title">
    <span>DOCUMENTO COMERCIAL</span>
    <h1>${escapeHtml(snapshot.document.title)}</h1>
    <p>Emissão: ${escapeHtml(snapshot.document.issueDate)}</p>
  </section>
  <section class="parties">
    <div class="box">
      <span>CONTRATADA</span>
      <strong>${escapeHtml(value(issuer, "tradeName") || value(issuer, "displayName"))}</strong>
      <p>${escapeHtml(value(issuer, "legalName"))}</p>
      <p>${escapeHtml(value(issuer, "documentType").toUpperCase())}: ${escapeHtml(value(issuer, "documentNumber") || "não informado")}</p>
      <p>${escapeHtml(address(issuer))}</p>
    </div>
    <div class="box">
      <span>CONTRATANTE</span>
      <strong>${escapeHtml(value(client, "tradeName") || value(client, "company") || value(client, "name"))}</strong>
      <p>Responsável: ${escapeHtml(value(client, "name"))}</p>
      <p>${escapeHtml(value(client, "documentType").toUpperCase())}: ${escapeHtml(value(client, "documentNumber"))}</p>
      <p>${escapeHtml(address(client))}</p>
    </div>
  </section>
  ${snapshot.project ? `<section class="project"><span>PROJETO</span><strong>${escapeHtml(value(snapshot.project, "name"))}</strong><p>${escapeHtml(value(snapshot.project, "serviceType"))}</p></section>` : ""}
  <section class="value"><span>VALOR</span><strong>${escapeHtml(formatCurrency(snapshot.document.amount))}</strong><p>${escapeHtml(snapshot.document.amountInWords)}</p></section>
  ${snapshot.services.length ? `<section class="section"><h2>Serviços contratados</h2><div class="services">${snapshot.services.map((item) => `<div class="service"><div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.description)}</p></div><b>${escapeHtml(formatCurrency(item.amount))}</b></div>`).join("")}</div></section>` : ""}
  <section class="section"><h2>Escopo e entregas</h2>${paragraphs(snapshot.document.scope)}</section>
  <section class="section"><h2>Condições de pagamento</h2>${paragraphs(snapshot.document.paymentTerms)}</section>
  ${snapshot.clauses.map((clause, index) => `<section class="section"><h2>${index + 1}. ${escapeHtml(clause.title)}</h2>${paragraphs(clause.body)}</section>`).join("")}
  ${snapshot.document.terms ? `<section class="section"><h2>Condições complementares</h2>${paragraphs(snapshot.document.terms)}</section>` : ""}
  ${snapshot.document.notes ? `<section class="section"><h2>Observações</h2>${paragraphs(snapshot.document.notes)}</section>` : ""}
  <section class="signature-area">
    <div class="signature">${escapeHtml(value(issuer, "legalName") || value(issuer, "displayName"))}<br>CONTRATADA</div>
    <div class="signature">${signatureMarkup}${escapeHtml(signature?.signerName || value(client, "name"))}<br>CONTRATANTE${signature ? `<br><small>${escapeHtml(new Date(signature.signedAt).toLocaleString("pt-BR"))}</small>` : ""}</div>
  </section>
  <section class="audit"><strong>HASH SHA-256 DA VERSÃO</strong><code>${escapeHtml(hash)}</code>${signature ? `<p>Assinatura eletrônica registrada pelo Nassus CRM. Documento: ${escapeHtml(signature.signerDocumentMasked)}.</p>` : ""}</section>
  <footer class="footer">Documento gerado pelo Nassus CRM Black Edition</footer>
</main>
<script>
window.onload=()=>{
  const images=[...document.images];
  Promise.all(images.map((image)=>image.complete?Promise.resolve():new Promise((resolve)=>{image.onload=resolve;image.onerror=resolve})))
    .finally(()=>setTimeout(()=>window.print(),250));
};
<\/script>
</body>
</html>`);
  popup.document.close();
}
