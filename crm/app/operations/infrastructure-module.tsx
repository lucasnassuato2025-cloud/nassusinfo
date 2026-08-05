"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Client, Project } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { clientLabel, compactCurrency, dateLabel, errorMessage, rows, text, today } from "./shared";

type InfraTab = "painel" | "sites" | "acessos" | "renovacoes";
type ModalType = "site" | "acesso" | "renovacao" | null;

type SiteRecord = {
  id: string; clientId: string; projectId: string | null; status: string; siteName: string; siteUrl: string;
  primaryDomain: string; paymentMethod: string; vercelProject: string; neonDatabase: string; githubRepository: string;
  nextAction: string; nextActionDate: string | null; notes: string; createdAt: string; updatedAt: string;
};

type CredentialRecord = {
  id: string; clientId: string; projectId: string | null; category: string; platform: string; accessUrl: string;
  usernameEmail: string; vaultReference: string; twoFactorEnabled: boolean; twoFactorMethod: string; recoveryEmail: string;
  recoveryPhone: string; accountHolder: string; createdOn: string | null; lastPasswordChange: string | null;
  nextPasswordChange: string | null; status: string; recoveryReference: string; notes: string; createdAt: string; updatedAt: string;
};

type RenewalRecord = {
  id: string; clientId: string; projectId: string | null; itemType: string; provider: string; planDomain: string;
  billingAccount: string; periodicity: string; contractedOn: string | null; nextDueDate: string | null; amount: number;
  paymentResponsible: string; autoRenew: boolean; paymentStatus: string; lastPaidOn: string | null; receiptUrl: string;
  notes: string; createdAt: string; updatedAt: string;
};

type Props = { clients: Client[]; projects: Project[] };

type SiteDraft = Omit<SiteRecord, "id" | "createdAt" | "updatedAt">;
type CredentialDraft = Omit<CredentialRecord, "id" | "createdAt" | "updatedAt">;
type RenewalDraft = Omit<RenewalRecord, "id" | "createdAt" | "updatedAt">;

const SITE_COLUMNS = "id, client_id, project_id, status, site_name, site_url, primary_domain, payment_method, vercel_project, neon_database, github_repository, next_action, next_action_date, notes, created_at, updated_at";
const CREDENTIAL_COLUMNS = "id, client_id, project_id, category, platform, access_url, username_email, vault_reference, two_factor_enabled, two_factor_method, recovery_email, recovery_phone, account_holder, created_on, last_password_change, next_password_change, status, recovery_reference, notes, created_at, updated_at";
const RENEWAL_COLUMNS = "id, client_id, project_id, item_type, provider, plan_domain, billing_account, periodicity, contracted_on, next_due_date, amount, payment_responsible, auto_renew, payment_status, last_paid_on, receipt_url, notes, created_at, updated_at";

function dateOnly(value: unknown): string | null {
  if (!value) return null;
  return new Date(String(value)).toISOString().slice(0, 10);
}

function iso(value: unknown): string {
  return new Date(String(value)).toISOString();
}

