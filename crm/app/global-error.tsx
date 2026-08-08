"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, background: "#060912", color: "#eef5ff", fontFamily: "system-ui, sans-serif" }}>
        <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
          <section style={{ width: "min(520px, 100%)", border: "1px solid #202a3a", borderRadius: 20, padding: 28, background: "#0b111c" }}>
            <small style={{ letterSpacing: ".14em", color: "#8494ae" }}>NASSUS CRM · RECUPERAÇÃO</small>
            <h1 style={{ margin: "10px 0" }}>O CRM encontrou uma falha crítica</h1>
            <p style={{ color: "#93a1b6" }}>Nenhuma alteração adicional será executada nesta tela. Tente reconstruir a interface ou volte ao login.</p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" onClick={reset} style={{ padding: "11px 15px", borderRadius: 10, border: 0, fontWeight: 800 }}>Reconstruir interface</button>
              <a href="/sign-in" style={{ padding: "11px 15px", borderRadius: 10, border: "1px solid #2b374b", color: "#eef5ff", textDecoration: "none" }}>Ir para o login</a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
