"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { friendlyAuthError } from "@/lib/auth-errors";
import { neonClient } from "@/lib/neon";
import { getCurrentUser } from "@/lib/session";
import { waitForWorkspaceReady } from "@/lib/workspace";

export default function SignInPage(){
  const [loading,setLoading]=useState(false);const [stage,setStage]=useState<"idle"|"auth"|"sync">("idle");const [error,setError]=useState("");
  useEffect(()=>{let active=true;void getCurrentUser().then(u=>{if(active&&u?.email)window.location.replace("/");}).catch(()=>{});return()=>{active=false};},[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(loading)return;setLoading(true);setStage("auth");setError("");
    const data=new FormData(event.currentTarget);const email=String(data.get("email")||"").trim().toLocaleLowerCase("pt-BR");const password=String(data.get("password")||"");
    try{
      const result=await neonClient.auth.signIn.email({email,password});if(result.error)throw result.error;
      setStage("sync");
      const workspace=await waitForWorkspaceReady();
      if(!workspace)throw new Error("SESSION_SYNC_TIMEOUT");
      window.location.replace(workspace.business?"/":"/onboarding");
    }
    catch(reason){setStage("idle");setError(friendlyAuthError(reason,"signin"));}
    finally{setLoading(false);}
  }
  const buttonLabel=stage==="auth"?"Validando acesso...":stage==="sync"?"Preparando seu painel...":"Entrar";
  return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>BUSINESS OS</small></div></div><div className="auth-copy"><span className="eyebrow">CONTROLE. VELOCIDADE. CLAREZA.</span><h1>Seu negócio em modo profissional.</h1><p>Uma central compacta para clientes, agenda, dinheiro, propostas e equipe — com segurança multiempresa desde a base.</p><div className="auth-proof"><span>01</span><p><strong>Visão em segundos</strong><br/>O que entrou, o que vence e o que precisa da sua atenção.</p></div></div></section><section className="auth-side"><div className="auth-card"><div className="auth-card-mark">NG</div><span className="eyebrow">ACESSO SEGURO</span><h2>Bem-vindo de volta</h2><p>Entre para abrir o workspace da sua empresa.</p><form onSubmit={submit}><label>E-mail<input name="email" type="email" maxLength={160} autoComplete="email" inputMode="email" required placeholder="voce@empresa.com"/></label><label>Senha<input name="password" type="password" autoComplete="current-password" required placeholder="Sua senha"/></label><div className="split small"><span></span><Link href="/forgot-password" className="auth-link">Esqueci minha senha</Link></div>{error&&<p className="auth-error" role="alert">{error}</p>}<button className="primary auth-submit" disabled={loading}>{buttonLabel}</button>{loading?<div className="auth-progress" aria-hidden="true"><i/></div>:null}</form><p className="auth-switch">Ainda não tem conta? <Link href="/cadastro">Criar conta</Link></p></div></section></main>;
}
