import type { ContractSnapshot } from "./contract-utils";
import { openReceiptPrint as renderReceipt } from "./receipt-print-v2";

function methodFromTerms(terms: string): string {
  const normalized = terms.toLocaleLowerCase("pt-BR");
  if (normalized.includes("cartão de crédito") || normalized.includes("cartao de credito")) return "credito";
  if (normalized.includes("cartão de débito") || normalized.includes("cartao de debito")) return "debito";
  if (normalized.includes("boleto")) return "boleto";
  if (normalized.includes("dinheiro")) return "dinheiro";
  if (normalized.includes("transfer")) return "transferencia";
  return "pix";
}

export function openReceiptPrint(snapshot: ContractSnapshot, hash: string) {
  const normalized = structuredClone(snapshot) as ContractSnapshot;
  const terms = String(normalized.document.terms || "").toLocaleLowerCase("pt-BR");
  const existing = normalized.payment && typeof normalized.payment === "object" ? normalized.payment : {};
  const payment = { ...existing } as Record<string, unknown>;

  payment.method = String(payment.method || methodFromTerms(normalized.document.paymentTerms || ""));
  payment.paidAt = String(payment.paidAt || normalized.document.issueDate);
  payment.paidAmount = Number(payment.paidAmount || normalized.document.amount || 0);
  payment.totalAmount = Number(payment.totalAmount || normalized.document.amount || 0);
  payment.status = String(payment.status || "pago");

  if (terms.includes("quitação total") || terms.includes("quitacao total")) {
    payment.paidAmount = Number(normalized.document.amount || payment.paidAmount || 0);
    payment.totalAmount = Number(normalized.document.amount || payment.totalAmount || 0);
  }

  normalized.payment = payment;
  renderReceipt(normalized, hash);
}
