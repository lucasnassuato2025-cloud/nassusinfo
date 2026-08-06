"use client";

import { FormEvent, useEffect, useState } from "react";

import { neonClient } from "@/lib/neon";
import styles from "../auth-recovery.module.css";

export default function SignInPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function redirectAuthenticatedUser() {
      const result = await neonClient.auth.getSession();
      const data = result.data as
        | { user?: unknown; session?: { user?: unknown } | null }
        | null;
      if (data?.user || data?.session?.user) window.location.replace("/");
    }
    void redirectAuthenticatedUser();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      const result = await neonClient.auth.signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message || "E-mail ou senha incorretos.");
        return;
      }
      window.location.replace("/");
    } catch {
      setError("O serviço de autenticação não respondeu. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="pro-auth">
      <section className="pro-auth-visual" aria-label="Apresentação do Nassus CRM Pro">
        <div className="pro-auth-brand">
          <span aria-hidden="true" />
          <div><strong>Nassus CRM</strong><small>PRO BUSINESS</small></div>
        </div>

        <div className="pro-auth-copy">
          <span>GESTÃO COMERCIAL PREMIUM</span>
          <h1>Do primeiro contato à renovação do cliente.</h1>
          <p>Leads, clientes, projetos, documentos, cobranças, tarefas, alertas e auditorias reunidos em uma central privada da Nassusinfo.</p>
        </div>

        <div className="pro-auth-features">
          <div><strong>Cliente 360°</strong><small>Dados, projetos, pagamentos e histórico em uma única ficha.</small></div>
          <div><strong>Operação e financeiro</strong><small>Controle entregas, Pix, cartão, parcelas e vencimentos.</small></div>
          <div><strong>Documentos e auditoria</strong><small>Gere propostas, contratos, recibos e análises de sites.</small></div>
        </div>
      </section>

      <section className="pro-auth-form-side">
        <div className="pro-auth-card">
          <span>ACESSO EXCLUSIVO</span>
          <h2>Bem-vindo de volta</h2>
          <p>Entre com seu acesso autorizado para abrir a central de negócios.</p>

          <form onSubmit={handleSubmit}>
            <label>
              E-mail
              <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com" />
            </label>
            <label>
              Senha
              <input name="password" type="password" minLength={8} required autoComplete="current-password" placeholder="Mínimo de 8 caracteres" />
            </label>
            <div className={styles.helperRow}>
              <a className={styles.recoveryLink} href="/forgot-password">Esqueci minha senha</a>
            </div>
            {error && <p className="pro-auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "Validando acesso..." : "Entrar no CRM"}</button>
          </form>

          <div className="pro-auth-private-note"><strong>CRM privado da Nassusinfo</strong><small>Novos acessos são liberados somente pelo administrador.</small></div>
          <div className="pro-auth-security">● Ambiente privado e protegido por autenticação</div>
        </div>
      </section>
    </main>
  );
}
