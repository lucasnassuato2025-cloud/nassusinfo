"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { formatDate, formatMoney, friendlyWorkspaceError, requireWorkspace, type Workspace } from "@/lib/workspace";

type Entry={id:string;client_id:string|null;type:"income"|"expense";category:string|null;description:string;amount:number|string;due_date:string|null;paid_at:string|null;payment_method:string|null;created_at:string};
type Client={id:string;name:string};

export default function FinancePage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [entries,setEntries]=useState<Entry[]>([]);
  const [clients,setClients]=useState<Client[]>([]);
  const [memberCount,setMemberCount]=useState(1);
  const [type,setType]=useState<Entry["type"]>("income");
  const [description,setDescription]=useState("");
  const [amount,setAmount]=useState("");
  const [dueDate,setDueDate]=useState("");
  const [category,setCategory]=useState("");
  const [clientId,setClientId]=useState("");
  const [method,setMethod]=useState("");
  const [paid,setPaid]=useState(false);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{let active=true;async function load(){try{const current=await requireWorkspace();if(!current||!active)return;const [eq,cq,mq]=await Promise.all([
    neonClient.from("financial_entries").select("id,client_id,type,category,description,amount,due_date,paid_at,payment_method,created_at").eq("business_id",current.business.id).order("created_at",{ascending:false}).limit(500),
    neonClient.from("clients").select("id,name").eq("business_id",current.business.id).order("name",{ascending:true}),
    neonClient.from("business_members").select("id").eq("business_id",current.business.id).eq("active",true),
  ]);if(eq.error)throw eq.error;setWorkspace(current);setEntries((Array.isArray(eq.data)?eq.data:[]) as Entry[]);setClients((Array.isArray(cq.data)?cq.data:[]) as Client[]);setMemberCount(Array.isArray(mq.data)?mq.data.length:1);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{if(active)setLoading(false);}}void load();return()=>{active=false};},[]);

  const totals=useMemo(()=>entries.reduce((acc,e)=>{const v=Number(e.amount||0);if(e.type==="income"){if(e.paid_at)acc.received+=v;else acc.receivable+=v}else{if(e.paid_at)acc.paid+=v;else acc.payable+=v}return acc;},{received:0,receivable:0,paid:0,payable:0}),[entries]);
  const clientMap=useMemo(()=>new Map(clients.map(c=>[c.id,c.name])),[clients]);

  async function createEntry(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!workspace||saving)return;setSaving(true);setError("");try{const parsed=Number(amount.replace(",","."));if(!Number.isFinite(parsed)||parsed<0)throw new Error("Informe um valor válido.");const result=await neonClient.from("financial_entries").insert({business_id:workspace.business.id,client_id:clientId||null,type,category:category.trim()||null,description:description.trim(),amount:parsed,due_date:dueDate||null,paid_at:paid?new Date().toISOString():null,payment_method:method.trim()||null}).select("id,client_id,type,category,description,amount,due_date,paid_at,payment_method,created_at").single();if(result.error)throw result.error;if(result.data)setEntries(prev=>[result.data as Entry,...prev]);setDescription("");setAmount("");setDueDate("");setCategory("");setClientId("");setMethod("");setPaid(false);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{setSaving(false);}}
  async function togglePaid(entry:Entry){if(!workspace)return;const paid_at=entry.paid_at?null:new Date().toISOString();const result=await neonClient.from("financial_entries").update({paid_at}).eq("id",entry.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setEntries(prev=>prev.map(item=>item.id===entry.id?{...item,paid_at}:item));}
  async function remove(entry:Entry){if(!workspace||!window.confirm(`Excluir lançamento "${entry.description}"?`))return;const result=await neonClient.from("financial_entries").delete().eq("id",entry.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setEntries(prev=>prev.filter(item=>item.id!==entry.id));}

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Financeiro</h1><p>Carregando movimentos...</p></main>;
  if(!workspace)return <main className="loading"><h1>Não foi possível abrir</h1><p>{error}</p></main>;

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clients.length} memberCount={memberCount}><main className="module-content">
    <div className="module-head"><div><span className="eyebrow">CONTROLE FINANCEIRO</span><h1>Financeiro</h1><p>Receitas, despesas, vencimentos e recebimentos da empresa.</p></div></div>
    {error?<div className="notice error">{error}</div>:null}
    <section className="summary-row"><article className="summary-card"><span>Recebido</span><strong className="finance-positive">{formatMoney(totals.received)}</strong><small>Entradas já pagas</small></article><article className="summary-card"><span>A receber</span><strong>{formatMoney(totals.receivable)}</strong><small>Receitas pendentes</small></article><article className="summary-card"><span>Despesas pagas</span><strong className="finance-negative">{formatMoney(totals.paid)}</strong><small>Saídas concluídas</small></article><article className="summary-card"><span>Saldo realizado</span><strong>{formatMoney(totals.received-totals.paid)}</strong><small>Recebido menos pago</small></article></section>
    <div className="module-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">MOVIMENTAÇÕES</span><h2>Lançamentos recentes</h2></div></div>{entries.length?<div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Tipo</th><th>Vencimento</th><th>Valor</th><th>Situação</th><th className="right">Ações</th></tr></thead><tbody>{entries.map(entry=><tr key={entry.id}><td><strong>{entry.description}</strong><br/><small className="muted">{entry.client_id?clientMap.get(entry.client_id)||"Cliente":"Sem cliente"}{entry.category?` • ${entry.category}`:""}</small></td><td><span className={`badge ${entry.type==="income"?"green":"red"}`}>{entry.type==="income"?"Receita":"Despesa"}</span></td><td>{formatDate(entry.due_date)}</td><td className={entry.type==="income"?"finance-positive":"finance-negative"}><strong>{entry.type==="expense"?"− ":"+ "}{formatMoney(entry.amount)}</strong></td><td><span className={`badge ${entry.paid_at?"green":"orange"}`}>{entry.paid_at?"Pago":"Pendente"}</span></td><td><div className="table-actions" style={{justifyContent:"flex-end"}}><button className="mini-button" onClick={()=>void togglePaid(entry)}>{entry.paid_at?"Reabrir":"Marcar pago"}</button><button className="danger" onClick={()=>void remove(entry)}>Excluir</button></div></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Nenhum lançamento</strong><p>Comece registrando uma receita ou despesa.</p></div>}</section>
      <aside className="form-panel"><span className="eyebrow">NOVO LANÇAMENTO</span><h2>Registrar movimentação</h2><p>Use receitas para cobranças e despesas para custos da empresa.</p><form onSubmit={createEntry}><div className="form-grid"><div className="field"><label>Tipo *</label><select value={type} onChange={e=>setType(e.target.value as Entry["type"])}><option value="income">Receita</option><option value="expense">Despesa</option></select></div><div className="field"><label>Valor *</label><input required inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0,00"/></div><div className="field full"><label>Descrição *</label><input required value={description} onChange={e=>setDescription(e.target.value)} placeholder="Ex.: Consulta, aluguel, fornecedor..."/></div><div className="field"><label>Categoria</label><input value={category} onChange={e=>setCategory(e.target.value)} placeholder="Ex.: Serviços"/></div><div className="field"><label>Vencimento</label><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></div><div className="field full"><label>Cliente</label><select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Sem cliente</option>{clients.map(client=><option key={client.id} value={client.id}>{client.name}</option>)}</select></div><div className="field full"><label>Forma de pagamento</label><input value={method} onChange={e=>setMethod(e.target.value)} placeholder="Pix, cartão, dinheiro..."/></div><div className="field full"><label style={{display:"flex",alignItems:"center",gap:8,textTransform:"none"}}><input type="checkbox" checked={paid} onChange={e=>setPaid(e.target.checked)} style={{width:16,minHeight:16}}/> Já foi pago/recebido</label></div></div><div className="form-actions"><button className="primary" disabled={saving}>{saving?"Salvando...":"Registrar lançamento"}</button></div></form></aside>
    </div>
  </main></AppShell>;
}
