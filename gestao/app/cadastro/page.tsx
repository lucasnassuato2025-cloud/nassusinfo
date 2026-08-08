"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { friendlyAuthError } from "@/lib/auth-errors";
import { neonClient } from "@/lib/neon";
import { PASSWORD_HINT, PASSWORD_MIN_LENGTH, passwordValidationError } from "@/lib/password";
import { waitForWorkspaceReady } from "@/lib/workspace";

export default function CadastroPage(){
  const [loading,setLoading]=useState(false);const [stage,setStage]=useState<"idle"|"auth"|"sync">("idle");const [error,setError]=useState("");
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(loading)return;setLoading(true);setStage("auth");setError("");
    const data=new FormData(event.currentTarget);const name=String(data.get("name")||"").trim().replace(/\s+/g," ");const email=String(data.get("email")||"").trim().toLocaleLowerCase("pt-BR");const password=String(data.get("password")||"");
    try{
      if(name.length<2||name.length>120)throw new Error("Informe seu nome com 2 a 120 caracteres.");
      const passwordError=passwordValidationError(password);if(passwordError)throw new Error(passwordError);
      const result=await neonClient.auth.signUp.email({name,email,password});if(result.error)throw result.error;
      setStage("sync");
      const workspace=await waitForWorkspaceReady();if(!workspace)throw new Error("SESSION_SYNC_TIMEOUT");
      window.location.replace(workspace.business?"/":"/onboarding");
    }catch(reason){setStage("idle");setError(friendlyAuthError(reason,"signup"));}
    finally{setLoading(false);}
  }
  const buttonLabel=stage==="auth"?"Criando acesso...":stage==="sync"?"Preparando seu workspace...":"Criar conta";
  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>COMECE AGORA</small></div></div><div className="auth-copy"><span className="eyebrow">7 DIAS PARA CONHECER</span><h1>Menos planilha. Mais controle.</h1><p>Crie sua conta, configure a empresa e comece com o Essencial: até 2 usuários e 90 clientes. O crescimento acontece sem perder histórico.</p><div className="auth-proof"><span>7D</span><p><strong>Teste com dados reais</strong><br/>Agenda, clientes, propostas e financeiro no mesmo fluxo.</p></div></div></section><section className="auth-side"><div className="auth-card"><div className="auth-card-mark">NG</div><span className="eyebrow">NOVO WORKSPACE</span><h2>Criar minha conta</h2><p>Leva menos de um minuto para começar.</p><form onSubmit={submit}><label>Seu nome<input name="name" minLength={2} maxLength={120} required autoComplete="name" placeholder="Seu nome"/></label><label>E-mail<input name="email" type="email" maxLength={160} required autoComplete="email" inputMode="email" placeholder="voce@empresa.com"/></label><label>Senha<input name="password" type="password" minLength={PASSWORD_MIN_LENGTH} required autoComplete="new-password" placeholder="Crie uma senha forte"/></label><small className="muted password-hint">{PASSWORD_HINT}</small>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary auth-submit" disabled={loading}>{buttonLabel}</button>{loading?<div className="auth-progress" aria-hidden="true"><i/></div>:null}</form><p className="auth-switch">Já tem conta? <Link href="/sign-in">Entrar</Link></p></div></section></main>;
}
