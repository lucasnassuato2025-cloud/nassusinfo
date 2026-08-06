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

function value(record: Record<string, unknown> | null | undefined, key: string): string {
  if (!record) return "";
  return record[key] == null ? "" : String(record[key]);
}

function formatDate(raw: string): string {
  if (!raw) return "Não informada";
  const normalized = raw.slice(0, 10);
  return new Date(`${normalized}T12:00:00`).toLocaleDateString("pt-BR");
}

function paymentMethod(method: string): string {
  const labels: Record<string, string> = {
    pix: "Pix",
    credito: "Cartão de crédito",
    debito: "Cartão de débito",
    boleto: "Boleto bancário",
    dinheiro: "Dinheiro",
    transferencia: "Transferência bancária",
    mercado_pago: "Mercado Pago",
    outro: "Outro meio de pagamento",
  };
  return labels[method] || method || "Não informada";
}

function receiptCategory(type: string): string {
  const labels: Record<string, string> = {
    servico: "Serviço",
    produto: "Produto",
    servico_produto: "Serviço e produto",
    pagamento: "Serviço ou produto descrito",
  };
  return labels[type] || "Serviço ou produto descrito";
}

function payerName(client: Record<string, unknown>): string {
  return value(client, "tradeName") || value(client, "company") || value(client, "legalName") || value(client, "name") || "Pagador não identificado";
}

function issuerName(issuer: Record<string, unknown>): string {
  return value(issuer, "tradeName") || value(issuer, "displayName") || value(issuer, "legalName") || "Nassusinfo Soluções Tecnológicas";
}

function documentLabel(record: Record<string, unknown>): string {
  const type = value(record, "documentType").toUpperCase();
  const number = value(record, "documentNumber");
  return number ? `${type || "CPF/CNPJ"} ${number}` : "Documento não informado";
}

function cleanReference(text: string): string {
  return text
    .replace(/^Recebimento referente a\s+/i, "")
    .replace(/^Pagamento referente a\s+/i, "")
    .replace(/\.$/, "")
    .trim() || "pagamento recebido";
}

const UNITS = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const TEENS = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const TENS = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const HUNDREDS = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];

function underThousand(number: number): string {
  if (number === 0) return "";
  if (number === 100) return "cem";
  const parts: string[] = [];
  const hundred = Math.floor(number / 100);
  const rest = number % 100;
  if (hundred) parts.push(HUNDREDS[hundred]);
  if (rest >= 10 && rest <= 19) parts.push(TEENS[rest - 10]);
  else {
    const ten = Math.floor(rest / 10);
    const unit = rest % 10;
    if (ten) parts.push(TENS[ten]);
    if (unit) parts.push(UNITS[unit]);
  }
  return parts.filter(Boolean).join(" e ");
}

function integerWords(number: number): string {
  if (number === 0) return "zero";
  const groups = [
    { value: 1_000_000_000, singular: "bilhão", plural: "bilhões" },
    { value: 1_000_000, singular: "milhão", plural: "milhões" },
    { value: 1_000, singular: "mil", plural: "mil" },
  ];
  let remaining = number;
  const parts: string[] = [];
  groups.forEach((group) => {
    const quantity = Math.floor(remaining / group.value);
    if (!quantity) return;
    remaining %= group.value;
    if (group.value === 1_000 && quantity === 1) parts.push("mil");
    else parts.push(`${underThousand(quantity)} ${quantity === 1 ? group.singular : group.plural}`);
  });
  if (remaining) parts.push(underThousand(remaining));
  return parts.join(remaining > 0 && remaining < 100 ? " e " : ", ").replace(/, ([^,]+)$/, " e $1");
}

function amountInWords(amount: number): string {
  const safe = Math.max(0, Math.round((Number(amount) || 0) * 100));
  const reais = Math.floor(safe / 100);
  const cents = safe % 100;
  const parts: string[] = [];
  parts.push(`${integerWords(reais)} ${reais === 1 ? "real" : "reais"}`);
  if (cents) parts.push(`${integerWords(cents)} ${cents === 1 ? "centavo" : "centavos"}`);
  return parts.join(" e ");
}

function quittance(snapshot: ContractSnapshot): string {
  const paid = Number(value(snapshot.payment, "paidAmount") || 0);
  const total = Number(value(snapshot.payment, "totalAmount") || snapshot.document.amount || 0);
  const terms = String(snapshot.document.terms || "").toLocaleLowerCase("pt-BR");
  if (terms.includes("parcial") || (paid > 0 && total > 0 && paid < total)) return "Quitação parcial do valor indicado";
  return "Quitação total do valor indicado";
}

