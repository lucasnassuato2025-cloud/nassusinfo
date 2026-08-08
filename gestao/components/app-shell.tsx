"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import AppIcon, { type AppIconName } from "@/components/app-icon";
import { neonClient } from "@/lib/neon";
import type { SessionUser } from "@/lib/session";
import { isTrialExpired, setActiveBusiness, trialDaysRemaining, type BusinessRole, type WorkspaceBusiness } from "@/lib/workspace";

type AppShellProps={business:WorkspaceBusiness;user:SessionUser;clientCount?:number;memberCount?:number;children:ReactNode};
type NavItem={href:string;icon:AppIconName;label:string;roles?:BusinessRole[]};
type QuickItem={href:string;icon:AppIconName;label:string;hint:string;roles?:BusinessRole[]};
const MANAGERS:BusinessRole[]=["owner","admin"];
const FINANCE:BusinessRole[]=["owner","admin","finance"];
const OPERATIONS:BusinessRole[]=["owner","admin","member","reception","professional"];
const COMMERCIAL:BusinessRole[]=["owner","admin","member","reception"];
const NAV_ITEMS:NavItem[]=[
  {href:"/",icon:"home",label:"Visão geral"},
  {href:"/clientes",icon:"users",label:"Clientes",roles:OPERATIONS},
  {href:"/agenda",icon:"calendar",label:"Agenda",roles:OPERATIONS},
  {href:"/servicos",icon:"briefcase",label:"Serviços",roles:OPERATIONS},
  {href:"/orcamentos",icon:"file",label:"Orçamentos",roles:COMMERCIAL},
  {href:"/financeiro",icon:"wallet",label:"Financeiro",roles:FINANCE},
  {href:"/relatorios",icon:"chart",label:"Relatórios",roles:FINANCE},
  {href:"/equipe",icon:"team",label:"Equipe",roles:MANAGERS},
  {href:"/assinatura",icon:"card",label:"Assinatura",roles:MANAGERS},
  {href:"/configuracoes",icon:"settings",label:"Configurações",roles:MANAGERS},
];
const QUICK_ITEMS:QuickItem[]=[
  {href:"/clientes",icon:"users",label:"Novo cliente",hint:"Cadastro e relacionamento",roles:OPERATIONS},
  {href:"/agenda",icon:"calendar",label:"Novo agendamento",hint:"Horário, cliente e profissional",roles:OPERATIONS},
  {href:"/orcamentos",icon:"file",label:"Novo orçamento",hint:"Proposta comercial",roles:COMMERCIAL},
  {href:"/financeiro",icon:"wallet",label:"Novo lançamento",hint:"Receita ou despesa",roles:FINANCE},
];
const ROLE_LABEL:Record<BusinessRole,string>={owner:"Proprietário",admin:"Administrador",member:"Equipe",reception:"Recepção",professional:"Profissional",finance:"Financeiro"};

