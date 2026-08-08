"use client";

import { FormEvent, useEffect, useState } from "react";

import { resetPassword } from "@/lib/auth-password";
import styles from "../auth-recovery.module.css";

function isStrongPassword(value: string): boolean {
  return value.length >= 10
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /\d/.test(value)
    && /[^A-Za-z0-9]/.test(value);
}

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const resetToken = currentUrl.searchParams.get("token")?.trim() || "";
    setToken(resetToken);

    if (currentUrl.search) {
      window.history.replaceState(window.history.state, "", currentUrl.pathname + currentUrl.hash);
    }
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const first = String(data.get("newPassword") || "");
    const second = String(data.get("confirmation") || "");

    if (!token) return setMessage("O link é inválido, está incompleto ou expirou.");
    if (!isStrongPassword(first)) return setMessage("Use pelo menos 10 caracteres, com letra maiúscula, minúscula, número e símbolo.");
    if (first !== second) return setMessage("As duas senhas não são iguais.");

    setLoading(true);
    setMessage("");
    try {
      await resetPassword(token, first);
      setToken("");
      setDone(true);
    } catch (reason) {
      const raw = reason instanceof Error ? reason.message : "";
      setMessage(/expired|invalid|token|expir|inválid/i.test(raw)
        ? "O link é inválido ou expirou. Solicite um novo link."
        : raw || "Não foi possível concluir a redefinição.");
    } finally {
      setLoading(false);
    }
  }

  const checkingToken = token === null;
  const invalidToken = token === "" && !done;

  return (
    <main className="pro-auth">
      <section className="pro-auth-visual" aria-label="Nova senha do Nassus CRM">
        <div className="pro-auth-brand"><span aria-hidden="true" /><div><strong>Nassus CRM</strong><small>PRO BUSINESS</small></div></div>
        <div className="pro-auth-copy"><span>NOVA SENHA</span><h1>Proteja novamente sua central.</h1><p>O link recebido por e-mail é individual e possui validade limitada.</p></div>
      </section>
      <section className="pro-auth-form-side">
        <div className="pro-auth-card">
          <span>REDEFINIÇÃO DE ACESSO</span><h2>Criar nova senha</h2><p>Digite e confirme a nova senha da sua conta.</p>

          {checkingToken && <p className={styles.hint} role="status">Validando o link de redefinição...</p>}

          {!checkingToken && invalidToken && (
            <p className="pro-auth-error" role="alert">O link é inválido, está incompleto ou expirou. Solicite um novo link de redefinição.</p>
          )}

          {!checkingToken && !invalidToken && !done && (
            <form onSubmit={submit}>
              <label>Nova senha<input name="newPassword" type="password" minLength={10} required autoComplete="new-password" /></label>
              <label>Confirmar nova senha<input name="confirmation" type="password" minLength={10} required autoComplete="new-password" /></label>
              <p className={styles.passwordRules}>Mínimo de 10 caracteres, incluindo maiúscula, minúscula, número e símbolo.</p>
              {message && <p className="pro-auth-error" role="alert">{message}</p>}
              <button type="submit" disabled={loading}>{loading ? "Atualizando..." : "Salvar nova senha"}</button>
            </form>
          )}

          {done && <div className={styles.success} role="status">Senha redefinida com sucesso. Entre novamente com a nova senha.</div>}
          <a className={styles.backLink} href={done ? "/sign-in" : "/forgot-password"}>{done ? "Ir para o login →" : "← Solicitar outro link"}</a>
        </div>
      </section>
    </main>
  );
}
