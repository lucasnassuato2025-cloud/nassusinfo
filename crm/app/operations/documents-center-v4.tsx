"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { claimWorkspaceWithRetry } from "@/lib/auth-session";
import { neonClient } from "@/lib/neon";
import { DocumentsCenterV2 } from "./documents-center-v2";
import styles from "./documents-lifecycle.module.css";

type Props = React.ComponentProps<typeof DocumentsCenterV2>;

type ActiveDocument = {
  id: string;
  number: string;
  title: string;
  documentType: string;
  status: string;
  signatureStatus: string;
  signedAt: string | null;
};

type TrashRow = {
  batchId: string;
  tableName: string;
  recordId: string;
  recordType: string;
  label: string;
  deletedAt: string;
  deletedReason: string;
  purgeAt: string;
  deletedByName: string;
  protectedEvidence: boolean;
};

type DataRow = Record<string, unknown>;

function rows(value: unknown): DataRow[] {
  return Array.isArray(value) ? value as DataRow[] : [];
}

function text(value: unknown): string {
  return value == null ? "" : String(value);
}

function errorText(reason: unknown, fallback: string): string {
  const raw = reason && typeof reason === "object" && "message" in reason
    ? text((reason as { message?: unknown }).message)
    : text(reason);
  if (/Registro de auditoria imutável/i.test(raw)) return "Este item possui evidência imutável e não pode ser destruído por esta ação.";
  if (/permission|row-level security|policy/i.test(raw)) return "Seu usuário não possui permissão para concluir esta ação.";
  if (/network|fetch|timeout/i.test(raw)) return "A conexão com o servidor falhou. Tente novamente.";
  return raw || fallback;
}

function mapActive(row: DataRow): ActiveDocument {
  return {
    id: text(row.id),
    number: text(row.number),
    title: text(row.title),
    documentType: text(row.document_type),
    status: text(row.status),
    signatureStatus: text(row.signature_status),
    signedAt: row.signed_at ? text(row.signed_at) : null,
  };
}

function mapTrash(row: DataRow): TrashRow {
  return {
    batchId: text(row.batch_id),
    tableName: text(row.table_name),
    recordId: text(row.record_id),
    recordType: text(row.record_type),
    label: text(row.label),
    deletedAt: text(row.deleted_at),
    deletedReason: text(row.deleted_reason),
    purgeAt: text(row.purge_at),
    deletedByName: text(row.deleted_by_name) || "Usuário do CRM",
    protectedEvidence: Boolean(row.protected_evidence),
  };
}