export function openReceiptPrint(snapshot: ContractSnapshot, hash: string) {
  const popup = window.open("", "_blank", "width=940,height=820");
  if (!popup) throw new Error("O navegador bloqueou a janela de impressão.");

  const issuer = snapshot.issuer || {};
  const client = snapshot.client || {};
  const payment = snapshot.payment || null;
  const document = snapshot.document as ContractSnapshot["document"] & { receiptType?: string };
  const amount = Number(document.amount || 0);
  const reference = cleanReference(document.scope || value(payment, "description"));
  const category = receiptCategory(document.receiptType || "pagamento");
  const paidAt = value(payment, "paidAt") || document.issueDate;
  const method = paymentMethod(value(payment, "method") || document.paymentTerms.replace(/^.*por\s+/i, "").replace(/,.*$/, ""));
  const logoUrl = new URL("/api/brand-logo?v=9", window.location.origin).href;
  const safeHash = hash && hash !== "RASCUNHO" ? hash : `${document.number}-${document.version}`;
  const payer = payerName(client);
  const issuerDisplay = issuerName(issuer);
  const payerDoc = documentLabel(client);
  const issuerDoc = documentLabel(issuer);
  const words = document.amountInWords?.trim() || amountInWords(amount);
  const city = [value(issuer, "city"), value(issuer, "state")].filter(Boolean).join(" / ") || "Guarujá / SP";

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(document.number)} — Comprovante de pagamento</title>
  <style>
    @page{size:A4;margin:16mm}
    *{box-sizing:border-box}
    body{margin:0;background:#fff;color:#172033;font:13px/1.55 Arial,Helvetica,sans-serif}
    .page{max-width:790px;margin:auto}
    .header{display:flex;align-items:center;justify-content:space-between;gap:24px;padding-bottom:18px;border-bottom:3px solid #315cff}
    .brand{display:flex;align-items:center;gap:12px}.brand img{width:58px;height:58px;object-fit:contain}.brand strong{display:block;font-size:18px}.brand small{display:block;color:#667085}
    .doc{text-align:right}.doc b{display:inline-block;padding:5px 9px;border-radius:999px;background:#fff0e7;color:#a64110;font-size:9px;letter-spacing:.12em}.doc strong{display:block;margin-top:7px;font-size:16px}.doc span{display:block;color:#667085;font-size:11px}
    .title{text-align:center;padding:31px 0 21px}.title span{font-size:9px;font-weight:800;letter-spacing:.18em;color:#315cff}.title h1{margin:8px 0 5px;font-size:29px;line-height:1.15}.title p{margin:0;color:#667085}
    .amount{padding:20px;border:1px solid #cbdcff;border-radius:15px;background:linear-gradient(145deg,#f5f8ff,#eaf1ff);text-align:center}.amount span{font-size:9px;font-weight:800;letter-spacing:.14em;color:#315cff}.amount strong{display:block;margin:4px 0;color:#173f9c;font-size:31px}.amount p{margin:0;color:#48556b;text-transform:capitalize}
    .statement{margin-top:18px;padding:22px;border:1px solid #dce3ee;border-radius:14px;font-size:15px;text-align:justify}.statement strong{color:#173f9c}
    .details{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px}.box{padding:15px;border:1px solid #dce3ee;border-radius:12px}.box span{font-size:9px;font-weight:800;letter-spacing:.13em;color:#315cff}.box strong{display:block;margin:5px 0 2px;font-size:14px}.box p{margin:2px 0;color:#526075;font-size:11px}
    .table{margin-top:16px;border:1px solid #dce3ee;border-radius:12px;overflow:hidden}.row{display:grid;grid-template-columns:185px 1fr;padding:10px 14px;border-bottom:1px solid #edf0f5}.row:last-child{border-bottom:0}.row b{color:#526075;font-size:11px}.row span{color:#172033}
    .auth{margin-top:28px;padding:18px;border:1px solid #cbdcff;border-radius:14px;background:#f8faff;text-align:center}.auth span{font-size:9px;font-weight:800;letter-spacing:.14em;color:#315cff}.auth strong{display:block;margin:7px 0 2px;font-size:16px}.auth p{margin:2px 0;color:#526075;font-size:11px}.seal{display:inline-block;margin-top:10px;padding:6px 10px;border-radius:999px;background:#e7efff;color:#173f9c;font-size:9px;font-weight:800}
    .non-fiscal{margin-top:18px;padding:12px 14px;border-radius:10px;background:#f7f7f9;border-left:4px solid #7b8495;color:#515d70;font-size:10px;line-height:1.55}
    .audit{margin-top:18px;padding-top:11px;border-top:1px solid #dce3ee;color:#707b8c;font-size:9px}.audit code{display:block;margin-top:4px;word-break:break-all;color:#3f4a5d}
    .footer{text-align:center;margin-top:17px;color:#929aaa;font-size:9px}
    @media(max-width:620px){.details{grid-template-columns:1fr}.row{grid-template-columns:1fr;gap:3px}.header{align-items:flex-start}.doc{max-width:230px}}
    @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  </style>
</head>
<body>
<main class="page">
  <header class="header">
    <div class="brand"><img src="${escapeHtml(logoUrl)}" alt="Logo da Nassusinfo"><div><strong>Nassusinfo</strong><small>Soluções Tecnológicas</small></div></div>
    <div class="doc"><b>DOCUMENTO NÃO FISCAL</b><strong>${escapeHtml(document.number)}</strong><span>Emitido em ${escapeHtml(formatDate(document.issueDate))}</span></div>
  </header>

  <section class="title"><span>CONFIRMAÇÃO DE RECEBIMENTO</span><h1>Comprovante de pagamento recebido</h1><p>Documento particular emitido eletronicamente pelo recebedor</p></section>

  <section class="amount"><span>VALOR EFETIVAMENTE RECEBIDO</span><strong>${escapeHtml(formatCurrency(amount))}</strong><p>${escapeHtml(words)}</p></section>

  <section class="statement">Declaramos que recebemos de <strong>${escapeHtml(payer)}</strong>${payerDoc !== "Documento não informado" ? `, identificado(a) por <strong>${escapeHtml(payerDoc)}</strong>` : ""}, o valor de <strong>${escapeHtml(formatCurrency(amount))}</strong>, referente a <strong>${escapeHtml(category.toLocaleLowerCase("pt-BR"))}: ${escapeHtml(reference)}</strong>, pago em <strong>${escapeHtml(formatDate(paidAt))}</strong> por meio de <strong>${escapeHtml(method)}</strong>.</section>

  <section class="details">
    <div class="box"><span>RECEBEDOR / EMITENTE</span><strong>${escapeHtml(issuerDisplay)}</strong><p>${escapeHtml(issuerDoc)}</p><p>${escapeHtml(city)}</p></div>
    <div class="box"><span>PAGADOR</span><strong>${escapeHtml(payer)}</strong><p>${escapeHtml(payerDoc)}</p><p>${escapeHtml(value(client, "email") || value(client, "whatsapp") || "Contato não informado")}</p></div>
  </section>

  <section class="table">
    <div class="row"><b>Natureza do recebimento</b><span>${escapeHtml(category)}</span></div>
    <div class="row"><b>Descrição</b><span>${escapeHtml(reference)}</span></div>
    <div class="row"><b>Forma de pagamento</b><span>${escapeHtml(method)}</span></div>
    <div class="row"><b>Data do pagamento</b><span>${escapeHtml(formatDate(paidAt))}</span></div>
    <div class="row"><b>Quitação</b><span>${escapeHtml(quittance(snapshot))}</span></div>
    ${value(payment, "id") ? `<div class="row"><b>Referência interna</b><span>Pagamento nº ${escapeHtml(value(payment, "id"))}</span></div>` : ""}
  </section>

  <section class="auth"><span>AUTENTICAÇÃO ELETRÔNICA DO RECEBEDOR</span><strong>${escapeHtml(issuerDisplay)}</strong><p>${escapeHtml(issuerDoc)} · ${escapeHtml(city)}</p><p>${escapeHtml(formatDate(document.issueDate))}</p><div class="seal">AUTENTICADO PELO NASSUS CRM</div></section>

  <div class="non-fiscal"><strong>Natureza não fiscal:</strong> este documento comprova exclusivamente o recebimento particular do valor descrito. Não é nota fiscal, cupom fiscal, recibo fiscal ou documento tributário e não substitui a emissão de documento fiscal quando ela for legalmente obrigatória.</div>

  <section class="audit"><strong>HASH SHA-256 DE INTEGRIDADE</strong><code>${escapeHtml(safeHash)}</code><p>A versão eletrônica correspondente foi congelada no CRM do emitente.</p></section>
  <footer class="footer">Nassus CRM Black Edition · Documento eletrônico de confirmação de pagamento</footer>
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
