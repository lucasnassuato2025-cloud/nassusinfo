"use client";

import { useEffect } from "react";

function labelStartsWith(modal: Element, text: string): HTMLLabelElement | null {
  return Array.from(modal.querySelectorAll<HTMLLabelElement>("label")).find((label) => label.textContent?.trim().startsWith(text)) || null;
}

function findTypeSelect(modal: Element): HTMLSelectElement | null {
  return labelStartsWith(modal, "Tipo")?.querySelector("select") || null;
}

function ensureBanner(modal: Element, receipt: boolean) {
  let banner = modal.querySelector<HTMLElement>(".receipt-generator-banner");
  if (!receipt) {
    banner?.remove();
    return;
  }
  if (banner) return;
  const form = modal.querySelector("form");
  if (!form) return;
  banner = document.createElement("div");
  banner.className = "receipt-generator-banner";
  banner.innerHTML = "<strong>Recibo sem assinatura do cliente</strong><span>O documento será concluído e autenticado eletronicamente pelo emissor, com versão congelada e hash próprio.</span>";
  form.prepend(banner);
}

function adaptReceiptCards() {
  document.querySelectorAll<HTMLElement>(".document-card-pro").forEach((card) => {
    const receipt = Boolean(card.querySelector(".document-type.type-recibo"));
    if (!receipt) return;
    card.querySelectorAll("dl > div").forEach((row) => {
      const term = row.querySelector("dt");
      const value = row.querySelector("dd");
      if (term?.textContent?.trim() === "Assinatura" && value) {
        term.textContent = "Autenticação";
        value.textContent = "Emissor eletrônico";
      }
    });
  });
}

function applyReceiptMode() {
  const modal = document.querySelector<HTMLElement>(".contract-editor");
  if (!modal) {
    adaptReceiptCards();
    return;
  }
  const typeSelect = findTypeSelect(modal);
  const receipt = typeSelect?.value === "recibo";
  modal.classList.toggle("receipt-generator-mode", receipt);
  ensureBanner(modal, receipt);

  const scope = labelStartsWith(modal, "Escopo e entregas");
  const payment = labelStartsWith(modal, "Condições de pagamento");
  if (scope) scope.dataset.receiptLabel = receipt ? "Referente ao pagamento" : "";
  if (payment) payment.dataset.receiptLabel = receipt ? "Forma e data do pagamento" : "";

  adaptReceiptCards();
}

export function ReceiptGeneratorAdapter() {
  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyReceiptMode);
    };

    const onChange = (event: Event) => {
      const target = event.target as HTMLSelectElement | null;
      if (target?.closest(".contract-editor")) schedule();
    };

    document.addEventListener("change", onChange, true);
    document.addEventListener("click", schedule, true);
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("click", schedule, true);
      observer.disconnect();
    };
  }, []);

  return null;
}
