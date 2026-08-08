"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { neonClient } from "@/lib/neon";
import { getCurrentUser } from "@/lib/session";

export default function SignInPage(){
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  useEffect(()=>{void getCurrentUser().then(u=>{if(u?.email)window.location.replace("/");}).catch(()=>{});},[]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setLoading(true);setError("");const data=new FormData(event.currentTarget);const email=String(data.get("email")||"").trim();const password=String(data.get("password")||"");try{const result=await neonClient.auth.signIn.email({email,password});if(result.error)throw result.error;window.location.replace("/");}catch(reason){setError(reason instanceof Error?reason.message:"E-mail ou senha incorretos.");}finally{setLoading(false);}}
  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>BUSINESS OS</small></div></div><div className="auth-copy"><span className="eyebrow">GESTÃO PROFISSIONAL</span><h1>Sua empresa organizada em um só lugar.</h1><p>Clientes, agenda, serviços, financeiro, orçamentos e equipe em uma plataforma multiempresa segura.</p></div></section><section className="auth-side"><div className="auth-card"><span className="eyebrow">ACESSO</span><h2>Bem-vindo</h2><p>Entre para acessar o painel da sua empresa.</p><form onSubmit={submit}><label>E-mail<input name="email" type="email" autoComplete="email" required placeholder="voce@empresa.com"/></label><label>Senha<input name="password" type="password" minLength={8} autoComplete="current-password" required placeholder="Mínimo de 8 caracteres"/></label>{error&&<p className="auth-error">{error}</p>}<button className="primary auth-submit" disabled={loading}>{loading?"Entrando...":"Entrar"}</button></form><p className="auth-switch">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p></div></section></main>;
}
