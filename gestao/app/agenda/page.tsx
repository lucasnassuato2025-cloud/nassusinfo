"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { formatDateTime, friendlyWorkspaceError, requireWorkspace, type Workspace } from "@/lib/workspace";

type Client = { id:string; name:string };
type Service = { id:string; name:string; duration_minutes:number|null; active:boolean };
type Appointment = { id:string; client_id:string|null; service_id:string|null; starts_at:string; ends_at:string|null; status:"scheduled"|"confirmed"|"completed"|"cancelled"|"no_show"; notes:string|null };

export default function AgendaPage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [clients,setClients]=useState<Client[]>([]);
  const [services,setServices]=useState<Service[]>([]);
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [memberCount,setMemberCount]=useState(1);
  const [clientId,setClientId]=useState("");
  const [serviceId,setServiceId]=useState("");
  const [startsAt,setStartsAt]=useState("");
  const [notes,setNotes]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  async function load(){try{const current=await requireWorkspace();if(!current)return;const from=new Date(Date.now()-86400000).toISOString();const [cq,sq,aq,mq]=await Promise.all([
    neonClient.from("clients").select("id,name").eq("business_id",current.business.id).eq("status","active").order("name",{ascending:true}),
    neonClient.from("services").select("id,name,duration_minutes,active").eq("business_id",current.business.id).eq("active",true).order("name",{ascending:true}),
    neonClient.from("appointments").select("id,client_id,service_id,starts_at,ends_at,status,notes").eq("business_id",current.business.id).gte("starts_at",from).order("starts_at",{ascending:true}).limit(200),
    neonClient.from("business_members").select("id").eq("business_id",current.business.id).eq("active",true),
  ]);if(cq.error)throw cq.error;if(sq.error)throw sq.error;if(aq.error)throw aq.error;setWorkspace(current);setClients((Array.isArray(cq.data)?cq.data:[]) as Client[]);setServices((Array.isArray(sq.data)?sq.data:[]) as Service[]);setAppointments((Array.isArray(aq.data)?aq.data:[]) as Appointment[]);setMemberCount(Array.isArray(mq.data)?mq.data.length:1);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{setLoading(false);}}
  useEffect(()=>{void load();},[]);

  const clientMap=useMemo(()=>new Map(clients.map(c=>[c.id,c.name])),[clients]);
  const serviceMap=useMemo(()=>new Map(services.map(s=>[s.id,s])),[services]);
  const todayKey=new Date().toLocaleDateString("pt-BR");
  const today=appointments.filter(a=>new Date(a.starts_at).toLocaleDateString("pt-BR")===todayKey&&a.status!=="cancelled").length;
  const pending=appointments.filter(a=>["scheduled","confirmed"].includes(a.status)&&new Date(a.starts_at).getTime()>=Date.now()).length;

  async function createAppointment(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!workspace||!clientId||!startsAt)return;setSaving(true);setError("");try{const service=serviceMap.get(serviceId);const start=new Date(startsAt);const end=service?.duration_minutes?new Date(start.getTime()+service.duration_minutes*60000):null;const result=await neonClient.from("appointments").insert({business_id:workspace.business.id,client_id:clientId,service_id:serviceId||null,starts_at:start.toISOString(),ends_at:end?.toISOString()||null,status:"scheduled",notes:notes.trim()||null}).select("id,client_id,service_id,starts_at,ends_at,status,notes").single();if(result.error)throw result.error;if(result.data)setAppointments(prev=>[...prev,result.data as Appointment].sort((a,b)=>new Date(a.starts_at).getTime()-new Date(b.starts_at).getTime()));setClientId("");setServiceId("");setStartsAt("");setNotes("");}catch(reason){setError(friendlyWorkspaceError(reason));}finally{setSaving(false);}}

  async function setStatus(appointment:Appointment,status:Appointment["status"]){if(!workspace)return;const result=await neonClient.from("appointments").update({status}).eq("id",appointment.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setAppointments(prev=>prev.map(item=>item.id===appointment.id?{...item,status}:item));}
  async function remove(appointment:Appointment){if(!workspace||!window.confirm("Excluir este agendamento?"))return;const result=await neonClient.from("appointments").delete().eq("id",appointment.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setAppointments(prev=>prev.filter(item=>item.id!==appointment.id));}

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Agenda</h1><p>Organizando compromissos...</p></main>;
  if(!workspace)return <main className="loading"><h1>Não foi possível abrir</h1><p>{error}</p></main>;

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clients.length} memberCount={memberCount}><main className="module-content">
    <div className="module-head"><div><span className="eyebrow">OPERAÇÃO</span><h1>Agenda</h1><p>Agendamentos ligados aos seus clientes e serviços.</p></div></div>
    {error?<div className="notice error">{error}</div>:null}
    <section className="summary-row"><article className="summary-card"><span>Hoje</span><strong>{today}</strong><small>Compromissos do dia</small></article><article className="summary-card"><span>Próximos</span><strong>{pending}</strong><small>Agendados ou confirmados</small></article><article className="summary-card"><span>Confirmados</span><strong>{appointments.filter(a=>a.status==="confirmed").length}</strong><small>Com presença aguardada</small></article><article className="summary-card"><span>Concluídos</span><strong>{appointments.filter(a=>a.status==="completed").length}</strong><small>Atendimentos finalizados</small></article></section>
    {!clients.length?<div className="notice">Cadastre pelo menos um cliente antes de criar um agendamento. <a href="/clientes"><strong>Ir para Clientes →</strong></a></div>:null}
    {!services.length?<div className="notice">Você pode agendar sem serviço, mas cadastrar seu catálogo deixa o fluxo mais rápido. <a href="/servicos"><strong>Ir para Serviços →</strong></a></div>:null}
    <div className="module-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">PRÓXIMOS ATENDIMENTOS</span><h2>Agenda operacional</h2></div></div><div className="agenda-list">{appointments.map(a=>{const date=new Date(a.starts_at);const service=a.service_id?serviceMap.get(a.service_id):null;return <article className="agenda-item" key={a.id}><div className="agenda-time"><strong>{date.toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</strong><small>{date.toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}</small></div><div className="agenda-body"><strong>{a.client_id?clientMap.get(a.client_id)||"Cliente":"Cliente removido"}</strong><small>{service?.name||"Sem serviço definido"} • {formatDateTime(a.starts_at)}</small>{a.notes?<small>{a.notes}</small>:null}</div><div className="agenda-actions"><span className={`badge ${a.status==="completed"?"green":a.status==="confirmed"?"blue":a.status==="cancelled"?"red":"orange"}`}>{({scheduled:"Agendado",confirmed:"Confirmado",completed:"Concluído",cancelled:"Cancelado",no_show:"Faltou"} as Record<string,string>)[a.status]}</span>{a.status==="scheduled"?<button className="mini-button ok" onClick={()=>void setStatus(a,"confirmed")}>Confirmar</button>:null}{["scheduled","confirmed"].includes(a.status)?<button className="mini-button ok" onClick={()=>void setStatus(a,"completed")}>Concluir</button>:null}{["scheduled","confirmed"].includes(a.status)?<button className="mini-button cancel" onClick={()=>void setStatus(a,"cancelled")}>Cancelar</button>:null}<button className="danger" onClick={()=>void remove(a)}>Excluir</button></div></article>})}{!appointments.length?<div className="empty-state"><strong>Nenhum agendamento</strong><p>Crie o primeiro compromisso usando o formulário ao lado.</p></div>:null}</div></section>
      <aside className="form-panel"><span className="eyebrow">NOVO AGENDAMENTO</span><h2>Reservar horário</h2><p>Escolha cliente, serviço e data. A duração é calculada pelo serviço cadastrado.</p><form onSubmit={createAppointment}><div className="form-grid"><div className="field full"><label>Cliente *</label><select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Selecione</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></div><div className="field full"><label>Serviço</label><select value={serviceId} onChange={e=>setServiceId(e.target.value)}><option value="">Sem serviço específico</option>{services.map(service=><option key={service.id} value={service.id}>{service.name}{service.duration_minutes?` • ${service.duration_minutes} min`:""}</option>)}</select></div><div className="field full"><label>Data e hora *</label><input type="datetime-local" required value={startsAt} onChange={e=>setStartsAt(e.target.value)}/></div><div className="field full"><label>Observações</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Informações importantes para o atendimento"/></div></div><div className="form-actions"><button className="primary" disabled={saving||!clients.length}>{saving?"Salvando...":"Criar agendamento"}</button></div></form></aside>
    </div>
  </main></AppShell>;
}
