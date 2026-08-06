"use client";

import { FormEvent, useState } from "react";

import { resetPassword } from "@/lib/auth-password";
import styles from "../auth-recovery.module.css";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const first = String(data.get("newPassword") || "");
    const second = String(data.get("confirmation") || "");
    const token = new URLSearchParams(window.location.search).get("token") || "";

    if (!token) return setMessage("O link é inválido ou está incompleto.");
    if (first.length < 8) return setMessage("Use pelo menos 8 caracteres.");
    if (first !== second) return setMessage("As duas senhas não são iguais.");

    setLoading(true);
    setMessage("");
    try {
      await resetPassword(token, first);
      setDone(true);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Não foi possível concluir a redefinição.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pro-auth">
      <section className="pro-auth-visual" aria-label="Nova senha do Nassus CRM">
        <div className="pro-auth-brand"><span aria-hidden="true" /><div><strong>Nassus CRM</strong><small>PRO BUSINESS</small></div></div>
        <div className="pro-auth-copy"><span>NOVA SENHA</span><h1>Proteja novamente sua central.</h1><p>O link recebido por e-mail é individual e possui validade limitada.</p></div>
      </section>
      <section className="pro-auth-form-side">
        <div className="pro-auth-card">
          <span>REDEFINIÇÃO DE ACESSO</span><h2>Criar nova senha</h2><p>Digite e confirme a nova senha da sua conta.</p>
          {!done ? <form onSubmit={submit}>
            <label>Nova senha<input name="newPassword" type="password" minLength={8} required autoComplete="new-password" /></label>
            <label>Confirmar nova senha<input name="confirmation" type="password" minLength={8} required autoComplete="new-password" /></label>
            <p className={styles.passwordRules}>Use uma senha exclusiva com letras, números e um caractere especial.</p>
            {message && <p className="pro-auth-error" role="alert">{message}</p>}
            <button type="submit" disabled={loading}>{loading ? "Atualizando..." : "Salvar nova senha"}</button>
          </form> : <div className={styles.success}>Senha redefinida com sucesso.</div>}
          <a className={styles.backLink} href={done ? "/sign-in" : "/forgot-password"}>{done ? "Ir para o login →" : "← Solicitar outro link"}</a>
        </div>
      </section>
    </main>
  );
}