function mapSite(row: Record<string, unknown>): SiteRecord {
  return { id: text(row.id), clientId: text(row.client_id), projectId: row.project_id == null ? null : text(row.project_id), status: text(row.status || "planejamento"), siteName: text(row.site_name), siteUrl: text(row.site_url), primaryDomain: text(row.primary_domain), paymentMethod: text(row.payment_method), vercelProject: text(row.vercel_project), neonDatabase: text(row.neon_database), githubRepository: text(row.github_repository), nextAction: text(row.next_action), nextActionDate: dateOnly(row.next_action_date), notes: text(row.notes), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function mapCredential(row: Record<string, unknown>): CredentialRecord {
  return { id: text(row.id), clientId: text(row.client_id), projectId: row.project_id == null ? null : text(row.project_id), category: text(row.category), platform: text(row.platform), accessUrl: text(row.access_url), usernameEmail: text(row.username_email), vaultReference: text(row.vault_reference), twoFactorEnabled: Boolean(row.two_factor_enabled), twoFactorMethod: text(row.two_factor_method), recoveryEmail: text(row.recovery_email), recoveryPhone: text(row.recovery_phone), accountHolder: text(row.account_holder), createdOn: dateOnly(row.created_on), lastPasswordChange: dateOnly(row.last_password_change), nextPasswordChange: dateOnly(row.next_password_change), status: text(row.status || "ativo"), recoveryReference: text(row.recovery_reference), notes: text(row.notes), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function mapRenewal(row: Record<string, unknown>): RenewalRecord {
  return { id: text(row.id), clientId: text(row.client_id), projectId: row.project_id == null ? null : text(row.project_id), itemType: text(row.item_type), provider: text(row.provider), planDomain: text(row.plan_domain), billingAccount: text(row.billing_account), periodicity: text(row.periodicity || "anual"), contractedOn: dateOnly(row.contracted_on), nextDueDate: dateOnly(row.next_due_date), amount: Number(row.amount || 0), paymentResponsible: text(row.payment_responsible || "cliente"), autoRenew: Boolean(row.auto_renew), paymentStatus: text(row.payment_status || "pendente"), lastPaidOn: dateOnly(row.last_paid_on), receiptUrl: text(row.receipt_url), notes: text(row.notes), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function emptySite(clientId = ""): SiteDraft {
  return { clientId, projectId: null, status: "planejamento", siteName: "", siteUrl: "", primaryDomain: "", paymentMethod: "", vercelProject: "", neonDatabase: "", githubRepository: "", nextAction: "", nextActionDate: null, notes: "" };
}

function emptyCredential(clientId = ""): CredentialDraft {
  return { clientId, projectId: null, category: "hospedagem", platform: "", accessUrl: "", usernameEmail: "", vaultReference: "", twoFactorEnabled: false, twoFactorMethod: "", recoveryEmail: "", recoveryPhone: "", accountHolder: "", createdOn: today(), lastPasswordChange: null, nextPasswordChange: null, status: "ativo", recoveryReference: "", notes: "" };
}

function emptyRenewal(clientId = ""): RenewalDraft {
  return { clientId, projectId: null, itemType: "dominio", provider: "", planDomain: "", billingAccount: "", periodicity: "anual", contractedOn: today(), nextDueDate: null, amount: 0, paymentResponsible: "cliente", autoRenew: false, paymentStatus: "pendente", lastPaidOn: null, receiptUrl: "", notes: "" };
}

function daysUntil(value: string | null): number | null {
  if (!value) return null;
  const start = new Date(`${today()}T12:00:00`).getTime();
  const end = new Date(`${value}T12:00:00`).getTime();
  return Math.ceil((end - start) / 86400000);
}

function dueLabel(value: string | null): { label: string; tone: string } {
  const days = daysUntil(value);
  if (days == null) return { label: "Sem vencimento", tone: "neutral" };
  if (days < 0) return { label: `Vencido há ${Math.abs(days)} dia(s)`, tone: "danger" };
  if (days <= 7) return { label: `Vence em ${days} dia(s)`, tone: "danger" };
  if (days <= 30) return { label: `Vence em ${days} dias`, tone: "warning" };
  if (days <= 60) return { label: `Programar · ${days} dias`, tone: "info" };
  return { label: "Em dia", tone: "success" };
}

export function InfrastructureModule({ clients, projects }: Props) {
  const [tab, setTab] = useState<InfraTab>("painel");
  const [sites, setSites] = useState<SiteRecord[]>([]);
  const [credentials, setCredentials] = useState<CredentialRecord[]>([]);
  const [renewals, setRenewals] = useState<RenewalRecord[]>([]);
  const [modal, setModal] = useState<ModalType>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [siteDraft, setSiteDraft] = useState<SiteDraft>(() => emptySite(clients[0]?.id || ""));
  const [credentialDraft, setCredentialDraft] = useState<CredentialDraft>(() => emptyCredential(clients[0]?.id || ""));
  const [renewalDraft, setRenewalDraft] = useState<RenewalDraft>(() => emptyRenewal(clients[0]?.id || ""));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const clientMap = useMemo(() => new Map(clients.map((item) => [item.id, item])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((item) => [item.id, item])), [projects]);
  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");

  async function loadData() {
    setLoading(true);
    const [siteQuery, credentialQuery, renewalQuery] = await Promise.all([
      neonClient.from("site_infrastructure").select(SITE_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
      neonClient.from("access_credentials").select(CREDENTIAL_COLUMNS).order("updated_at", { ascending: false }).order("id", { ascending: false }),
      neonClient.from("renewal_costs").select(RENEWAL_COLUMNS).order("next_due_date", { ascending: true }).order("id", { ascending: false }),
    ]);
    const error = siteQuery.error || credentialQuery.error || renewalQuery.error;
    if (error) setNotice(error.message || "Não foi possível carregar a infraestrutura.");
    else {
      setSites(rows(siteQuery.data).map(mapSite));
      setCredentials(rows(credentialQuery.data).map(mapCredential));
      setRenewals(rows(renewalQuery.data).map(mapRenewal));
    }
    setLoading(false);
  }

  useEffect(() => { void loadData(); }, []);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3500);
  }

  function openNew(type: Exclude<ModalType, null>) {
    setEditingId(null);
    const clientId = clients[0]?.id || "";
    if (type === "site") setSiteDraft(emptySite(clientId));
    if (type === "acesso") setCredentialDraft(emptyCredential(clientId));
    if (type === "renovacao") setRenewalDraft(emptyRenewal(clientId));
    setModal(type);
  }

  function closeModal() { setModal(null); setEditingId(null); }

  function projectOptions(clientId: string) {
    return projects.filter((project) => !clientId || project.clientId === clientId);
  }

  async function saveSite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!siteDraft.clientId || !siteDraft.siteName.trim()) return flash("Selecione o cliente e informe o nome do site.");
    setSaving(true);
    const payload = { client_id: Number(siteDraft.clientId), project_id: siteDraft.projectId ? Number(siteDraft.projectId) : null, status: siteDraft.status, site_name: siteDraft.siteName.trim(), site_url: siteDraft.siteUrl.trim(), primary_domain: siteDraft.primaryDomain.trim(), payment_method: siteDraft.paymentMethod.trim(), vercel_project: siteDraft.vercelProject.trim(), neon_database: siteDraft.neonDatabase.trim(), github_repository: siteDraft.githubRepository.trim(), next_action: siteDraft.nextAction.trim(), next_action_date: siteDraft.nextActionDate || null, notes: siteDraft.notes.trim(), updated_at: new Date().toISOString() };
    const table = neonClient.from("site_infrastructure") as any;
    const result = editingId ? await table.update(payload).eq("id", editingId).select(SITE_COLUMNS) : await table.insert(payload).select(SITE_COLUMNS);
    setSaving(false);
    if (result.error) return flash(errorMessage(result.error, "Não foi possível salvar o site."));
    const saved = mapSite(rows(result.data)[0] || result.data);
    setSites((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [saved, ...current]);
    closeModal(); flash(editingId ? "Site atualizado." : "Site cadastrado.");
  }

  async function saveCredential(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!credentialDraft.clientId || !credentialDraft.platform.trim()) return flash("Selecione o cliente e informe a plataforma.");
    setSaving(true);
    const payload = { client_id: Number(credentialDraft.clientId), project_id: credentialDraft.projectId ? Number(credentialDraft.projectId) : null, category: credentialDraft.category, platform: credentialDraft.platform.trim(), access_url: credentialDraft.accessUrl.trim(), username_email: credentialDraft.usernameEmail.trim(), vault_reference: credentialDraft.vaultReference.trim(), two_factor_enabled: credentialDraft.twoFactorEnabled, two_factor_method: credentialDraft.twoFactorMethod.trim(), recovery_email: credentialDraft.recoveryEmail.trim(), recovery_phone: credentialDraft.recoveryPhone.trim(), account_holder: credentialDraft.accountHolder.trim(), created_on: credentialDraft.createdOn || null, last_password_change: credentialDraft.lastPasswordChange || null, next_password_change: credentialDraft.nextPasswordChange || null, status: credentialDraft.status, recovery_reference: credentialDraft.recoveryReference.trim(), notes: credentialDraft.notes.trim(), updated_at: new Date().toISOString() };
    const table = neonClient.from("access_credentials") as any;
    const result = editingId ? await table.update(payload).eq("id", editingId).select(CREDENTIAL_COLUMNS) : await table.insert(payload).select(CREDENTIAL_COLUMNS);
    setSaving(false);
    if (result.error) return flash(errorMessage(result.error, "Não foi possível salvar o acesso."));
    const saved = mapCredential(rows(result.data)[0] || result.data);
    setCredentials((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [saved, ...current]);
    closeModal(); flash(editingId ? "Acesso atualizado." : "Acesso cadastrado sem armazenar senha.");
  }

  async function saveRenewal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!renewalDraft.clientId || !renewalDraft.provider.trim()) return flash("Selecione o cliente e informe o fornecedor.");
    setSaving(true);
    const payload = { client_id: Number(renewalDraft.clientId), project_id: renewalDraft.projectId ? Number(renewalDraft.projectId) : null, item_type: renewalDraft.itemType, provider: renewalDraft.provider.trim(), plan_domain: renewalDraft.planDomain.trim(), billing_account: renewalDraft.billingAccount.trim(), periodicity: renewalDraft.periodicity, contracted_on: renewalDraft.contractedOn || null, next_due_date: renewalDraft.nextDueDate || null, amount: Math.max(0, Number(renewalDraft.amount || 0)), payment_responsible: renewalDraft.paymentResponsible.trim(), auto_renew: renewalDraft.autoRenew, payment_status: renewalDraft.paymentStatus, last_paid_on: renewalDraft.lastPaidOn || null, receipt_url: renewalDraft.receiptUrl.trim(), notes: renewalDraft.notes.trim(), updated_at: new Date().toISOString() };
    const table = neonClient.from("renewal_costs") as any;
    const result = editingId ? await table.update(payload).eq("id", editingId).select(RENEWAL_COLUMNS) : await table.insert(payload).select(RENEWAL_COLUMNS);
    setSaving(false);
    if (result.error) return flash(errorMessage(result.error, "Não foi possível salvar a renovação."));
    const saved = mapRenewal(rows(result.data)[0] || result.data);
    setRenewals((current) => editingId ? current.map((item) => item.id === editingId ? saved : item) : [saved, ...current]);
    closeModal(); flash(editingId ? "Renovação atualizada." : "Renovação cadastrada.");
  }

  function editSite(item: SiteRecord) { const { id, createdAt, updatedAt, ...draft } = item; void id; void createdAt; void updatedAt; setEditingId(item.id); setSiteDraft(draft); setModal("site"); }
  function editCredential(item: CredentialRecord) { const { id, createdAt, updatedAt, ...draft } = item; void id; void createdAt; void updatedAt; setEditingId(item.id); setCredentialDraft(draft); setModal("acesso"); }
  function editRenewal(item: RenewalRecord) { const { id, createdAt, updatedAt, ...draft } = item; void id; void createdAt; void updatedAt; setEditingId(item.id); setRenewalDraft(draft); setModal("renovacao"); }

  const filteredSites = sites.filter((item) => [item.siteName, item.primaryDomain, item.siteUrl, clientLabel(clientMap.get(item.clientId)), projectMap.get(item.projectId || "")?.name || ""].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  const filteredCredentials = credentials.filter((item) => [item.platform, item.usernameEmail, item.category, item.vaultReference, clientLabel(clientMap.get(item.clientId))].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch));
  const filteredRenewals = renewals.filter((item) => [item.itemType, item.provider, item.planDomain, item.billingAccount, clientLabel(clientMap.get(item.clientId))].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch));

  const publishedSites = sites.filter((item) => item.status === "publicado").length;
  const activeCredentials = credentials.filter((item) => item.status === "ativo").length;
  const without2FA = credentials.filter((item) => item.status === "ativo" && !item.twoFactorEnabled).length;
  const accessReview = credentials.filter((item) => item.status === "revisar" || (item.nextPasswordChange && item.nextPasswordChange <= today())).length;
  const expired = renewals.filter((item) => item.nextDueDate && item.nextDueDate < today() && !["pago", "cancelado", "isento"].includes(item.paymentStatus)).length;
  const due30 = renewals.filter((item) => { const days = daysUntil(item.nextDueDate); return days != null && days >= 0 && days <= 30; }).length;
  const monthlyCost = renewals.reduce((sum, item) => sum + (item.periodicity === "mensal" ? item.amount : item.periodicity === "trimestral" ? item.amount / 3 : item.periodicity === "semestral" ? item.amount / 6 : item.periodicity === "anual" ? item.amount / 12 : 0), 0);
  const annualCost = renewals.reduce((sum, item) => sum + (item.periodicity === "mensal" ? item.amount * 12 : item.periodicity === "trimestral" ? item.amount * 4 : item.periodicity === "semestral" ? item.amount * 2 : item.periodicity === "anual" ? item.amount : 0), 0);

  function dashboard() {
    const upcoming = [...renewals].filter((item) => item.nextDueDate).sort((a, b) => String(a.nextDueDate).localeCompare(String(b.nextDueDate))).slice(0, 8);
    return <div className="infra-stack"><section className="infra-metrics"><article><span>SITES</span><strong>{sites.length}</strong><small>{publishedSites} publicados</small></article><article><span>ACESSOS ATIVOS</span><strong>{activeCredentials}</strong><small>{without2FA} sem 2FA</small></article><article><span>RENOVAÇÕES</span><strong>{renewals.length}</strong><small>{due30} vencem em 30 dias</small></article><article><span>CUSTO MENSAL</span><strong>{compactCurrency.format(monthlyCost)}</strong><small>Estimativa recorrente</small></article><article><span>CUSTO ANUAL</span><strong>{compactCurrency.format(annualCost)}</strong><small>Total equivalente</small></article></section><section className="infra-grid"><article className="pro-panel infra-risk"><header><div><span>ATENÇÃO</span><h3>Riscos que precisam de ação</h3></div></header><div><button type="button" onClick={() => setTab("renovacoes")}><i className="danger">{expired}</i><span><strong>Serviços vencidos</strong><small>Regularizar imediatamente</small></span></button><button type="button" onClick={() => setTab("acessos")}><i className="warning">{without2FA}</i><span><strong>Contas sem 2FA</strong><small>Ativar proteção adicional</small></span></button><button type="button" onClick={() => setTab("acessos")}><i className="info">{accessReview}</i><span><strong>Acessos para revisar</strong><small>Senha ou situação do acesso</small></span></button></div></article><article className="pro-panel infra-upcoming"><header><div><span>AGENDA FINANCEIRA</span><h3>Próximos vencimentos</h3></div></header>{upcoming.length ? upcoming.map((item) => { const due = dueLabel(item.nextDueDate); return <button type="button" key={item.id} onClick={() => { setTab("renovacoes"); editRenewal(item); }}><i className={due.tone} /><span><strong>{item.provider} · {item.planDomain || item.itemType}</strong><small>{clientLabel(clientMap.get(item.clientId))} · {dateLabel(item.nextDueDate)}</small></span><b>{compactCurrency.format(item.amount)}<small>{due.label}</small></b></button>; }) : <p className="business-muted">Nenhum vencimento cadastrado.</p>}</article></section></div>;
  }

  function sitesView() {
    return <section className="pro-panel infra-panel"><div className="infra-toolbar"><div className="business-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar site, domínio ou cliente" /></div><button type="button" className="pro-primary" onClick={() => openNew("site")}>+ Novo site</button></div>{filteredSites.length ? <div className="business-table-wrap"><table className="business-table"><thead><tr><th>Cliente / projeto</th><th>Site e domínio</th><th>Status</th><th>Vercel</th><th>Neon</th><th>GitHub</th><th>Próxima ação</th><th /></tr></thead><tbody>{filteredSites.map((item) => <tr key={item.id}><td><strong>{clientLabel(clientMap.get(item.clientId))}</strong><small>{projectMap.get(item.projectId || "")?.name || "Sem projeto vinculado"}</small></td><td><strong>{item.siteName}</strong><small>{item.primaryDomain || item.siteUrl || "Sem domínio"}</small></td><td><span className={`infra-pill infra-${item.status}`}>{item.status.replaceAll("_", " ")}</span></td><td>{item.vercelProject || "—"}</td><td>{item.neonDatabase || "—"}</td><td>{item.githubRepository || "—"}</td><td><strong>{item.nextAction || "Não definida"}</strong><small>{dateLabel(item.nextActionDate)}</small></td><td><button type="button" className="infra-edit" onClick={() => editSite(item)}>Editar</button></td></tr>)}</tbody></table></div> : <div className="business-empty"><div>◈</div><h2>Nenhum site cadastrado</h2><p>Cadastre sites, domínios e recursos técnicos vinculados aos clientes.</p><button type="button" className="pro-primary" onClick={() => openNew("site")}>Cadastrar site</button></div>}</section>;
  }

  function credentialsView() {
    return <section className="pro-panel infra-panel"><div className="infra-security-note"><strong>Senhas não são armazenadas neste CRM.</strong><span>Use o campo “Referência no cofre” para indicar onde a senha está guardada no Bitwarden ou outro gerenciador.</span></div><div className="infra-toolbar"><div className="business-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar plataforma, usuário ou cliente" /></div><button type="button" className="pro-primary" onClick={() => openNew("acesso")}>+ Novo acesso</button></div>{filteredCredentials.length ? <div className="business-table-wrap"><table className="business-table"><thead><tr><th>Cliente / projeto</th><th>Plataforma</th><th>Usuário</th><th>2FA</th><th>Recuperação</th><th>Cofre</th><th>Próxima revisão</th><th>Status</th><th /></tr></thead><tbody>{filteredCredentials.map((item) => <tr key={item.id}><td><strong>{clientLabel(clientMap.get(item.clientId))}</strong><small>{projectMap.get(item.projectId || "")?.name || item.category}</small></td><td><strong>{item.platform}</strong><small>{item.accessUrl}</small></td><td>{item.usernameEmail || "—"}</td><td><span className={`infra-pill ${item.twoFactorEnabled ? "infra-ativo" : "infra-revisar"}`}>{item.twoFactorEnabled ? `Ativo${item.twoFactorMethod ? ` · ${item.twoFactorMethod}` : ""}` : "Não ativo"}</span></td><td><strong>{item.recoveryEmail || item.recoveryPhone || "—"}</strong><small>{item.recoveryReference}</small></td><td>{item.vaultReference || "Não informado"}</td><td>{dateLabel(item.nextPasswordChange)}</td><td><span className={`infra-pill infra-${item.status}`}>{item.status}</span></td><td><button type="button" className="infra-edit" onClick={() => editCredential(item)}>Editar</button></td></tr>)}</tbody></table></div> : <div className="business-empty"><div>⌾</div><h2>Nenhum acesso cadastrado</h2><p>Crie um índice seguro das contas, responsáveis, 2FA e referências do cofre.</p><button type="button" className="pro-primary" onClick={() => openNew("acesso")}>Cadastrar acesso</button></div>}</section>;
  }

  function renewalsView() {
    return <section className="pro-panel infra-panel"><div className="infra-toolbar"><div className="business-search"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar domínio, serviço ou fornecedor" /></div><button type="button" className="pro-primary" onClick={() => openNew("renovacao")}>+ Nova renovação</button></div>{filteredRenewals.length ? <div className="business-table-wrap"><table className="business-table"><thead><tr><th>Cliente / projeto</th><th>Tipo e fornecedor</th><th>Domínio / plano</th><th>Periodicidade</th><th>Vencimento</th><th>Alerta</th><th>Valor</th><th>Responsável</th><th>Pagamento</th><th /></tr></thead><tbody>{filteredRenewals.map((item) => { const due = dueLabel(item.nextDueDate); return <tr key={item.id}><td><strong>{clientLabel(clientMap.get(item.clientId))}</strong><small>{projectMap.get(item.projectId || "")?.name || "Sem projeto"}</small></td><td><strong>{item.itemType}</strong><small>{item.provider}</small></td><td>{item.planDomain || "—"}</td><td>{item.periodicity}</td><td>{dateLabel(item.nextDueDate)}</td><td><span className={`infra-alert infra-alert-${due.tone}`}>{due.label}</span></td><td>{compactCurrency.format(item.amount)}</td><td>{item.paymentResponsible}</td><td><span className={`infra-pill infra-${item.paymentStatus}`}>{item.paymentStatus}</span><small>{item.autoRenew ? "Renovação automática" : "Renovação manual"}</small></td><td><button type="button" className="infra-edit" onClick={() => editRenewal(item)}>Editar</button></td></tr>; })}</tbody></table></div> : <div className="business-empty"><div>◷</div><h2>Nenhuma renovação cadastrada</h2><p>Controle domínios, hospedagens, licenças, APIs e demais custos recorrentes.</p><button type="button" className="pro-primary" onClick={() => openNew("renovacao")}>Cadastrar renovação</button></div>}</section>;
  }

  return <div className="infra-module"><div className="infra-tabs"><button type="button" className={tab === "painel" ? "active" : ""} onClick={() => { setTab("painel"); setSearch(""); }}>Painel</button><button type="button" className={tab === "sites" ? "active" : ""} onClick={() => { setTab("sites"); setSearch(""); }}>Sites e infraestrutura</button><button type="button" className={tab === "acessos" ? "active" : ""} onClick={() => { setTab("acessos"); setSearch(""); }}>Acessos</button><button type="button" className={tab === "renovacoes" ? "active" : ""} onClick={() => { setTab("renovacoes"); setSearch(""); }}>Renovações e custos</button></div>{notice && <div className="business-notice">{notice}</div>}{loading ? <div className="suite-loading"><i /><strong>Carregando infraestrutura...</strong><span>Buscando sites, acessos e renovações.</span></div> : tab === "painel" ? dashboard() : tab === "sites" ? sitesView() : tab === "acessos" ? credentialsView() : renewalsView()}

    {modal === "site" && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="business-modal"><header><div><span>SITES E INFRAESTRUTURA</span><h2>{editingId ? "Editar site" : "Novo site"}</h2></div><button type="button" onClick={closeModal}>×</button></header><form onSubmit={saveSite}><div className="business-form-grid"><label>Cliente *<select required value={siteDraft.clientId} onChange={(event) => setSiteDraft((current) => ({ ...current, clientId: event.target.value, projectId: null }))}><option value="">Selecione</option>{clients.map((item) => <option key={item.id} value={item.id}>{clientLabel(item)}</option>)}</select></label><label>Projeto<select value={siteDraft.projectId || ""} onChange={(event) => setSiteDraft((current) => ({ ...current, projectId: event.target.value || null }))}><option value="">Sem vínculo</option>{projectOptions(siteDraft.clientId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="span-2">Nome do site / projeto *<input required value={siteDraft.siteName} onChange={(event) => setSiteDraft((current) => ({ ...current, siteName: event.target.value }))} /></label><label>Status<select value={siteDraft.status} onChange={(event) => setSiteDraft((current) => ({ ...current, status: event.target.value }))}><option value="planejamento">Planejamento</option><option value="desenvolvimento">Desenvolvimento</option><option value="publicado">Publicado</option><option value="manutencao">Manutenção</option><option value="pausado">Pausado</option><option value="encerrado">Encerrado</option></select></label><label>Forma de pagamento<input value={siteDraft.paymentMethod} onChange={(event) => setSiteDraft((current) => ({ ...current, paymentMethod: event.target.value }))} /></label><label>URL do site<input value={siteDraft.siteUrl} onChange={(event) => setSiteDraft((current) => ({ ...current, siteUrl: event.target.value }))} placeholder="https://" /></label><label>Domínio principal<input value={siteDraft.primaryDomain} onChange={(event) => setSiteDraft((current) => ({ ...current, primaryDomain: event.target.value }))} /></label><label>Projeto Vercel<input value={siteDraft.vercelProject} onChange={(event) => setSiteDraft((current) => ({ ...current, vercelProject: event.target.value }))} /></label><label>Neon / banco<input value={siteDraft.neonDatabase} onChange={(event) => setSiteDraft((current) => ({ ...current, neonDatabase: event.target.value }))} /></label><label className="span-2">GitHub / repositório<input value={siteDraft.githubRepository} onChange={(event) => setSiteDraft((current) => ({ ...current, githubRepository: event.target.value }))} /></label><label>Próxima ação<input value={siteDraft.nextAction} onChange={(event) => setSiteDraft((current) => ({ ...current, nextAction: event.target.value }))} /></label><label>Data da próxima ação<input type="date" value={siteDraft.nextActionDate || ""} onChange={(event) => setSiteDraft((current) => ({ ...current, nextActionDate: event.target.value || null }))} /></label><label className="span-2">Observações<textarea rows={4} value={siteDraft.notes} onChange={(event) => setSiteDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div><footer><button type="button" className="business-secondary" onClick={closeModal}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar site"}</button></footer></form></section></div>}

    {modal === "acesso" && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="business-modal"><header><div><span>ACESSO SEGURO</span><h2>{editingId ? "Editar acesso" : "Novo acesso"}</h2></div><button type="button" onClick={closeModal}>×</button></header><form onSubmit={saveCredential}><div className="infra-password-warning"><strong>Não digite a senha aqui.</strong><span>Guarde-a no Bitwarden e informe somente a referência do cofre.</span></div><div className="business-form-grid"><label>Cliente *<select required value={credentialDraft.clientId} onChange={(event) => setCredentialDraft((current) => ({ ...current, clientId: event.target.value, projectId: null }))}><option value="">Selecione</option>{clients.map((item) => <option key={item.id} value={item.id}>{clientLabel(item)}</option>)}</select></label><label>Projeto<select value={credentialDraft.projectId || ""} onChange={(event) => setCredentialDraft((current) => ({ ...current, projectId: event.target.value || null }))}><option value="">Sem vínculo</option>{projectOptions(credentialDraft.clientId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Categoria<select value={credentialDraft.category} onChange={(event) => setCredentialDraft((current) => ({ ...current, category: event.target.value }))}><option value="dominio">Domínio</option><option value="hospedagem">Hospedagem</option><option value="banco">Banco de dados</option><option value="repositorio">Repositório</option><option value="email">E-mail</option><option value="google">Google</option><option value="outro">Outro</option></select></label><label>Plataforma / serviço *<input required value={credentialDraft.platform} onChange={(event) => setCredentialDraft((current) => ({ ...current, platform: event.target.value }))} placeholder="Vercel, Neon, Registro.br..." /></label><label>URL de acesso<input value={credentialDraft.accessUrl} onChange={(event) => setCredentialDraft((current) => ({ ...current, accessUrl: event.target.value }))} /></label><label>E-mail / usuário<input value={credentialDraft.usernameEmail} onChange={(event) => setCredentialDraft((current) => ({ ...current, usernameEmail: event.target.value }))} /></label><label className="span-2">Referência no cofre<input value={credentialDraft.vaultReference} onChange={(event) => setCredentialDraft((current) => ({ ...current, vaultReference: event.target.value }))} placeholder="Bitwarden → Cliente → Vercel" /></label><label className="checkbox-label"><input type="checkbox" checked={credentialDraft.twoFactorEnabled} onChange={(event) => setCredentialDraft((current) => ({ ...current, twoFactorEnabled: event.target.checked }))} />2FA ativo</label><label>Método 2FA<input value={credentialDraft.twoFactorMethod} onChange={(event) => setCredentialDraft((current) => ({ ...current, twoFactorMethod: event.target.value }))} placeholder="Aplicativo, SMS, chave..." /></label><label>E-mail de recuperação<input value={credentialDraft.recoveryEmail} onChange={(event) => setCredentialDraft((current) => ({ ...current, recoveryEmail: event.target.value }))} /></label><label>Telefone de recuperação<input value={credentialDraft.recoveryPhone} onChange={(event) => setCredentialDraft((current) => ({ ...current, recoveryPhone: event.target.value }))} /></label><label>Titular da conta<input value={credentialDraft.accountHolder} onChange={(event) => setCredentialDraft((current) => ({ ...current, accountHolder: event.target.value }))} /></label><label>Status<select value={credentialDraft.status} onChange={(event) => setCredentialDraft((current) => ({ ...current, status: event.target.value }))}><option value="ativo">Ativo</option><option value="revisar">Revisar</option><option value="bloqueado">Bloqueado</option><option value="inativo">Inativo</option></select></label><label>Data de criação<input type="date" value={credentialDraft.createdOn || ""} onChange={(event) => setCredentialDraft((current) => ({ ...current, createdOn: event.target.value || null }))} /></label><label>Última troca de senha<input type="date" value={credentialDraft.lastPasswordChange || ""} onChange={(event) => setCredentialDraft((current) => ({ ...current, lastPasswordChange: event.target.value || null }))} /></label><label>Próxima troca sugerida<input type="date" value={credentialDraft.nextPasswordChange || ""} onChange={(event) => setCredentialDraft((current) => ({ ...current, nextPasswordChange: event.target.value || null }))} /></label><label>Referência da recuperação<input value={credentialDraft.recoveryReference} onChange={(event) => setCredentialDraft((current) => ({ ...current, recoveryReference: event.target.value }))} placeholder="Envelope, cofre, pasta..." /></label><label className="span-2">Observações<textarea rows={3} value={credentialDraft.notes} onChange={(event) => setCredentialDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div><footer><button type="button" className="business-secondary" onClick={closeModal}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar acesso"}</button></footer></form></section></div>}

    {modal === "renovacao" && <div className="business-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="business-modal"><header><div><span>RENOVAÇÕES E CUSTOS</span><h2>{editingId ? "Editar renovação" : "Nova renovação"}</h2></div><button type="button" onClick={closeModal}>×</button></header><form onSubmit={saveRenewal}><div className="business-form-grid"><label>Cliente *<select required value={renewalDraft.clientId} onChange={(event) => setRenewalDraft((current) => ({ ...current, clientId: event.target.value, projectId: null }))}><option value="">Selecione</option>{clients.map((item) => <option key={item.id} value={item.id}>{clientLabel(item)}</option>)}</select></label><label>Projeto<select value={renewalDraft.projectId || ""} onChange={(event) => setRenewalDraft((current) => ({ ...current, projectId: event.target.value || null }))}><option value="">Sem vínculo</option>{projectOptions(renewalDraft.clientId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Tipo<select value={renewalDraft.itemType} onChange={(event) => setRenewalDraft((current) => ({ ...current, itemType: event.target.value }))}><option value="dominio">Domínio</option><option value="hospedagem">Hospedagem</option><option value="banco">Banco de dados</option><option value="email">E-mail</option><option value="licenca">Licença</option><option value="api">API</option><option value="manutencao">Manutenção</option><option value="outro">Outro</option></select></label><label>Serviço / fornecedor *<input required value={renewalDraft.provider} onChange={(event) => setRenewalDraft((current) => ({ ...current, provider: event.target.value }))} /></label><label>Domínio / plano<input value={renewalDraft.planDomain} onChange={(event) => setRenewalDraft((current) => ({ ...current, planDomain: event.target.value }))} /></label><label>Conta de cobrança<input value={renewalDraft.billingAccount} onChange={(event) => setRenewalDraft((current) => ({ ...current, billingAccount: event.target.value }))} /></label><label>Periodicidade<select value={renewalDraft.periodicity} onChange={(event) => setRenewalDraft((current) => ({ ...current, periodicity: event.target.value }))}><option value="mensal">Mensal</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option><option value="unico">Pagamento único</option><option value="outro">Outro</option></select></label><label>Valor por período<input type="number" min="0" step="0.01" value={renewalDraft.amount} onChange={(event) => setRenewalDraft((current) => ({ ...current, amount: Number(event.target.value || 0) }))} /></label><label>Data da contratação<input type="date" value={renewalDraft.contractedOn || ""} onChange={(event) => setRenewalDraft((current) => ({ ...current, contractedOn: event.target.value || null }))} /></label><label>Próximo vencimento<input type="date" value={renewalDraft.nextDueDate || ""} onChange={(event) => setRenewalDraft((current) => ({ ...current, nextDueDate: event.target.value || null }))} /></label><label>Responsável pelo pagamento<input value={renewalDraft.paymentResponsible} onChange={(event) => setRenewalDraft((current) => ({ ...current, paymentResponsible: event.target.value }))} placeholder="Cliente ou Nassusinfo" /></label><label>Status do pagamento<select value={renewalDraft.paymentStatus} onChange={(event) => setRenewalDraft((current) => ({ ...current, paymentStatus: event.target.value }))}><option value="pendente">Pendente</option><option value="pago">Pago</option><option value="atrasado">Atrasado</option><option value="cancelado">Cancelado</option><option value="isento">Isento</option></select></label><label className="checkbox-label"><input type="checkbox" checked={renewalDraft.autoRenew} onChange={(event) => setRenewalDraft((current) => ({ ...current, autoRenew: event.target.checked }))} />Renovação automática</label><label>Último pagamento<input type="date" value={renewalDraft.lastPaidOn || ""} onChange={(event) => setRenewalDraft((current) => ({ ...current, lastPaidOn: event.target.value || null }))} /></label><label className="span-2">Comprovante / link<input value={renewalDraft.receiptUrl} onChange={(event) => setRenewalDraft((current) => ({ ...current, receiptUrl: event.target.value }))} /></label><label className="span-2">Observações<textarea rows={3} value={renewalDraft.notes} onChange={(event) => setRenewalDraft((current) => ({ ...current, notes: event.target.value }))} /></label></div><footer><button type="button" className="business-secondary" onClick={closeModal}>Cancelar</button><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar renovação"}</button></footer></form></section></div>}
  </div>;
}
