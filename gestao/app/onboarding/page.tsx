"use client";

import { FormEvent, useEffect, useState } from "react";
import { neonClient } from "@/lib/neon";
import { getCurrentUser } from "@/lib/session";

function slugify(value:string){return value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48);}

export default function OnboardingPage(){
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{void getCurrentUser().then(u=>{if(!u?.email)window.location.replace("/sign-in");});},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setLoading(true);setError("");const data=new FormData(event.currentTarget);const name=String(data.get("name")||"").trim();const type=String(data.get("business_type")||"services");const document=String(data.get("document")||"").trim();const slug=`${slugify(name)}-${Math.random().toString(36).slice(2,7)}`;try{const result=await (neonClient as any).rpc("create_business",{p_name:name,p_slug:slug,p_business_type:type,p_document:document||null});if(result.error)throw result.error;window.location.replace("/");}catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível criar sua empresa.");}finally{setLoading(false);}}
  return <main className="onboarding-page"><section className="onboarding-card"><span className="eyebrow">PRIMEIROS PASSOS</span><h1>Configure sua empresa</h1><p>O workspace nasce no plano Essencial com 2 usuários e até 90 clientes.</p><form onSubmit={submit}><label>Nome da empresa<input name="name" minLength={2} required placeholder="Ex.: Clínica Bem Estar"/></label><label>Tipo de negócio<select name="business_type" defaultValue="services"><option value="services">Prestador de serviços</option><option value="clinic">Clínica / saúde</option><option value="beauty">Barbearia / salão / estética</option><option value="pet">Petshop / veterinária</option><option value="auto">Oficina / automotivo</option><option value="professional">Profissional liberal</option></select></label><label>CPF/CNPJ (opcional)<input name="document" placeholder="Documento da empresa"/></label>{error&&<p className="auth-error">{error}</p>}<button className="primary auth-submit" disabled={loading}>{loading?"Criando empresa...":"Entrar no Nassus Gestão"}</button></form></section></main>;
}