export default function AppShell({business,user,clientCount=0,memberCount=1,children}:AppShellProps){
  const pathname=usePathname();
  const searchRef=useRef<HTMLInputElement>(null);
  const [businesses,setBusinesses]=useState<WorkspaceBusiness[]>([business]);
  const [role,setRole]=useState<BusinessRole>("member");
  const [commandOpen,setCommandOpen]=useState(false);
  const [createOpen,setCreateOpen]=useState(false);
  const [query,setQuery]=useState("");
  const [collapsed,setCollapsed]=useState(false);
  const clientUsage=business.client_limit?Math.min(100,(clientCount/business.client_limit)*100):100;
  const trialDays=trialDaysRemaining(business);const trialExpired=isTrialExpired(business);const canManage=MANAGERS.includes(role);
  const visibleNav=useMemo(()=>NAV_ITEMS.filter(item=>!item.roles||item.roles.includes(role)),[role]);
  const visibleQuick=useMemo(()=>QUICK_ITEMS.filter(item=>!item.roles||item.roles.includes(role)),[role]);
  const commandItems=useMemo(()=>{
    const term=query.trim().toLocaleLowerCase("pt-BR");
    const items=[...visibleNav.map(item=>({...item,hint:"Ir para módulo"})),...visibleQuick];
    return term?items.filter(item=>`${item.label} ${item.hint}`.toLocaleLowerCase("pt-BR").includes(term)):items;
  },[query,visibleNav,visibleQuick]);

  useEffect(()=>{let active=true;async function loadShellContext(){const [businessResult,roleResult]=await Promise.all([neonClient.from("businesses").select("id,name,slug,plan,status,client_limit,user_limit,business_type,trial_ends_at,phone,email,document,address,timezone,opening_hours,public_booking_enabled,booking_notice").order("name",{ascending:true}),(neonClient as any).rpc("business_role",{p_business_id:business.id})]);if(!active)return;if(!businessResult.error&&Array.isArray(businessResult.data)&&businessResult.data.length)setBusinesses(businessResult.data as WorkspaceBusiness[]);if(!roleResult.error&&typeof roleResult.data==="string")setRole(roleResult.data as BusinessRole);}void loadShellContext();return()=>{active=false};},[business.id]);
  useEffect(()=>{const saved=window.localStorage.getItem("nassus_sidebar_collapsed");setCollapsed(saved==="1");const handler=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==="k"){event.preventDefault();setCommandOpen(value=>!value);}if(event.key==="Escape"){setCommandOpen(false);setCreateOpen(false);}};window.addEventListener("keydown",handler);return()=>window.removeEventListener("keydown",handler);},[]);
  useEffect(()=>{if(commandOpen)window.setTimeout(()=>searchRef.current?.focus(),20);else setQuery("");},[commandOpen]);

  async function signOut(){await neonClient.auth.signOut();window.localStorage.removeItem("nassus_active_business_id");window.location.replace("/sign-in");}
  function toggleSidebar(){setCollapsed(value=>{const next=!value;window.localStorage.setItem("nassus_sidebar_collapsed",next?"1":"0");return next;});}
  function BusinessSelect({compact=false}:{compact?:boolean}){if(businesses.length<=1)return compact?<div className="workspace-static"><strong>{business.name}</strong><small>{business.plan==="essential"?"Essencial":"Profissional"}</small></div>:<strong className="workspace-single">{business.name}</strong>;return <select className={compact?"business-switch compact":"business-switch"} value={business.id} onChange={e=>setActiveBusiness(e.target.value)} aria-label="Selecionar empresa">{businesses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>;}
  const mobileNav=visibleNav.filter(item=>["/","/clientes","/agenda","/financeiro","/orcamentos"].includes(item.href)).slice(0,5);
  const userLabel=user.name||user.email||"Usuário";const initials=userLabel.split(/\s+/).slice(0,2).map(part=>part[0]?.toUpperCase()).join("")||"U";

  return <div className={collapsed?"shell shell-collapsed":"shell"}>
    <aside className="sidebar">
      <div className="side-top">
        <Link className="side-brand" href="/" aria-label="Nassus Gestão — início"><div className="brand-mark">N</div><div className="brand-copy"><strong>Nassus</strong><small>GESTÃO</small></div></Link>
        <button className="sidebar-toggle" onClick={toggleSidebar} aria-label={collapsed?"Expandir menu":"Recolher menu"}><AppIcon name="menu" size={17}/></button>
      </div>
      <div className="business-chip"><span className="business-kicker">WORKSPACE</span><BusinessSelect/><small>{ROLE_LABEL[role]}</small></div>
      <nav className="nav" aria-label="Menu principal">{visibleNav.map(item=>{const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);return <Link key={item.href} className={active?"active":""} href={item.href} title={collapsed?item.label:undefined}><AppIcon name={item.icon}/><span>{item.label}</span>{active?<i className="nav-active-dot"/>:null}</Link>;})}</nav>
      <div className="side-bottom">
        <div className="plan-box"><div className="plan-line"><span>{business.plan==="essential"?"Essencial":"Profissional"}</span><b>{business.client_limit?`${clientCount}/${business.client_limit}`:"∞"}</b></div><div className="meter"><i style={{width:`${clientUsage}%`}}/></div><small>{business.client_limit?"clientes utilizados":"clientes ilimitados"} • {memberCount}/{business.user_limit} usuários</small>{business.plan==="essential"&&canManage?<Link className="side-upgrade" href="/assinatura">Fazer upgrade <AppIcon name="arrow" size={13}/></Link>:null}</div>
        <div className="side-user"><span className="avatar">{initials}</span><div><strong>{userLabel}</strong><small>{ROLE_LABEL[role]}</small></div><button type="button" onClick={signOut} aria-label="Sair"><AppIcon name="logout" size={17}/></button></div>
      </div>
    </aside>

    <div className="main">
      <header className="topbar">
        <div className="top-workspace"><BusinessSelect compact/></div>
        <button className="command-trigger" type="button" onClick={()=>setCommandOpen(true)}><AppIcon name="search" size={16}/><span>Buscar no Nassus Gestão</span><kbd>Ctrl K</kbd></button>
        <div className="top-actions">
          <div className="create-wrap"><button className="top-create" type="button" onClick={()=>setCreateOpen(value=>!value)}><AppIcon name="plus" size={16}/> <span>Novo</span></button>{createOpen?<div className="create-menu">{visibleQuick.map(item=><Link key={item.href+item.label} href={item.href} onClick={()=>setCreateOpen(false)}><span><AppIcon name={item.icon}/></span><div><strong>{item.label}</strong><small>{item.hint}</small></div></Link>)}</div>:null}</div>
          <button className="icon-button" type="button" onClick={()=>setCommandOpen(true)} aria-label="Abrir busca"><AppIcon name="command" size={17}/></button>
          <div className="top-avatar" title={userLabel}>{initials}</div>
        </div>
      </header>

      {business.status==="trial"?<div className={trialExpired?"trial-banner expired":"trial-banner"}><div><AppIcon name="bolt" size={15}/><strong>{trialExpired?"Teste encerrado":`Trial • ${trialDays ?? 0}d`}</strong><span>{trialExpired?"Leitura disponível. Ative um plano para voltar a alterar dados.":"Explore todos os recursos antes de escolher seu plano."}</span></div>{canManage?<Link href="/assinatura">{trialExpired?"Ativar plano":"Ver planos"}<AppIcon name="arrow" size={13}/></Link>:null}</div>:null}

      {children}

      <nav className="mobile-nav" aria-label="Navegação móvel">{mobileNav.map(item=>{const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);return <Link key={item.href} className={active?"active":""} href={item.href}><AppIcon name={item.icon} size={19}/><span>{item.label}</span></Link>;})}</nav>
    </div>

    {commandOpen?<div className="command-overlay" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setCommandOpen(false);}}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Busca e comandos"><div className="command-search"><AppIcon name="search"/><input ref={searchRef} value={query} onChange={event=>setQuery(event.target.value)} placeholder="Digite um módulo ou ação..."/><button onClick={()=>setCommandOpen(false)} aria-label="Fechar"><AppIcon name="close" size={16}/></button></div><div className="command-results">{commandItems.length?commandItems.map((item,index)=><Link key={`${item.href}-${index}`} href={item.href} onClick={()=>setCommandOpen(false)}><span className="command-icon"><AppIcon name={item.icon}/></span><div><strong>{item.label}</strong><small>{item.hint}</small></div><AppIcon name="chevron" size={15}/></Link>):<div className="command-empty">Nenhum comando encontrado.</div>}</div><footer><span><kbd>↵</kbd> abrir</span><span><kbd>Esc</kbd> fechar</span></footer></section></div>:null}
  </div>;
}
