"use client";

import { useEffect, useMemo, useState } from "react";

import { Client, Payment, Project, SiteAudit } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import {
  ACTIVITY_COLUMNS,
  TASK_COLUMNS,
  CRMTask,
  ClientActivity,
  clientLabel,
  compactCurrency,
  dateFormatter,
  dateLabel,
  mapActivity,
  mapTask,
  rows,
} from "./shared";

type Props = {
  clients: Client[];
  projects: Project[];
  payments: Payment[];
  audits: SiteAudit[];
};

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CL";
}

export function Client360Module({ clients, projects, payments, audits }: Props) {
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [search, setSearch] = useState("");
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!clients.length) {
      setSelectedClientId("");
      return;
    }
    if (!clients.some((client) => client.id === selectedClientId)) {
      setSelectedClientId(clients[0].id);
    }
  }, [clients, selectedClientId]);

  useEffect(() => {
    if (!selectedClientId) {
      setTasks([]);
      setActivities([]);
      return;
    }

    let active = true;
    async function loadClientHistory() {
      setLoading(true);
      setNotice("");
      const [taskQuery, activityQuery] = await Promise.all([
        neonClient
          .from("tasks")
          .select(TASK_COLUMNS)
          .eq("client_id", selectedClientId)
          .order("due_date", { ascending: true })
          .order("id", { ascending: false }),
        neonClient
          .from("client_activities")
          .select(ACTIVITY_COLUMNS)
          .eq("client_id", selectedClientId)
          .order("activity_at", { ascending: false })
          .order("id", { ascending: false }),
      ]);
      if (!active) return;
      const error = taskQuery.error || activityQuery.error;
      if (error) {
        setNotice(error.message || "Não foi possível carregar o histórico do cliente.");
      } else {
        setTasks(rows(taskQuery.data).map(mapTask));
        setActivities(rows(activityQuery.data).map(mapActivity));
      }
      setLoading(false);
    }

    void loadClientHistory();
    return () => {
      active = false;
    };
  }, [selectedClientId]);

  const normalizedSearch = search.trim().toLocaleLowerCase("pt-BR");
  const filteredClients = useMemo(
    () => clients.filter((client) => [clientLabel(client), client.name, client.document, client.segment, client.city].join(" ").toLocaleLowerCase("pt-BR").includes(normalizedSearch)),
    [clients, normalizedSearch],
  );

  const client = clients.find((item) => item.id === selectedClientId) || null;
  const clientProjects = projects.filter((item) => item.clientId === selectedClientId);
  const clientPayments = payments.filter((item) => item.clientId === selectedClientId);
  const clientAudits = audits.filter((item) => item.clientId === selectedClientId);
  const contracted = clientProjects.reduce((sum, project) => sum + project.totalValue, 0);
  const received = clientPayments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const balance = clientPayments.reduce((sum, payment) => sum + Math.max(0, payment.totalAmount - payment.paidAmount), 0);
  const pendingTasks = tasks.filter((task) => task.status === "pendente");

  if (!clients.length) {
    return (
      <section className="business-empty">
        <div>◉</div>
        <h2>Nenhum cliente disponível</h2>
        <p>Cadastre ou converta um lead no CRM principal para liberar a ficha 360°.</p>
      </section>
    );
  }

  return (
    <div className="client360-layout">
      <aside className="client360-list pro-panel">
        <div className="business-search">
          <span>⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente ou empresa" />
        </div>
        <div className="client360-list-items">
          {filteredClients.map((item) => (
            <button type="button" key={item.id} className={selectedClientId === item.id ? "active" : ""} onClick={() => setSelectedClientId(item.id)}>
              <i>{initials(clientLabel(item))}</i>
              <span><strong>{clientLabel(item)}</strong><small>{item.name}{item.segment ? ` · ${item.segment}` : ""}</small></span>
              <b>›</b>
            </button>
          ))}
          {!filteredClients.length && <p className="business-muted">Nenhum cliente encontrado.</p>}
        </div>
      </aside>

      {client && (
        <main className="client360-main">
          <section className="client360-hero">
            <div className="client360-avatar">{initials(clientLabel(client))}</div>
            <div className="client360-identity">
              <span>{client.clientType === "empresa" ? "EMPRESA" : client.clientType === "autonomo" ? "AUTÔNOMO" : "PESSOA FÍSICA"}</span>
              <h2>{clientLabel(client)}</h2>
              <p>{client.name}{client.document ? ` · ${client.document}` : ""}{client.city ? ` · ${client.city}/${client.state}` : ""}</p>
            </div>
            <div className="client360-actions">
              {(client.whatsapp || client.phone) && <a href={`https://wa.me/${normalizePhone(client.whatsapp || client.phone)}`} target="_blank" rel="noreferrer">WhatsApp</a>}
              {client.email && <a href={`mailto:${client.email}`}>E-mail</a>}
              {client.website && <a href={client.website.startsWith("http") ? client.website : `https://${client.website}`} target="_blank" rel="noreferrer">Abrir site</a>}
            </div>
          </section>

          <section className="business-metrics">
            <article><span>PROJETOS</span><strong>{clientProjects.length}</strong><small>{clientProjects.filter((project) => project.status !== "finalizado").length} em andamento</small></article>
            <article><span>CONTRATADO</span><strong>{compactCurrency.format(contracted)}</strong><small>Valor total dos projetos</small></article>
            <article><span>RECEBIDO</span><strong>{compactCurrency.format(received)}</strong><small>Pagamentos confirmados</small></article>
            <article><span>SALDO</span><strong>{compactCurrency.format(balance)}</strong><small>A receber</small></article>
            <article><span>PENDÊNCIAS</span><strong>{pendingTasks.length}</strong><small>Tarefas abertas</small></article>
          </section>

          {notice && <div className="business-notice">{notice}</div>}

          <section className="client360-grid">
            <article className="pro-panel client360-details">
              <header><div><span>CADASTRO</span><h3>Dados do cliente</h3></div></header>
              <dl>
                <div><dt>Responsável</dt><dd>{client.name || "Não informado"}</dd></div>
                <div><dt>Razão social</dt><dd>{client.legalName || "Não informada"}</dd></div>
                <div><dt>CPF / CNPJ</dt><dd>{client.document || "Não informado"}</dd></div>
                <div><dt>Telefone</dt><dd>{client.whatsapp || client.phone || "Não informado"}</dd></div>
                <div><dt>E-mail</dt><dd>{client.email || "Não informado"}</dd></div>
                <div><dt>Instagram</dt><dd>{client.instagram || "Não informado"}</dd></div>
                <div><dt>Origem</dt><dd>{client.source || "Não informada"}</dd></div>
                <div><dt>Endereço</dt><dd>{[client.address, client.addressNumber, client.neighborhood, client.city, client.state].filter(Boolean).join(", ") || "Não informado"}</dd></div>
              </dl>
              {client.notes && <div className="client360-note"><strong>Observações</strong><p>{client.notes}</p></div>}
            </article>

            <article className="pro-panel client360-tasks">
              <header><div><span>AGENDA</span><h3>Próximas tarefas</h3></div><b>{pendingTasks.length}</b></header>
              {loading ? <p className="business-muted">Carregando tarefas...</p> : pendingTasks.length ? (
                <div className="client360-task-list">
                  {pendingTasks.slice(0, 6).map((task) => <div key={task.id}><i className={`priority-${task.priority}`} /><span><strong>{task.title}</strong><small>{dateLabel(task.dueDate)}{task.description ? ` · ${task.description}` : ""}</small></span></div>)}
                </div>
              ) : <p className="business-muted">Nenhuma tarefa pendente.</p>}
            </article>
          </section>

          <section className="pro-panel client360-section">
            <header><div><span>PROJETOS</span><h3>Serviços contratados</h3></div><b>{clientProjects.length}</b></header>
            {clientProjects.length ? <div className="business-table-wrap"><table className="business-table"><thead><tr><th>Projeto</th><th>Status</th><th>Progresso</th><th>Entrega</th><th>Valor</th><th>Mensalidade</th></tr></thead><tbody>{clientProjects.map((project) => <tr key={project.id}><td><strong>{project.name}</strong><small>{project.serviceType}</small></td><td>{project.status.replaceAll("_", " ")}</td><td><div className="business-progress"><i style={{ width: `${project.progress}%` }} /></div><small>{project.progress}%</small></td><td>{dateLabel(project.dueDate)}</td><td>{compactCurrency.format(project.totalValue)}</td><td>{project.maintenanceEnabled ? compactCurrency.format(project.maintenanceValue) : "—"}</td></tr>)}</tbody></table></div> : <p className="business-muted">Nenhum projeto vinculado.</p>}
          </section>

          <section className="client360-grid">
            <article className="pro-panel client360-section">
              <header><div><span>FINANCEIRO</span><h3>Pagamentos e cobranças</h3></div></header>
              {clientPayments.length ? <div className="client360-finance-list">{clientPayments.slice(0, 8).map((payment) => <div key={payment.id}><span><strong>{payment.description}</strong><small>{payment.method} · {payment.installments}x · {dateLabel(payment.dueDate)}</small></span><b>{compactCurrency.format(payment.totalAmount)}<small>{compactCurrency.format(payment.paidAmount)} recebido</small></b></div>)}</div> : <p className="business-muted">Nenhuma cobrança vinculada.</p>}
            </article>

            <article className="pro-panel client360-section">
              <header><div><span>SITES</span><h3>Auditorias realizadas</h3></div><b>{clientAudits.length}</b></header>
              {clientAudits.length ? <div className="client360-audit-list">{clientAudits.slice(0, 6).map((audit) => <a key={audit.id} href={audit.url} target="_blank" rel="noreferrer"><i className={audit.overallScore >= 80 ? "good" : audit.overallScore >= 55 ? "medium" : "low"}>{audit.overallScore}</i><span><strong>{audit.title}</strong><small>{dateFormatter.format(new Date(audit.createdAt))}</small></span></a>)}</div> : <p className="business-muted">Nenhuma auditoria vinculada.</p>}
            </article>
          </section>

          <section className="pro-panel client360-section">
            <header><div><span>HISTÓRICO</span><h3>Linha do tempo do relacionamento</h3></div><b>{activities.length}</b></header>
            {loading ? <p className="business-muted">Carregando histórico...</p> : activities.length ? <div className="client360-timeline">{activities.slice(0, 20).map((activity) => <div key={activity.id}><i /><time>{dateFormatter.format(new Date(activity.activityAt))}</time><span><strong>{activity.title}</strong><p>{activity.description || activity.activityType}</p></span></div>)}</div> : <p className="business-muted">O histórico será criado automaticamente conforme o CRM for utilizado.</p>}
          </section>
        </main>
      )}
    </div>
  );
}
