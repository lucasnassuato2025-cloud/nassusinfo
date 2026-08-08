"use client";

import { FormEvent, useState } from "react";

import { claimWorkspaceWithRetry } from "@/lib/auth-session";
import { neonClient } from "@/lib/neon";
import styles from "./governance-center.module.css";

type Row = Record<string, any>;

export function PrivacyExecutionPanel({ canManage }: { canManage: boolean }) {
  const [query,setQuery]=useState("");
  const [items,setItems]=useState<Row[]>([]);
  const [busy,setBusy]=useState("");
  const [message,setMessage]=useState("");

  if(!canManage) return null;

  async function search(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy("search");setMessage("");
    try{await claimWorkspaceWithRetry();const result=await(neonClient as any).rpc("crm_data_subject_inventory",{p_query:query});if(result.error)throw result.error;setItems(Array.isArray(result.data)?result.data:[]);}catch(reason){setMessage(reason instanceof Error?reason.message:"Não foi possível pesquisar o titular.");}finally{setBusy("");}
  }

  async function anonymize(item:Row){
    if(Number(item.documents_count||0)>0){setMessage("Anonimização automática bloqueada porque existem documentos comerciais. Registre uma solicitação LGPD para revisão.");return;}
    const expected=`ANONIMIZAR ${item.client_id}`;
    const typed=window.prompt(`Esta ação remove dados pessoais do cadastro e não pode ser desfeita. Digite exatamente: ${expected}`);
    if(typed!==expected){if(typed!==null)setMessage("Confirmação incorreta. Nenhuma alteração foi feita.");return;}
    setBusy(`anon:${item.client_id}`);setMessage("");
    try{await claimWorkspaceWithRetry();const result=await(neonClient as any).rpc("crm_anonymize_data_subject",{p_client_id:Number(item.client_id)});if(result.error)throw result.error;setMessage("Dados pessoais anonimizados. A ação foi registrada na auditoria.");setItems(current=>current.filter(row=>row.client_id!==item.client_id));}catch(reason){setMessage(reason instanceof Error?reason.message:"Não foi possível anonimizar o titular.");}finally{setBusy("");}
  }

  return <article className={styles.wide} style={{marginTop:12}}><h3>Execução LGPD controlada</h3><p>A anonimização automática só é liberada para cadastro sem documento comercial vinculado. Contratos e evidências nunca são alterados por esta ação.</p><form onSubmit={search} className={styles.search}><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Pesquisar titular para anonimização"/><button type="submit" disabled={busy==="search"}>Verificar elegibilidade</button></form>{message&&<div className={styles.notice}>{message}</div>}{items.length>0&&<div className={styles.list}>{items.map(item=><div className={styles.listRow} key={item.client_id}><div><strong>{item.display_name}</strong><small>{item.masked_document||"sem documento"} · {item.documents_count} documento(s) · {item.signed_documents_count} assinado(s)</small></div><button type="button" className={Number(item.documents_count||0)>0?styles.danger:""} disabled={Number(item.documents_count||0)>0||busy===`anon:${item.client_id}`} onClick={()=>void anonymize(item)}>{Number(item.documents_count||0)>0?"Revisão obrigatória":"Anonimizar"}</button></div>)}</div>}</article>;
}
