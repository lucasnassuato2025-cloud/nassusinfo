"use client";

import { useEffect } from "react";

function openWhatsApp(message: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function enhanceDocumentCards() {
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(".document-card-pro footer button"))) {
    const text = button.textContent?.trim();
    if (text === "Gerar link") {
      button.textContent = "Enviar para assinatura";
      button.title = "Criar link privado e código para o cliente assinar";
    } else if (text === "Novo link") {
      button.textContent = "Gerar novo link";
      button.title = "Revoga o link anterior e cria outro para reenviar";
    }
  }
}

function enhanceDocumentsGuide() {
  const panel = document.querySelector<HTMLElement>(".document-center-panel");
  if (!panel || document.querySelector("[data-signature-guide='true']")) return;

  const guide = document.createElement("aside");
  guide.className = "signature-guide";
  guide.dataset.signatureGuide = "true";
  guide.innerHTML = `
    <div class="signature-guide-icon" aria-hidden="true">↗</div>
    <div>
      <strong>Como enviar o contrato para assinatura</strong>
      <span>No card do contrato, clique em <b>Enviar para assinatura</b>. O CRM abrirá o link privado e o código de acesso para copiar ou enviar pelo WhatsApp.</span>
    </div>
  `;
  panel.before(guide);
}

function enhanceShareModal() {
  const modal = document.querySelector<HTMLElement>(".share-modal");
  if (!modal || modal.dataset.whatsappEnhanced === "true") return;

  const inputs = Array.from(modal.querySelectorAll<HTMLInputElement>("input[readonly]"));
  const link = inputs[0]?.value || "";
  const code = inputs[1]?.value || "";
  const footer = modal.querySelector<HTMLElement>("footer");
  if (!footer || !link || !code) return;

  modal.dataset.whatsappEnhanced = "true";

  const linkButton = document.createElement("button");
  linkButton.type = "button";
  linkButton.className = "business-secondary signature-whatsapp-button";
  linkButton.textContent = "Enviar link no WhatsApp";
  linkButton.addEventListener("click", () => {
    openWhatsApp(`Olá! Segue o link privado para leitura e assinatura do contrato: ${link}\n\nPor segurança, enviarei o código de acesso em outra mensagem.`);
  });

  const codeButton = document.createElement("button");
  codeButton.type = "button";
  codeButton.className = "business-secondary signature-whatsapp-button";
  codeButton.textContent = "Enviar código no WhatsApp";
  codeButton.addEventListener("click", () => {
    openWhatsApp(`Código de acesso para assinatura do contrato: ${code}`);
  });

  const finalButton = footer.querySelector<HTMLButtonElement>(".pro-primary");
  footer.insertBefore(linkButton, finalButton || null);
  footer.insertBefore(codeButton, finalButton || null);
}

function scanDocumentsExperience() {
  enhanceDocumentCards();
  enhanceDocumentsGuide();
  enhanceShareModal();
}

export function DocumentsUxEnhancer() {
  useEffect(() => {
    scanDocumentsExperience();
    const observer = new MutationObserver(scanDocumentsExperience);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}
