"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { formatMoney, friendlyWorkspaceError, requireWorkspace, type Workspace } from "@/lib/workspace";

type Finance={type:"income"|"expense";amount:number|string;paid_at:string|null;category:string|null};
type Appointment={status:string;service_id:string|null};
type Service={id:string;name:string};
type Quote={status:string;total:number|string};

export default function ReportsPage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [clientCount,setClientCount]=useState(0);
  const [memberCount,setMemberCount]=useState(1);
  const [finance,setFinance]=useState<Finance[]>([]);
  const [appointments,setAppointments]=useState<Appointment[]>([]);
  const [services,setServices]=useState<Service[]>([]);
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{let active=true;async function load(){try{const current=await requireWorkspace();if(!current||!active)return;const [cq,mq,fq,aq,sq,qq]=await Promise.all([
    neonClient.from("clients").select("id").eq("business_id",current.business.id),
    neonClient.from("business_members").select("id").eq("business_id",current.business.id).eq("active",true),
    neonClient.from("financial_entries").select("type,amount,paid_at,category").eq("business_id",current.business.id).limit(1000),
    neonClient.from("appointments").select("status,service_id").eq("business_id",current.business.id).limit(1000),
    neonClient.from("services").select("id,name").eq("business_id",current.business.id),
    neonClient.from("quotes").select("status,total").eq("business_id",current.business.id).limit(1000),
  ]);setWorkspace(current);setClientCount(Array.isArray(cq.data)?cq.data.length:0);setMemberCount(Array.isArray(mq.data)?mq.data.length:1);setFinance((Array.isArray(fq.data)?fq.data:[]) as Finance[]);setAppointments((Array.isArray(aq.data)?aq.data:[]) as Appointment[]);setServices((Array.isArray(sq.data)?sq.data:[]) as Service[]);setQuotes((Array.isArray(qq.data)?qq.data:[]) as Quote[]);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{if(active)setLoading(false);}}void load();return()=>{active=false};},[]);

  const metrics=useMemo(()=>{let revenue=0,expenses=0;for(const item of finance){if(!item.paid_at)continue;if(item.type==="income")revenue+=Number(item.amount||0);else expenses+=Number(item.amount||0);}const completed=appointments.filter(a=>a.status==="completed").length;const approved=quotes.filter(q=>["approved","converted"].includes(q.status));const quoteTotal=approved.reduce((sum,q)=>sum+Number(q.total||0),0);return{revenue,expenses,result:revenue-expenses,completed,quoteTotal,conversion:quotes.length?approved.length/quotes.length*100:0};},[finance,appointments,quotes]);
  const serviceUsage=useMemo(()=>{const counts=new Map<string,number>();for(const appointment of appointments){if(appointment.service_id&&appointment.status!=="cancelled")counts.set(appointment.service_id,(counts.get(appointment.service_id)||0)+1);}return services.map(service=>({name:service.name,count:counts.get(service.id)||0})).sort((a,b)=>b.count-a.count).slice(0,8);},[appointments,services]);
  const maxService=Math.max(1,...serviceUsage.map(item=>item.count));

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Relatórios</h1><p>Calculando indicadores...</p></main>;
  if(!workspace)return <main className="loading"><h1>Não foi possível abrir</h1><p>{error}</p></main>;

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clientCount} memberCount={memberCount}><main className="module-content">
    <div className="module-head"><div><span className="eyebrow">INTELIGÊNCIA DO NEGÓCIO</span><h1>Relatórios</h1><p>Indicadores calculados a partir dos dados reais da sua empresa.</p></div></div>
    {error?<div className="notice error">{error}</div>:null}
    <section className="summary-row"><article className="summary-card"><span>Faturamento recebido</span><strong>{formatMoney(metrics.revenue)}</strong><small>Receitas marcadas como pagas</small></article><article className="summary-card"><span>Resultado realizado</span><strong>{formatMoney(metrics.result)}</strong><small>Receitas menos despesas</small></article><article className="summary-card"><span>Atendimentos concluídos</span><strong>{metrics.completed}</strong><small>Agenda finalizada</small></article><article className="summary-card"><span>Conversão de orçamentos</span><strong>{metrics.conversion.toFixed(0)}%</strong><small>{formatMoney(metrics.quoteTotal)} aprovados</small></article></section>
    <div className="grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">DEMANDA</span><h2>Serviços mais agendados</h2></div></div>{serviceUsage.length?<div className="report-bars">{serviceUsage.map(item=><div className="report-row" key={item.name}><strong>{item.name}</strong><div className="bar-track"><i style={{width:`${item.count/maxService*100}%`}}/></div><span className="right">{item.count} agend.</span></div>)}</div>:<div className="empty-state"><strong>Ainda sem dados suficientes</strong><p>Quando a agenda começar a ser utilizada, os serviços mais procurados aparecem aqui.</p></div>}</section>
      <aside className="panel"><div className="panel-head"><div><span className="eyebrow">SAÚDE DA OPERAÇÃO</span><h2>Resumo</h2></div></div><div className="info-list"><div><span>Clientes cadastrados</span><strong>{clientCount}</strong></div><div><span>Usuários ativos</span><strong>{memberCount}</strong></div><div><span>Serviços no catálogo</span><strong>{services.length}</strong></div><div><span>Agendamentos registrados</span><strong>{appointments.length}</strong></div><div><span>Orçamentos emitidos</span><strong>{quotes.length}</strong></div><div><span>Despesas realizadas</span><strong>{formatMoney(metrics.expenses)}</strong></div></div>{workspace.business.plan==="essential"?<div className="limit-note"><strong>Plano Profissional</strong><br/>A base já está preparada para relatórios mais avançados conforme o produto evoluir.</div>:null}</aside>
    </div>
  </main></AppShell>;
}
