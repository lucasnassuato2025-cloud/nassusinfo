"use client";

import { useEffect, useMemo, useState } from "react";

import { Client, Payment, Project } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { TASK_COLUMNS, CRMTask, addDays, clientLabel, compactCurrency, dateLabel, mapTask, rows, today } from "./shared";

type Props = {
  clients: Client[];
  projects: Project[];
  payments: Payment[];
};

type AlertSeverity = "urgente" | "alta" | "media" | "baixa";
type AlertKind = "pagamento" | "tarefa" | "projeto" | "dominio" | "hospedagem";

type BusinessAlert = {
  id: string;
  kind: AlertKind;
  severity: AlertSeverity;
  title: string;
  detail: string;
  date: string | null;
  clientId: string | null;
  amount?: number;
};

const SEVERITY_ORDER: Record<AlertSeverity, number> = {
  urgente: 0,
  alta: 1,
  media: 2,
  baixa: 3,
};

const KIND_LABELS: Record<AlertKind, string> = {
  pagamento: "Cobrança",
  tarefa: "Tarefa",
  projeto: "Projeto",
  dominio: "Domínio",
  hospedagem: "Hospedagem",
};

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function AlertsModule({ clients, projects, payments }: Props) {
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"todos" | AlertKind>("todos");
  const [notice, setNotice] = useState("");

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);

  useEffect(() => {
    let active = true;
    async function loadTasks() {
      setLoading(true);
      const query = await neonClient
        .from("tasks")
        .select(TASK_COLUMNS)
        .eq("status", "pendente")
        .order("due_date", { ascending: true })
        .order("id", { ascending: false });
      if (!active) return;
      if (query.error) setNotice(query.error.message || "Não foi possível carregar os alertas de tarefas.");
      else setTasks(rows(query.data).map(mapTask));
      setLoading(false);
    }
    void loadTasks();
    return () => {
      active = false;
    };
  }, []);

  const alerts = useMemo(() => {
    const current = today();
    const next7 = addDays(current, 7);
    const next14 = addDays(current, 14);
    const next30 = addDays(current, 30);
    const items: BusinessAlert[] = [];

    payments.forEach((payment) => {
      if (["pago", "cancelado"].includes(payment.status)) return;
      const remaining = Math.max(0, payment.totalAmount - payment.paidAmount);
      if (!payment.dueDate || remaining <= 0) return;
      if (payment.dueDate < current || payment.status === "atrasado") {
        items.push({ id: `payment-overdue-${payment.id}`, kind: "pagamento", severity: "urgente", title: "Cobrança vencida", detail: `${payment.description} · ${compactCurrency.format(remaining)} em aberto`, date: payment.dueDate, clientId: payment.clientId, amount: remaining });
      } else if (payment.dueDate <= next7) {
        items.push({ id: `payment-soon-${payment.id}`, kind: "pagamento", severity: "alta", title: "Cobrança próxima do vencimento", detail: `${payment.description} · ${compactCurrency.format(remaining)} em aberto`, date: payment.dueDate, clientId: payment.clientId, amount: remaining });
      }
    });

    tasks.forEach((task) => {
      if (!task.dueDate) return;
      if (task.dueDate < current) {
        items.push({ id: `task-overdue-${task.id}`, kind: "tarefa", severity: task.priority === "urgente" ? "urgente" : "alta", title: "Tarefa atrasada", detail: `${task.title}${task.description ? ` · ${task.description}` : ""}`, date: task.dueDate, clientId: task.clientId });
      } else if (task.dueDate <= next7) {
        items.push({ id: `task-soon-${task.id}`, kind: "tarefa", severity: task.priority === "urgente" || task.priority === "alta" ? "alta" : "media", title: task.dueDate === current ? "Tarefa para hoje" : "Tarefa próxima", detail: `${task.title}${task.description ? ` · ${task.description}` : ""}`, date: task.dueDate, clientId: task.clientId });
      }
    });

    projects.forEach((project) => {
      if (project.status !== "finalizado" && project.dueDate) {
        if (project.dueDate < current) {
          items.push({ id: `project-overdue-${project.id}`, kind: "projeto", severity: "urgente", title: "Projeto com prazo vencido", detail: `${project.name} · ${project.progress}% concluído`, date: project.dueDate, clientId: project.clientId });
        } else if (project.dueDate <= next14) {
          items.push({ id: `project-soon-${project.id}`, kind: "projeto", severity: project.progress < 70 ? "alta" : "media", title: "Entrega de projeto próxima", detail: `${project.name} · ${project.progress}% concluído`, date: project.dueDate, clientId: project.clientId });
        }
      }

      if (project.domainRenewalDate && project.domainRenewalDate <= next30) {
        items.push({ id: `domain-${project.id}`, kind: "dominio", severity: project.domainRenewalDate < current ? "urgente" : project.domainRenewalDate <= next7 ? "alta" : "media", title: project.domainRenewalDate < current ? "Domínio vencido" : "Renovação de domínio", detail: `${project.domain || project.name} · verificar renovação`, date: project.domainRenewalDate, clientId: project.clientId });
      }

      if (project.hostingRenewalDate && project.hostingRenewalDate <= next30) {
        items.push({ id: `hosting-${project.id}`, kind: "hospedagem", severity: project.hostingRenewalDate < current ? "urgente" : project.hostingRenewalDate <= next7 ? "alta" : "media", title: project.hostingRenewalDate < current ? "Hospedagem vencida" : "Renovação de hospedagem", detail: `${project.hosting || "Hospedagem"} · ${project.name}`, date: project.hostingRenewalDate, clientId: project.clientId });
      }
    });

    return items.sort((a, b) => {
      const severity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
      if (severity !== 0) return severity;
      return String(a.date || "9999-12-31").localeCompare(String(b.date || "9999-12-31"));
    });
  }, [payments, projects, tasks]);

  const visibleAlerts = filter === "todos" ? alerts : alerts.filter((alert) => alert.kind === filter);
  const urgent = alerts.filter((alert) => alert.severity === "urgente").length;
  const nextSevenDays = alerts.filter((alert) => alert.date && alert.date >= today() && alert.date <= addDays(today(), 7)).length;
  const overdueValue = alerts.filter((alert) => alert.kind === "pagamento" && alert.severity === "urgente").reduce((sum, alert) => sum + Number(alert.amount || 0), 0);

  function whatsappLink(alert: BusinessAlert): string | null {
    if (alert.kind !== "pagamento" || !alert.clientId) return null;
    const client = clientMap.get(alert.clientId);
    const phone = normalizePhone(client?.whatsapp || client?.phone || "");
    if (!phone) return null;
    const message = `Olá, ${client?.name || "tudo bem"}! Passando para lembrar sobre ${alert.detail}. O vencimento é ${dateLabel(alert.date)}. Qualquer dúvida, estou à disposição. — Nassusinfo`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }

  return (
    <div className="alerts-module">
      <section className="business-metrics alerts-metrics">
        <article><span>ALERTAS ATIVOS</span><strong>{alerts.length}</strong><small>Itens que exigem atenção</small></article>
        <article><span>URGENTES</span><strong>{urgent}</strong><small>Vencidos ou críticos</small></article>
        <article><span>PRÓXIMOS 7 DIAS</span><strong>{nextSevenDays}</strong><small>Prazos e vencimentos</small></article>
        <article><span>VALOR VENCIDO</span><strong>{compactCurrency.format(overdueValue)}</strong><small>Cobranças em atraso</small></article>
      </section>

      {notice && <div className="business-notice">{notice}</div>}

      <section className="pro-panel alerts-panel">
        <header className="alerts-toolbar">
          <div><span>CENTRAL DE ATENÇÃO</span><h2>Prazos, cobranças e renovações</h2></div>
          <div className="alerts-filters">
            {(["todos", "pagamento", "tarefa", "projeto", "dominio", "hospedagem"] as const).map((item) => <button type="button" key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "todos" ? "Todos" : KIND_LABELS[item]}</button>)}
          </div>
        </header>

        {loading ? <p className="business-muted">Atualizando alertas...</p> : visibleAlerts.length ? (
          <div className="alerts-list">
            {visibleAlerts.map((alert) => {
              const client = alert.clientId ? clientMap.get(alert.clientId) : undefined;
              const whatsapp = whatsappLink(alert);
              return (
                <article className={`alert-card severity-${alert.severity}`} key={alert.id}>
                  <i>{alert.kind === "pagamento" ? "R$" : alert.kind === "tarefa" ? "✓" : alert.kind === "projeto" ? "◇" : alert.kind === "dominio" ? "WWW" : "☁"}</i>
                  <div className="alert-content"><header><span>{KIND_LABELS[alert.kind]}</span><b>{alert.severity}</b></header><h3>{alert.title}</h3><p>{alert.detail}</p><small>{client ? clientLabel(client) : "Sem cliente vinculado"} · {dateLabel(alert.date)}</small></div>
                  <div className="alert-actions">{whatsapp && <a href={whatsapp} target="_blank" rel="noreferrer">Cobrar no WhatsApp</a>}{client?.email && alert.kind === "pagamento" && <a href={`mailto:${client.email}?subject=${encodeURIComponent("Lembrete de pagamento — Nassusinfo")}`}>Enviar e-mail</a>}</div>
                </article>
              );
            })}
          </div>
        ) : <section className="business-empty"><div>✓</div><h2>Nenhum alerta neste filtro</h2><p>Quando houver vencimentos, tarefas, entregas ou renovações próximas, eles aparecerão aqui.</p></section>}
      </section>
    </div>
  );
}
