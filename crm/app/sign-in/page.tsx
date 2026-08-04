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
    <main className="login-page">
      <section className="login-brand" aria-label="Apresentação do Nassus CRM">
        <span aria-hidden="true">N</span>
        <strong>Nassus</strong>
        <small>Central comercial</small>
        <h1>Seu negócio organizado para vender mais.</h1>
        <p>Clientes, oportunidades e próximas ações reunidos em um painel privado.</p>
      </section>

      <section className="login-card">
        <div>
          <small>ACESSO PROTEGIDO</small>
          <h2>{registerMode ? "Crie sua conta" : "Entre no CRM"}</h2>
          <p>{registerMode ? "Crie seu acesso seguro ao sistema." : "Informe seu e-mail e sua senha para continuar."}</p>
        </div>

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
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={loading}>{loading ? "Aguarde..." : registerMode ? "Criar conta" : "Entrar com segurança"}</button>
        </form>

        <button type="button" className="login-switch" onClick={() => { setRegisterMode((current) => !current); setError(""); }}>
          {registerMode ? "Já tenho uma conta" : "Primeiro acesso? Crie sua conta"}
        </button>
      </section>
    </main>
  );
}