function dateTime(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function daysLeft(value: string): string {
  if (!value) return "—";
  const days = Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
  if (days < 0) return "prazo encerrado";
  if (days === 0) return "expira hoje";
  return `${days} dia${days === 1 ? "" : "s"}`;
}

function isPurgeEligible(item: TrashRow): boolean {
  if (item.protectedEvidence || !item.purgeAt) return false;
  const purgeTime = new Date(item.purgeAt).getTime();
  return Number.isFinite(purgeTime) && purgeTime <= Date.now();
}

function latestPurgeItem(items: TrashRow[]): TrashRow | null {
  return items
    .filter((item) => !item.protectedEvidence && item.purgeAt)
    .sort((a, b) => new Date(b.purgeAt).getTime() - new Date(a.purgeAt).getTime())[0] || null;
}

function canPurgeBatch(items: TrashRow[]): boolean {
  return items.length > 0
    && !items.some((item) => item.protectedEvidence)
    && items.every(isPurgeEligible);
}

export function DocumentsCenterV4(props: Props) {
  const [activeDocuments, setActiveDocuments] = useState<ActiveDocument[]>([]);
  const [trash, setTrash] = useState<TrashRow[]>([]);
  const [trashOpen, setTrashOpen] = useState(false);
  const [managingOpen, setManagingOpen] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  const refreshLifecycle = useCallback(async () => {
    setError("");
    try {
      await claimWorkspaceWithRetry();
      const [activeResult, trashResult] = await Promise.all([
        (neonClient.from("commercial_documents") as any)
          .select("id, number, title, document_type, status, signature_status, signed_at")
          .order("updated_at", { ascending: false }),
        (neonClient as any).rpc("crm_list_trash_v2"),
      ]);
      if (activeResult.error) throw activeResult.error;
      if (trashResult.error && !/function.*not found|schema cache/i.test(text(trashResult.error?.message))) throw trashResult.error;
      setActiveDocuments(rows(activeResult.data).map(mapActive));
      setTrash(trashResult.error ? [] : rows(trashResult.data).map(mapTrash));
    } catch (reason) {
      setError(errorText(reason, "Não foi possível carregar o gerenciamento de documentos."));
    }
  }, []);

  useEffect(() => { void refreshLifecycle(); }, [refreshLifecycle, version]);

  const trashBatches = useMemo(() => {
    const grouped = new Map<string, TrashRow[]>();
    for (const item of trash) grouped.set(item.batchId, [...(grouped.get(item.batchId) || []), item]);
    return [...grouped.entries()];
  }, [trash]);

  async function deleteDocument(document: ActiveDocument) {
    const signed = document.status === "assinado" || document.signatureStatus === "signed" || Boolean(document.signedAt);
    const warning = signed
      ? "\n\nO documento assinado irá para a lixeira, porém a versão, assinatura e evidências continuarão preservadas."
      : "\n\nLinks de assinatura ativos serão revogados automaticamente.";
    if (!window.confirm(`Mover ${document.number} para a lixeira?${warning}`)) return;

    setBusyId(`delete:${document.id}`);
    setError("");
    try {
      await claimWorkspaceWithRetry();
      const result = await (neonClient as any).rpc("crm_soft_delete", {
        p_table: "commercial_documents",
        p_id: Number(document.id),
        p_reason: `Excluído pela Central de Documentos por ${props.userName || "usuário autorizado"}`,
      });
      if (result.error) throw result.error;
      if (!result.data) throw new Error("O banco não confirmou o envio para a lixeira.");
      setNotice(`${document.number} foi enviado para a lixeira.`);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(errorText(reason, "Não foi possível excluir o documento."));
    } finally {
      setBusyId("");
    }
  }

  async function restoreBatch(batchId: string) {
    setBusyId(`restore:${batchId}`);
    setError("");
    try {
      await claimWorkspaceWithRetry();
      const result = await (neonClient as any).rpc("crm_restore_trash_batch", { p_batch: batchId });
      if (result.error) throw result.error;
      setNotice(`${Number(result.data || 0)} registro(s) restaurado(s).`);
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(errorText(reason, "Não foi possível restaurar o lote."));
    } finally {
      setBusyId("");
    }
  }

  async function purgeBatch(batchId: string, items: TrashRow[]) {
    const protectedCount = items.filter((item) => item.protectedEvidence).length;
    const latestItem = latestPurgeItem(items);

    if (protectedCount > 0) {
      setError("");
      setNotice("Este lote contém evidência contratual protegida e permanecerá preservado por inteiro.");
      return;
    }

    if (!canPurgeBatch(items)) {
      setError("");
      setNotice(latestItem
        ? `O lote ainda está em retenção. Expurgo liberado após ${dateTime(latestItem.purgeAt)} (${daysLeft(latestItem.purgeAt)}).`
        : "Este lote ainda não está elegível para expurgo.");
      return;
    }

    if (!window.confirm(`Apagar definitivamente os ${items.length} item(ns) deste lote? Todos os prazos de retenção já venceram. Esta ação não pode ser desfeita.`)) return;

    setBusyId(`purge:${batchId}`);
    setError("");
    try {
      await claimWorkspaceWithRetry();
      const result = await (neonClient as any).rpc("crm_purge_trash_batch", { p_batch: batchId });
      if (result.error) throw result.error;
      const deleted = Number(result.data || 0);
      setNotice(deleted > 0
        ? `${deleted} registro(s) apagado(s) definitivamente após o prazo de retenção.`
        : "Nenhum registro foi expurgado. O banco preservou o lote por retenção ou evidência relacionada.");
      setVersion((value) => value + 1);
    } catch (reason) {
      setError(errorText(reason, "Não foi possível concluir o expurgo."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.lifecycle} aria-label="Ciclo de vida dos documentos">
        <div className={styles.heading}>
          <div>
            <span>CONTROLE DE DOCUMENTOS</span>
            <h2>Exclusão segura e lixeira</h2>
            <p>As ações são executadas pelo React e confirmadas pelo banco antes da interface mudar.</p>
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={() => setManagingOpen((value) => !value)}>{managingOpen ? "Fechar gerenciamento" : `Gerenciar (${activeDocuments.length})`}</button>
            <button type="button" className={styles.trashButton} onClick={() => setTrashOpen((value) => !value)}>Lixeira ({trash.length})</button>
          </div>
        </div>

        {notice && <div className={styles.notice} role="status">{notice}</div>}
        {error && <div className={styles.error} role="alert"><strong>Ação não concluída</strong><span>{error}</span><button type="button" onClick={() => setError("")}>Fechar</button></div>}

        {managingOpen && <div className={styles.manager}>
          {activeDocuments.length ? activeDocuments.map((document) => {
            const protectedEvidence = document.status === "assinado" || document.signatureStatus === "signed" || Boolean(document.signedAt);
            return <article key={document.id}>
              <div><span>{document.documentType === "recibo" ? "COMPROVANTE" : document.documentType.toUpperCase()}</span><strong>{document.number}</strong><small>{document.title}</small></div>
              <div className={styles.rowActions}>{protectedEvidence && <em>Evidência protegida</em>}<button type="button" className={styles.danger} disabled={busyId === `delete:${document.id}`} onClick={() => void deleteDocument(document)}>{busyId === `delete:${document.id}` ? "Excluindo..." : "Excluir"}</button></div>
            </article>;
          }) : <p className={styles.empty}>Nenhum documento ativo.</p>}
        </div>}

        {trashOpen && <div className={styles.trash}>
          <header><strong>Lixeira do workspace</strong><span>O lote só pode ser expurgado quando todos os prazos vencerem; evidências assinadas permanecem preservadas.</span></header>
          {trashBatches.length ? trashBatches.map(([batchId, items]) => {
            const first = items[0];
            const protectedCount = items.filter((item) => item.protectedEvidence).length;
            const latestItem = latestPurgeItem(items);
            const purgeAllowed = canPurgeBatch(items);
            const purgeLabel = protectedCount > 0
              ? "Retenção protegida"
              : purgeAllowed
                ? `Expurgar lote (${items.length})`
                : latestItem
                  ? `Expurgo em ${daysLeft(latestItem.purgeAt)}`
                  : "Não elegível";
            return <article className={styles.batch} key={batchId}>
              <div className={styles.batchHeader}>
                <div><strong>{items.length} item(ns) · {dateTime(first.deletedAt)}</strong><small>Excluído por {first.deletedByName} · prazo final {latestItem ? daysLeft(latestItem.purgeAt) : "protegido"}</small></div>
                <div>{protectedCount > 0 && <span className={styles.protected}>{protectedCount} evidência(s) protegida(s)</span>}<button type="button" disabled={busyId === `restore:${batchId}`} onClick={() => void restoreBatch(batchId)}>Restaurar lote</button><button type="button" className={styles.danger} disabled={busyId === `purge:${batchId}` || !purgeAllowed} title={!purgeAllowed ? "O lote ainda está em retenção ou contém evidência protegida." : "Apagar definitivamente o lote após todos os prazos vencerem."} onClick={() => void purgeBatch(batchId, items)}>{busyId === `purge:${batchId}` ? "Expurgando..." : purgeLabel}</button></div>
              </div>
              <ul>{items.map((item) => <li key={`${item.tableName}:${item.recordId}`}><div><span>{item.recordType}</span><strong>{item.label}</strong><small>{item.deletedReason || "Sem motivo informado"}</small></div>{item.protectedEvidence && <em>EVIDÊNCIA CONTRATUAL — RETENÇÃO PROTEGIDA</em>}</li>)}</ul>
            </article>;
          }) : <p className={styles.empty}>A lixeira está vazia.</p>}
        </div>}
      </section>

      <DocumentsCenterV2 key={version} {...props} />
    </div>
  );
}
