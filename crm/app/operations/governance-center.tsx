"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { claimWorkspaceWithRetry, waitForAuthenticatedUser } from "@/lib/auth-session";
import { neonClient } from "@/lib/neon";
import styles from "./governance-center.module.css";

type Tab = "health" | "security" | "privacy" | "retention" | "audit" | "vault" | "backups" | "roles";
type Row = Record<string, any>;

type SessionItem = {
  id: string;
  token: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
};

type Props = {
  canManage: boolean;
};

const TABS: Array<[Tab, string]> = [
  ["health", "Saúde"],
  ["security", "Segurança"],
  ["privacy", "LGPD"],
  ["retention", "Retenção"],
  ["audit", "Auditoria"],
  ["vault", "Cofre"],
  ["backups", "Backups"],
  ["roles", "Acessos"],
];

const REQUEST_LABELS: Record<string, string> = {
  access: "Acesso aos dados",
  correction: "Correção",
  portability: "Portabilidade",
  anonymization: "Anonimização",
  deletion: "Exclusão",
  information: "Informação sobre tratamento",
};

const RETENTION_LABELS: Record<string, string> = {
  clients: "Clientes",
  projects: "Projetos",
  payments: "Financeiro",
  commercial_documents: "Documentos comerciais",
  tasks: "Tarefas",
  site_audits: "Auditorias de sites",
  site_infrastructure: "Infraestrutura",
  access_credentials: "Referências de acesso",
  renewal_costs: "Renovações e custos",
};

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? value as Row[] : [];
}

function str(value: unknown): string {
  return value == null ? "" : String(value);
}

function friendly(reason: unknown, fallback: string): string {
  const raw = reason && typeof reason === "object" && "message" in reason ? str((reason as { message?: unknown }).message) : str(reason);
  if (/permission|permissão|row-level security/i.test(raw)) return "Seu perfil não possui permissão para esta ação.";
  if (/network|fetch|timeout/i.test(raw)) return "A conexão falhou. Tente novamente.";
  return raw || fallback;
}

function when(value: unknown): string {
  const text = str(value);
  if (!text) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(text));
}

