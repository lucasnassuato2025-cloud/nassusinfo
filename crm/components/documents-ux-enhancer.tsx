"use client";

import { useEffect } from "react";

import { neonClient } from "@/lib/neon";

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function openWhatsApp(message: string) {
  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
}

function findButton(scope: ParentNode, labels: string[]): HTMLButtonElement | null {
  const normalizedLabels = labels.map(normalizeText);
  return Array.from(scope.querySelectorAll<HTMLButtonElement>("button")).find((button) => {
    const text = normalizeText(button.textContent);
    return normalizedLabels.some((label) => text === label || text.includes(label));
  }) || null;
}

function setText(element: HTMLElement | null, text: string) {
  if (element && element.textContent !== text) element.textContent = text;
}

function directChildText(card: HTMLElement, selector: string) {
  return Array.from(card.children).find((child) => child.matches(selector))?.textContent?.trim() || "";
}

function showDeleteError(message: string) {
  window.alert(message || "Não foi possível excluir o documento.");
}

async function deleteDocument(card: HTMLElement, button: HTMLButtonElement) {
  const documentNumber = directChildText(card, "small");
  const typeLabel = card.querySelector<HTMLElement>(".document-type")?.textContent?.trim() || "Documento";
  const statusLabel = normalizeText(card.querySelector<HTMLElement>(".document-status")?.textContent);
  const title = card.querySelector<HTMLHeadingElement>("h3")?.textContent?.trim() || typeLabel;

  if (!documentNumber) {
    showDeleteError("Não foi possível identificar este documento. Atualize a página e tente novamente.");
    return;
  }

  const relatedWarning = "Também serão apagados o link de assinatura, versões, assinatura e histórico técnico vinculados. O cliente, o projeto e a cobrança permanecerão cadastrados.";
  const confirmed = window.confirm(`Excluir ${typeLabel.toLowerCase()} ${documentNumber}?\n\n${title}\n\n${relatedWarning}\n\nEsta ação não pode ser desfeita.`);
  if (!confirmed) return;

  if (statusLabel.includes("assinado")) {
    const typed = window.prompt(`Este documento está ASSINADO e pode ser uma prova jurídica.\n\nPara confirmar a exclusão definitiva, digite exatamente:\n${documentNumber}`);
    if ((typed || "").trim() !== documentNumber) {
      window.alert("Exclusão cancelada. O número informado não corresponde ao documento.");
      return;
    }
  }

  button.disabled = true;
  const originalText = button.textContent || "Excluir";
  button.textContent = "Excluindo...";

  try {
    const result = await (neonClient.from("commercial_documents") as any)
      .delete()
      .eq("number", documentNumber)
      .select("id");

    if (result.error) throw new Error(result.error.message || "Não foi possível excluir o documento.");
    if (!Array.isArray(result.data) || result.data.length === 0) throw new Error("Documento não encontrado ou sem permissão para exclusão.");

    card.remove();
    window.alert(`${typeLabel} ${documentNumber} excluído com sucesso.`);
    window.location.reload();
  } catch (reason) {
    button.disabled = false;
    button.textContent = originalText;
    showDeleteError(reason instanceof Error ? reason.message : "Não foi possível excluir o documento.");
  }
}

function openContractEditor() {
  const panel = document.querySelector<HTMLElement>(".document-center-panel");
  const contractButton = panel ? findButton(panel, ["+ contrato", "novo contrato", "criar contrato"]) : null;

  if (contractButton) {
    contractButton.click();
    return;
  }

  const documentsTab = findButton(document, ["documentos"]);
  documentsTab?.click();
  window.setTimeout(() => {
    const refreshedPanel = document.querySelector<HTMLElement>(".document-center-panel");
    findButton(refreshedPanel || document, ["+ contrato", "novo contrato", "criar contrato"])?.click();
  }, 120);
}

function enhanceDocumentCards() {
  for (const card of Array.from(document.querySelectorAll<HTMLElement>(".document-card-pro"))) {
    const type = normalizeText(card.querySelector(".document-type")?.textContent);
    const footer = card.querySelector<HTMLElement>("footer");
    if (!footer) continue;

    if (type.includes("contrato")) {
      const signingButton = findButton(footer, ["gerar link", "novo link", "enviar para assinatura", "gerar novo link"]);
      if (signingButton) {
        const alreadyActive = normalizeText(signingButton.textContent).includes("novo");
        const desiredText = alreadyActive ? "Gerar novo link" : "Enviar para assinatura";
        setText(signingButton, desiredText);
        signingButton.title = alreadyActive
          ? "Revogar o link anterior e criar outro link de assinatura"
          : "Criar link privado e código para o cliente assinar";
        signingButton.classList.add("signature-main-action");
      }
    }

    if (type.includes("recibo") && !footer.querySelector("[data-receipt-note='true']")) {
      const note = document.createElement("small");
      note.dataset.receiptNote = "true";
      note.className = "receipt-signature-note";
      note.textContent = "Recibos não geram link. Crie um contrato para assinatura.";
      footer.append(note);
    }

    if (!footer.querySelector("[data-document-delete='true']")) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.dataset.documentDelete = "true";
      deleteButton.className = "danger delete-document-action";
      deleteButton.textContent = "Excluir";
      deleteButton.title = "Excluir este documento e seus registros vinculados";
      deleteButton.addEventListener("click", () => void deleteDocument(card, deleteButton));
      footer.append(deleteButton);
    }
  }
}

function enhanceDocumentsGuide() {
  const panel = document.querySelector<HTMLElement>(".document-center-panel");
  if (!panel) return;

  let guide = document.querySelector<HTMLElement>("[data-signature-guide='true']");
  if (!guide) {
    guide = document.createElement("aside");
    guide.className = "signature-guide signature-launcher";
    guide.dataset.signatureGuide = "true";
    guide.innerHTML = `
      <div class="signature-guide-icon" aria-hidden="true">✍</div>
      <div class="signature-guide-copy">
        <strong>Contrato com assinatura pelo CRM</strong>
        <span data-signature-guide-message></span>
        <small><b>1.</b> Crie e salve o contrato. <b>2.</b> No card, clique em “Enviar para assinatura”. <b>3.</b> Copie o link e o código ou envie pelo WhatsApp.</small>
      </div>
      <button type="button" class="signature-launcher-button">Criar contrato para assinatura</button>
    `;
    panel.before(guide);
    guide.querySelector<HTMLButtonElement>(".signature-launcher-button")?.addEventListener("click", openContractEditor);
  }

  const contractCount = Array.from(document.querySelectorAll<HTMLElement>(".document-card-pro .document-type"))
    .filter((item) => normalizeText(item.textContent).includes("contrato")).length;
  const message = guide.querySelector<HTMLElement>("[data-signature-guide-message]");
  const desiredMessage = contractCount > 0
    ? "Seus contratos aparecem abaixo. Use o botão azul no card para criar o link privado."
    : "Você ainda não possui contrato salvo. O documento atual é um recibo, e recibos não geram link de assinatura.";
  setText(message, desiredMessage);
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

    let frame = 0;
    const observer = new MutationObserver(() => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        scanDocumentsExperience();
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
