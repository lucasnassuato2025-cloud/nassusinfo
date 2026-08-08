"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { formatMoney, friendlyWorkspaceError, requireWorkspace, type Workspace } from "@/lib/workspace";

type Service = { id:string; name:string; description:string|null; duration_minutes:number|null; price:number|string; active:boolean; created_at:string };

export default function ServicesPage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [services,setServices]=useState<Service[]>([]);
  const [clientCount,setClientCount]=useState(0);
  const [memberCount,setMemberCount]=useState(1);
  const [name,setName]=useState("");
  const [description,setDescription]=useState("");
  const [duration,setDuration]=useState("60");
  const [price,setPrice]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);

  useEffect(()=>{let active=true;async function load(){try{const current=await requireWorkspace();if(!current||!active)return;const [sq,cq,mq]=await Promise.all([
    neonClient.from("services").select("id,name,description,duration_minutes,price,active,created_at").eq("business_id",current.business.id).order("created_at",{ascending:false}),
    neonClient.from("clients").select("id").eq("business_id",current.business.id),
    neonClient.from("business_members").select("id").eq("business_id",current.business.id).eq("active",true),
  ]);if(sq.error)throw sq.error;setWorkspace(current);setServices((Array.isArray(sq.data)?sq.data:[]) as Service[]);setClientCount(Array.isArray(cq.data)?cq.data.length:0);setMemberCount(Array.isArray(mq.data)?mq.data.length:1);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{if(active)setLoading(false);}}void load();return()=>{active=false};},[]);

  async function createService(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!workspace||saving)return;setSaving(true);setError("");try{const value=Number(price.replace(",","."));const result=await neonClient.from("services").insert({business_id:workspace.business.id,name:name.trim(),description:description.trim()||null,duration_minutes:Number(duration)||null,price:Number.isFinite(value)?value:0,active:true}).select("id,name,description,duration_minutes,price,active,created_at").single();if(result.error)throw result.error;if(result.data)setServices(prev=>[result.data as Service,...prev]);setName("");setDescription("");setDuration("60");setPrice("");}catch(reason){setError(friendlyWorkspaceError(reason));}finally{setSaving(false);}}

  async function toggle(service:Service){if(!workspace)return;const next=!service.active;const result=await neonClient.from("services").update({active:next}).eq("id",service.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setServices(prev=>prev.map(item=>item.id===service.id?{...item,active:next}:item));}
  async function remove(service:Service){if(!workspace||!window.confirm(`Excluir o serviço ${service.name}?`))return;const result=await neonClient.from("services").delete().eq("id",service.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setServices(prev=>prev.filter(item=>item.id!==service.id));}

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Serviços</h1><p>Carregando catálogo...</p></main>;
  if(!workspace)return <main className="loading"><h1>Não foi possível abrir</h1><p>{error}</p></main>;
  const activeServices=services.filter(service=>service.active).length;
  const average=activeServices?services.filter(s=>s.active).reduce((sum,s)=>sum+Number(s.price||0),0)/activeServices:0;

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clientCount} memberCount={memberCount}><main className="module-content">
    <div className="module-head"><div><span className="eyebrow">CATÁLOGO</span><h1>Serviços</h1><p>Organize o que sua empresa oferece, duração e preço.</p></div></div>
    {error?<div className="notice error">{error}</div>:null}
    <section className="summary-row"><article className="summary-card"><span>Serviços cadastrados</span><strong>{services.length}</strong><small>Total do catálogo</small></article><article className="summary-card"><span>Ativos</span><strong>{activeServices}</strong><small>Disponíveis para agenda</small></article><article className="summary-card"><span>Preço médio</span><strong>{formatMoney(average)}</strong><small>Serviços ativos</small></article><article className="summary-card"><span>Inativos</span><strong>{services.length-activeServices}</strong><small>Ocultos da operação</small></article></section>
    <div className="module-grid"><section><div className="service-cards">{services.map(service=><article className="service-card" key={service.id}><div className="split"><span className={`badge ${service.active?"green":""}`}>{service.active?"Ativo":"Inativo"}</span><div className="table-actions"><button className="mini-button" onClick={()=>void toggle(service)}>{service.active?"Pausar":"Ativar"}</button><button className="danger" onClick={()=>void remove(service)}>Excluir</button></div></div><h3>{service.name}</h3><p>{service.description||"Sem descrição."}</p><div className="service-price"><strong>{formatMoney(service.price)}</strong><small>{service.duration_minutes?`${service.duration_minutes} min`:"Duração livre"}</small></div></article>)}</div>{!services.length?<div className="panel empty-state"><strong>Seu catálogo está vazio</strong><p>Cadastre os serviços oferecidos pela empresa. Eles poderão ser usados na agenda e nos orçamentos.</p></div>:null}</section>
      <aside className="form-panel"><span className="eyebrow">NOVO SERVIÇO</span><h2>Adicionar ao catálogo</h2><p>Defina preço e duração para acelerar agendamentos e orçamentos.</p><form onSubmit={createService}><div className="form-grid"><div className="field full"><label>Nome *</label><input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Consulta inicial"/></div><div className="field"><label>Duração (min)</label><input type="number" min="1" value={duration} onChange={e=>setDuration(e.target.value)}/></div><div className="field"><label>Preço (R$)</label><input inputMode="decimal" value={price} onChange={e=>setPrice(e.target.value)} placeholder="150,00"/></div><div className="field full"><label>Descrição</label><textarea value={description} onChange={e=>setDescription(e.target.value)} placeholder="O que está incluído neste serviço?"/></div></div><div className="form-actions"><button className="primary" disabled={saving}>{saving?"Salvando...":"Cadastrar serviço"}</button></div></form></aside>
    </div>
  </main></AppShell>;
}
