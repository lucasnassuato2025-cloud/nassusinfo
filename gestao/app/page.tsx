"use client";

import { useEffect, useMemo, useState } from "react";
import AppIcon from "@/components/app-icon";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { formatDateTime, formatMoney, friendlyWorkspaceError, getBusinessRole, requireWorkspace, type BusinessRole, type Workspace } from "@/lib/workspace";

type Client={id:string;name:string;phone:string|null;email:string|null;status:string;created_at:string};
type Appointment={id:string;client_id:string|null;starts_at:string;status:string};
type Finance={type:"income"|"expense";amount:number|string;paid_at:string|null;due_date:string|null};
type Quote={status:string;total:number|string};

function DashboardSkeleton(){return <main className="workspace-skeleton"><div className="skeleton-bar"/><div className="skeleton-grid">{[0,1,2,3].map(item=><div className="skeleton-card" key={item}/>)}</div><div className="skeleton-card" style={{height:280,marginTop:10}}/></main>}

export default function DashboardPage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);const [role,setRole]=useState<BusinessRole|null>(null);const [clients,setClients]=useState<Client[]>([]);const [appointments,setAppointments]=useState<Appointment[]>([]);const [finance,setFinance]=useState<Finance[]>([]);const [quotes,setQuotes]=useState<Quote[]>([]);const [memberCount,setMemberCount]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState("");
  useEffect(()=>{let active=true;async function load(){try{
    const current=await requireWorkspace();if(!current||!active)return;
    const currentRole=await getBusinessRole(current.business.id);if(!currentRole)throw new Error("ACCESS_DENIED");
    const canOperate=["owner","admin","member","reception","professional"].includes(currentRole);const canCommercial=["owner","admin","member","reception"].includes(currentRole);const canFinance=["owner","admin","finance"].includes(currentRole);const isManager=["owner","admin"].includes(currentRole);const now=new Date().toISOString();const empty=()=>Promise.resolve({data:[],error:null});
    const clientQuery=currentRole==="finance"?(neonClient as any).rpc("finance_client_options",{p_business_id:current.business.id}):neonClient.from("clients").select("id,name,phone,email,status,created_at").eq("business_id",current.business.id).order("created_at",{ascending:false});
    const [cq,aq,fq,qq,mq]=await Promise.all([
      clientQuery,
      canOperate?neonClient.from("appointments").select("id,client_id,starts_at,status").eq("business_id",current.business.id).gte("starts_at",now).order("starts_at",{ascending:true}).limit(30):empty(),
      canFinance?neonClient.from("financial_entries").select("type,amount,paid_at,due_date").eq("business_id",current.business.id).limit(1500):empty(),
      canCommercial?neonClient.from("quotes").select("status,total").eq("business_id",current.business.id).limit(750):empty(),
      isManager?(neonClient as any).rpc("list_business_members_v2",{p_business_id:current.business.id}):empty(),
    ]);
    for(const result of [cq,aq,fq,qq,mq])if(result.error)throw result.error;
    const rawClients=Array.isArray(cq.data)?cq.data:[];setWorkspace(current);setRole(currentRole);
    setClients(currentRole==="finance"?rawClients.map((item:any)=>({id:String(item.id),name:String(item.name||"Cliente"),phone:null,email:null,status:"active",created_at:""})):rawClients as Client[]);
    setAppointments((Array.isArray(aq.data)?aq.data:[]) as Appointment[]);setFinance((Array.isArray(fq.data)?fq.data:[]) as Finance[]);setQuotes((Array.isArray(qq.data)?qq.data:[]) as Quote[]);
    setMemberCount(isManager&&Array.isArray(mq.data)?mq.data.filter((item:any)=>item.active!==false).length:0);
  }catch(reason){if(active)setError(friendlyWorkspaceError(reason));}finally{if(active)setLoading(false);}}void load();return()=>{active=false};},[]);

  const canOperate=Boolean(role&&["owner","admin","member","reception","professional"].includes(role));const canCommercial=Boolean(role&&["owner","admin","member","reception"].includes(role));const canFinance=Boolean(role&&["owner","admin","finance"].includes(role));const isManager=role==="owner"||role==="admin";
  const clientMap=useMemo(()=>new Map(clients.map(client=>[client.id,client.name])),[clients]);
  const metrics=useMemo(()=>{let revenue=0,expenses=0,overdue=0,receivable=0;const now=Date.now();for(const entry of finance){const value=Number(entry.amount||0);if(entry.paid_at){if(entry.type==="income")revenue+=value;else expenses+=value;}else if(entry.type==="income"){receivable+=value;if(entry.due_date&&new Date(`${entry.due_date}T23:59:59`).getTime()<now)overdue+=1;}}const approved=quotes.filter(q=>["approved","converted"].includes(q.status));const openQuotes=quotes.filter(q=>["draft","sent","viewed","pending"].includes(q.status));return{revenue,expenses,result:revenue-expenses,receivable,overdue,approved:approved.length,approvedValue:approved.reduce((sum,q)=>sum+Number(q.total||0),0),openQuotes:openQuotes.length};},[finance,quotes]);
  const pendingAppointments=appointments.filter(a=>["scheduled","confirmed"].includes(a.status));const todayKey=new Date().toLocaleDateString("en-CA");const todayAppointments=pendingAppointments.filter(item=>new Date(item.starts_at).toLocaleDateString("en-CA")===todayKey);
  if(loading||(!workspace&&!error))return <DashboardSkeleton/>;
  if(!workspace)return <main className="loading"><div className="brand-mark">N</div><h1>Não foi possível abrir o painel</h1><p>{error}</p><button className="primary" onClick={()=>window.location.reload()}>Tentar novamente</button></main>;
  const firstName=(workspace.user.name||workspace.user.email||"").split(" ")[0].split("@")[0];const remaining=workspace.business.client_limit==null?null:Math.max(0,workspace.business.client_limit-clients.length);

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clients.length} memberCount={memberCount}>
    <main className="module-content">
      <header className="dashboard-head"><div><span className="eyebrow">NASSUS PULSE</span><h1>Visão geral</h1><p>{firstName}, aqui está o que está acontecendo no seu negócio agora.</p></div><div className="dashboard-actions">{canOperate?<a className="secondary" href="/agenda"><AppIcon name="calendar" size={15}/> Agenda</a>:null}{canOperate?<a className="primary" href="/clientes"><AppIcon name="plus" size={15}/> Novo cliente</a>:null}</div></header>
      {error?<div className="notice error" role="alert">{error}</div>:null}

      <section className="dashboard-kpis">
        <article className="kpi"><div className="kpi-top"><span className="kpi-label">Clientes</span><span className="kpi-icon"><AppIcon name="users" size={15}/></span></div><strong>{clients.length}</strong><small>{remaining==null?"Sem limite no plano":`${remaining} cadastros disponíveis`}</small></article>
        {canOperate?<article className="kpi"><div className="kpi-top"><span className="kpi-label">Agenda hoje</span><span className="kpi-icon"><AppIcon name="calendar" size={15}/></span></div><strong>{todayAppointments.length}</strong><small>{pendingAppointments.length} compromisso(s) futuro(s)</small></article>:null}
        {canFinance?<article className="kpi highlight"><div className="kpi-top"><span className="kpi-label">Recebido</span><span className="kpi-icon"><AppIcon name="wallet" size={15}/></span></div><strong>{formatMoney(metrics.revenue)}</strong><small>{formatMoney(metrics.receivable)} ainda a receber</small></article>:canCommercial?<article className="kpi highlight"><div className="kpi-top"><span className="kpi-label">Aprovado</span><span className="kpi-icon"><AppIcon name="file" size={15}/></span></div><strong>{formatMoney(metrics.approvedValue)}</strong><small>{metrics.approved} orçamento(s) aprovado(s)</small></article>:null}
        {canFinance?<article className="kpi"><div className="kpi-top"><span className="kpi-label">Resultado</span><span className="kpi-icon"><AppIcon name="chart" size={15}/></span></div><strong>{formatMoney(metrics.result)}</strong><small>Receitas recebidas menos despesas pagas</small></article>:canCommercial?<article className="kpi"><div className="kpi-top"><span className="kpi-label">Em negociação</span><span className="kpi-icon"><AppIcon name="file" size={15}/></span></div><strong>{metrics.openQuotes}</strong><small>orçamento(s) aguardando avanço</small></article>:null}
      </section>

      <section className="dashboard-grid">
        <article className="pulse-panel"><div className="pulse-head"><div className="pulse-title"><span>PRÓXIMOS PASSOS</span><h2>Agenda e relacionamento</h2></div>{canOperate?<a className="link-button" href="/agenda">Abrir agenda →</a>:null}</div>{canOperate&&pendingAppointments.length?<div className="agenda-list">{pendingAppointments.slice(0,5).map(item=><article className="agenda-item" key={item.id}><div className="agenda-time"><strong>{new Date(item.starts_at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</strong><small>{new Date(item.starts_at).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit"})}</small></div><div className="agenda-body"><strong>{item.client_id?clientMap.get(item.client_id)||"Cliente":"Cliente"}</strong><small>{formatDateTime(item.starts_at)}</small></div><span className={`badge ${item.status==="confirmed"?"blue":"orange"}`}>{item.status==="confirmed"?"Confirmado":"Agendado"}</span></article>)}</div>:<div className="empty-state"><strong>{canOperate?"Agenda livre":"Acesso segmentado"}</strong><p>{canOperate?"Nenhum compromisso futuro. Use o botão Novo para começar.":"Seu perfil exibe somente os indicadores necessários para sua função."}</p></div>}</article>

        <aside className="pulse-panel"><div className="pulse-head"><div className="pulse-title"><span>NASSUS PULSE</span><h2>Precisa da sua atenção</h2></div><AppIcon name="bolt" size={17}/></div><div className="attention-list">
          {canFinance&&metrics.overdue>0?<a className="attention-item warn" href="/financeiro"><span className="attention-dot"><AppIcon name="wallet" size={14}/></span><div><strong>{metrics.overdue} cobrança(s) vencida(s)</strong><small>Revise o contas a receber</small></div><AppIcon name="chevron" size={13}/></a>:null}
          {canOperate&&todayAppointments.length>0?<a className="attention-item" href="/agenda"><span className="attention-dot"><AppIcon name="calendar" size={14}/></span><div><strong>{todayAppointments.length} atendimento(s) hoje</strong><small>Confira horários e confirmações</small></div><AppIcon name="chevron" size={13}/></a>:null}
          {canCommercial&&metrics.openQuotes>0?<a className="attention-item" href="/orcamentos"><span className="attention-dot"><AppIcon name="file" size={14}/></span><div><strong>{metrics.openQuotes} orçamento(s) em aberto</strong><small>Avance propostas pendentes</small></div><AppIcon name="chevron" size={13}/></a>:null}
          {isManager&&workspace.business.plan==="essential"?<a className="attention-item" href="/assinatura"><span className="attention-dot"><AppIcon name="card" size={14}/></span><div><strong>Plano Essencial ativo</strong><small>{clients.length}/90 clientes • {memberCount || 1}/2 usuários</small></div><AppIcon name="chevron" size={13}/></a>:null}
          {(!canFinance||metrics.overdue===0)&&(!canOperate||todayAppointments.length===0)&&(!canCommercial||metrics.openQuotes===0)&&!(isManager&&workspace.business.plan==="essential")?<div className="empty-state"><strong>Tudo sob controle</strong><p>Nenhuma ação crítica detectada neste momento.</p></div>:null}
        </div></aside>
      </section>

      <section className="dashboard-grid dashboard-table">
        {canOperate?<article className="pulse-panel"><div className="pulse-head"><div className="pulse-title"><span>BASE DE CLIENTES</span><h2>Cadastros recentes</h2></div><a className="link-button" href="/clientes">Ver todos →</a></div>{clients.length?<div className="table-wrap"><table><thead><tr><th>Cliente</th><th>Telefone</th><th>E-mail</th><th>Status</th></tr></thead><tbody>{clients.slice(0,6).map(client=><tr key={client.id}><td><strong>{client.name}</strong></td><td>{client.phone||"—"}</td><td>{client.email||"—"}</td><td><span className={`badge ${client.status==="active"?"green":""}`}>{client.status==="active"?"Ativo":"Inativo"}</span></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Construa sua base</strong><p>Cadastre o primeiro cliente e o histórico começa aqui.</p></div>}</article>:<article className="pulse-panel"><div className="pulse-title"><span>PRIVACIDADE</span><h2>Dados minimizados</h2></div><div className="limit-note">Seu perfil Financeiro recebe somente informações necessárias para lançamentos e indicadores.</div></article>}
        <aside className="pulse-panel"><div className="pulse-head"><div className="pulse-title"><span>RESUMO RÁPIDO</span><h2>Operação</h2></div></div><div className="activity-strip"><div className="activity-pill"><span>Clientes</span><strong>{clients.length}</strong></div>{canOperate?<div className="activity-pill"><span>Agenda</span><strong>{pendingAppointments.length}</strong></div>:null}{canCommercial?<div className="activity-pill"><span>Aprovados</span><strong>{metrics.approved}</strong></div>:canFinance?<div className="activity-pill"><span>Vencidos</span><strong>{metrics.overdue}</strong></div>:null}</div></aside>
      </section>
    </main>
  </AppShell>;
}
