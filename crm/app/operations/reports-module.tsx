"use client";

import { useEffect, useMemo, useState } from "react";

import { Client, Payment, Project } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { METHOD_LABELS, PROJECT_STATUS_LABELS, clientLabel, compactCurrency } from "./shared";

type ReportsModuleProps = {
  clients: Client[];
  projects: Project[];
  payments: Payment[];
  canManage?: boolean;
};

type MonthPoint = { key: string; label: string; value: number };

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, headers: string[], data: unknown[][]) {
  const content = [headers, ...data].map((row) => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateOnly(value: string | null | undefined) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function RevenueLineChart({ points }: { points: MonthPoint[] }) {
  const width = 720;
  const height = 250;
  const paddingX = 38;
  const paddingY = 30;
  const maxValue = Math.max(1, ...points.map((point) => point.value));
  const coordinates = points.map((point, index) => ({
    ...point,
    x: paddingX + (index * (width - paddingX * 2)) / Math.max(1, points.length - 1),
    y: height - paddingY - (point.value / maxValue) * (height - paddingY * 2),
  }));
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${paddingX},${height - paddingY} ${polyline} ${width - paddingX},${height - paddingY}`;

  return (
    <div className="executive-line-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Receita recebida nos últimos doze meses">
        {[0, 1, 2, 3, 4].map((line) => {
          const y = paddingY + (line * (height - paddingY * 2)) / 4;
          return <line key={line} x1={paddingX} x2={width - paddingX} y1={y} y2={y} className="chart-grid-line" />;
        })}
        <polygon points={area} className="chart-area" />
        <polyline points={polyline} className="chart-line" />
        {coordinates.map((point) => <g key={point.key}><circle cx={point.x} cy={point.y} r="5" className="chart-point" /><title>{point.label}: {compactCurrency.format(point.value)}</title></g>)}
      </svg>
      <div className="executive-chart-labels">{points.map((point) => <span key={point.key}>{point.label}</span>)}</div>
    </div>
  );
}

function FunnelChart({ clients }: { clients: Client[] }) {
  const stages = [
    ["novo", "Novos"], ["contato", "Contato"], ["proposta", "Proposta"], ["negociacao", "Negociação"], ["fechado", "Fechados"],
  ] as const;
  const maximum = Math.max(1, ...stages.map(([stage]) => clients.filter((client) => client.status === stage).length));
  return <div className="executive-funnel">{stages.map(([stage, label]) => {
    const count = clients.filter((client) => client.status === stage).length;
    const value = clients.filter((client) => client.status === stage).reduce((sum, client) => sum + client.estimatedValue, 0);
    return <div key={stage}><header><span>{label}</span><b>{count}</b></header><i><em style={{ width: `${Math.max(5, (count / maximum) * 100)}%` }} /></i><small>{compactCurrency.format(value)}</small></div>;
  })}</div>;
}

export function ReportsModule({ clients, projects, payments, canManage = true }: ReportsModuleProps) {
  const [monthlyGoal, setMonthlyGoal] = useState(0);
  const [goalDraft, setGoalDraft] = useState("");
  const [goalSaving, setGoalSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  useEffect(() => {
    let active = true;
    async function loadGoal() {
      const access = await (neonClient as any).rpc("crm_my_access");
      const ownerId = access.data?.workspaceOwnerId;
      if (!ownerId) return;
      const query = await neonClient.from("crm_settings").select("monthly_revenue_goal").eq("workspace_owner_id", ownerId).maybeSingle();
      if (!active || query.error) return;
      const value = Number(query.data?.monthly_revenue_goal || 0);
      setMonthlyGoal(value);
      setGoalDraft(value ? String(value) : "");
    }
    void loadGoal();
    return () => { active = false; };
  }, []);

  const leads = clients.filter((client) => client.lifecycle === "lead");
  const customers = clients.filter((client) => client.lifecycle === "cliente");
  const received = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const contracted = projects.reduce((sum, project) => sum + project.totalValue, 0);
  const averageTicket = projects.length ? contracted / projects.length : 0;
  const conversionRate = clients.length ? (customers.length / clients.length) * 100 : 0;
  const recurring = projects.filter((project) => project.maintenanceEnabled).reduce((sum, project) => sum + project.maintenanceValue, 0);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const currentMonth = monthKey(now);
  const currentMonthReceived = payments.filter((payment) => (payment.paidAt || "").slice(0, 7) === currentMonth).reduce((sum, payment) => sum + payment.paidAmount, 0);
  const goalPercent = monthlyGoal > 0 ? Math.min(100, (currentMonthReceived / monthlyGoal) * 100) : 0;

  const forecastDate = new Date(now);
  forecastDate.setDate(forecastDate.getDate() + 60);
  const forecastLimit = forecastDate.toISOString().slice(0, 10);
  const forecast = payments.filter((payment) => !["pago", "cancelado"].includes(payment.status) && payment.dueDate && payment.dueDate <= forecastLimit)
    .reduce((sum, payment) => sum + Math.max(0, payment.totalAmount - payment.paidAmount), 0);

  const overduePayments = payments.filter((payment) => !["pago", "cancelado"].includes(payment.status) && payment.dueDate && payment.dueDate < today);
  const overdueValue = overduePayments.reduce((sum, payment) => sum + Math.max(0, payment.totalAmount - payment.paidAmount), 0);

  const months = useMemo(() => {
    const items: MonthPoint[] = [];
    for (let offset = 11; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      items.push({ key: monthKey(date), label: date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), value: 0 });
    }
    payments.forEach((payment) => {
      if (payment.paidAmount <= 0) return;
      const key = (payment.paidAt || payment.createdAt.slice(0, 10)).slice(0, 7);
      const month = items.find((item) => item.key === key);
      if (month) month.value += payment.paidAmount;
    });
    return items;
  }, [payments]);

  const methodRows = Object.entries(METHOD_LABELS).map(([method, label]) => ({
    method,
    label,
    total: payments.filter((payment) => payment.method === method).reduce((sum, payment) => sum + payment.paidAmount, 0),
    count: payments.filter((payment) => payment.method === method).length,
  })).filter((item) => item.count > 0).sort((a, b) => b.total - a.total);
  const methodMax = Math.max(1, ...methodRows.map((item) => item.total));

  const riskProjects = projects.map((project) => {
    const due = dateOnly(project.dueDate);
    const days = due ? Math.ceil((due.getTime() - now.getTime()) / 86400000) : null;
    const overdue = days != null && days < 0 && project.status !== "finalizado";
    const risk = overdue || (days != null && days <= 7 && project.progress < 80) || (days != null && days <= 15 && project.progress < 50);
    return { project, days, overdue, risk };
  }).filter((item) => item.risk).sort((a, b) => (a.days ?? 9999) - (b.days ?? 9999)).slice(0, 8);

  const clientRisks = clients.map((client) => {
    const items = overduePayments.filter((payment) => payment.clientId === client.id);
    return { client, count: items.length, total: items.reduce((sum, payment) => sum + Math.max(0, payment.totalAmount - payment.paidAmount), 0) };
  }).filter((item) => item.count > 0).sort((a, b) => b.total - a.total).slice(0, 8);

  const topClients = clients.map((client) => ({
    client,
    total: projects.filter((project) => project.clientId === client.id).reduce((sum, project) => sum + project.totalValue, 0),
    projects: projects.filter((project) => project.clientId === client.id).length,
  })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);

  const projectStatuses = Object.entries(PROJECT_STATUS_LABELS).map(([status, label]) => ({ status, label, count: projects.filter((project) => project.status === status).length })).filter((item) => item.count > 0);

  async function saveGoal() {
    const value = Math.max(0, Number(goalDraft || 0));
    setGoalSaving(true); setNotice("");
    try {
      const access = await (neonClient as any).rpc("crm_my_access");
      if (access.error || !access.data?.workspaceOwnerId) throw access.error || new Error("Workspace não identificado.");
      const result = await (neonClient.from("crm_settings") as any).upsert({ workspace_owner_id: access.data.workspaceOwnerId, monthly_revenue_goal: value, updated_at: new Date().toISOString() }, { onConflict: "workspace_owner_id" });
      if (result.error) throw result.error;
      setMonthlyGoal(value);
      setNotice("Meta mensal atualizada.");
    } catch (reason) { setNotice(reason instanceof Error ? reason.message : "Não foi possível salvar a meta."); }
    finally { setGoalSaving(false); }
  }

  function exportFinance() {
    downloadCsv("nassus-financeiro.csv", ["Cliente", "Projeto", "Descrição", "Forma", "Parcelas", "Total", "Recebido", "Vencimento", "Status"], payments.map((payment) => {
      const project = payment.projectId ? projects.find((item) => item.id === payment.projectId) : null;
      return [clientLabel(clientMap.get(payment.clientId)), project?.name || "", payment.description, METHOD_LABELS[payment.method] || payment.method, payment.installments, payment.totalAmount, payment.paidAmount, payment.dueDate || "", payment.status];
    }));
  }

  function exportClients() {
    downloadCsv("nassus-clientes.csv", ["Tipo", "Nome", "Empresa", "CPF/CNPJ", "WhatsApp", "E-mail", "Cidade", "Estado", "Segmento", "Status"], clients.map((client) => [client.lifecycle, client.name, client.company, client.document, client.whatsapp || client.phone, client.email, client.city, client.state, client.segment, client.status]));
  }

  return (
    <div className="executive-stack">
      {notice && <div className="business-notice">{notice}</div>}
      <section className="executive-hero">
        <div><span>PAINEL EXECUTIVO</span><h2>Saúde comercial e financeira</h2><p>Indicadores calculados com os dados reais cadastrados no CRM.</p></div>
        <div className="executive-goal-editor"><label>Meta mensal<input type="number" min="0" step="100" value={goalDraft} onChange={(event) => setGoalDraft(event.target.value)} placeholder="Ex.: 10000" /></label><button type="button" className="pro-primary" disabled={!canManage || goalSaving} onClick={() => void saveGoal()}>{goalSaving ? "Salvando..." : "Salvar meta"}</button></div>
      </section>

      <section className="executive-metrics">
        <article><span>RECEBIDO NO MÊS</span><strong>{compactCurrency.format(currentMonthReceived)}</strong><small>{monthlyGoal > 0 ? `${goalPercent.toFixed(0)}% da meta de ${compactCurrency.format(monthlyGoal)}` : "Defina uma meta mensal"}</small><i><em style={{ width: `${goalPercent}%` }} /></i></article>
        <article className="tone-blue"><span>PREVISÃO 60 DIAS</span><strong>{compactCurrency.format(forecast)}</strong><small>Saldo das cobranças a vencer</small></article>
        <article className="tone-green"><span>RECEITA RECORRENTE</span><strong>{compactCurrency.format(recurring)}</strong><small>Manutenções mensais</small></article>
        <article className={overdueValue > 0 ? "tone-red" : "tone-violet"}><span>EM ATRASO</span><strong>{compactCurrency.format(overdueValue)}</strong><small>{overduePayments.length} cobrança(s) vencida(s)</small></article>
        <article><span>CONVERSÃO</span><strong>{conversionRate.toFixed(1)}%</strong><small>{customers.length} clientes de {clients.length} contatos</small></article>
        <article><span>TICKET MÉDIO</span><strong>{compactCurrency.format(averageTicket)}</strong><small>{projects.length} projeto(s) · {compactCurrency.format(contracted)} contratado</small></article>
      </section>

      <section className="executive-grid">
        <article className="ops-panel executive-wide"><header className="ops-panel-head"><div><span>RECEITA HISTÓRICA</span><h2>Recebimentos dos últimos 12 meses</h2></div><div><button type="button" className="business-secondary" onClick={exportClients}>Clientes CSV</button><button type="button" className="pro-primary" onClick={exportFinance}>Financeiro CSV</button></div></header><RevenueLineChart points={months} /></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>FUNIL COMERCIAL</span><h2>Conversão por etapa</h2></div></header><FunnelChart clients={clients} /></article>

        <article className="ops-panel"><header className="ops-panel-head"><div><span>PROJETOS EM RISCO</span><h2>Prazos que exigem atenção</h2></div><b className={riskProjects.length ? "risk-count" : "safe-count"}>{riskProjects.length}</b></header><div className="risk-list">{riskProjects.length ? riskProjects.map(({ project, days, overdue }) => <div key={project.id}><span><strong>{project.name}</strong><small>{clientLabel(clientMap.get(project.clientId))} · {project.progress}% concluído</small></span><b className={overdue ? "late" : "warning"}>{overdue ? `${Math.abs(days || 0)}d atrasado` : `${days}d restantes`}</b></div>) : <p className="ops-muted">Nenhum projeto em risco neste momento.</p>}</div></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>CLIENTES EM RISCO</span><h2>Inadimplência por cliente</h2></div></header><div className="risk-list">{clientRisks.length ? clientRisks.map((item) => <div key={item.client.id}><span><strong>{clientLabel(item.client)}</strong><small>{item.count} cobrança(s) vencida(s)</small></span><b className="late">{compactCurrency.format(item.total)}</b></div>) : <p className="ops-muted">Nenhum cliente com cobrança atrasada.</p>}</div></article>

        <article className="ops-panel"><header className="ops-panel-head"><div><span>FORMAS DE PAGAMENTO</span><h2>Receita por canal</h2></div></header><div className="channel-chart">{methodRows.length ? methodRows.map((item) => <div key={item.method}><header><span>{item.label}</span><b>{compactCurrency.format(item.total)}</b></header><i><em style={{ width: `${Math.max(4, (item.total / methodMax) * 100)}%` }} /></i><small>{item.count} cobrança(s)</small></div>) : <p className="ops-muted">Nenhum pagamento registrado.</p>}</div></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>MAIORES CLIENTES</span><h2>Valor contratado</h2></div></header><div className="report-list">{topClients.length ? topClients.map((item, index) => <div key={item.client.id}><span><b>{index + 1}</b>{clientLabel(item.client)}<small>{item.projects} projeto(s)</small></span><strong>{compactCurrency.format(item.total)}</strong></div>) : <p className="ops-muted">Cadastre projetos para gerar o ranking.</p>}</div></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>PRODUÇÃO</span><h2>Status dos projetos</h2></div></header><div className="status-report">{projectStatuses.length ? projectStatuses.map((item) => <div key={item.status}><span>{item.label}</span><strong>{item.count}</strong><i style={{ width: `${Math.max(8, (item.count / Math.max(1, projects.length)) * 100)}%` }} /></div>) : <p className="ops-muted">Nenhum projeto cadastrado.</p>}</div></article>
      </section>
    </div>
  );
}
