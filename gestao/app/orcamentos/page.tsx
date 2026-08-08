"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { neonClient } from "@/lib/neon";
import { formatDate, formatMoney, friendlyWorkspaceError, requireWorkspace, type Workspace } from "@/lib/workspace";

type Client={id:string;name:string};
type Service={id:string;name:string;price:number|string;active:boolean};
type Quote={id:string;client_id:string|null;number:number;status:"draft"|"sent"|"approved"|"rejected"|"expired"|"converted";subtotal:number|string;discount:number|string;total:number|string;notes:string|null;valid_until:string|null;created_at:string};
type DraftItem={key:string;service_id:string|null;description:string;quantity:number;unit_price:number;total:number};

const STATUS_LABEL:Record<Quote["status"],string>={draft:"Rascunho",sent:"Enviado",approved:"Aprovado",rejected:"Recusado",expired:"Expirado",converted:"Convertido"};

export default function QuotesPage(){
  const [workspace,setWorkspace]=useState<Workspace|null>(null);
  const [clients,setClients]=useState<Client[]>([]);
  const [services,setServices]=useState<Service[]>([]);
  const [quotes,setQuotes]=useState<Quote[]>([]);
  const [memberCount,setMemberCount]=useState(1);
  const [clientId,setClientId]=useState("");
  const [serviceId,setServiceId]=useState("");
  const [description,setDescription]=useState("");
  const [quantity,setQuantity]=useState("1");
  const [unitPrice,setUnitPrice]=useState("");
  const [draftItems,setDraftItems]=useState<DraftItem[]>([]);
  const [discount,setDiscount]=useState("0");
  const [validUntil,setValidUntil]=useState("");
  const [notes,setNotes]=useState("");
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");

  useEffect(()=>{let active=true;async function load(){try{const current=await requireWorkspace();if(!current||!active)return;const [cq,sq,qq,mq]=await Promise.all([
    neonClient.from("clients").select("id,name").eq("business_id",current.business.id).eq("status","active").order("name",{ascending:true}),
    neonClient.from("services").select("id,name,price,active").eq("business_id",current.business.id).eq("active",true).order("name",{ascending:true}),
    neonClient.from("quotes").select("id,client_id,number,status,subtotal,discount,total,notes,valid_until,created_at").eq("business_id",current.business.id).order("created_at",{ascending:false}).limit(200),
    neonClient.from("business_members").select("id").eq("business_id",current.business.id).eq("active",true),
  ]);if(qq.error)throw qq.error;setWorkspace(current);setClients((Array.isArray(cq.data)?cq.data:[]) as Client[]);setServices((Array.isArray(sq.data)?sq.data:[]) as Service[]);setQuotes((Array.isArray(qq.data)?qq.data:[]) as Quote[]);setMemberCount(Array.isArray(mq.data)?mq.data.length:1);}catch(reason){setError(friendlyWorkspaceError(reason));}finally{if(active)setLoading(false);}}void load();return()=>{active=false};},[]);

  const clientMap=useMemo(()=>new Map(clients.map(c=>[c.id,c.name])),[clients]);
  const totalApproved=useMemo(()=>quotes.filter(q=>["approved","converted"].includes(q.status)).reduce((sum,q)=>sum+Number(q.total||0),0),[quotes]);
  const draftSubtotal=useMemo(()=>draftItems.reduce((sum,item)=>sum+item.total,0),[draftItems]);

  function chooseService(id:string){setServiceId(id);const service=services.find(item=>item.id===id);if(service){setDescription(service.name);setUnitPrice(String(service.price).replace(".",","));}else{setDescription("");setUnitPrice("");}}
  function currentItem():DraftItem|null{const text=description.trim();if(!text)return null;const qty=Math.max(0.01,Number(quantity.replace(",","."))||1);const price=Math.max(0,Number(unitPrice.replace(",","."))||0);return{key:crypto.randomUUID(),service_id:serviceId||null,description:text,quantity:qty,unit_price:price,total:qty*price};}
  function clearCurrentItem(){setServiceId("");setDescription("");setQuantity("1");setUnitPrice("");}
  function addItem(){setError("");const item=currentItem();if(!item){setError("Informe a descrição do item antes de adicionar.");return;}setDraftItems(prev=>[...prev,item]);clearCurrentItem();}
  function removeItem(key:string){setDraftItems(prev=>prev.filter(item=>item.key!==key));}

  async function createQuote(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!workspace||saving)return;setSaving(true);setError("");let createdId="";try{const pending=currentItem();const items=pending?[...draftItems,pending]:draftItems;if(!items.length)throw new Error("Adicione pelo menos um item ao orçamento.");const disc=Math.max(0,Number(discount.replace(",","."))||0);const subtotal=items.reduce((sum,item)=>sum+item.total,0);const total=Math.max(0,subtotal-disc);const quoteResult=await neonClient.from("quotes").insert({business_id:workspace.business.id,client_id:clientId||null,status:"draft",subtotal,discount:disc,total,notes:notes.trim()||null,valid_until:validUntil||null}).select("id,client_id,number,status,subtotal,discount,total,notes,valid_until,created_at").single();if(quoteResult.error)throw quoteResult.error;const quote=quoteResult.data as Quote;createdId=quote.id;const payload=items.map(item=>({quote_id:quote.id,service_id:item.service_id,description:item.description,quantity:item.quantity,unit_price:item.unit_price,total:item.total}));const itemResult=await neonClient.from("quote_items").insert(payload);if(itemResult.error)throw itemResult.error;setQuotes(prev=>[quote,...prev]);setClientId("");setDraftItems([]);clearCurrentItem();setDiscount("0");setValidUntil("");setNotes("");}catch(reason){if(createdId)await neonClient.from("quotes").delete().eq("id",createdId);setError(friendlyWorkspaceError(reason));}finally{setSaving(false);}}

  async function setStatus(quote:Quote,status:Quote["status"]){if(!workspace)return;const result=await neonClient.from("quotes").update({status}).eq("id",quote.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setQuotes(prev=>prev.map(item=>item.id===quote.id?{...item,status}:item));}
  async function remove(quote:Quote){if(!workspace||!window.confirm(`Excluir orçamento #${quote.number}?`))return;const result=await neonClient.from("quotes").delete().eq("id",quote.id).eq("business_id",workspace.business.id);if(result.error){setError(friendlyWorkspaceError(result.error));return;}setQuotes(prev=>prev.filter(item=>item.id!==quote.id));}

  if(loading)return <main className="loading"><div className="brand-mark">N</div><h1>Orçamentos</h1><p>Carregando propostas...</p></main>;
  if(!workspace)return <main className="loading"><h1>Não foi possível abrir</h1><p>{error}</p></main>;

  return <AppShell business={workspace.business} user={workspace.user} clientCount={clients.length} memberCount={memberCount}><main className="module-content">
    <div className="module-head"><div><span className="eyebrow">COMERCIAL</span><h1>Orçamentos</h1><p>Monte propostas com vários itens e acompanhe aprovação.</p></div></div>
    {error?<div className="notice error">{error}</div>:null}
    <section className="summary-row"><article className="summary-card"><span>Total</span><strong>{quotes.length}</strong><small>Orçamentos criados</small></article><article className="summary-card"><span>Aguardando</span><strong>{quotes.filter(q=>["draft","sent"].includes(q.status)).length}</strong><small>Rascunhos e enviados</small></article><article className="summary-card"><span>Aprovados</span><strong>{quotes.filter(q=>["approved","converted"].includes(q.status)).length}</strong><small>Negócios ganhos</small></article><article className="summary-card"><span>Valor aprovado</span><strong>{formatMoney(totalApproved)}</strong><small>Potencial convertido</small></article></section>
    <div className="module-grid"><section className="panel"><div className="panel-head"><div><span className="eyebrow">PROPOSTAS</span><h2>Histórico de orçamentos</h2></div></div>{quotes.length?<div className="table-wrap"><table><thead><tr><th>Nº</th><th>Cliente</th><th>Validade</th><th>Total</th><th>Status</th><th className="right">Ações</th></tr></thead><tbody>{quotes.map(q=><tr key={q.id}><td><strong>#{q.number}</strong></td><td>{q.client_id?clientMap.get(q.client_id)||"Cliente":"Sem cliente"}</td><td>{formatDate(q.valid_until)}</td><td className="quote-total">{formatMoney(q.total)}</td><td><span className={`badge ${["approved","converted"].includes(q.status)?"green":q.status==="rejected"?"red":q.status==="sent"?"blue":"orange"}`}>{STATUS_LABEL[q.status]}</span></td><td><div className="table-actions" style={{justifyContent:"flex-end"}}>{q.status==="draft"?<button className="mini-button" onClick={()=>void setStatus(q,"sent")}>Marcar enviado</button>:null}{["draft","sent"].includes(q.status)?<button className="mini-button ok" onClick={()=>void setStatus(q,"approved")}>Aprovar</button>:null}{["draft","sent"].includes(q.status)?<button className="mini-button cancel" onClick={()=>void setStatus(q,"rejected")}>Recusar</button>:null}<button className="danger" onClick={()=>void remove(q)}>Excluir</button></div></td></tr>)}</tbody></table></div>:<div className="empty-state"><strong>Nenhum orçamento</strong><p>Crie uma proposta para começar a acompanhar seu funil comercial.</p></div>}</section>
      <aside className="form-panel"><span className="eyebrow">NOVO ORÇAMENTO</span><h2>Montar proposta</h2><p>Adicione quantos serviços ou itens forem necessários antes de gerar o orçamento.</p><form onSubmit={createQuote}><div className="form-grid"><div className="field full"><label>Cliente</label><select value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Sem cliente definido</option>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div className="field full"><label>Usar serviço</label><select value={serviceId} onChange={e=>chooseService(e.target.value)}><option value="">Item personalizado</option>{services.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div className="field full"><label>Descrição do item</label><input value={description} onChange={e=>setDescription(e.target.value)} placeholder="Serviço ou item do orçamento"/></div><div className="field"><label>Quantidade</label><input inputMode="decimal" value={quantity} onChange={e=>setQuantity(e.target.value)}/></div><div className="field"><label>Valor unitário</label><input inputMode="decimal" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} placeholder="0,00"/></div></div><div className="form-actions"><button type="button" className="secondary" onClick={addItem}>+ Adicionar item</button></div>{draftItems.length?<div className="quote-items-draft">{draftItems.map((item,index)=><div className="quote-draft-row" key={item.key}><div><strong>{index+1}. {item.description}</strong><small>{item.quantity} × {formatMoney(item.unit_price)}</small></div><div><strong>{formatMoney(item.total)}</strong><button type="button" className="link-button" onClick={()=>removeItem(item.key)}>remover</button></div></div>)}<div className="quote-draft-total"><span>Subtotal dos itens</span><strong>{formatMoney(draftSubtotal)}</strong></div></div>:null}<div className="form-grid" style={{marginTop:15}}><div className="field"><label>Desconto R$</label><input inputMode="decimal" value={discount} onChange={e=>setDiscount(e.target.value)}/></div><div className="field"><label>Validade</label><input type="date" value={validUntil} onChange={e=>setValidUntil(e.target.value)}/></div><div className="field full"><label>Observações</label><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Condições, prazo, forma de pagamento..."/></div></div><div className="form-actions"><button className="primary" disabled={saving||(!draftItems.length&&!description.trim())}>{saving?"Criando...":"Criar orçamento"}</button></div></form></aside>
    </div>
  </main></AppShell>;
}
