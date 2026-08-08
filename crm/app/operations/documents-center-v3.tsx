"use client";

import { useEffect } from "react";

import { claimWorkspaceWithRetry } from "@/lib/auth-session";
import { neonClient } from "@/lib/neon";
import { DocumentsCenterV2 } from "./documents-center-v2";

type Props = React.ComponentProps<typeof DocumentsCenterV2>;

type DocumentLookup = {
  id: string | number;
  number?: string;
  document_type?: string;
  status?: string;
};

function errorText(reason: unknown): string {
  if (reason && typeof reason === "object" && "message" in reason) {
    return String((reason as { message?: unknown }).message || "");
  }
  return String(reason || "");
}

async function moveDocumentToTrash(number: string) {
  await claimWorkspaceWithRetry();

  const lookup = await (neonClient.from("commercial_documents") as any)
    .select("id, number, document_type, status")
    .eq("number", number)
    .limit(1);
  if (lookup.error) throw lookup.error;

  const document = (Array.isArray(lookup.data) ? lookup.data[0] : lookup.data) as DocumentLookup | undefined;
  if (!document?.id) throw new Error("Documento não encontrado no workspace ou já está na lixeira.");

  const result = await (neonClient as any).rpc("crm_soft_delete", {
    p_table: "commercial_documents",
    p_id: Number(document.id),
    p_reason: "Movido para a lixeira pela Central de Documentos",
  });
  if (result.error) throw result.error;
  if (!result.data) throw new Error("O servidor não confirmou a exclusão do documento.");

  return { document, batch: String(result.data) };
}

function installDeleteButtons(root: ParentNode) {
  root.querySelectorAll<HTMLElement>(".document-card-pro").forEach((card) => {
    const footer = card.querySelector<HTMLElement>("footer");
    if (!footer || footer.querySelector("[data-document-delete]")) return;

    const number = card.querySelector("small")?.textContent?.trim() || "";
    if (!number) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "danger";
    button.textContent = "Excluir";
    button.setAttribute("data-document-delete", "true");
    button.setAttribute("aria-label", `Mover documento ${number} para a lixeira`);

    button.addEventListener("click", async () => {
      const status = card.querySelector(".document-status")?.textContent?.trim().toLocaleLowerCase("pt-BR") || "";
      const signedWarning = status.includes("assinado")
        ? "\n\nEste documento está assinado. Ele sairá da lista, mas versões, assinatura e evidências serão preservadas para integridade e auditoria."
        : "\n\nO documento será enviado à lixeira do CRM e os links de assinatura ativos serão revogados.";
      const confirmed = window.confirm(`Excluir ${number}?${signedWarning}`);
      if (!confirmed) return;

      button.disabled = true;
      button.textContent = "Excluindo...";
      try {
        await moveDocumentToTrash(number);
        card.remove();
        window.setTimeout(() => window.location.reload(), 120);
      } catch (reason) {
        button.disabled = false;
        button.textContent = "Excluir";
        const raw = errorText(reason);
        const message = /permission|row-level security|policy/i.test(raw)
          ? "Seu usuário não possui permissão para excluir este documento no workspace."
          : raw || "Não foi possível excluir o documento.";
        window.alert(message);
      }
    });

    footer.appendChild(button);
  });
}

export function DocumentsCenterV3(props: Props) {
  useEffect(() => {
    const root = document.querySelector(".documents-v2") || document.body;
    installDeleteButtons(root);

    const observer = new MutationObserver(() => installDeleteButtons(root));
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <DocumentsCenterV2 {...props} />;
}
