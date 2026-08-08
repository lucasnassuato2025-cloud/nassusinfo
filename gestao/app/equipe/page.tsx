"use client";

import { FormEvent, useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { friendlyWorkspaceError, requireWorkspace, type Workspace } from "@/lib/workspace";

type Member={member_id:string;user_id:string;name:string|null;email:string;role:"owner"|"admin"|"member";active:boolean;created_at:string};

export default function TeamPage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [members,setMembers]=useState<Member[]>([]);
  const [clientCount,setClientCount]=useState(0);
  const [email,setEmail]=useState("");
  const [role,setRole]=useState<"admin"|"member">("member");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");

  async function loadMembers(businessId:string){const result=await (neonClient as any).rpc("list_business_members",{p_business_id:businessId});if(result.error)throw result.error;setMembers((Array.isArray(result.data)?result.data:[]) as Member[]);}
  useEffect(()=>{let active=true;async function load(){try{const current=await requireWorkspace();if(!current||!active)return;const cq=await neonClient.from("clients").select("id").eq("business_id",current.business.id);setWorkspace(current);setClientCount(Array.isArray(cq.data)?cq.data.length:0);await loadMembers(current.business.id);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{if(active)setLoading(false);}}void load();return()=>{active=false};},[]);

  async function addMember(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!workspace||saving)return;setSaving(true);setError("");setSuccess("");try{const result=await (neonClient as any).rpc("add_business_member_by_email",{p_business_id:workspace.business.id,p_email:email.trim(),p_role:role});if(result.error)throw result.error;await loadMembers(workspace.business.id);setEmail("");setRole("member");setSuccess("Usuário adicionado à empresa.");}catch(reason){setError(friendlyWorkspaceError(reason));}finally{setSaving(false);}}
  async function deactivate(member:Member){if(!workspace||!window.confirm(`Desativar o acesso de ${member.name||member.email}?`))return;const result=await (neonClient as any).rpc("deactivate_business_member",{p_business_id:workspace.business.id,p_member_id:member.member_id});if(result.error){setError(friendlyWorkspaceError(result.error));return;}await loadMembers(workspace.business.id);}

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Equipe</h1><p>Carregando acessos...</p></main>;
  if(!workspace)return <main className="loading"><h1>Não foi possível abrir</h1><p>{error}</p></main>;
  const activeCount=members.filter(m=>m.active).length;
  const remaining=Math.max(0,workspace.business.user_limit-activeCount);

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clientCount} memberCount={activeCount}><main className="module-content">
    <div className="module-head"><div><span className="eyebrow">ACESSOS E PERMISSÕES</span><h1>Equipe</h1><p>Controle quem pode acessar a empresa no Nassus Gestão.</p></div></div>
    <div className="quota-banner"><div><span>{workspace.business.plan==="essential"?"PLANO ESSENCIAL":"PLANO PROFISSIONAL"}</span><strong>{activeCount} de {workspace.business.user_limit} usuários ativos</strong><p>{remaining?`${remaining} acesso${remaining>1?"s":""} disponível${remaining>1?"is":""}.`:"Limite do plano atingido."}</p></div>{workspace.business.plan==="essential"?<a className="primary" href="/assinatura">Liberar até 10 usuários</a>:null}</div>
    {error?<div className="notice error">{error}</div>:null}{success?<div className="notice success">{success}</div>:null}
    <div className="module-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">USUÁRIOS</span><h2>Pessoas com acesso</h2></div></div><div className="team-list">{members.map(member=><article className="team-card" key={member.member_id}><div className="team-person"><div className="team-avatar">{(member.name||member.email).slice(0,1).toUpperCase()}</div><div><strong>{member.name||"Usuário"}</strong><small>{member.email}</small></div></div><div className="table-actions"><span className={`badge ${member.active?"green":"red"}`}>{member.active?"Ativo":"Inativo"}</span><span className="badge blue">{member.role==="owner"?"Proprietário":member.role==="admin"?"Administrador":"Equipe"}</span>{member.role!=="owner"&&member.active?<button className="danger" onClick={()=>void deactivate(member)}>Desativar</button>:null}</div></article>)}</div></section>
      <aside className="form-panel"><span className="eyebrow">NOVO ACESSO</span><h2>Adicionar usuário</h2><p>A pessoa precisa criar uma conta no Nassus Gestão com esse mesmo e-mail antes de ser adicionada.</p><form onSubmit={addMember}><div className="form-grid"><div className="field full"><label>E-mail *</label><input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="funcionario@email.com"/></div><div className="field full"><label>Perfil</label><select value={role} onChange={e=>setRole(e.target.value as "admin"|"member")}><option value="member">Equipe — acesso operacional</option><option value="admin">Administrador — gestão completa</option></select></div></div><div className="notice" style={{marginTop:15}}>O banco bloqueia automaticamente a inclusão quando a empresa atinge o limite de usuários do plano.</div><div className="form-actions"><button className="primary" disabled={saving||remaining===0}>{saving?"Adicionando...":remaining===0?"Limite atingido":"Adicionar usuário"}</button></div></form></aside>
    </div>
  </main></AppShell>;
}
