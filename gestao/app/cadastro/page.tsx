"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { friendlyAuthError } from "@/lib/auth-errors";
import { neonClient } from "@/lib/neon";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordValidationError } from "@/lib/password";

export default function CadastroPage(){
  const [loading,setLoading]=useState(false);const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(loading)return;
    setLoading(true);setError("");
    const data=new FormData(event.currentTarget);
    const name=String(data.get("name")||"").trim().replace(/\s+/g," ");
    const email=String(data.get("email")||"").trim().toLocaleLowerCase("pt-BR");
    const password=String(data.get("password")||"");
    try{
      if(name.length<2||name.length>120)throw new Error("Informe seu nome com 2 a 120 caracteres.");
      const passwordError=passwordValidationError(password);if(passwordError)throw new Error(passwordError);
      const result=await neonClient.auth.signUp.email({name,email,password});
      if(result.error)throw result.error;
      window.location.replace("/onboarding");
    }catch(reason){setError(friendlyAuthError(reason,"signup"));}
    finally{setLoading(false);}
  }
  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>COMECE AGORA</small></div></div><div className="auth-copy"><span className="eyebrow">7 DIAS PARA CONHECER</span><h1>Crie sua conta e cadastre sua empresa.</h1><p>Você começa no Essencial: 2 usuários e até 90 clientes. Quando crescer, migra para o Profissional sem perder dados.</p></div></section><section className="auth-side"><div className="auth-card"><span className="eyebrow">CADASTRO</span><h2>Criar minha conta</h2><p>Use seus dados para iniciar o workspace.</p><form onSubmit={submit}><label>Seu nome<input name="name" minLength={2} maxLength={120} required autoComplete="name" placeholder="Seu nome"/></label><label>E-mail<input name="email" type="email" maxLength={160} required autoComplete="email" inputMode="email" placeholder="voce@empresa.com"/></label><label>Senha<input name="password" type="password" minLength={PASSWORD_MIN_LENGTH} required autoComplete="new-password" placeholder="Crie uma senha forte"/></label><small className="muted" style={{display:"block",marginTop:-6}}>{PASSWORD_HINT}</small>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary auth-submit" disabled={loading}>{loading?"Criando conta...":"Criar conta"}</button></form><p className="auth-switch">Já tem conta? <Link href="/sign-in">Entrar</Link></p></div></section></main>;
}
