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

function quittance(terms: string, paid: number, total: number): string {
  const normalized = terms.toLocaleLowerCase("pt-BR");
  if (normalized.includes("parcial") || (paid > 0 && total > 0 && paid < total)) return "Quitação parcial";
  return "Quitação total";
}

export function openReceiptPrint(snapshot: ContractSnapshot, hash: string) {
  const popup = window.open("", "_blank", "width=980,height=840");
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
  const reference = cleanReference(document.scope || value(payment, "description"));
  const payer = payerName(client);
  const receiver = issuerName(issuer);
  const payerDoc = documentLabel(client);
  const receiverDoc = documentLabel(issuer);
  const city = [value(issuer, "city"), value(issuer, "state")].filter(Boolean).join(" / ") || "Guarujá / SP";
  const logoUrl = new URL("/api/brand-logo?v=10", window.location.origin).href;
  const safeHash = hash && hash !== "RASCUNHO" ? hash : `${document.number}-${document.version}`;
  const quittanceLabel = quittance(document.terms || "", amount, totalAmount);

  popup.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(document.number)} — Comprovante de pagamento</title>
  <style>
    @page{size:A4;margin:14mm}
    *{box-sizing:border-box}
    body{margin:0;background:#eef1f6;color:#171b24;font:13px/1.5 Arial,Helvetica,sans-serif}
    .sheet{max-width:794px;margin:24px auto;background:#fff;border:1px solid #e1e5ec;box-shadow:0 12px 40px rgba(17,24,39,.12)}
    .accent{height:7px;background:linear-gradient(90deg,#0d1017 0%,#232a37 72%,#c7a95b 100%)}
    .page{padding:30px 34px 26px}
    .top{display:flex;justify-content:space-between;gap:24px;align-items:flex-start;padding-bottom:22px;border-bottom:1px solid #e5e8ee}
    .brand{display:flex;gap:13px;align-items:center}.brand img{width:60px;height:60px;object-fit:contain}.brand strong{display:block;font-size:18px}.brand small{display:block;margin-top:2px;color:#697386}
    .meta{text-align:right}.badge{display:inline-block;padding:6px 9px;border:1px solid #d6bf7b;border-radius:999px;color:#7d6624;font-size:9px;font-weight:800;letter-spacing:.12em}.meta strong{display:block;margin-top:9px;font-size:16px}.meta span{display:block;color:#697386;font-size:11px}
    .hero{padding:30px 0 24px;text-align:center}.hero small{font-size:9px;font-weight:800;letter-spacing:.18em;color:#8b7332}.hero h1{margin:8px 0 4px;font-size:29px;line-height:1.14}.hero p{margin:0;color:#697386}
    .amount{margin:0 auto 20px;padding:20px;border:1px solid #dfe3ea;border-radius:16px;background:#f7f8fa;text-align:center}.amount span{font-size:9px;font-weight:800;letter-spacing:.14em;color:#697386}.amount strong{display:block;margin:5px 0;font-size:32px;color:#111827}.amount p{margin:0;color:#697386}
    .statement{padding:18px 20px;border-left:4px solid #c7a95b;background:#fffaf0;font-size:14px;text-align:justify}.statement strong{color:#111827}
    .people{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:18px}.card{padding:15px 16px;border:1px solid #e1e5ec;border-radius:12px}.card span{font-size:9px;font-weight:800;letter-spacing:.13em;color:#8b7332}.card strong{display:block;margin:5px 0 3px;font-size:14px}.card p{margin:2px 0;color:#5d6677;font-size:11px}
    .details{margin-top:16px;border:1px solid #e1e5ec;border-radius:12px;overflow:hidden}.row{display:grid;grid-template-columns:190px 1fr;gap:12px;padding:10px 14px;border-bottom:1px solid #eef0f4}.row:last-child{border-bottom:0}.row b{font-size:11px;color:#697386}.row span{color:#171b24}
    .auth{margin-top:22px;padding:16px 18px;border:1px solid #dfe3ea;border-radius:12px;background:#f8f9fb}.auth-top{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.auth span{font-size:9px;font-weight:800;letter-spacing:.13em;color:#697386}.auth strong{display:block;margin-top:5px}.seal{padding:6px 9px;border-radius:8px;background:#171b24;color:#fff;font-size:9px;font-weight:800;white-space:nowrap}.hash{margin-top:10px;padding-top:10px;border-top:1px solid #e5e8ee;color:#697386;font-size:9px}.hash code{display:block;margin-top:4px;word-break:break-all;color:#343b48}
    .notice{margin-top:15px;color:#697386;font-size:9px;line-height:1.55}.footer{text-align:center;margin-top:18px;color:#8b94a4;font-size:9px}
    @media(max-width:640px){body{background:#fff}.sheet{margin:0;border:0;box-shadow:none}.page{padding:22px 18px}.people{grid-template-columns:1fr}.row{grid-template-columns:1fr;gap:3px}.top{align-items:flex-start}.meta{max-width:230px}}
    @media print{body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.sheet{margin:0;border:0;box-shadow:none}.page{padding:0}.accent{margin-bottom:24px}}
  </style>
</head>
<body>
  <main class="sheet">
    <div class="accent"></div>
    <div class="page">
      <header class="top">
        <div class="brand">
          <img src="${escapeHtml(logoUrl)}" alt="Logo Nassusinfo">
          <div><strong>Nassusinfo</strong><small>Soluções Tecnológicas</small></div>
        </div>
        <div class="meta">
          <b class="badge">COMPROVANTE NÃO FISCAL</b>
          <strong>${escapeHtml(document.number)}</strong>
          <span>Emitido em ${escapeHtml(formatDate(document.issueDate))}</span>
        </div>
      </header>

      <section class="hero">
        <small>CONFIRMAÇÃO DE PAGAMENTO</small>
        <h1>Comprovante de pagamento recebido</h1>
        <p>Documento particular emitido eletronicamente pelo recebedor.</p>
      </section>

      <section class="amount">
        <span>VALOR RECEBIDO</span>
        <strong>${escapeHtml(formatCurrency(amount))}</strong>
        <p>${escapeHtml(quittanceLabel)}</p>
      </section>

      <section class="statement">
        Declaramos que recebemos de <strong>${escapeHtml(payer)}</strong>${payerDoc !== "Documento não informado" ? `, ${escapeHtml(payerDoc)}` : ""}, o valor de <strong>${escapeHtml(formatCurrency(amount))}</strong>, referente a <strong>${escapeHtml(category.toLocaleLowerCase("pt-BR"))}: ${escapeHtml(reference)}</strong>, pago em <strong>${escapeHtml(formatDate(paidAt))}</strong> por meio de <strong>${escapeHtml(paymentMethodLabel(method))}</strong>.
      </section>

      <section class="people">
        <div class="card"><span>RECEBEDOR / EMITENTE</span><strong>${escapeHtml(receiver)}</strong><p>${escapeHtml(receiverDoc)}</p><p>${escapeHtml(city)}</p></div>
        <div class="card"><span>PAGADOR</span><strong>${escapeHtml(payer)}</strong><p>${escapeHtml(payerDoc)}</p><p>${escapeHtml(value(client, "email") || value(client, "whatsapp") || "Contato não informado")}</p></div>
      </section>

      <section class="details">
        <div class="row"><b>Natureza do recebimento</b><span>${escapeHtml(category)}</span></div>
        <div class="row"><b>Descrição</b><span>${escapeHtml(reference)}</span></div>
        <div class="row"><b>Forma de pagamento</b><span>${escapeHtml(paymentMethodLabel(method))}</span></div>
        <div class="row"><b>Data do pagamento</b><span>${escapeHtml(formatDate(paidAt))}</span></div>
        <div class="row"><b>Quitação</b><span>${escapeHtml(quittanceLabel)}</span></div>
        ${value(payment, "id") ? `<div class="row"><b>Referência interna</b><span>Pagamento nº ${escapeHtml(value(payment, "id"))}</span></div>` : ""}
      </section>

      <section class="auth">
        <div class="auth-top">
          <div><span>AUTENTICAÇÃO ELETRÔNICA</span><strong>${escapeHtml(receiver)}</strong></div>
          <div class="seal">AUTENTICADO PELO NASSUS CRM</div>
        </div>
        <div class="hash"><span>HASH / REFERÊNCIA DE INTEGRIDADE</span><code>${escapeHtml(safeHash)}</code></div>
      </section>

      <p class="notice"><strong>Natureza não fiscal:</strong> este comprovante registra exclusivamente o recebimento particular do valor descrito. Não é nota fiscal, cupom fiscal ou documento tributário e não substitui documento fiscal quando sua emissão for legalmente obrigatória.</p>
      <footer class="footer">Comprovante gerado pelo Nassus CRM · ${escapeHtml(city)}</footer>
    </div>
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
