"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { neonClient } from "@/lib/neon";
import type { SessionUser } from "@/lib/session";
import { isTrialExpired, setActiveBusiness, trialDaysRemaining, type BusinessRole, type WorkspaceBusiness } from "@/lib/workspace";

type AppShellProps={business:WorkspaceBusiness;user:SessionUser;clientCount?:number;memberCount?:number;children:ReactNode};
type NavItem={href:string;icon:string;label:string;roles?:BusinessRole[]};
const MANAGERS:BusinessRole[]=["owner","admin"];
const FINANCE:BusinessRole[]=["owner","admin","finance"];
const OPERATIONS:BusinessRole[]=["owner","admin","member","reception","professional"];
const COMMERCIAL:BusinessRole[]=["owner","admin","member","reception"];
const NAV_ITEMS:NavItem[]=[
  {href:"/",icon:"▣",label:"Dashboard"},
  {href:"/clientes",icon:"👥",label:"Clientes",roles:OPERATIONS},
  {href:"/agenda",icon:"▦",label:"Agenda",roles:OPERATIONS},
  {href:"/servicos",icon:"🛠",label:"Serviços",roles:OPERATIONS},
  {href:"/financeiro",icon:"R$",label:"Financeiro",roles:FINANCE},
  {href:"/orcamentos",icon:"▤",label:"Orçamentos",roles:COMMERCIAL},
  {href:"/equipe",icon:"◉",label:"Equipe",roles:MANAGERS},
  {href:"/relatorios",icon:"↗",label:"Relatórios",roles:FINANCE},
  {href:"/assinatura",icon:"◆",label:"Assinatura",roles:MANAGERS},
  {href:"/configuracoes",icon:"⚙",label:"Configurações",roles:MANAGERS},
];
const ROLE_LABEL:Record<BusinessRole,string>={owner:"Proprietário",admin:"Administrador",member:"Equipe",reception:"Recepção",professional:"Profissional",finance:"Financeiro"};

export default function AppShell({business,user,clientCount=0,memberCount=1,children}:AppShellProps){
  const pathname=usePathname();const [businesses,setBusinesses]=useState<WorkspaceBusiness[]>([business]);const [role,setRole]=useState<BusinessRole>("member");
  const clientUsage=business.client_limit?Math.min(100,(clientCount/business.client_limit)*100):100;const userUsage=Math.min(100,(memberCount/business.user_limit)*100);const trialDays=trialDaysRemaining(business);const trialExpired=isTrialExpired(business);const canManage=MANAGERS.includes(role);const visibleNav=useMemo(()=>NAV_ITEMS.filter(item=>!item.roles||item.roles.includes(role)),[role]);
  useEffect(()=>{let active=true;async function loadShellContext(){const [businessResult,roleResult]=await Promise.all([neonClient.from("businesses").select("id,name,slug,plan,status,client_limit,user_limit,business_type,trial_ends_at,phone,email,document,address,timezone,opening_hours,public_booking_enabled,booking_notice").order("name",{ascending:true}),(neonClient as any).rpc("business_role",{p_business_id:business.id})]);if(!active)return;if(!businessResult.error&&Array.isArray(businessResult.data)&&businessResult.data.length)setBusinesses(businessResult.data as WorkspaceBusiness[]);if(!roleResult.error&&typeof roleResult.data==="string")setRole(roleResult.data as BusinessRole);}void loadShellContext();return()=>{active=false};},[business.id]);
  async function signOut(){await neonClient.auth.signOut();window.localStorage.removeItem("nassus_active_business_id");window.location.replace("/sign-in");}
  function BusinessSelect({compact=false}:{compact?:boolean}){if(businesses.length<=1)return compact?null:<strong>{business.name}</strong>;return <select className={compact?"business-switch compact":"business-switch"} value={business.id} onChange={e=>setActiveBusiness(e.target.value)} aria-label="Selecionar empresa">{businesses.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select>;}
  return <div className="shell"><aside className="sidebar"><a className="side-brand" href="/" aria-label="Nassus Gestão — início"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>BUSINESS OS</small></div></a><div className="business-chip"><span>Empresa atual</span><BusinessSelect/></div><nav className="nav" aria-label="Menu principal">{visibleNav.map(item=>{const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);return <a key={item.href} className={active?"active":""} href={item.href}><b>{item.icon}</b><span>{item.label}</span></a>;})}</nav><div className="plan-box"><span>{business.plan==="essential"?"Plano Essencial":"Plano Profissional"}</span><strong>{business.client_limit?`${clientCount} / ${business.client_limit} clientes`:`${clientCount} clientes • ilimitado`}</strong><div className="meter"><i style={{width:`${clientUsage}%`}}/></div><small>{memberCount}/{business.user_limit} usuários • {Math.round(userUsage)}% da capacidade</small><small className="role-label">Perfil: {ROLE_LABEL[role]}</small>{business.plan==="essential"&&canManage?<a className="side-upgrade" href="/assinatura">Conhecer Profissional →</a>:null}</div></aside><div className="main"><header className="topbar"><div className="top-business"><strong>{business.name}</strong><small>{business.plan==="essential"?"Essencial • 2 usuários • 90 clientes":"Profissional • 10 usuários • clientes ilimitados"}</small></div><BusinessSelect compact/><div className="top-actions">{canManage?<a className="top-help" href="/configuracoes">Ajuda e configurações</a>:null}<div className="top-user"><span>{(user.name||user.email||"U").slice(0,1).toUpperCase()}</span><div><strong>{user.name||user.email}</strong><button type="button" onClick={signOut}>Sair</button></div></div></div></header>{business.status==="trial"?<div className={trialExpired?"trial-banner expired":"trial-banner"}>{trialExpired?<><strong>Seu período de teste terminou.</strong><span>Os dados continuam disponíveis para consulta, mas novas alterações estão bloqueadas.</span>{canManage?<a href="/assinatura">Escolher plano →</a>:null}</>:<><strong>Período de teste</strong><span>{trialDays===1?"Último dia para testar todos os recursos.":`${trialDays} dias restantes para testar o Nassus Gestão.`}</span>{canManage?<a href="/assinatura">Ver planos →</a>:null}</>}</div>:null}<div className="mobile-nav" aria-label="Navegação móvel">{visibleNav.slice(0,6).map(item=>{const active=item.href==="/"?pathname==="/":pathname.startsWith(item.href);return <a key={item.href} className={active?"active":""} href={item.href}><b>{item.icon}</b><span>{item.label}</span></a>;})}</div>{children}</div></div>;
}
