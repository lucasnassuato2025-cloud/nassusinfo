"use client";

import { FormEvent, useMemo, useState } from "react";

import { authClient } from "@/lib/auth/client";
import {
  CLIENT_STATUSES,
  Client,
  ClientInput,
  ClientStatus,
} from "@/lib/clients";

type DashboardProps = {
  initialClients: Client[];
  user: {
    name: string;
    email: string;
  };
};

const EMPTY_DRAFT: ClientInput = {
  name: "",
  company: "",
  segment: "",
  phone: "",
  email: "",
  status: "novo",
  estimatedValue: 0,
  nextAction: "",
  nextActionDate: null,
  notes: "",
};

const STATUS_LABELS: Record<ClientStatus, string> = {
  novo: "Novo lead",
  contato: "Em contato",
  proposta: "Proposta enviada",
  negociacao: "Negociação",
  fechado: "Fechado",
  perdido: "Perdido",
};

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function cloneEmptyDraft(): ClientInput {
  return { ...EMPTY_DRAFT };
}

function clientToDraft(client: Client): ClientInput {
  return {
    name: client.name,
    company: client.company,
    segment: client.segment,
    phone: client.phone,
    email: client.email,
    status: client.status,
    estimatedValue: client.estimatedValue,
    nextAction: client.nextAction,
    nextActionDate: client.nextActionDate,
    notes: client.notes,
  };
}

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export default function DashboardClient({ initialClients, user }: DashboardProps) {
  const [clients, setClients] = useState(initialClients);
  const [draft, setDraft] = useState<ClientInput>(cloneEmptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | ClientStatus>("todos");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const filteredClients = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");

    return clients.filter((client) => {
      const matchesStatus = statusFilter === "todos" || client.status === statusFilter;
      const haystack = [
        client.name,
        client.company,
        client.segment,
        client.phone,
        client.email,
        client.nextAction,
      ]
        .join(" ")
        .toLocaleLowerCase("pt-BR");

      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [clients, search, statusFilter]);

  const totals = useMemo(() => {
    const pipeline = clients.filter(
      (client) => client.status !== "fechado" && client.status !== "perdido",
    );

    return {
      clients: clients.length,
      active: pipeline.length,
      potential: pipeline.reduce((sum, client) => sum + client.estimatedValue, 0),
      closed: clients.filter((client) => client.status === "fechado").length,
    };
  }, [clients]);

  function updateDraft<K extends keyof ClientInput>(key: K, value: ClientInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetForm() {
    setDraft(cloneEmptyDraft());
    setEditingId(null);
    setMessage("");
  }

  function startEditing(client: Client) {
    setEditingId(client.id);
    setDraft(clientToDraft(client));
    setFormOpen(true);
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      const response = await fetch(
        editingId ? `/api/clients/${editingId}` : "/api/clients",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draft),
        },
      );
      const payload = (await response.json()) as { client?: Client; error?: string };

      if (!response.ok || !payload.client) {
        throw new Error(payload.error || "Não foi possível salvar o cliente.");
      }

      if (editingId) {
        setClients((current) =>
          current.map((client) =>
            client.id === editingId ? payload.client! : client,
          ),
        );
      } else {
        setClients((current) => [payload.client!, ...current]);
      }

      const successMessage = editingId
        ? "Cliente atualizado com sucesso."
        : "Cliente adicionado com sucesso.";
      resetForm();
      setMessage(successMessage);
      setFormOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  }

  async function removeClient(client: Client) {
    const confirmed = window.confirm(
      `Excluir ${client.name}? Esta ação não poderá ser desfeita.`,
    );
    if (!confirmed) return;

    const response = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(payload.error || "Não foi possível excluir o cliente.");
      return;
    }

    setClients((current) => current.filter((item) => item.id !== client.id));
    if (editingId === client.id) resetForm();
    setMessage("Cliente excluído.");
  }

  async function signOut() {
    await authClient.signOut();
    window.location.assign("/sign-in");
  }

  return (
    <main className="crm-shell">
      <header className="crm-header">
        <div className="crm-brand">
          <span aria-hidden="true">N</span>
          <div>
            <strong>Nassus CRM</strong>
            <small>Central comercial</small>
          </div>
        </div>

        <div className="crm-user">
          <div>
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button type="button" onClick={signOut}>Sair</button>
        </div>
      </header>

      <section className="crm-intro">
        <div>
          <small>VISÃO COMERCIAL</small>
          <h1>Organize contatos e transforme conversas em vendas.</h1>
          <p>
            Acompanhe o estágio de cada oportunidade, o valor do seu funil e a
            próxima ação que precisa ser realizada.
          </p>
        </div>
        <button
          type="button"
          className="primary-action"
          onClick={() => {
            resetForm();
            setFormOpen(true);
          }}
        >
          + Novo cliente
        </button>
      </section>

      <section className="metric-grid" aria-label="Resumo comercial">
        <article>
          <span>Clientes</span>
          <strong>{totals.clients}</strong>
          <small>Total cadastrado</small>
        </article>
        <article>
          <span>Em andamento</span>
          <strong>{totals.active}</strong>
          <small>Oportunidades ativas</small>
        </article>
        <article>
          <span>Potencial</span>
          <strong>{currency.format(totals.potential)}</strong>
          <small>Valor aberto no funil</small>
        </article>
        <article>
          <span>Fechados</span>
          <strong>{totals.closed}</strong>
          <small>Negócios ganhos</small>
        </article>
      </section>

      {message && <p className="crm-message" role="status">{message}</p>}

      {formOpen && (
        <section className="client-editor">
          <div className="section-heading">
            <div>
              <small>{editingId ? "EDITAR OPORTUNIDADE" : "NOVA OPORTUNIDADE"}</small>
              <h2>{editingId ? "Atualize os dados do cliente" : "Cadastre um cliente"}</h2>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
            >
              Fechar
            </button>
          </div>

          <form onSubmit={handleSubmit} className="client-form">
            <label>
              Nome do cliente *
              <input
                required
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="Nome completo"
              />
            </label>
            <label>
              Empresa
              <input
                value={draft.company}
                onChange={(event) => updateDraft("company", event.target.value)}
                placeholder="Empresa ou marca"
              />
            </label>
            <label>
              Segmento
              <input
                value={draft.segment}
                onChange={(event) => updateDraft("segment", event.target.value)}
                placeholder="Ex.: clínica, turismo, construção"
              />
            </label>
            <label>
              Status
              <select
                value={draft.status}
                onChange={(event) =>
                  updateDraft("status", event.target.value as ClientStatus)
                }
              >
                {CLIENT_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_LABELS[status]}</option>
                ))}
              </select>
            </label>
            <label>
              WhatsApp / telefone
              <input
                value={draft.phone}
                onChange={(event) => updateDraft("phone", event.target.value)}
                placeholder="(13) 99999-9999"
              />
            </label>
            <label>
              E-mail
              <input
                type="email"
                value={draft.email}
                onChange={(event) => updateDraft("email", event.target.value)}
                placeholder="cliente@empresa.com"
              />
            </label>
            <label>
              Valor estimado
              <input
                type="number"
                min="0"
                step="1"
                value={draft.estimatedValue}
                onChange={(event) =>
                  updateDraft("estimatedValue", Number(event.target.value || 0))
                }
              />
            </label>
            <label>
              Data da próxima ação
              <input
                type="date"
                value={draft.nextActionDate || ""}
                onChange={(event) =>
                  updateDraft("nextActionDate", event.target.value || null)
                }
              />
            </label>
            <label className="span-2">
              Próxima ação
              <input
                value={draft.nextAction}
                onChange={(event) => updateDraft("nextAction", event.target.value)}
                placeholder="Ex.: enviar proposta, ligar, marcar reunião"
              />
            </label>
            <label className="span-2">
              Observações
              <textarea
                value={draft.notes}
                onChange={(event) => updateDraft("notes", event.target.value)}
                placeholder="Necessidades, histórico da conversa e detalhes importantes"
              />
            </label>
            <div className="form-actions span-2">
              <button type="submit" className="primary-action" disabled={saving}>
                {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Adicionar cliente"}
              </button>
              {editingId && (
                <button type="button" className="ghost-button" onClick={resetForm}>
                  Cancelar edição
                </button>
              )}
            </div>
          </form>
        </section>
      )}

      <section className="client-section">
        <div className="section-heading">
          <div>
            <small>CARTEIRA COMERCIAL</small>
            <h2>Clientes e oportunidades</h2>
          </div>
          <span>{filteredClients.length} resultado(s)</span>
        </div>

        <div className="client-filters">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar nome, empresa, segmento ou contato"
          />
          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "todos" | ClientStatus)
            }
          >
            <option value="todos">Todos os status</option>
            {CLIENT_STATUSES.map((status) => (
              <option key={status} value={status}>{STATUS_LABELS[status]}</option>
            ))}
          </select>
        </div>

        {filteredClients.length === 0 ? (
          <div className="empty-state">
            <strong>Nenhuma oportunidade encontrada.</strong>
            <p>Cadastre um cliente novo ou altere os filtros da pesquisa.</p>
          </div>
        ) : (
          <div className="client-grid">
            {filteredClients.map((client) => {
              const phone = normalizePhone(client.phone);
              return (
                <article className="client-card" key={client.id}>
                  <div className="client-card-top">
                    <span className={`status status-${client.status}`}>
                      {STATUS_LABELS[client.status]}
                    </span>
                    <strong>{currency.format(client.estimatedValue)}</strong>
                  </div>
                  <h3>{client.name}</h3>
                  <p className="client-company">
                    {[client.company, client.segment].filter(Boolean).join(" · ") || "Contato direto"}
                  </p>

                  <dl>
                    <div>
                      <dt>Próxima ação</dt>
                      <dd>{client.nextAction || "Ainda não definida"}</dd>
                    </div>
                    <div>
                      <dt>Data</dt>
                      <dd>
                        {client.nextActionDate
                          ? shortDate.format(new Date(`${client.nextActionDate}T12:00:00`))
                          : "Sem data"}
                      </dd>
                    </div>
                  </dl>

                  {client.notes && <p className="client-notes">{client.notes}</p>}

                  <div className="client-links">
                    {phone && (
                      <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer">
                        WhatsApp
                      </a>
                    )}
                    {client.email && <a href={`mailto:${client.email}`}>E-mail</a>}
                  </div>

                  <div className="client-actions">
                    <button type="button" onClick={() => startEditing(client)}>Editar</button>
                    <button type="button" className="danger" onClick={() => removeClient(client)}>
                      Excluir
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
