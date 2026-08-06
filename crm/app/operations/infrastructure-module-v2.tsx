"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { Client, Project } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { InfrastructureModule as LegacyInfrastructureModule } from "./infrastructure-module";
import { clientLabel, errorMessage, rows } from "./shared";

type Props = { clients: Client[]; projects: Project[] };

type FirstAccessDraft = {
  clientId: string;
  projectId: string;
  category: string;
  platform: string;
  accessUrl: string;
  usernameEmail: string;
  vaultReference: string;
  accountHolder: string;
  twoFactorEnabled: boolean;
};

const ACCESS_SUMMARY_COLUMNS = "id, client_id, project_id, platform";

function initialDraft(clients: Client[], projects: Project[]): FirstAccessDraft {
  const clientId = clients[0]?.id || "";
  return {
    clientId,
    projectId: projects.find((project) => project.clientId === clientId)?.id || "",
    category: "hospedagem",
    platform: "",
    accessUrl: "",
    usernameEmail: "",
    vaultReference: "",
    accountHolder: "",
    twoFactorEnabled: false,
  };
}

export function InfrastructureModule({ clients, projects }: Props) {
  const [accessCount, setAccessCount] = useState<number | null>(null);
  const [showFirstAccess, setShowFirstAccess] = useState(false);
  const [draft, setDraft] = useState<FirstAccessDraft>(() => initialDraft(clients, projects));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [legacyVersion, setLegacyVersion] = useState(0);

  const availableProjects = useMemo(
    () => projects.filter((project) => project.clientId === draft.clientId),
    [projects, draft.clientId],
  );

  useEffect(() => {
    if (draft.clientId || !clients[0]) return;
    setDraft(initialDraft(clients, projects));
  }, [clients, projects, draft.clientId]);

  useEffect(() => {
    let active = true;
    async function loadSummary() {
      try {
        const claim = await (neonClient as any).rpc("crm_claim_membership");
        if (claim.error) throw claim.error;
        const result = await neonClient.from("access_credentials").select(ACCESS_SUMMARY_COLUMNS);
        if (result.error) throw result.error;
        if (active) setAccessCount(rows(result.data).length);
      } catch (reason) {
        if (active) setNotice(errorMessage(reason, "Não foi possível verificar os acessos cadastrados."));
      }
    }
    void loadSummary();
    return () => { active = false; };
  }, [legacyVersion]);

  function selectClient(clientId: string) {
    const firstProject = projects.find((project) => project.clientId === clientId);
    setDraft((current) => ({ ...current, clientId, projectId: firstProject?.id || "" }));
  }

  async function saveFirstAccess(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.clientId) return setNotice("Cadastre ou selecione um cliente antes de continuar.");
    if (!draft.platform.trim()) return setNotice("Informe a plataforma do acesso.");

    setSaving(true);
    setNotice("");
    try {
      const claim = await (neonClient as any).rpc("crm_claim_membership");
      if (claim.error) throw claim.error;

      const result = await (neonClient.from("access_credentials") as any).insert({
        client_id: Number(draft.clientId),
        project_id: draft.projectId ? Number(draft.projectId) : null,
        category: draft.category,
        platform: draft.platform.trim(),
        access_url: draft.accessUrl.trim(),
        username_email: draft.usernameEmail.trim(),
        vault_reference: draft.vaultReference.trim(),
        account_holder: draft.accountHolder.trim(),
        two_factor_enabled: draft.twoFactorEnabled,
        status: "ativo",
        notes: "Senha não armazenada no CRM. Use apenas a referência segura do cofre.",
        updated_at: new Date().toISOString(),
      }).select(ACCESS_SUMMARY_COLUMNS);

      if (result.error) throw result.error;
      setAccessCount((current) => (current || 0) + 1);
      setShowFirstAccess(false);
      setDraft(initialDraft(clients, projects));
      setLegacyVersion((current) => current + 1);
      setNotice("Primeiro acesso cadastrado e vinculado ao cliente. Nenhuma senha foi salva no CRM.");
    } catch (reason) {
      setNotice(errorMessage(reason, "Não foi possível cadastrar o acesso."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <section className="pro-panel infrastructure-onboarding">
        <header>
          <div>
            <span>ACESSOS DOS CLIENTES</span>
            <h2>{accessCount === 0 ? "Nenhum acesso cadastrado" : "Credenciais vinculadas ao cadastro"}</h2>
            <p>
              {accessCount === 0
                ? "Os clientes estão disponíveis, mas ainda não existe nenhum acesso de plataforma registrado. Cadastre o primeiro acesso sem guardar a senha em texto aberto."
                : `${accessCount ?? "—"} acesso(s) localizado(s). Cliente e projeto são vinculados automaticamente ao cadastro.`}
            </p>
          </div>
          <button type="button" className="pro-primary" disabled={!clients.length} onClick={() => setShowFirstAccess((current) => !current)}>
            {showFirstAccess ? "Fechar cadastro" : "+ Cadastrar acesso"}
          </button>
        </header>

        {!clients.length && <div className="documents-warning"><strong>Nenhum cliente disponível</strong><p>Cadastre um cliente na Central antes de registrar plataformas e credenciais.</p></div>}
        {notice && <div className="business-notice">{notice}</div>}

        {showFirstAccess && clients.length > 0 && (
          <form onSubmit={saveFirstAccess} className="contract-form-grid">
            <label className="span-2">Cliente *
              <select required value={draft.clientId} onChange={(event) => selectClient(event.target.value)}>
                {clients.map((client) => <option key={client.id} value={client.id}>{clientLabel(client)}</option>)}
              </select>
            </label>
            <label className="span-2">Projeto
              <select value={draft.projectId} onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))}>
                <option value="">Sem projeto específico</option>
                {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label>Categoria
              <select value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))}>
                <option value="hospedagem">Hospedagem</option>
                <option value="dominio">Domínio</option>
                <option value="email">E-mail</option>
                <option value="banco">Banco de dados</option>
                <option value="codigo">Código e repositório</option>
                <option value="rede_social">Rede social</option>
                <option value="outro">Outro</option>
              </select>
            </label>
            <label>Plataforma *<input required value={draft.platform} onChange={(event) => setDraft((current) => ({ ...current, platform: event.target.value }))} placeholder="Ex.: Vercel, GitHub ou Registro.br" /></label>
            <label className="span-2">Endereço de acesso<input type="url" value={draft.accessUrl} onChange={(event) => setDraft((current) => ({ ...current, accessUrl: event.target.value }))} placeholder="https://..." /></label>
            <label>Usuário ou e-mail<input value={draft.usernameEmail} onChange={(event) => setDraft((current) => ({ ...current, usernameEmail: event.target.value }))} /></label>
            <label>Titular da conta<input value={draft.accountHolder} onChange={(event) => setDraft((current) => ({ ...current, accountHolder: event.target.value }))} /></label>
            <label className="span-2">Referência no cofre de senhas<input value={draft.vaultReference} onChange={(event) => setDraft((current) => ({ ...current, vaultReference: event.target.value }))} placeholder="Ex.: 1Password / Cliente Health / Vercel" /></label>
            <label className="profile-default"><input type="checkbox" checked={draft.twoFactorEnabled} onChange={(event) => setDraft((current) => ({ ...current, twoFactorEnabled: event.target.checked }))} /><span>Autenticação em dois fatores ativada</span></label>
            <div className="span-2"><button type="submit" className="pro-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar primeiro acesso"}</button></div>
          </form>
        )}
      </section>

      <LegacyInfrastructureModule key={legacyVersion} clients={clients} projects={projects} />
    </div>
  );
}
