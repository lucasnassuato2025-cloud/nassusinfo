"use client";

import Link from "next/link";
import AuthRecoveryForm from "@/components/auth-recovery-form";

export default function ForgotPasswordPage(){
 return <main className="auth-page"><section className="auth-visual"><div className="auth-brand"><div className="brand-mark">N</div><div><strong>Nassus Gestão</strong><small>RECUPERAÇÃO</small></div></div><div className="auth-copy"><span className="eyebrow">ACESSO SEGURO</span><h1>Recupere sua conta sem perder dados.</h1><p>O fluxo de recuperação usa o mecanismo oficial do Neon Auth e um link temporário de redefinição.</p></div></section><section className="auth-side"><div className="auth-card"><span className="eyebrow">RECUPERAÇÃO</span><h2>Esqueci minha senha</h2><p>Informe o e-mail da conta. Por segurança, a resposta não confirma se o endereço está cadastrado.</p><AuthRecoveryForm mode="forgot"/><p className="auth-switch"><Link href="/sign-in">← Voltar para o login</Link></p></div></section></main>;
}
