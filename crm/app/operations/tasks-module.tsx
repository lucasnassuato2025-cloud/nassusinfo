"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Client, Project } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { ACTIVITY_COLUMNS, PRIORITY_LABELS, TASK_COLUMNS, CRMTask, ClientActivity, TaskPriority, addDays, clientLabel, dateFormatter, dateLabel, errorMessage, mapActivity, mapTask, recordActivity, rows, today } from "./shared";

type TasksModuleProps = {
  clients: Client[];
  projects: Project[];
};

export function TasksModule({ clients, projects }: TasksModuleProps) {
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [activities, setActivities] = useState<ClientActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState(clients[0]?.id || "");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState({
    clientId: "",
    projectId: "",
    title: "",
    description: "",
    priority: "media" as TaskPriority,
    dueDate: today(),
  });

  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  const selectedActivities = useMemo(
    () => activities.filter((activity) => activity.clientId === selectedClientId),
    [activities, selectedClientId],
  );
  const pending = tasks.filter((task) => task.status === "pendente");
  const overdue = pending.filter((task) => task.dueDate && task.dueDate < today());
  const dueToday = pending.filter((task) => task.dueDate === today());
  const nextSevenDays = pending.filter((task) => task.dueDate && task.dueDate > today() && task.dueDate <= addDays(today(), 7));

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [taskQuery, activityQuery] = await Promise.all([
        neonClient.from("tasks").select(TASK_COLUMNS).order("due_date", { ascending: true }).order("id", { ascending: false }),
        neonClient.from("client_activities").select(ACTIVITY_COLUMNS).order("activity_at", { ascending: false }).order("id", { ascending: false }),
      ]);
      if (!active) return;
      if (taskQuery.error || activityQuery.error) {
        setNotice(taskQuery.error?.message || activityQuery.error?.message || "Não foi possível carregar a agenda.");
      } else {
        setTasks(rows(taskQuery.data).map(mapTask));
        setActivities(rows(activityQuery.data).map(mapActivity));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  function resetDraft() {
    setEditingId(null);
    setDraft({ clientId: selectedClientId, projectId: "", title: "", description: "", priority: "media", dueDate: today() });
  }

  function openNewTask() {
    resetDraft();
    setFormOpen(true);
  }

  function editTask(task: CRMTask) {
    setEditingId(task.id);
    setDraft({
      clientId: task.clientId || "",
      projectId: task.projectId || "",
      title: task.title,
      description: task.description,
      priority: task.priority,
      dueDate: task.dueDate || "",
    });
    setFormOpen(true);
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) return setNotice("Informe o título da tarefa.");
    const row = {
      client_id: draft.clientId ? Number(draft.clientId) : null,
      project_id: draft.projectId ? Number(draft.projectId) : null,
      title: draft.title.trim(),
      description: draft.description.trim(),
      priority: draft.priority,
      due_date: draft.dueDate || null,
      updated_at: new Date().toISOString(),
    };
    const table = neonClient.from("tasks") as any;
    const result = editingId
      ? await table.update(row).eq("id", editingId).select(TASK_COLUMNS)
      : await table.insert(row).select(TASK_COLUMNS);
    if (result.error) return setNotice(errorMessage(result.error, "Não foi possível salvar a tarefa."));
    const saved = mapTask(rows(result.data)[0] || result.data);
    setTasks((current) => editingId
      ? current.map((task) => task.id === editingId ? saved : task)
      : [saved, ...current].sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999")));
    setFormOpen(false);
    resetDraft();
    setNotice(editingId ? "Tarefa atualizada." : "Tarefa criada.");
    if (saved.clientId) {
      void recordActivity({
        clientId: saved.clientId,
        projectId: saved.projectId,
        type: editingId ? "tarefa_atualizada" : "tarefa_criada",
        title: editingId ? "Tarefa atualizada" : "Nova tarefa criada",
        description: saved.title,
      });
    }
  }

  async function completeTask(task: CRMTask) {
    const result = await (neonClient.from("tasks") as any)
      .update({ status: "concluida", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", task.id)
      .select(TASK_COLUMNS);
    if (result.error) return setNotice(errorMessage(result.error, "Não foi possível concluir a tarefa."));
    const saved = mapTask(rows(result.data)[0] || result.data);
    setTasks((current) => current.map((item) => item.id === task.id ? saved : item));
    setNotice("Tarefa concluída.");
    if (task.clientId) {
      void recordActivity({ clientId: task.clientId, projectId: task.projectId, type: "tarefa_concluida", title: "Tarefa concluída", description: task.title });
    }
  }

  async function removeTask(task: CRMTask) {
    if (!window.confirm(`Excluir a tarefa “${task.title}”?`)) return;
    const result = await (neonClient.from("tasks") as any).delete().eq("id", task.id);
    if (result.error) return setNotice(errorMessage(result.error, "Não foi possível excluir a tarefa."));
    setTasks((current) => current.filter((item) => item.id !== task.id));
    setNotice("Tarefa excluída.");
  }

  async function addNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedClientId || !note.trim()) return setNotice("Selecione o cliente e escreva uma observação.");
    const result = await (neonClient.from("client_activities") as any)
      .insert({
        client_id: Number(selectedClientId),
        project_id: null,
        activity_type: "nota",
        title: "Observação adicionada",
        description: note.trim(),
        activity_at: new Date().toISOString(),
      })
      .select(ACTIVITY_COLUMNS);
    if (result.error) return setNotice(errorMessage(result.error, "Não foi possível salvar a observação."));
    const saved = mapActivity(rows(result.data)[0] || result.data);
    setActivities((current) => [saved, ...current]);
    setNote("");
    setNotice("Observação registrada no histórico.");
  }

  const filteredProjects = draft.clientId
    ? projects.filter((project) => project.clientId === draft.clientId)
    : projects;

  return (
    <div className="ops-stack">
      {notice && <div className="ops-notice">{notice}</div>}
      <section className="ops-metrics">
        <article><span>Pendentes</span><strong>{pending.length}</strong><small>Tarefas em aberto</small></article>
        <article className="tone-red"><span>Atrasadas</span><strong>{overdue.length}</strong><small>Precisam de atenção</small></article>
        <article className="tone-blue"><span>Para hoje</span><strong>{dueToday.length}</strong><small>Compromissos do dia</small></article>
        <article className="tone-violet"><span>Próximos 7 dias</span><strong>{nextSevenDays.length}</strong><small>Agenda da semana</small></article>
      </section>

      <section className="ops-grid">
        <article className="ops-panel ops-panel-wide">
          <header className="ops-panel-head">
            <div><span>AGENDA OPERACIONAL</span><h2>Tarefas e lembretes</h2></div>
            <button id="tasks-new-button" type="button" className="pro-primary" onClick={openNewTask}>+ Nova tarefa</button>
          </header>

          {formOpen && (
            <form className="ops-task-form" onSubmit={saveTask}>
              <label className="span-2">Título *<input required value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ex.: Enviar proposta para a clínica" /></label>
              <label>Cliente<select value={draft.clientId} onChange={(event) => setDraft((current) => ({ ...current, clientId: event.target.value, projectId: "" }))}><option value="">Sem cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientLabel(client)}</option>)}</select></label>
              <label>Projeto<select value={draft.projectId} onChange={(event) => setDraft((current) => ({ ...current, projectId: event.target.value }))}><option value="">Sem projeto</option>{filteredProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              <label>Prioridade<select value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))}>{Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Prazo<input type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></label>
              <label className="span-2">Descrição<textarea value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Detalhes importantes da tarefa" /></label>
              <footer className="span-2"><button type="button" className="pro-secondary" onClick={() => setFormOpen(false)}>Cancelar</button><button type="submit" className="pro-primary">{editingId ? "Salvar alterações" : "Criar tarefa"}</button></footer>
            </form>
          )}

          {loading ? <p className="ops-muted">Carregando agenda...</p> : tasks.length ? (
            <div className="ops-task-list">
              {tasks.map((task) => {
                const effectiveStatus = task.status === "pendente" && task.dueDate && task.dueDate < today() ? "atrasada" : task.status;
                return (
                  <div className={`ops-task ops-task-${effectiveStatus}`} key={task.id}>
                    <button type="button" className="ops-check" disabled={task.status !== "pendente"} onClick={() => completeTask(task)} aria-label="Concluir tarefa">{task.status === "concluida" ? "✓" : ""}</button>
                    <div className="ops-task-main"><div><span className={`priority priority-${task.priority}`}>{PRIORITY_LABELS[task.priority]}</span><strong>{task.title}</strong></div><p>{task.description || "Sem descrição adicional."}</p><small>{clientLabel(task.clientId ? clientMap.get(task.clientId) : undefined)}{task.projectId ? ` · ${projectMap.get(task.projectId)?.name || "Projeto"}` : ""}</small></div>
                    <div className="ops-task-due"><strong>{dateLabel(task.dueDate)}</strong><small>{effectiveStatus === "atrasada" ? "Atrasada" : task.status === "concluida" ? "Concluída" : "Pendente"}</small></div>
                    <div className="ops-row-actions"><button type="button" onClick={() => editTask(task)}>Editar</button><button type="button" className="danger" onClick={() => removeTask(task)}>Excluir</button></div>
                  </div>
                );
              })}
            </div>
          ) : <div className="ops-empty"><strong>Nenhuma tarefa cadastrada</strong><p>Crie lembretes para propostas, cobranças, materiais e entregas.</p></div>}
        </article>

        <article className="ops-panel">
          <header className="ops-panel-head"><div><span>HISTÓRICO DO CLIENTE</span><h2>Linha do tempo</h2></div></header>
          <label className="ops-client-select">Cliente<select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{clientLabel(client)}</option>)}</select></label>
          <form className="ops-note-form" onSubmit={addNote}><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Registrar conversa, reunião ou detalhe importante" /><button type="submit" className="pro-primary">Adicionar nota</button></form>
          <div className="ops-timeline">
            {selectedActivities.length ? selectedActivities.map((activity) => (
              <div key={activity.id}><i /><section><time>{dateFormatter.format(new Date(activity.activityAt))}</time><strong>{activity.title}</strong>{activity.description && <p>{activity.description}</p>}{activity.projectId && <small>{projectMap.get(activity.projectId)?.name || "Projeto relacionado"}</small>}</section></div>
            )) : <p className="ops-muted">O histórico deste cliente começará a aparecer conforme você usar o CRM.</p>}
          </div>
        </article>
      </section>
    </div>
  );
}
