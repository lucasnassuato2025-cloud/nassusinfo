"use client";

import { useEffect, useMemo, useState } from "react";
import { neonClient } from "@/lib/neon";
import { getCurrentUser, type SessionUser } from "@/lib/session";

type Business = { id:string; name:string; plan:"essential"|"professional"; client_limit:number|null; user_limit:number; status:string };
type Client = { id:string; name:string; phone:string|null; email:string|null; status:string; created_at:string };
type Appointment = { id:string; starts_at:string; status:string };
type Finance = { id:string; type:"income"|"expense"; amount:number|string; paid_at:string|null };
type Row = Record<string, unknown>;

export default function DashboardPage(){
  const [user,setUser]=useState<SessionUser|null>(null);
  const [business,setBusiness]=useState<Business|null>(null);
  const [clients,setClients]=useState<Client[]>([]);
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [finance,setFinance]=useState<Finance[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  async function load(){
    try{
      const current=await getCurrentUser();
      if(!current?.email){window.location.replace("/sign-in");return;}
      const bq=await neonClient.from("businesses").select("id,name,plan,client_limit,user_limit,status").limit(1);
      if(bq.error) throw bq.error;
      const businesses=Array.isArray(bq.data)?bq.data as Row[]:[];
      if(!businesses.length){window.location.replace("/onboarding");return;}
      const b=businesses[0] as unknown as Business;
      const [cq,aq,fq]=await Promise.all([
        neonClient.from("clients").select("id,name,phone,email,status,created_at").eq("business_id",b.id).order("created_at",{ascending:false}),
        neonClient.from("appointments").select("id,starts_at,status").eq("business_id",b.id).order("starts_at",{ascending:true}).limit(50),
        neonClient.from("financial_entries").select("id,type,amount,paid_at").eq("business_id",b.id).limit(500),
      ]);
      if(cq.error) throw cq.error;
      setUser(current);setBusiness(b);
      setClients((Array.isArray(cq.data)?cq.data:[]) as Client[]);
      if(!aq.error) setAppointments((Array.isArray(aq.data)?aq.data:[]) as Appointment[]);
      if(!fq.error) setFinance((Array.isArray(fq.data)?fq.data:[]) as Finance[]);
    }catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível carregar o sistema.");}
    finally{setLoading(false);}
  }

  useEffect(()=>{void load();},[]);

  const revenue=useMemo(()=>finance.filter(x=>x.type==="income"&&x.paid_at).reduce((s,x)=>s+Number(x.amount||0),0),[finance]);
  const expenses=useMemo(()=>finance.filter(x=>x.type==="expense"&&x.paid_at).reduce((s,x)=>s+Number(x.amount||0),0),[finance]);
  const scheduled=appointments.filter(x=>x.status==="scheduled"||x.status==="confirmed").length;

  async function addClient(){
    if(!business)return;
    const name=window.prompt("Nome do cliente:")?.trim(); if(!name)return;
    const phone=window.prompt("Telefone (opcional):")?.trim()||null;
    const email=window.prompt("E-mail (opcional):")?.trim()||null;
    const result=await neonClient.from("clients").insert({business_id:business.id,name,phone,email,status:"active"}).select("id,name,phone,email,status,created_at").single();
    if(result.error){
      const msg=String(result.error.message||"");
      alert(msg.includes("CLIENT_LIMIT_REACHED")?"Você atingiu o limite de 90 clientes do Essencial. Faça upgrade para o Profissional.":msg);
      return;
    }
    if(result.data)setClients((prev)=>[result.data as Client,...prev]);
  }

  async function signOut(){await neonClient.auth.signOut();window.location.replace("/sign-in");}

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Nassus Gestão</h1><p>Validando sua sessão e empresa...</p></main>;
  if(error)return <main className="loading"><div className="brand-mark">N</div><h1>Não foi possível abrir</h1><p>{error}</p><button className="primary" onClick={()=>window.location.reload()}>Tentar novamente</button></main>;
  if(!user||!business)return null;

  const usage=business.client_limit?Math.min(100,(clients.length/business.client_limit)*100):100;
  const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});

  return <div className="shell">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>BUSINESS OS</small></div></div>
      <div className="business-chip"><span>Empresa atual</span><strong>{business.name}</strong></div>
      <nav className="nav"><a className="active" href="#inicio"><span>▣ Dashboard</span></a><a href="#clientes"><span>👥 Clientes</span></a><a href="#agenda"><span>▦ Agenda</span></a><a href="#servicos"><span>🛠 Serviços</span></a><a href="#financeiro"><span>R$ Financeiro</span></a><a href="#orcamentos"><span>▤ Orçamentos</span></a><a href="#equipe"><span>◉ Equipe</span></a><a href="#config"><span>⚙ Configurações</span></a></nav>
      <div className="plan-box"><span>{business.plan==="essential"?"Plano Essencial":"Plano Profissional"}</span><strong>{business.client_limit?`${clients.length} / ${business.client_limit} clientes`:"Clientes ilimitados"}</strong><div className="meter"><i style={{width:`${usage}%`}}/></div><small>{business.client_limit?`${Math.max(0,business.client_limit-clients.length)} cadastros restantes.`:"Sem limite de clientes."}</small></div>
    </aside>
    <div className="main">
      <header className="topbar"><div><strong>{business.name}</strong><small>{business.plan==="essential"?"Essencial • 2 usuários • 90 clientes":"Profissional • 10 usuários • clientes ilimitados"}</small></div><div><strong>{user.name||user.email}</strong><small><button onClick={signOut} style={{border:0,background:"transparent",padding:0,color:"#2271b1",cursor:"pointer"}}>Sair</button></small></div></header>
      <main className="content" id="inicio">
        <div className="page-head"><div><span className="eyebrow">VISÃO GERAL</span><h1>Olá, {user.name?.split(" ")[0]||"bem-vindo"} 👋</h1><p>Acompanhe sua operação em um painel simples e profissional.</p></div><button className="primary" onClick={addClient}>+ Novo cliente</button></div>
        <section className="stats"><article className="card"><span>Clientes</span><strong>{clients.length}</strong><small>{business.client_limit?`${Math.max(0,business.client_limit-clients.length)} vagas no plano`:"Ilimitados"}</small></article><article className="card"><span>Agenda ativa</span><strong>{scheduled}</strong><small>Agendados ou confirmados</small></article><article className="card"><span>Receitas</span><strong>{money(revenue)}</strong><small>Recebimentos registrados</small></article><article className="card"><span>Resultado</span><strong>{money(revenue-expenses)}</strong><small>Receitas menos despesas</small></article></section>
        <section className="grid"><article className="panel" id="clientes"><div className="panel-head"><div><span className="eyebrow">RELACIONAMENTO</span><h2>Clientes recentes</h2></div><button className="secondary" onClick={addClient}>Novo cliente</button></div>{clients.length?<div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>E-mail</th><th>Status</th></tr></thead><tbody>{clients.slice(0,10).map(c=><tr key={c.id}><td><strong>{c.name}</strong></td><td>{c.phone||"—"}</td><td>{c.email||"—"}</td><td><span className="status">{c.status==="active"?"Ativo":c.status}</span></td></tr>)}</tbody></table></div>:<div className="empty">Nenhum cliente ainda. Cadastre o primeiro para começar.</div>}</article>
        <aside className="panel"><div className="panel-head"><div><span className="eyebrow">ATALHOS</span><h2>Ações rápidas</h2></div></div><div className="quick"><button onClick={addClient}><strong>+ Novo cliente</strong><br/><small>Cadastro protegido pelo limite do plano.</small></button><button><strong>▦ Novo agendamento</strong><br/><small>Módulo preparado no banco.</small></button><button><strong>R$ Nova receita</strong><br/><small>Financeiro protegido por permissão.</small></button><button><strong>▤ Novo orçamento</strong><br/><small>Orçamentos e itens já estruturados.</small></button></div>{business.plan==="essential"&&<div className="limit-note"><strong>Profissional — R$ 139,90/mês</strong><br/>Até 10 usuários, clientes ilimitados e recursos avançados.</div>}</aside></section>
      </main>
    </div>
  </div>;
}
