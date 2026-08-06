import type { ContractSnapshot } from "./contract-utils";
import { formatCurrency } from "./contract-utils";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function value(record: Record<string, unknown> | null, key: string): string {
  if (!record) return "";
  return record[key] == null ? "" : String(record[key]);
}

function formatDate(valueToFormat: string): string {
  if (!valueToFormat) return "Não informada";
  const normalized = valueToFormat.slice(0, 10);
  return new Date(`${normalized}T12:00:00`).toLocaleDateString("pt-BR");
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

function firstLine(text: string): string {
  return text.split(/\n+/).map((item) => item.trim()).find(Boolean)?.slice(0, 650) || "serviços profissionais prestados";
}

function paymentMethod(method: string): string {
  const labels: Record<string, string> = {
    pix: "Pix",
    credito: "Cartão de crédito",
    debito: "Cartão de débito",
    boleto: "Boleto",
    dinheiro: "Dinheiro",
    transferencia: "Transferência bancária",
  };
  return labels[method] || method || "Não informada";
}

function quittance(snapshot: ContractSnapshot): string {
  const payment = snapshot.payment;
  const status = value(payment, "status");
  const total = Number(value(payment, "totalAmount") || snapshot.document.amount || 0);
  const paid = Number(value(payment, "paidAmount") || 0);

  if (status === "pago") return "quitação total exclusivamente do valor e do serviço descritos neste recibo";
  if (paid > 0 && paid < total) return "quitação parcial exclusivamente do valor descrito neste recibo";
  return "quitação exclusivamente do valor e do serviço descritos neste recibo";
}

function receiptReference(snapshot: ContractSnapshot): string {
  const paymentDescription = value(snapshot.payment, "description");
  const projectName = value(snapshot.project, "name");
  const site = value(snapshot.project, "websiteUrl") || value(snapshot.project, "domain");
  const parts = [paymentDescription, projectName && paymentDescription !== projectName ? projectName : "", site].filter(Boolean);
  return parts.length ? parts.join(" — ") : firstLine(snapshot.document.scope);
}

export function openReceiptPrint(snapshot: ContractSnapshot, hash: string) {
  const popup = window.open("", "_blank", "width=920,height=800");
  if (!popup) throw new Error("O navegador bloqueou a janela de impressão.");

  const issuer = snapshot.issuer;
  const client = snapshot.client;
  const payment = snapshot.payment;
  const issuerName = value(issuer, "legalName") || value(issuer, "displayName") || value(issuer, "tradeName");
  const issuerTradeName = value(issuer, "tradeName") || "Nassusinfo Soluções Tecnológicas";
  const clientName = value(client, "tradeName") || value(client, "company") || value(client, "name");
  const clientLegalName = value(client, "legalName") || value(client, "name") || clientName;
  const clientDocument = value(client, "documentNumber");
  const clientDocumentType = value(client, "documentType").toUpperCase() || "CPF/CNPJ";
  const issuerDocument = value(issuer, "documentNumber");
  const issuerDocumentType = value(issuer, "documentType").toUpperCase() || "CPF/CNPJ";
  const paidAt = value(payment, "paidAt") || snapshot.document.issueDate;
  const reference = receiptReference(snapshot);
  const logoUrl = new URL("/api/brand-logo?v=9", window.location.origin).href;
  const safeHash = hash && hash !== "RASCUNHO" ? hash : `${snapshot.document.number}-${snapshot.document.version}`;

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(snapshot.document.number)} — Recibo</title>
  <style>
    @page{size:A4;margin:16mm}
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#172033;font:13px/1.6 Arial,sans-serif}
    .page{max-width:790px;margin:auto}
    .head{display:flex;justify-content:space-between;align-items:center;gap:24px;padding-bottom:18px;border-bottom:3px solid #315cff}
    .brand{display:flex;align-items:center;gap:12px}.brand img{width:58px;height:58px;object-fit:contain}.brand strong{display:block;font-size:18px}.brand small{color:#667085}
    .meta{text-align:right}.meta b{display:block;color:#315cff;font-size:10px;letter-spacing:.14em}.meta strong{display:block;font-size:18px}.meta span{color:#667085}
    .title{text-align:center;padding:34px 0 22px}.title span{font-size:10px;font-weight:800;letter-spacing:.18em;color:#315cff}.title h1{margin:8px 0 4px;font-size:30px}.title p{margin:0;color:#667085}
    .amount{margin:8px 0 24px;padding:20px;border:1px solid #cbdcff;border-radius:14px;background:#eff5ff;text-align:center}.amount span{display:block;font-size:9px;font-weight:800;letter-spacing:.14em;color:#315cff}.amount strong{display:block;margin:5px 0;color:#183f9c;font-size:30px}.amount p{margin:0;color:#48556b}
    .statement{padding:22px;border:1px solid #dce3ee;border-radius:14px;font-size:15px;text-align:justify}.statement strong{color:#183f9c}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.box{border:1px solid #dce3ee;border-radius:12px;padding:15px}.box span{font-size:9px;font-weight:800;letter-spacing:.13em;color:#315cff}.box strong{display:block;margin:6px 0 3px;font-size:14px}.box p{margin:2px 0;color:#48556b}
    .details{margin-top:18px;border:1px solid #dce3ee;border-radius:12px;overflow:hidden}.details div{display:grid;grid-template-columns:190px 1fr;padding:10px 14px;border-bottom:1px solid #edf0f5}.details div:last-child{border-bottom:0}.details b{font-size:11px;color:#48556b}.details span{color:#172033}
    .issuer-sign{margin-top:36px;padding:20px;border:1px solid #cbdcff;border-radius:14px;background:#f8faff;text-align:center}.issuer-sign span{font-size:9px;font-weight:800;letter-spacing:.14em;color:#315cff}.issuer-sign strong{display:block;margin:8px 0 3px;font-size:17px}.issuer-sign p{margin:3px 0;color:#48556b}.issuer-sign .seal{display:inline-block;margin-top:12px;padding:7px 11px;border-radius:999px;background:#e7efff;color:#183f9c;font-size:10px;font-weight:800}
    .audit{margin-top:25px;padding-top:12px;border-top:1px solid #dce3ee;color:#707b8c;font-size:9px}.audit code{display:block;margin-top:4px;word-break:break-all;color:#3f4a5d}.notice{margin-top:13px;padding:10px 12px;border-radius:9px;background:#f6f7f9;color:#5f6b7e;font-size:10px}.footer{text-align:center;margin-top:20px;color:#8892a2;font-size:9px}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head>
<body>
<main class="page">
  <header class="head">
    <div class="brand"><img src="${escapeHtml(logoUrl)}" alt="Logo oficial da Nassusinfo"><div><strong>Nassusinfo</strong><small>Soluções Tecnológicas</small></div></div>
    <div class="meta"><b>RECIBO</b><strong>${escapeHtml(snapshot.document.number)}</strong><span>Emissão: ${escapeHtml(formatDate(snapshot.document.issueDate))}</span></div>
  </header>

  <section class="title"><span>COMPROVANTE DE PAGAMENTO</span><h1>Recibo de pagamento</h1><p>Documento eletrônico emitido pelo prestador</p></section>

  <section class="amount"><span>VALOR RECEBIDO</span><strong>${escapeHtml(formatCurrency(snapshot.document.amount))}</strong><p>${escapeHtml(snapshot.document.amountInWords || "Valor conforme indicado acima")}</p></section>

  <section class="statement">
    Recebi de <strong>${escapeHtml(clientLegalName)}</strong>${clientDocument ? `, inscrito(a) no ${escapeHtml(clientDocumentType)} sob o nº <strong>${escapeHtml(clientDocument)}</strong>` : ""}, a importância de <strong>${escapeHtml(formatCurrency(snapshot.document.amount))}</strong>${snapshot.document.amountInWords ? ` (${escapeHtml(snapshot.document.amountInWords.toLocaleLowerCase("pt-BR"))})` : ""}, referente a <strong>${escapeHtml(reference)}</strong>. O presente recibo representa ${escapeHtml(quittance(snapshot))}.
  </section>

  <section class="grid">
    <div class="box"><span>EMITENTE / CREDOR</span><strong>${escapeHtml(issuerTradeName)}</strong><p>${escapeHtml(issuerName)}</p><p>${escapeHtml(issuerDocumentType)}: ${escapeHtml(issuerDocument || "não informado")}</p><p>${escapeHtml(address(issuer))}</p></div>
    <div class="box"><span>PAGADOR</span><strong>${escapeHtml(clientName)}</strong><p>${escapeHtml(clientLegalName)}</p><p>${escapeHtml(clientDocumentType)}: ${escapeHtml(clientDocument || "não informado")}</p><p>${escapeHtml(address(client))}</p></div>
  </section>

  <section class="details">
    <div><b>Referente a</b><span>${escapeHtml(reference)}</span></div>
    <div><b>Forma de pagamento</b><span>${escapeHtml(paymentMethod(value(payment, "method")))}</span></div>
    <div><b>Data do pagamento</b><span>${escapeHtml(formatDate(paidAt))}</span></div>
    <div><b>Tipo de quitação</b><span>${escapeHtml(quittance(snapshot))}</span></div>
    ${value(payment, "id") ? `<div><b>Referência interna</b><span>Pagamento nº ${escapeHtml(value(payment, "id"))}</span></div>` : ""}
  </section>

  <section class="issuer-sign"><span>ASSINATURA ELETRÔNICA DO EMISSOR</span><strong>${escapeHtml(issuerName)}</strong><p>${escapeHtml(issuerTradeName)} · ${escapeHtml(issuerDocumentType)} ${escapeHtml(issuerDocument || "não informado")}</p><p>${escapeHtml([value(issuer, "city"), value(issuer, "state")].filter(Boolean).join(" / "))}, ${escapeHtml(formatDate(snapshot.document.issueDate))}</p><div class="seal">EMITIDO ELETRONICAMENTE PELO NASSUS CRM</div></section>

  <section class="audit"><strong>CÓDIGO DE AUTENTICAÇÃO / HASH SHA-256</strong><code>${escapeHtml(safeHash)}</code><p>A integridade deste recibo está vinculada à versão eletrônica registrada no CRM do emissor.</p></section>
  <div class="notice">Este recibo comprova exclusivamente o pagamento descrito e não substitui nota fiscal ou outro documento fiscal quando sua emissão for legalmente obrigatória.</div>
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
