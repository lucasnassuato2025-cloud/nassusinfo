"use client";

import { useEffect } from "react";

export default function GlobalError({error,reset}:{error:Error & {digest?:string};reset:()=>void}){
  useEffect(()=>{console.error("Nassus Gestão error",error);},[error]);
  return <main className="loading"><div className="brand-mark">N</div><span className="eyebrow">ERRO INESPERADO</span><h1>Não foi possível concluir esta tela.</h1><p>Seus dados continuam protegidos. Tente recarregar a operação.</p><div className="toolbar"><button className="primary" onClick={reset}>Tentar novamente</button><a className="secondary" href="/">Voltar ao Dashboard</a></div></main>;
}
