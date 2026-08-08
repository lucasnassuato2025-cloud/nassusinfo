"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { neonClient } from "@/lib/neon";

export default function CadastroPage(){
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setLoading(true);setError("");const data=new FormData(event.currentTarget);const name=String(data.get("name")||"").trim();const email=String(data.get("email")||"").trim();const password=String(data.get("password")||"");try{const result=await neonClient.auth.signUp.email({name,email,password});if(result.error)throw result.error;window.location.replace("/onboarding");}catch(reason){setError(reason instanceof Error?reason.message:"Não foi possível criar sua conta.");}finally{setLoading(false);}}
  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>COMECE AGORA</small></div></div><div className="auth-copy"><span className="eyebrow">7 DIAS PARA CONHECER</span><h1>Crie sua conta e cadastre sua empresa.</h1><p>Você começa no Essencial: 2 usuários e até 90 clientes. Quando crescer, migra para o Profissional sem perder dados.</p></div></section><section className="auth-side"><div className="auth-card"><span className="eyebrow">CADASTRO</span><h2>Criar minha conta</h2><p>Use seus dados para iniciar o workspace.</p><form onSubmit={submit}><label>Seu nome<input name="name" minLength={2} required autoComplete="name" placeholder="Seu nome"/></label><label>E-mail<input name="email" type="email" required autoComplete="email" placeholder="voce@empresa.com"/></label><label>Senha<input name="password" type="password" minLength={8} required autoComplete="new-password" placeholder="Mínimo de 8 caracteres"/></label>{error&&<p className="auth-error">{error}</p>}<button className="primary auth-submit" disabled={loading}>{loading?"Criando conta...":"Criar conta"}</button></form><p className="auth-switch">Já tem conta? <Link href="/sign-in">Entrar</Link></p></div></section></main>;
}