function maskIp(value: string): string {
  if (!value) return "não informado";
  if (value.includes(":")) return `${value.split(":").slice(0, 2).join(":")}:…`;
  const parts = value.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.***.***` : "mascarado";
}

function browserLabel(value: string): string {
  if (!value) return "Dispositivo não identificado";
  if (/Edg\//i.test(value)) return "Microsoft Edge";
  if (/Chrome\//i.test(value)) return "Google Chrome";
  if (/Firefox\//i.test(value)) return "Mozilla Firefox";
  if (/Safari\//i.test(value)) return "Safari";
  return value.slice(0, 80);
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

async function rpc(name: string, args?: Record<string, unknown>) {
  const result = await (neonClient as any).rpc(name, args || {});
  if (result.error) throw result.error;
  return result.data;
}

export function GovernanceCenter({ canManage }: Props) {
  const [tab, setTab] = useState<Tab>("health");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [health, setHealth] = useState<Row>({});
  const [security, setSecurity] = useState<Row>({});
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [audit, setAudit] = useState<Row[]>([]);
  const [retention, setRetention] = useState<Row[]>([]);
  const [requests, setRequests] = useState<Row[]>([]);
  const [inventory, setInventory] = useState<Row[]>([]);
  const [vault, setVault] = useState<Row[]>([]);
  const [backups, setBackups] = useState<Row[]>([]);
  const [roles, setRoles] = useState<Row[]>([]);
  const [team, setTeam] = useState<Row[]>([]);
  const [subjectSearch, setSubjectSearch] = useState("");
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null);
  const [retentionDraft, setRetentionDraft] = useState<Record<string, number>>({});

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      await claimWorkspaceWithRetry();
      const [healthData, securityData, auditData, retentionData, requestData, vaultData, backupData, roleData, teamData] = await Promise.all([
        rpc("crm_health_snapshot"),
        rpc("crm_auth_security_summary"),
        rpc("crm_list_audit_events", { p_limit: 250 }),
        rpc("crm_list_retention_policies"),
        rpc("crm_list_data_subject_requests"),
        rpc("crm_vault_list"),
        rpc("crm_list_backups"),
        rpc("crm_list_role_presets"),
        rpc("crm_team_security_overview"),
      ]);
      setHealth((healthData || {}) as Row);
      setSecurity((securityData || {}) as Row);
      setAudit(rows(auditData));
      const retentionRows = rows(retentionData);
      setRetention(retentionRows);
      setRetentionDraft(Object.fromEntries(retentionRows.map((item) => [str(item.record_type), Number(item.retention_days || 30)])));
      setRequests(rows(requestData));
      setVault(rows(vaultData));
      setBackups(rows(backupData));
      setRoles(rows(roleData));
      setTeam(rows(teamData));

      try {
        const auth = neonClient.auth as any;
        const sessionResult = await auth.listSessions?.();
        if (sessionResult?.error) throw sessionResult.error;
        setSessions(rows(sessionResult?.data).map((item) => ({
          id: str(item.id), token: str(item.token), createdAt: str(item.createdAt), updatedAt: str(item.updatedAt), expiresAt: str(item.expiresAt), ipAddress: str(item.ipAddress), userAgent: str(item.userAgent),
        })));
      } catch {
        setSessions([]);
      }
    } catch (reason) {
      setError(friendly(reason, "Não foi possível carregar a central de governança."));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function auditAction(eventType: string, entityType: string, entityId: string, message: string, severity = "info") {
    try {
      await rpc("crm_record_audit_event", { p_event_type: eventType, p_entity_type: entityType, p_entity_id: entityId, p_severity: severity, p_outcome: "success", p_message: message, p_metadata: {} });
    } catch { /* diagnóstico não deve quebrar a ação principal */ }
  }

  async function revokeOtherSessions() {
    setBusy("sessions"); setError(""); setNotice("");
    try {
      const result = await (neonClient.auth as any).revokeOtherSessions?.();
      if (!result) throw new Error("O provedor de autenticação não expôs revogação de sessões.");
      if (result.error) throw result.error;
      await auditAction("auth_other_sessions_revoked", "session", "others", "Outras sessões foram encerradas", "warning");
      setNotice("Outras sessões foram encerradas.");
      await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível encerrar as outras sessões.")); }
    finally { setBusy(""); }
  }

  async function revokeSession(session: SessionItem) {
    if (!session.token || !window.confirm("Encerrar esta sessão?")) return;
    setBusy(`session:${session.id}`); setError(""); setNotice("");
    try {
      const result = await (neonClient.auth as any).revokeSession?.({ token: session.token });
      if (!result) throw new Error("O provedor não expôs revogação individual de sessão.");
      if (result.error) throw result.error;
      await auditAction("auth_session_revoked", "session", session.id, "Sessão encerrada", "warning");
      setNotice("Sessão encerrada.");
      await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível encerrar a sessão.")); }
    finally { setBusy(""); }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = str(form.get("currentPassword"));
    const newPassword = str(form.get("newPassword"));
    const confirmPassword = str(form.get("confirmPassword"));
    if (newPassword.length < 12) return setError("Use uma nova senha com pelo menos 12 caracteres.");
    if (newPassword !== confirmPassword) return setError("A confirmação da nova senha não confere.");
    setBusy("password"); setError(""); setNotice("");
    try {
      const result = await (neonClient.auth as any).changePassword?.({ currentPassword, newPassword, revokeOtherSessions: true });
      if (!result) throw new Error("A troca de senha não está disponível neste provedor.");
      if (result.error) throw result.error;
      await auditAction("auth_password_changed", "user", "self", "Senha alterada e outras sessões revogadas", "critical");
      setNotice("Senha alterada. Outras sessões foram revogadas por segurança.");
      event.currentTarget.reset();
      await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível alterar a senha.")); }
    finally { setBusy(""); }
  }

  async function searchSubjects(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setBusy("subject-search"); setError("");
    try { setInventory(rows(await rpc("crm_data_subject_inventory", { p_query: subjectSearch }))); }
    catch (reason) { setError(friendly(reason, "Não foi possível localizar o titular.")); }
    finally { setBusy(""); }
  }

  async function exportSubject(clientId: number, name: string) {
    setBusy(`export:${clientId}`); setError("");
    try {
      const data = await rpc("crm_export_data_subject", { p_client_id: clientId });
      downloadJson(`lgpd-${name.toLowerCase().replace(/[^a-z0-9]+/gi, "-")}-${new Date().toISOString().slice(0, 10)}.json`, data);
      await auditAction("lgpd_export_generated", "client", String(clientId), "Exportação de dados do titular gerada", "warning");
      setNotice("Exportação LGPD gerada localmente no navegador.");
    } catch (reason) { setError(friendly(reason, "Não foi possível gerar a exportação.")); }
    finally { setBusy(""); }
  }

  async function createRequest(clientId: number, type: string) {
    const notes = window.prompt("Observação da solicitação (opcional):") || "";
    setBusy(`request:${clientId}`); setError("");
    try {
      await rpc("crm_create_data_subject_request", { p_client_id: clientId, p_request_type: type, p_notes: notes });
      setNotice("Solicitação do titular registrada e auditada.");
      await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível registrar a solicitação.")); }
    finally { setBusy(""); }
  }

  async function completeRequest(id: number) {
    if (!window.confirm("Marcar esta solicitação como concluída?")) return;
    setBusy(`complete:${id}`); setError("");
    try {
      await rpc("crm_complete_data_subject_request", { p_id: id, p_notes: "" });
      setNotice("Solicitação concluída.");
      await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível concluir a solicitação.")); }
    finally { setBusy(""); }
  }

  async function saveRetention(item: Row) {
    const recordType = str(item.record_type);
    const days = Number(retentionDraft[recordType] || item.retention_days || 30);
    setBusy(`retention:${recordType}`); setError("");
    try {
      await rpc("crm_update_retention_policy", { p_record_type: recordType, p_days: days, p_preserve_signed: Boolean(item.preserve_signed), p_legal_basis: str(item.legal_basis) });
      setNotice("Política de retenção atualizada.");
      await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível atualizar a retenção.")); }
    finally { setBusy(""); }
  }

  async function saveVault(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const label = str(form.get("label")).trim();
    const username = str(form.get("username")).trim();
    const secret = str(form.get("secret"));
    const notes = str(form.get("notes")).trim();
    if (!label || !secret) return setError("Informe o nome e o segredo que será protegido.");
    setBusy("vault-save"); setError("");
    try {
      await rpc("crm_vault_put", { p_id: null, p_client_id: null, p_project_id: null, p_label: label, p_username_hint: username, p_secret: secret, p_notes: notes });
      event.currentTarget.reset();
      setNotice("Segredo criptografado e salvo no cofre.");
      await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível salvar no cofre.")); }
    finally { setBusy(""); }
  }

  async function revealVault(id: number) {
    setBusy(`reveal:${id}`); setError("");
    try {
      const secret = str(await rpc("crm_vault_reveal", { p_id: id }));
      setRevealed({ id: String(id), secret });
      window.setTimeout(() => setRevealed((current) => current?.id === String(id) ? null : current), 30_000);
      setNotice("Segredo revelado por até 30 segundos. A ação foi auditada.");
    } catch (reason) { setError(friendly(reason, "Não foi possível revelar o segredo.")); }
    finally { setBusy(""); }
  }

  async function deleteVault(id: number) {
    if (!window.confirm("Apagar definitivamente este segredo do cofre?")) return;
    setBusy(`vault-delete:${id}`); setError("");
    try {
      await rpc("crm_vault_delete", { p_id: id });
      setRevealed(null); setNotice("Item removido do cofre."); await load(true);
    } catch (reason) { setError(friendly(reason, "Não foi possível apagar o item.")); }
    finally { setBusy(""); }
  }

  async function applyRole(memberId: number, role: string) {
    if (!window.confirm(`Aplicar o perfil ${role} a este usuário?`)) return;
    setBusy(`role:${memberId}`); setError("");
    try { await rpc("crm_apply_role_preset", { p_member_id: memberId, p_role: role }); setNotice("Perfil de acesso aplicado."); await load(true); }
    catch (reason) { setError(friendly(reason, "Não foi possível aplicar o perfil.")); }
    finally { setBusy(""); }
  }

  const highSeverity = useMemo(() => audit.filter((item) => ["critical", "error"].includes(str(item.severity))).length, [audit]);

  if (loading) return <div className={styles.loading}><i /><strong>Carregando governança</strong><span>Validando segurança, privacidade e integridade do workspace.</span></div>;

  return <section className={styles.shell}>
    <header className={styles.hero}><div><span>GOVERNANÇA V2</span><h2>Segurança, LGPD e saúde do CRM</h2><p>Controles administrativos com trilha de auditoria, minimização de dados e ações confirmadas pelo banco.</p></div><button type="button" onClick={() => void load()} disabled={Boolean(busy)}>Atualizar</button></header>
    <nav className={styles.tabs}>{TABS.map(([id,label]) => <button type="button" key={id} className={tab===id?styles.active:""} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {notice && <div className={styles.notice}>{notice}</div>}
    {error && <div className={styles.error}><strong>Ação não concluída</strong><span>{error}</span><button type="button" onClick={() => setError("")}>Fechar</button></div>}

    {tab==="health" && <div className={styles.grid}>
      <article className={styles.metric}><span>BANCO</span><strong>{str(health.database||"—").toUpperCase()}</strong><small>Neon + RLS do workspace</small></article>
      <article className={styles.metric}><span>AUTH</span><strong>{str(health.authUser||"—").toUpperCase()}</strong><small>{Number(security.activeSessions||0)} sessão(ões) ativa(s)</small></article>
      <article className={styles.metric}><span>ASSINATURAS PENDENTES</span><strong>{Number(health.pendingSignatures||0)}</strong><small>Links válidos aguardando cliente</small></article>
      <article className={styles.metric}><span>EVENTOS 24H</span><strong>{Number(health.auditEvents24h||0)}</strong><small>{highSeverity} evento(s) crítico(s) na visão atual</small></article>
      <article className={styles.wide}><h3>Inventário operacional</h3><dl><div><dt>Clientes</dt><dd>{Number(health.clients||0)}</dd></div><div><dt>Projetos</dt><dd>{Number(health.projects||0)}</dd></div><div><dt>Pagamentos</dt><dd>{Number(health.payments||0)}</dd></div><div><dt>Documentos</dt><dd>{Number(health.documents||0)}</dd></div><div><dt>Lixeira</dt><dd>{Number(health.trash||0)}</dd></div></dl><small>Snapshot: {when(health.generatedAt)}</small></article>
    </div>}

    {tab==="security" && <div className={styles.columns}>
      <article className={styles.panel}><h3>Postura de autenticação</h3><dl><div><dt>E-mail verificado</dt><dd>{security.emailVerified?"Sim":"Não — não será exigido até confirmação segura"}</dd></div><div><dt>Conta por senha</dt><dd>{security.passwordAccount?"Ativa":"Não detectada"}</dd></div><div><dt>Sessões ativas</dt><dd>{Number(security.activeSessions||sessions.length)}</dd></div><div><dt>Última sessão</dt><dd>{when(security.lastSessionAt)}</dd></div></dl>{sessions.length>1 && <button type="button" onClick={() => void revokeOtherSessions()} disabled={busy==="sessions"}>Encerrar todas as outras sessões</button>}</article>
      <article className={styles.panel}><h3>Trocar senha</h3><p>Use no mínimo 12 caracteres. Ao alterar, as outras sessões são encerradas.</p><form onSubmit={changePassword} className={styles.form}><label>Senha atual<input name="currentPassword" type="password" required autoComplete="current-password" /></label><label>Nova senha<input name="newPassword" type="password" required minLength={12} autoComplete="new-password" /></label><label>Confirmar nova senha<input name="confirmPassword" type="password" required minLength={12} autoComplete="new-password" /></label><button type="submit" disabled={busy==="password"}>Atualizar senha</button></form></article>
      <article className={styles.wide}><h3>Sessões</h3>{sessions.length?<div className={styles.list}>{sessions.map((session)=><div className={styles.listRow} key={session.id}><div><strong>{browserLabel(session.userAgent)}</strong><small>{maskIp(session.ipAddress)} · criada {when(session.createdAt)} · expira {when(session.expiresAt)}</small></div><button type="button" disabled={busy===`session:${session.id}`} onClick={()=>void revokeSession(session)}>Encerrar</button></div>)}</div>:<p className={styles.muted}>O provedor não retornou a lista detalhada de sessões. O resumo do banco continua ativo.</p>}</article>
    </div>}

    {tab==="privacy" && <div className={styles.columns}>
      <article className={styles.wide}><h3>Localizar titular</h3><form onSubmit={searchSubjects} className={styles.search}><input value={subjectSearch} onChange={e=>setSubjectSearch(e.target.value)} placeholder="Nome, e-mail, CPF/CNPJ"/><button type="submit" disabled={busy==="subject-search"}>Pesquisar</button></form>{inventory.length?<div className={styles.list}>{inventory.map(item=><div className={styles.subject} key={item.client_id}><div><strong>{item.display_name}</strong><small>{item.masked_document||"sem documento"} · {item.email_hint||"sem e-mail"} · {item.status}</small><span>{item.projects_count} projeto(s) · {item.payments_count} pagamento(s) · {item.documents_count} documento(s) · {item.signed_documents_count} assinado(s)</span></div><div><button type="button" onClick={()=>void exportSubject(Number(item.client_id),str(item.display_name))}>Exportar</button><select defaultValue="information" onChange={e=>{const type=e.target.value;if(type)void createRequest(Number(item.client_id),type);e.currentTarget.value="";}}><option value="">Registrar solicitação...</option>{Object.entries(REQUEST_LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div></div>)}</div>:<p className={styles.muted}>Pesquise um titular para inventariar os dados relacionados.</p>}</article>
      <article className={styles.wide}><h3>Solicitações LGPD</h3>{requests.length?<div className={styles.list}>{requests.map(item=><div className={styles.listRow} key={item.id}><div><strong>{item.client_name} · {REQUEST_LABELS[str(item.request_type)]||item.request_type}</strong><small>{item.status} · solicitada {when(item.requested_at)}{item.notes?` · ${item.notes}`:""}</small></div>{item.status!=="completed"&&canManage&&<button type="button" onClick={()=>void completeRequest(Number(item.id))}>Concluir</button>}</div>)}</div>:<p className={styles.muted}>Nenhuma solicitação registrada.</p>}</article>
    </div>}

    {tab==="retention" && <div className={styles.list}>{retention.map(item=><article className={styles.retention} key={item.record_type}><div><strong>{RETENTION_LABELS[str(item.record_type)]||item.record_type}</strong><small>{item.legal_basis}</small>{item.preserve_signed&&<span>Evidências assinadas preservadas</span>}</div><label>Dias<input type="number" min={1} max={3650} value={retentionDraft[str(item.record_type)]??Number(item.retention_days)} onChange={e=>setRetentionDraft(cur=>({...cur,[str(item.record_type)]:Number(e.target.value)}))}/></label>{canManage&&<button type="button" disabled={busy===`retention:${item.record_type}`} onClick={()=>void saveRetention(item)}>Salvar</button>}</article>)}</div>}

    {tab==="audit" && <div className={styles.list}>{audit.length?audit.map(item=><article className={`${styles.audit} ${styles[`severity_${str(item.severity)}`]||""}`} key={item.id}><div><span>{str(item.severity).toUpperCase()} · {str(item.outcome).toUpperCase()}</span><strong>{item.message||item.event_type}</strong><small>{item.actor_name} · {when(item.created_at)} · {item.entity_type}{item.entity_id?` #${item.entity_id}`:""}</small></div><code>{item.event_type}</code></article>):<p className={styles.muted}>Nenhum evento de governança registrado ainda.</p>}</div>}

    {tab==="vault" && <div className={styles.columns}>
      {canManage&&<article className={styles.panel}><h3>Novo segredo</h3><p>O valor é cifrado antes de ser persistido e só pode ser revelado por perfil autorizado.</p><form onSubmit={saveVault} className={styles.form}><label>Nome<input name="label" required placeholder="Ex.: Cloudflare do cliente"/></label><label>Usuário / referência<input name="username" autoComplete="off" /></label><label>Segredo<input name="secret" type="password" required autoComplete="new-password" /></label><label>Observação<textarea name="notes" rows={3}/></label><button type="submit" disabled={busy==="vault-save"}>Criptografar e salvar</button></form></article>}
      <article className={canManage?styles.panel:styles.wide}><h3>Itens protegidos</h3>{vault.length?<div className={styles.list}>{vault.map(item=><div className={styles.vaultRow} key={item.id}><div><strong>{item.label}</strong><small>{item.username_hint||"sem usuário"} · atualizado {when(item.updated_at)}</small>{revealed?.id===String(item.id)&&<code className={styles.secret}>{revealed.secret}</code>}</div><div><button type="button" onClick={()=>void revealVault(Number(item.id))}>Revelar 30s</button>{canManage&&<button type="button" className={styles.danger} onClick={()=>void deleteVault(Number(item.id))}>Apagar</button>}</div></div>)}</div>:<p className={styles.muted}>Nenhum segredo armazenado no cofre V2.</p>}</article>
    </div>}

    {tab==="backups" && <article className={styles.wide}><h3>Registro de backups verificados</h3><p>Backups só aparecem aqui depois de uma verificação real de recuperação. O CRM não marca um backup como válido apenas por existir.</p>{backups.length?<div className={styles.list}>{backups.map(item=><div className={styles.listRow} key={item.id}><div><strong>{item.backup_label}</strong><small>{item.status} · criado {when(item.created_at)}{item.verified_at?` · verificado ${when(item.verified_at)}`:""}</small></div><code>{item.provider_ref||"registro interno"}</code></div>)}</div>:<p className={styles.muted}>Nenhum backup desta evolução foi registrado como verificado ainda.</p>}</article>}

    {tab==="roles" && <div className={styles.columns}><article className={styles.panel}><h3>Perfis padrão</h3>{roles.map(role=><div className={styles.role} key={role.role}><strong>{role.label}</strong><small>{role.description}</small></div>)}</article><article className={styles.panel}><h3>Equipe</h3>{team.map(member=><div className={styles.member} key={member.id}><div><strong>{member.name||member.email}</strong><small>{member.email} · {member.status} · atual: {member.role}</small></div>{canManage&&member.role!=="owner"&&<select value={member.role} onChange={e=>void applyRole(Number(member.id),e.target.value)}>{roles.filter(role=>role.role!=="owner").map(role=><option key={role.role} value={role.role}>{role.label}</option>)}</select>}</div>)}</article></div>}
  </section>;
}
