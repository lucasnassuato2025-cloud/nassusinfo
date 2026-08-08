"use client";

import Link from "next/link";
import AuthRecoveryForm from "@/components/auth-recovery-form";

export default function ResetPasswordPage(){
 return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>NOVA SENHA</small></div></div><div className="auth-copy"><span className="eyebrow">ACESSO PROTEGIDO</span><h1>Crie uma nova senha para sua conta.</h1><p>O link recebido por e-mail é individual, temporário e validado pelo Neon Auth.</p></div></section><section className="auth-side"><div className="auth-card"><span className="eyebrow">REDEFINIÇÃO</span><h2>Nova senha</h2><p>Use pelo menos 10 caracteres. O token do link é validado pelo componente oficial do Neon.</p><AuthRecoveryForm mode="reset"/><p className="auth-switch"><Link href="/sign-in">Ir para o login →</Link></p></div></section></main>;
}
