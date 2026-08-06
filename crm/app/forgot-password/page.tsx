"use client";

import { FormEvent, useState } from "react";

import { requestPasswordReset } from "@/lib/auth-password";
import styles from "../auth-recovery.module.css";

function isConnectivityError(message: string): boolean {
  return /network|fetch|timeout|não respondeu|indisponível|unavailable/i.test(message);
}

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim().toLocaleLowerCase("pt-BR");

    if (!email) {
      setError("Informe o e-mail da conta.");
      setLoading(false);
      return;
    }

    try {
      await requestPasswordReset(email, `${window.location.origin}/reset-password`);
      setSent(true);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "";
      if (isConnectivityError(message)) {
        setError("O serviço de autenticação não respondeu. Tente novamente.");
      } else {
        // Evita revelar publicamente se um endereço possui ou não uma conta.
        setSent(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pro-auth">
      <section className="pro-auth-visual" aria-label="Recuperação de acesso do Nassus CRM">
        <div className="pro-auth-brand">
          <span aria-hidden="true" />
          <div><strong>Nassus CRM</strong><small>PRO BUSINESS</small></div>
        </div>
        <div className="pro-auth-copy">
          <span>RECUPERAÇÃO SEGURA</span>
          <h1>Recupere o acesso sem alterar seus dados.</h1>
          <p>O CRM enviará um link individual ao e-mail cadastrado. Nenhuma senha antiga é exibida ou armazenada em texto aberto.</p>
        </div>
      </section>

      <section className="pro-auth-form-side">
        <div className="pro-auth-card">
          <span>REDEFINIR SENHA</span>
          <h2>Esqueceu sua senha?</h2>
          <p>Informe o e-mail usado no Nassus CRM para receber o link de redefinição.</p>

          {!sent ? (
            <form onSubmit={handleSubmit}>
              <label>
                E-mail da conta
                <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com" />
              </label>
              {error && <p className="pro-auth-error" role="alert">{error}</p>}
              <button type="submit" disabled={loading}>{loading ? "Enviando link..." : "Enviar link de redefinição"}</button>
            </form>
          ) : (
            <div className={styles.success} role="status" aria-live="polite">
              Se esse endereço estiver autorizado, o link de redefinição será enviado. Verifique também Spam e Lixo eletrônico.
            </div>
          )}

          <p className={styles.hint}>Por segurança, o sistema nunca informa publicamente se um endereço possui conta.</p>
          <a className={styles.backLink} href="/sign-in">← Voltar para o login</a>
        </div>
      </section>
    </main>
  );
}
