"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

import { Client, Payment, Project } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { compactCurrency, dateLabel } from "./shared";

type AccessProfile = {
  id?: number;
  workspaceOwnerId?: string;
  name?: string;
  email?: string;
  role: string;
  permissions: Record<string, boolean>;
  status: string;
  isOwner: boolean;
};

type Props = {
  access: AccessProfile;
  clients: Client[];
  projects: Project[];
  payments: Payment[];
  onDataChanged?: () => void;
};

type AdminTab = "data" | "trash" | "team" | "backup";
type ManagedTable = "clients" | "projects" | "payments" | "commercial_documents" | "tasks" | "site_audits" | "site_infrastructure" | "access_credentials" | "renewal_costs";

type ManagedItem = {
  id: string;
  table: ManagedTable;
  type: string;
  label: string;
  detail: string;
  signed?: boolean;
  confirmationCode?: string;
};

type TrashItem = {
  batch_id: string;
  table_name: string;
  record_id: number;
  record_type: string;
  label: string;
  deleted_at: string;
  deleted_reason: string;
  purge_at: string;
};

type TeamMember = {
  id: number;
  workspace_owner_id: string;
  user_id: string | null;
  name: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
  status: string;
  invited_at: string;
  joined_at: string | null;
};

type MemberDraft = {
  id: number | null;
  name: string;
  email: string;
  role: string;
  permissions: Record<string, boolean>;
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  commercial: "Comercial",
  operations: "Operações",
  finance: "Financeiro",
  viewer: "Somente leitura",
};

const STATUS_LABELS: Record<string, string> = {
  invited: "Aguardando acesso",
  active: "Ativo",
  suspended: "Suspenso",
};

const PERMISSIONS = [
  ["clients.view", "Ver clientes"], ["clients.write", "Editar clientes"],
  ["projects.view", "Ver projetos"], ["projects.write", "Editar projetos"],
  ["finance.view", "Ver financeiro"], ["finance.write", "Editar financeiro"],
  ["documents.view", "Ver documentos"], ["documents.write", "Editar documentos"],
  ["tasks.view", "Ver agenda"], ["tasks.write", "Editar agenda"],
  ["infrastructure.view", "Ver infraestrutura"], ["infrastructure.write", "Editar infraestrutura"],
  ["reports.view", "Ver relatórios"], ["admin.view", "Ver administração"], ["admin.manage", "Gerenciar administração"],
] as const;

const TABLE_LABELS: Record<ManagedTable, string> = {
  clients: "Clientes e leads",
  projects: "Projetos",
  payments: "Cobranças",
  commercial_documents: "Contratos, propostas e recibos",
  tasks: "Tarefas",
  site_audits: "Auditorias",
  site_infrastructure: "Infraestrutura",
  access_credentials: "Referências de acesso",
  renewal_costs: "Custos e renovações",
};

const RESTORE_ORDER = [
  "clients", "projects", "payments", "payment_installments", "tasks", "client_activities", "site_audits",
  "site_infrastructure", "access_credentials", "renewal_costs", "business_profiles", "service_catalog",
  "contract_clause_templates", "commercial_documents", "document_versions", "document_signing_links",
  "document_signatures", "document_events", "crm_team_members", "crm_settings",
];

function emptyMember(): MemberDraft {
  return { id: null, name: "", email: "", role: "viewer", permissions: {} };
}

function rows(value: unknown): Record<string, any>[] {
  return Array.isArray(value) ? value as Record<string, any>[] : [];
}

function friendlyError(reason: unknown, fallback: string) {
  const raw = reason instanceof Error ? reason.message : typeof reason === "object" && reason && "message" in reason ? String((reason as any).message || "") : "";
  const message = raw.trim();
  if (!message) return fallback;
  if (/permission|permissão|row-level security/i.test(message)) return "Seu usuário não possui permissão para concluir esta ação.";
  if (/duplicate|unique/i.test(message)) return "Já existe um registro com esses dados.";
  if (/foreign key|violates.*constraint/i.test(message)) return "Este registro possui informações vinculadas e não pode ser alterado dessa forma.";
  if (/network|fetch|timeout/i.test(message)) return "A conexão com o servidor falhou. Confira a internet e tente novamente.";
  return message;
}

