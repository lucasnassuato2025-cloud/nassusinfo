"use client";

import { FormEvent, useEffect, useState } from "react";

import { neonClient } from "@/lib/neon";

export default function SignInPage() {
  const [registerMode, setRegisterMode] = useState(false);
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
    const name = String(formData.get("name") || "Lucas").trim();

    try {
      const result = registerMode
        ? await neonClient.auth.signUp.email({ email, password, name })
        : await neonClient.auth.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message || "Não foi possível concluir o acesso.");
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
          <h1>Do primeiro contato ao pagamento recebido.</h1>
          <p>Leads, clientes, projetos, cobranças e auditorias de sites reunidos em uma central privada da Nassusinfo.</p>
        </div>

        <div className="pro-auth-features">
          <div><strong>Funil comercial</strong><small>Acompanhe propostas, negociações e fechamentos.</small></div>
          <div><strong>Projetos e financeiro</strong><small>Controle entregas, Pix, cartão e parcelamentos.</small></div>
          <div><strong>Auditoria inteligente</strong><small>Analise sites e salve relatórios dentro do CRM.</small></div>
        </div>
      </section>

      <section className="pro-auth-form-side">
        <div className="pro-auth-card">
          <span>ACESSO PROTEGIDO</span>
          <h2>{registerMode ? "Crie sua conta" : "Bem-vindo de volta"}</h2>
          <p>{registerMode ? "Crie um acesso privado para começar a usar o CRM." : "Entre com seus dados para acessar a central de negócios."}</p>

          <form onSubmit={handleSubmit}>
            {registerMode && (
              <label>
                Seu nome
                <input name="name" required placeholder="Lucas Nassuato" autoComplete="name" />
              </label>
            )}
            <label>
              E-mail
              <input name="email" type="email" required autoComplete="email" placeholder="seu@email.com" />
            </label>
            <label>
              Senha
              <input name="password" type="password" minLength={8} required autoComplete={registerMode ? "new-password" : "current-password"} placeholder="Mínimo de 8 caracteres" />
            </label>
            {error && <p className="pro-auth-error" role="alert">{error}</p>}
            <button type="submit" disabled={loading}>{loading ? "Aguarde..." : registerMode ? "Criar acesso" : "Entrar no CRM"}</button>
          </form>

          <button type="button" className="pro-auth-switch" onClick={() => { setRegisterMode((current) => !current); setError(""); }}>
            {registerMode ? "Já tenho uma conta" : "Primeiro acesso? Crie sua conta"}
          </button>
          <div className="pro-auth-security">● Ambiente privado e protegido por autenticação</div>
        </div>
      </section>
    </main>
  );
}
