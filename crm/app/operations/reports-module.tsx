"use client";

import { useMemo } from "react";
import { Client, Payment, Project } from "@/lib/crm-pro";
import { METHOD_LABELS, PROJECT_STATUS_LABELS, clientLabel, compactCurrency } from "./shared";

type ReportsModuleProps = {
  clients: Client[];
  projects: Project[];
  payments: Payment[];
};

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

export function ReportsModule({ clients, projects, payments }: ReportsModuleProps) {
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const leads = clients.filter((client) => client.lifecycle === "lead");
  const customers = clients.filter((client) => client.lifecycle === "cliente");
  const received = payments.reduce((sum, payment) => sum + payment.paidAmount, 0);
  const averageTicket = projects.length ? projects.reduce((sum, project) => sum + project.totalValue, 0) / projects.length : 0;
  const conversionRate = clients.length ? (customers.length / clients.length) * 100 : 0;
  const recurring = projects.filter((project) => project.maintenanceEnabled).reduce((sum, project) => sum + project.maintenanceValue, 0);

  const months = useMemo(() => {
    const items: Array<{ key: string; label: string; value: number }> = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      items.push({ key, label: date.toLocaleDateString("pt-BR", { month: "short" }), value: 0 });
    }
    payments.forEach((payment) => {
      if (payment.paidAmount <= 0) return;
      const key = (payment.paidAt || payment.createdAt.slice(0, 10)).slice(0, 7);
      const month = items.find((item) => item.key === key);
      if (month) month.value += payment.paidAmount;
    });
    return items;
  }, [payments]);

  const maxMonth = Math.max(1, ...months.map((month) => month.value));
  const methodRows = Object.entries(METHOD_LABELS).map(([method, label]) => ({
    method,
    label,
    total: payments.filter((payment) => payment.method === method).reduce((sum, payment) => sum + payment.paidAmount, 0),
    count: payments.filter((payment) => payment.method === method).length,
  })).filter((item) => item.count > 0);

  const topClients = clients.map((client) => ({
    client,
    total: projects.filter((project) => project.clientId === client.id).reduce((sum, project) => sum + project.totalValue, 0),
    projects: projects.filter((project) => project.clientId === client.id).length,
  })).filter((item) => item.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);

  const projectStatuses = Object.entries(PROJECT_STATUS_LABELS).map(([status, label]) => ({
    status,
    label,
    count: projects.filter((project) => project.status === status).length,
  })).filter((item) => item.count > 0);

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
    <div className="reports-stack">
      <section className="ops-metrics reports-metrics"><article><span>Conversão</span><strong>{conversionRate.toFixed(1)}%</strong><small>{customers.length} clientes de {clients.length} contatos</small></article><article className="tone-green"><span>Receita recebida</span><strong>{compactCurrency.format(received)}</strong><small>Total registrado</small></article><article className="tone-blue"><span>Ticket médio</span><strong>{compactCurrency.format(averageTicket)}</strong><small>Por projeto</small></article><article className="tone-violet"><span>Receita recorrente</span><strong>{compactCurrency.format(recurring)}</strong><small>Manutenção mensal</small></article></section>

      <section className="reports-toolbar"><div><span>RELATÓRIOS E EXPORTAÇÃO</span><h2>Indicadores do negócio</h2></div><div><button id="reports-export-button" type="button" className="pro-secondary" onClick={exportClients}>Exportar clientes</button><button type="button" className="pro-primary" onClick={exportFinance}>Exportar financeiro</button></div></section>

      <section className="reports-grid">
        <article className="ops-panel reports-wide"><header className="ops-panel-head"><div><span>FATURAMENTO</span><h2>Recebimentos nos últimos 6 meses</h2></div></header><div className="revenue-chart">{months.map((month) => <div key={month.key}><strong>{month.value ? compactCurrency.format(month.value) : "R$ 0"}</strong><span><i style={{ height: `${Math.max(4, (month.value / maxMonth) * 100)}%` }} /></span><small>{month.label}</small></div>)}</div></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>FORMAS DE PAGAMENTO</span><h2>Receita por canal</h2></div></header><div className="report-list">{methodRows.length ? methodRows.map((item) => <div key={item.method}><span>{item.label}<small>{item.count} cobrança(s)</small></span><strong>{compactCurrency.format(item.total)}</strong></div>) : <p className="ops-muted">Nenhum pagamento registrado.</p>}</div></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>CLIENTES</span><h2>Maiores contratos</h2></div></header><div className="report-list">{topClients.length ? topClients.map((item, index) => <div key={item.client.id}><span><b>{index + 1}</b>{clientLabel(item.client)}<small>{item.projects} projeto(s)</small></span><strong>{compactCurrency.format(item.total)}</strong></div>) : <p className="ops-muted">Cadastre projetos para gerar o ranking.</p>}</div></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>PRODUÇÃO</span><h2>Status dos projetos</h2></div></header><div className="status-report">{projectStatuses.length ? projectStatuses.map((item) => <div key={item.status}><span>{item.label}</span><strong>{item.count}</strong><i style={{ width: `${Math.max(8, (item.count / Math.max(1, projects.length)) * 100)}%` }} /></div>) : <p className="ops-muted">Nenhum projeto cadastrado.</p>}</div></article>
        <article className="ops-panel"><header className="ops-panel-head"><div><span>FUNIL</span><h2>Resumo comercial</h2></div></header><div className="report-list"><div><span>Leads em aberto</span><strong>{leads.filter((lead) => lead.status !== "perdido").length}</strong></div><div><span>Clientes ativos</span><strong>{customers.length}</strong></div><div><span>Projetos cadastrados</span><strong>{projects.length}</strong></div><div><span>Cobranças registradas</span><strong>{payments.length}</strong></div></div></article>
      </section>
    </div>
  );
}