function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function groupTrash(items: TrashItem[]) {
  const map = new Map<string, TrashItem[]>();
  items.forEach((item) => map.set(item.batch_id, [...(map.get(item.batch_id) || []), item]));
  return Array.from(map.entries()).map(([batch, records]) => ({ batch, records, root: records[0] }));
}

export function AdministrationModule({ access, clients, projects, payments, onDataChanged }: Props) {
  const [tab, setTab] = useState<AdminTab>("data");
  const [managedItems, setManagedItems] = useState<ManagedItem[]>([]);
  const [trash, setTrash] = useState<TrashItem[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [memberDraft, setMemberDraft] = useState<MemberDraft>(emptyMember);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const canManage = access.isOwner || access.role === "admin" || access.permissions?.["admin.manage"] === true;

  async function loadAdministration() {
    setLoading(true);
    setError("");
    try {
      if (canManage) await (neonClient as any).rpc("crm_purge_expired_trash");
      const [documentsQuery, tasksQuery, auditsQuery, infraQuery, credentialsQuery, renewalsQuery, trashQuery, teamQuery] = await Promise.all([
        neonClient.from("commercial_documents").select("id, number, title, document_type, status, amount").order("updated_at", { ascending: false }),
        neonClient.from("tasks").select("id, title, status, due_date").order("updated_at", { ascending: false }),
        neonClient.from("site_audits").select("id, title, url, overall_score").order("created_at", { ascending: false }),
        neonClient.from("site_infrastructure").select("id, site_name, primary_domain, status").order("updated_at", { ascending: false }),
        neonClient.from("access_credentials").select("id, platform, category, username_email").order("updated_at", { ascending: false }),
        neonClient.from("renewal_costs").select("id, item_type, provider, plan_domain, amount, next_due_date").order("updated_at", { ascending: false }),
        (neonClient as any).rpc("crm_list_trash"),
        neonClient.from("crm_team_members").select("id, workspace_owner_id, user_id, name, email, role, permissions, status, invited_at, joined_at").order("role", { ascending: true }).order("id", { ascending: true }),
      ]);

      const failure = documentsQuery.error || tasksQuery.error || auditsQuery.error || infraQuery.error || credentialsQuery.error || renewalsQuery.error || trashQuery.error || teamQuery.error;
      if (failure) throw failure;

      const items: ManagedItem[] = [
        ...clients.map((item) => ({ id: item.id, table: "clients" as const, type: item.lifecycle === "lead" ? "Lead" : "Cliente", label: item.tradeName || item.company || item.name, detail: item.document || item.email || item.city || "Cadastro comercial" })),
        ...projects.map((item) => ({ id: item.id, table: "projects" as const, type: "Projeto", label: item.name, detail: `${item.serviceType} · ${compactCurrency.format(item.totalValue)}` })),
        ...payments.map((item) => ({ id: item.id, table: "payments" as const, type: "Cobrança", label: item.description, detail: `${compactCurrency.format(item.totalAmount)} · ${item.status}` })),
        ...rows(documentsQuery.data).map((item) => ({ id: String(item.id), table: "commercial_documents" as const, type: item.document_type === "contrato" ? "Contrato" : item.document_type === "recibo" ? "Recibo" : "Proposta", label: `${item.number} · ${item.title}`, detail: `${compactCurrency.format(Number(item.amount || 0))} · ${item.status}`, signed: item.status === "assinado", confirmationCode: String(item.number || "") })),
        ...rows(tasksQuery.data).map((item) => ({ id: String(item.id), table: "tasks" as const, type: "Tarefa", label: String(item.title || "Tarefa"), detail: `${item.status}${item.due_date ? ` · ${dateLabel(String(item.due_date))}` : ""}` })),
        ...rows(auditsQuery.data).map((item) => ({ id: String(item.id), table: "site_audits" as const, type: "Auditoria", label: String(item.title || item.url || "Auditoria"), detail: `Pontuação ${Number(item.overall_score || 0)}` })),
        ...rows(infraQuery.data).map((item) => ({ id: String(item.id), table: "site_infrastructure" as const, type: "Infraestrutura", label: String(item.site_name || item.primary_domain || "Site"), detail: String(item.status || "ativo") })),
        ...rows(credentialsQuery.data).map((item) => ({ id: String(item.id), table: "access_credentials" as const, type: "Referência de acesso", label: String(item.platform || item.category || "Acesso"), detail: String(item.username_email || item.category || "") })),
        ...rows(renewalsQuery.data).map((item) => ({ id: String(item.id), table: "renewal_costs" as const, type: "Renovação", label: String(item.plan_domain || item.provider || item.item_type || "Custo"), detail: `${compactCurrency.format(Number(item.amount || 0))}${item.next_due_date ? ` · ${dateLabel(String(item.next_due_date))}` : ""}` })),
      ];

      setManagedItems(items);
      setTrash(rows(trashQuery.data) as TrashItem[]);
      setMembers(rows(teamQuery.data) as TeamMember[]);
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível carregar a administração."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadAdministration(); }, [clients, projects, payments]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return managedItems.filter((item) => [item.type, item.label, item.detail, TABLE_LABELS[item.table]].join(" ").toLocaleLowerCase("pt-BR").includes(term));
  }, [managedItems, search]);

  async function moveToTrash(item: ManagedItem) {
    let warning = `Enviar ${item.type.toLowerCase()} “${item.label}” para a lixeira?\n\nO registro poderá ser restaurado por 30 dias.`;
    if (item.table === "clients") warning += "\n\nProjetos, cobranças, documentos, tarefas e infraestrutura vinculados serão enviados no mesmo lote.";
    if (item.table === "projects") warning += "\n\nCobranças, documentos, tarefas e infraestrutura do projeto serão enviados no mesmo lote.";
    if (!window.confirm(warning)) return;
    if (item.signed) {
      const typed = window.prompt(`Este contrato está assinado e pode ser uma prova jurídica.\n\nDigite exatamente ${item.confirmationCode} para continuar.`);
      if (typed?.trim() !== item.confirmationCode) return setError("Exclusão cancelada: o número do contrato não confere.");
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await (neonClient as any).rpc("crm_soft_delete", { p_table: item.table, p_id: Number(item.id), p_reason: "Exclusão solicitada pela administração do CRM" });
      if (result.error) throw result.error;
      setNotice(`${item.type} enviado para a lixeira.`);
      await loadAdministration();
      onDataChanged?.();
    } catch (reason) {
      setError(friendlyError(reason, "Não foi possível enviar o registro para a lixeira."));
    } finally { setBusy(false); }
  }

  async function restoreBatch(batch: string) {
    if (!window.confirm("Restaurar todos os registros deste lote?")) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await (neonClient as any).rpc("crm_restore_trash_batch", { p_batch: batch });
      if (result.error) throw result.error;
      setNotice(`${Number(result.data || 0)} registro(s) restaurado(s).`);
      await loadAdministration();
      onDataChanged?.();
    } catch (reason) { setError(friendlyError(reason, "Não foi possível restaurar o lote.")); }
    finally { setBusy(false); }
  }

  async function purgeBatch(batch: string) {
    const typed = window.prompt("Esta ação é definitiva. Digite EXCLUIR para apagar o lote permanentemente.");
    if (typed !== "EXCLUIR") return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await (neonClient as any).rpc("crm_purge_trash_batch", { p_batch: batch });
      if (result.error) throw result.error;
      setNotice(`${Number(result.data || 0)} registro(s) apagado(s) definitivamente.`);
      await loadAdministration();
      onDataChanged?.();
    } catch (reason) { setError(friendlyError(reason, "Não foi possível apagar o lote.")); }
    finally { setBusy(false); }
  }

  function editMember(member: TeamMember) {
    setMemberDraft({ id: member.id, name: member.name, email: member.email, role: member.role, permissions: member.permissions || {} });
  }

  async function saveMember() {
    if (!memberDraft.email.trim()) return setError("Informe o e-mail do funcionário.");
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await (neonClient as any).rpc("crm_upsert_team_member", {
        p_id: memberDraft.id,
        p_name: memberDraft.name,
        p_email: memberDraft.email,
        p_role: memberDraft.role,
        p_permissions: memberDraft.permissions,
      });
      if (result.error) throw result.error;
      setNotice(memberDraft.id ? "Permissões atualizadas." : "Funcionário autorizado. O acesso será ativado quando ele entrar com este e-mail.");
      setMemberDraft(emptyMember());
      await loadAdministration();
    } catch (reason) { setError(friendlyError(reason, "Não foi possível salvar o funcionário.")); }
    finally { setBusy(false); }
  }

  async function setMemberStatus(member: TeamMember, status: string) {
    if (!window.confirm(`${status === "suspended" ? "Suspender" : "Reativar"} o acesso de ${member.name || member.email}?`)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await (neonClient as any).rpc("crm_set_team_member_status", { p_id: member.id, p_status: status });
      if (result.error) throw result.error;
      setNotice(status === "suspended" ? "Acesso suspenso." : "Acesso reativado.");
      await loadAdministration();
    } catch (reason) { setError(friendlyError(reason, "Não foi possível alterar o acesso.")); }
    finally { setBusy(false); }
  }

  async function exportBackup() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await (neonClient as any).rpc("crm_export_backup");
      if (result.error) throw result.error;
      const date = new Date().toISOString().slice(0, 10);
      downloadJson(`nassus-crm-backup-${date}.json`, result.data);
      setNotice("Backup completo gerado e baixado.");
    } catch (reason) { setError(friendlyError(reason, "Não foi possível gerar o backup.")); }
    finally { setBusy(false); }
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const typed = window.prompt("A restauração mesclará o arquivo com o CRM atual. Digite RESTAURAR para continuar.");
    if (typed !== "RESTAURAR") return;
    setBusy(true); setError(""); setNotice("");
    try {
      const backup = JSON.parse(await file.text());
      if (Number(backup?.schemaVersion || 0) < 4 || !backup?.tables) throw new Error("Arquivo de backup inválido ou incompatível.");
      const ownerId = access.workspaceOwnerId || backup.workspaceOwnerId;
      for (const table of RESTORE_ORDER) {
        const data = Array.isArray(backup.tables[table]) ? backup.tables[table] : [];
        if (!data.length) continue;
        const normalized = data.map((row: Record<string, unknown>) => {
          const value = { ...row } as Record<string, unknown>;
          if ("owner_id" in value) value.owner_id = ownerId;
          if ("workspace_owner_id" in value) value.workspace_owner_id = ownerId;
          return value;
        });
        const onConflict = table === "crm_settings" ? "workspace_owner_id" : "id";
        const result = await (neonClient.from(table) as any).upsert(normalized, { onConflict });
        if (result.error) throw new Error(`${table}: ${result.error.message}`);
      }
      const repair = await (neonClient as any).rpc("crm_repair_sequences");
      if (repair.error) throw repair.error;
      setNotice("Backup restaurado e índices internos reparados.");
      await loadAdministration();
      onDataChanged?.();
    } catch (reason) { setError(friendlyError(reason, "Não foi possível restaurar o backup.")); }
    finally { setBusy(false); }
  }

  const groupedTrash = useMemo(() => groupTrash(trash), [trash]);
  const groupedManaged = useMemo(() => Object.entries(TABLE_LABELS).map(([table, label]) => ({ table: table as ManagedTable, label, items: filteredItems.filter((item) => item.table === table) })).filter((group) => group.items.length), [filteredItems]);

  return (
    <div className="admin-stack">
      <nav className="admin-tabs">
        <button type="button" className={tab === "data" ? "active" : ""} onClick={() => setTab("data")}>Gestão de dados</button>
        <button type="button" className={tab === "trash" ? "active" : ""} onClick={() => setTab("trash")}>Lixeira <b>{groupedTrash.length}</b></button>
        <button type="button" className={tab === "team" ? "active" : ""} onClick={() => setTab("team")}>Equipe e permissões</button>
        <button type="button" className={tab === "backup" ? "active" : ""} onClick={() => setTab("backup")}>Backup e restauração</button>
      </nav>

      {notice && <div className="admin-feedback success">{notice}</div>}
      {error && <div className="admin-feedback error"><strong>Ação não concluída</strong><span>{error}</span><button type="button" onClick={() => setError("")}>Fechar</button></div>}
      {loading && <div className="suite-loading"><i /><strong>Carregando administração</strong><span>Validando permissões e dados do workspace.</span></div>}

      {!loading && tab === "data" && <section className="admin-data">
        <header className="admin-section-head"><div><span>EXCLUSÃO SEGURA</span><h2>Gestão de registros ativos</h2><p>Os itens são enviados à lixeira por 30 dias. Nada é apagado imediatamente.</p></div><div className="business-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, contrato, projeto..." /></div></header>
        {groupedManaged.map((group) => <article className="admin-record-group" key={group.table}><header><h3>{group.label}</h3><b>{group.items.length}</b></header><div>{group.items.map((item) => <section key={`${item.table}-${item.id}`}><span><strong>{item.label}</strong><small>{item.type} · {item.detail}</small></span><button type="button" className="danger" disabled={busy || !canManage} onClick={() => void moveToTrash(item)}>Enviar à lixeira</button></section>)}</div></article>)}
        {!groupedManaged.length && <div className="business-empty"><div>⌕</div><h2>Nenhum registro encontrado</h2><p>Altere a busca para localizar outro item.</p></div>}
      </section>}

      {!loading && tab === "trash" && <section className="admin-trash">
        <header className="admin-section-head"><div><span>RECUPERAÇÃO DE 30 DIAS</span><h2>Lixeira do CRM</h2><p>Restaure o lote completo ou apague definitivamente com confirmação reforçada.</p></div><button type="button" className="business-secondary" onClick={() => void loadAdministration()}>Atualizar</button></header>
        {groupedTrash.length ? groupedTrash.map((group) => <article className="trash-card" key={group.batch}><header><div><span>{group.root.record_type}</span><h3>{group.root.label}</h3><small>Excluído em {new Date(group.root.deleted_at).toLocaleString("pt-BR")} · exclusão automática em {new Date(group.root.purge_at).toLocaleDateString("pt-BR")}</small></div><b>{group.records.length} registro(s)</b></header><div className="trash-related">{group.records.slice(0, 8).map((item) => <span key={`${item.table_name}-${item.record_id}`}>{item.record_type}: {item.label}</span>)}{group.records.length > 8 && <span>+ {group.records.length - 8} vinculados</span>}</div><footer><button type="button" className="business-secondary" disabled={busy || !canManage} onClick={() => void restoreBatch(group.batch)}>Restaurar lote</button><button type="button" className="danger" disabled={busy || !canManage} onClick={() => void purgeBatch(group.batch)}>Apagar definitivamente</button></footer></article>) : <div className="business-empty"><div>✓</div><h2>Lixeira vazia</h2><p>Nenhum registro está aguardando exclusão.</p></div>}
      </section>}

      {!loading && tab === "team" && <section className="admin-team-grid">
        <article className="pro-panel team-editor"><header><div><span>ACESSO DE FUNCIONÁRIOS</span><h2>{memberDraft.id ? "Editar permissões" : "Autorizar funcionário"}</h2><p>O acesso é vinculado ao e-mail usado no login do CRM.</p></div></header><div className="admin-form-grid"><label>Nome<input value={memberDraft.name} onChange={(event) => setMemberDraft((current) => ({ ...current, name: event.target.value }))} /></label><label>E-mail<input type="email" value={memberDraft.email} onChange={(event) => setMemberDraft((current) => ({ ...current, email: event.target.value }))} /></label><label className="span-2">Cargo<select value={memberDraft.role} onChange={(event) => setMemberDraft((current) => ({ ...current, role: event.target.value }))}><option value="admin">Administrador</option><option value="commercial">Comercial</option><option value="operations">Operações</option><option value="finance">Financeiro</option><option value="viewer">Somente leitura</option></select></label></div><div className="permission-grid">{PERMISSIONS.map(([key, label]) => <label key={key}><input type="checkbox" checked={memberDraft.permissions[key] === true} onChange={(event) => setMemberDraft((current) => ({ ...current, permissions: { ...current.permissions, [key]: event.target.checked } }))} /><span>{label}</span></label>)}</div><footer><button type="button" className="business-secondary" onClick={() => setMemberDraft(emptyMember())}>Limpar</button><button type="button" className="pro-primary" disabled={busy || !canManage} onClick={() => void saveMember()}>{memberDraft.id ? "Salvar permissões" : "Autorizar e-mail"}</button></footer></article>
        <article className="pro-panel team-list"><header><div><span>EQUIPE AUTORIZADA</span><h2>Usuários e cargos</h2></div><b>{members.length}</b></header>{members.map((member) => <section key={member.id}><div className="team-avatar">{(member.name || member.email).split(/\s+/).slice(0,2).map((part) => part[0]?.toUpperCase()).join("")}</div><span><strong>{member.name || member.email}</strong><small>{member.email} · {ROLE_LABELS[member.role] || member.role}</small></span><b className={`team-status status-${member.status}`}>{STATUS_LABELS[member.status] || member.status}</b><div>{member.role !== "owner" && <><button type="button" onClick={() => editMember(member)}>Editar</button><button type="button" className={member.status === "suspended" ? "positive" : "danger"} disabled={busy || !canManage} onClick={() => void setMemberStatus(member, member.status === "suspended" ? "invited" : "suspended")}>{member.status === "suspended" ? "Reativar" : "Suspender"}</button></>}</div></section>)}</article>
      </section>}

      {!loading && tab === "backup" && <section className="admin-backup-grid">
        <article className="backup-card"><span>BACKUP COMPLETO</span><h2>Exportar dados do CRM</h2><p>Gera um arquivo JSON com clientes, projetos, financeiro, documentos, assinaturas, infraestrutura, equipe e lixeira.</p><button type="button" className="pro-primary" disabled={busy || !canManage} onClick={() => void exportBackup()}>Baixar backup agora</button></article>
        <article className="backup-card warning"><span>RESTAURAÇÃO</span><h2>Restaurar arquivo</h2><p>O arquivo será mesclado com os dados atuais. Registros com o mesmo ID serão atualizados.</p><label className={`backup-upload ${busy || !canManage ? "disabled" : ""}`}>Selecionar backup<input type="file" accept="application/json,.json" disabled={busy || !canManage} onChange={(event) => void restoreBackup(event)} /></label></article>
        <article className="backup-guidance"><strong>Boas práticas</strong><p>Faça um backup antes de alterações grandes e guarde uma cópia fora do computador principal. O arquivo contém dados comerciais e deve ser tratado como confidencial.</p></article>
      </section>}
    </div>
  );
}
