"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { friendlyWorkspaceError, requireWorkspace, type Workspace } from "@/lib/workspace";

type Subscription={id:string;provider:string;plan:"essential"|"professional";status:string;current_period_start:string|null;current_period_end:string|null;cancel_at_period_end:boolean};

export default function SubscriptionPage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [subscription,setSubscription]=useState<Subscription|null>(null);
  const [clientCount,setClientCount]=useState(0);
  const [memberCount,setMemberCount]=useState(1);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(()=>{let active=true;async function load(){try{const current=await requireWorkspace();if(!current||!active)return;const [sq,cq,mq]=await Promise.all([
    neonClient.from("subscriptions").select("id,provider,plan,status,current_period_start,current_period_end,cancel_at_period_end").eq("business_id",current.business.id).limit(1),
    neonClient.from("clients").select("id").eq("business_id",current.business.id),
    neonClient.from("business_members").select("id").eq("business_id",current.business.id).eq("active",true),
  ]);setWorkspace(current);setSubscription(Array.isArray(sq.data)&&sq.data.length?sq.data[0] as Subscription:null);setClientCount(Array.isArray(cq.data)?cq.data.length:0);setMemberCount(Array.isArray(mq.data)?mq.data.length:1);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{if(active)setLoading(false);}}void load();return()=>{active=false};},[]);

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Assinatura</h1><p>Consultando seu plano...</p></main>;
  if(!workspace)return <main className="loading"><h1>Não foi possível abrir</h1><p>{error}</p></main>;

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clientCount} memberCount={memberCount}><main className="module-content">
    <div className="module-head"><div><span className="eyebrow">PLANOS E COBRANÇA</span><h1>Assinatura</h1><p>Escolha o plano adequado para o tamanho da sua operação.</p></div></div>
    {error?<div className="notice error">{error}</div>:null}
    <div className="notice"><strong>Status atual:</strong> {subscription?`${subscription.status} via ${subscription.provider}`:workspace.business.status==="trial"?"período de avaliação":"sem assinatura registrada"}. A cobrança automática será conectada à Cakto sem armazenar dados de pagamento no Nassus Gestão.</div>
    <div className="plan-cards">
      <article className={`pricing-card ${workspace.business.plan==="essential"?"featured":""}`}><span className="eyebrow">ESSENCIAL</span>{workspace.business.plan==="essential"?<span className="recommended">PLANO ATUAL</span>:null}<h2>Para começar organizado</h2><div className="price">R$ 39,90 <small>/mês</small></div><ul><li>Até 2 usuários</li><li>Até 90 clientes</li><li>Agenda e serviços</li><li>Financeiro</li><li>Orçamentos</li><li>Dashboard e relatórios básicos</li><li>Uso no computador e celular</li></ul><button className="secondary" disabled={workspace.business.plan==="essential"}>{workspace.business.plan==="essential"?"Seu plano atual":"Mudar para Essencial"}</button></article>
      <article className={`pricing-card ${workspace.business.plan==="professional"?"featured":""}`}><span className="eyebrow">PROFISSIONAL</span><span className="recommended">MAIS COMPLETO</span><h2>Para empresas em crescimento</h2><div className="price">R$ 139,90 <small>/mês</small></div><ul><li>Até 10 usuários</li><li>Clientes ilimitados</li><li>Todos os recursos do Essencial</li><li>Equipe e permissões ampliadas</li><li>Mais capacidade operacional</li><li>Base pronta para automações avançadas</li><li>Suporte prioritário</li></ul><button className="primary" disabled>{workspace.business.plan==="professional"?"Seu plano atual":"Ativar com Cakto — próxima etapa"}</button></article>
    </div>
    <div className="panel" style={{marginTop:15,maxWidth:940}}><div className="panel-head"><div><span className="eyebrow">USO DO PLANO</span><h2>Consumo atual</h2></div></div><div className="stack"><div><div className="split small"><strong>Clientes</strong><span>{workspace.business.client_limit?`${clientCount}/${workspace.business.client_limit}`:`${clientCount} • ilimitado`}</span></div><div className="progress-line" style={{marginTop:6}}><i style={{width:`${workspace.business.client_limit?Math.min(100,clientCount/workspace.business.client_limit*100):100}%`}}/></div></div><div><div className="split small"><strong>Usuários</strong><span>{memberCount}/{workspace.business.user_limit}</span></div><div className="progress-line" style={{marginTop:6}}><i style={{width:`${Math.min(100,memberCount/workspace.business.user_limit*100)}%`}}/></div></div></div></div>
  </main></AppShell>;
}
