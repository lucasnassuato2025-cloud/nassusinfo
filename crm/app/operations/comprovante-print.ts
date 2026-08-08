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

function paymentMethodFromTerms(terms: string): string {
  const normalized = terms.toLocaleLowerCase("pt-BR");
  if (normalized.includes("cartão de crédito") || normalized.includes("cartao de credito")) return "credito";
  if (normalized.includes("cartão de débito") || normalized.includes("cartao de debito")) return "debito";
  if (normalized.includes("boleto")) return "boleto";
  if (normalized.includes("dinheiro")) return "dinheiro";
  if (normalized.includes("transfer")) return "transferencia";
  return "pix";
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    pix: "PIX",
    credito: "Cartão de crédito",
    debito: "Cartão de débito",
    boleto: "Boleto",
    dinheiro: "Dinheiro",
    transferencia: "Transferência",
    mercado_pago: "Mercado Pago",
    outro: "Outro",
  };
  return labels[method] || method || "Não informada";
}

function receiptCategory(type: string): string {
  const labels: Record<string, string> = {
    servico: "Serviço",
    produto: "Produto",
    servico_produto: "Serviço + produto",
    pagamento: "Pagamento",
  };
  return labels[type] || "Pagamento";
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
    .trim() || "Pagamento recebido";
}

function compact(text: string, limit = 120): string {
  return text.length > limit ? `${text.slice(0, Math.max(0, limit - 3)).trim()}...` : text;
}

function quittance(terms: string, paid: number, total: number): string {
  const normalized = terms.toLocaleLowerCase("pt-BR");
  if (normalized.includes("parcial") || (paid > 0 && total > 0 && paid < total)) return "PARCIAL";
  return "TOTAL";
}

export function openReceiptPrint(snapshot: ContractSnapshot, hash: string) {
  const popup = window.open("", "_blank", "width=430,height=760");
  if (!popup) throw new Error("O navegador bloqueou a janela de impressão.");

  const issuer = snapshot.issuer || {};
  const client = snapshot.client || {};
  const document = snapshot.document as ContractSnapshot["document"] & { receiptType?: string };
  const payment = snapshot.payment || {};

  const amount = Number(value(payment, "paidAmount") || document.amount || 0);
  const totalAmount = Number(value(payment, "totalAmount") || document.amount || 0);
  const paidAt = value(payment, "paidAt") || document.issueDate;
  const method = value(payment, "method") || paymentMethodFromTerms(document.paymentTerms || "");
  const category = receiptCategory(document.receiptType || "pagamento");
  const reference = compact(cleanReference(document.scope || value(payment, "description")));
  const payer = payerName(client);
  const receiver = issuerName(issuer);
  const payerDoc = documentLabel(client);
  const receiverDoc = documentLabel(issuer);
  const city = [value(issuer, "city"), value(issuer, "state")].filter(Boolean).join("/") || "Guarujá/SP";
  const logoUrl = new URL("/api/brand-logo?v=10", window.location.origin).href;
  const safeHash = hash && hash !== "RASCUNHO" ? hash : `${document.number}-${document.version}`;
  const hashReference = safeHash.length > 24 ? `${safeHash.slice(0, 12)}…${safeHash.slice(-8)}` : safeHash;
  const quittanceLabel = quittance(document.terms || "", amount, totalAmount);
  const paymentReference = value(payment, "id");

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(document.number)} — Comprovante</title>
  <style>
    @page{size:80mm 150mm;margin:4mm}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#f1f1f1;color:#111}
    body{font:11px/1.35 ui-monospace,SFMono-Regular,Consolas,"Liberation Mono",monospace}
    .ticket{width:80mm;max-width:100%;margin:14px auto;background:#fff;padding:5mm 4.5mm;box-shadow:0 8px 28px rgba(0,0,0,.12)}
    .brand{text-align:center}.brand img{width:34px;height:34px;object-fit:contain;filter:grayscale(1)}.brand strong{display:block;margin-top:4px;font:700 13px Arial,sans-serif}.brand small{display:block;margin-top:1px;color:#555;font-size:9px}
    .dash{border:0;border-top:1px dashed #555;margin:9px 0}
    .title{text-align:center}.title b{display:block;font-size:12px;letter-spacing:.03em}.title span{display:block;margin-top:2px;color:#555;font-size:8px}
    .meta{display:flex;justify-content:space-between;gap:8px;font-size:9px}.meta span:last-child{text-align:right}
    .amount{text-align:center;padding:7px 0 5px}.amount span{display:block;font-size:8px;letter-spacing:.08em}.amount strong{display:block;margin:2px 0;font:800 25px Arial,sans-serif}.amount small{font-weight:700}
    .row{display:grid;grid-template-columns:28mm 1fr;gap:4px;padding:2px 0}.row b{font-size:9px}.row span{text-align:right;overflow-wrap:anywhere}
    .block{margin-top:5px}.block b{display:block;font-size:9px}.block span{display:block;margin-top:2px;overflow-wrap:anywhere}
    .auth{text-align:center;font-size:8px;color:#444}.auth strong{display:block;color:#111;font-size:9px;margin-bottom:2px}.auth code{font-size:8px;overflow-wrap:anywhere}
    .nonfiscal{text-align:center;font-size:7px;color:#666;line-height:1.3}.footer{text-align:center;font-size:8px;font-weight:700}
    @media(max-width:360px){.ticket{width:100%;margin:0;box-shadow:none;padding:14px}}
    @media print{html,body{background:#fff}.ticket{width:72mm;margin:0;box-shadow:none;padding:0}.brand img{filter:grayscale(1)}}
  </style>
</head>
<body>
  <main class="ticket">
    <section class="brand">
      <img src="${escapeHtml(logoUrl)}" alt="Nassusinfo">
      <strong>NASSUSINFO</strong>
      <small>Soluções Tecnológicas · ${escapeHtml(city)}</small>
    </section>

    <hr class="dash">

    <section class="title">
      <b>COMPROVANTE DE PAGAMENTO</b>
      <span>DOCUMENTO NÃO FISCAL</span>
    </section>

    <hr class="dash">

    <div class="meta"><span>${escapeHtml(document.number)}</span><span>${escapeHtml(formatDate(document.issueDate))}</span></div>

    <section class="amount">
      <span>VALOR RECEBIDO</span>
      <strong>${escapeHtml(formatCurrency(amount))}</strong>
      <small>QUITAÇÃO ${escapeHtml(quittanceLabel)}</small>
    </section>

    <hr class="dash">

    <div class="row"><b>PAGADOR</b><span>${escapeHtml(payer)}</span></div>
    ${payerDoc !== "Documento não informado" ? `<div class="row"><b>DOCUMENTO</b><span>${escapeHtml(payerDoc)}</span></div>` : ""}
    <div class="row"><b>PAGAMENTO</b><span>${escapeHtml(paymentMethodLabel(method))}</span></div>
    <div class="row"><b>DATA</b><span>${escapeHtml(formatDate(paidAt))}</span></div>
    <div class="row"><b>NATUREZA</b><span>${escapeHtml(category)}</span></div>

    <div class="block"><b>REFERENTE A</b><span>${escapeHtml(reference)}</span></div>

    <hr class="dash">

    <div class="block"><b>RECEBIDO POR</b><span>${escapeHtml(receiver)}</span><span>${escapeHtml(receiverDoc)}</span></div>
    ${paymentReference ? `<div class="row"><b>REF. INTERNA</b><span>#${escapeHtml(paymentReference)}</span></div>` : ""}

    <hr class="dash">

    <section class="auth">
      <strong>AUTENTICADO PELO NASSUS CRM</strong>
      <span>Ref. de integridade</span><br>
      <code>${escapeHtml(hashReference)}</code>
    </section>

    <hr class="dash">

    <p class="nonfiscal">Comprova somente o recebimento do valor acima. Não substitui nota ou documento fiscal quando exigido por lei.</p>
    <div class="footer">OBRIGADO!</div>
  </main>
  <script>
    window.onload=()=>{
      const images=[...document.images];
      Promise.all(images.map((image)=>image.complete?Promise.resolve():new Promise((resolve)=>{image.onload=resolve;image.onerror=resolve})))
        .finally(()=>setTimeout(()=>window.print(),200));
    };
  <\/script>
</body>
</html>`);

  popup.document.close();
}
