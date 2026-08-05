"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";

import type { ContractSnapshot } from "@/app/operations/contract-utils";
import { callPublicSigningRpc, sha256Hex } from "@/lib/public-signing";

type OpenResult = {
  document: ContractSnapshot;
  document_hash: string;
  expires_at: string;
  status: string;
  signature_status: string;
};

type SignResult = {
  success: boolean;
  signed_at: string;
  document_hash: string;
  signer_name: string;
  signer_document: string;
};

function value(record: Record<string, unknown>, key: string): string {
  const item = record[key];
  return item == null ? "" : String(item);
}

function fullAddress(record: Record<string, unknown>): string {
  return [value(record, "address"), value(record, "addressNumber"), value(record, "complement"), value(record, "neighborhood"), value(record, "city"), value(record, "state"), value(record, "zipCode")].filter(Boolean).join(", ");
}

function dateLabel(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`));
}

function currency(valueNumber: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueNumber || 0);
}

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n+/).filter(Boolean).map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</>;
}

export default function SigningClient({ token }: { token: string }) {
  const [code, setCode] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [data, setData] = useState<OpenResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signerPhone, setSignerPhone] = useState("");
  const [method, setMethod] = useState<"typed" | "drawn">("typed");
  const [consent, setConsent] = useState(false);
  const [signed, setSigned] = useState<SignResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const hasDrawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || method !== "drawn") return;
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2.2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#eaf1ff";
  }, [method]);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const current = point(event);
    drawingRef.current = true;
    context.beginPath();
    context.moveTo(current.x, current.y);
  }

  function draw(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext("2d");
    if (!context) return;
    const current = point(event);
    context.lineTo(current.x, current.y);
    context.stroke();
    hasDrawingRef.current = true;
  }

  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawingRef.current = false;
  }

  async function unlock(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const [tokenHash, codeHash] = await Promise.all([sha256Hex(token), sha256Hex(code.trim())]);
      const result = await callPublicSigningRpc<OpenResult>("public_open_signing_document", {
        p_token_hash: tokenHash,
        p_access_code_hash: codeHash,
        p_signer_document: documentNumber,
      });
      setData(result);
      const client = result.document.client;
      setSignerName(value(client, "name"));
      setSignerEmail(value(client, "email"));
      setSignerPhone(value(client, "whatsapp") || value(client, "phone"));
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Não foi possível abrir o documento.");
    } finally {
      setLoading(false);
    }
  }

  async function submitSignature(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    if (method === "drawn" && !hasDrawingRef.current) {
      setNotice("Desenhe sua assinatura no campo indicado.");
      return;
    }
    setLoading(true);
    setNotice("");
    try {
      const signatureData = method === "typed" ? signerName.trim() : canvasRef.current?.toDataURL("image/png") || "";
      const [tokenHash, codeHash] = await Promise.all([sha256Hex(token), sha256Hex(code.trim())]);
      const result = await callPublicSigningRpc<SignResult>("public_submit_document_signature", {
        p_token_hash: tokenHash,
        p_access_code_hash: codeHash,
        p_signer_document: documentNumber,
        p_signer_name: signerName,
        p_signer_email: signerEmail,
        p_signer_phone: signerPhone,
        p_signature_method: method,
        p_signature_data: signatureData,
        p_consent: consent,
        p_document_hash: data.document_hash,
      });
      setSigned(result);
      setNotice("Documento assinado com sucesso. Guarde esta página como comprovante.");
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : "Não foi possível registrar a assinatura.");
    } finally {
      setLoading(false);
    }
  }

  if (!data) {
    return (
      <main className="sign-shell">
        <section className="sign-unlock-card">
          <div className="sign-brand"><span /><div><strong>Nassus CRM</strong><small>ASSINATURA ELETRÔNICA</small></div></div>
          <div className="sign-lock-icon">✓</div>
          <span className="sign-eyebrow">LINK PRIVADO</span>
          <h1>Acesse o documento para leitura e assinatura</h1>
          <p>Informe o código enviado separadamente e o CPF, CNPJ ou RG combinado com a Nassusinfo.</p>
          {notice && <div className="sign-notice sign-error">{notice}</div>}
          <form onSubmit={unlock} className="sign-unlock-form">
            <label>Código de acesso<input inputMode="numeric" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" /></label>
            <label>CPF, CNPJ ou RG<input required value={documentNumber} onChange={(event) => setDocumentNumber(event.target.value)} placeholder="Documento do contratante" /></label>
            <button type="submit" disabled={loading}>{loading ? "Verificando..." : "Abrir documento"}</button>
          </form>
          <small className="sign-privacy">O código, a identificação e o link são usados para restringir o acesso e compor a trilha de auditoria.</small>
        </section>
      </main>
    );
  }

  const snapshot = data.document;
  const issuer = snapshot.issuer;
  const client = snapshot.client;
  const project = snapshot.project;

  return (
    <main className="sign-shell sign-document-shell">
      <header className="sign-topbar">
        <div className="sign-brand"><span /><div><strong>Nassus CRM</strong><small>DOCUMENTO SEGURO</small></div></div>
        <div><span>Documento</span><strong>{snapshot.document.number}</strong></div>
      </header>

      {notice && <div className={`sign-notice ${signed ? "sign-success" : "sign-error"}`}>{notice}</div>}

      <article className="sign-paper">
        <header className="sign-paper-head">
          <div><span>{snapshot.document.type.toUpperCase()}</span><h1>{snapshot.document.title}</h1></div>
          <dl><div><dt>Emissão</dt><dd>{dateLabel(snapshot.document.issueDate)}</dd></div><div><dt>Versão</dt><dd>{snapshot.document.version}</dd></div></dl>
        </header>

        <section className="sign-parties">
          <div><span>CONTRATADA</span><strong>{value(issuer, "tradeName") || value(issuer, "displayName")}</strong><p>{value(issuer, "legalName")}</p><p>{value(issuer, "documentType").toUpperCase()}: {value(issuer, "documentNumber") || "não informado"}</p><p>{fullAddress(issuer)}</p></div>
          <div><span>CONTRATANTE</span><strong>{value(client, "tradeName") || value(client, "company") || value(client, "name")}</strong><p>Responsável: {value(client, "name")}</p><p>{value(client, "documentType").toUpperCase()}: {value(client, "documentNumber")}</p><p>{fullAddress(client)}</p></div>
        </section>

        {project && <section className="sign-project"><span>PROJETO VINCULADO</span><strong>{value(project, "name")}</strong><p>{value(project, "serviceType")}</p></section>}

        <section className="sign-value"><div><span>Valor contratado</span><strong>{currency(snapshot.document.amount)}</strong></div><p>{snapshot.document.amountInWords}</p></section>

        {snapshot.services.length > 0 && <section className="sign-section"><h2>Serviços contratados</h2><div className="sign-services">{snapshot.services.map((service, index) => <article key={`${service.name}-${index}`}><div><strong>{service.name}</strong><p>{service.description}</p></div><span>{currency(service.amount)}</span></article>)}</div></section>}
        <section className="sign-section"><h2>Escopo e entregas</h2><Paragraphs text={snapshot.document.scope} /></section>
        <section className="sign-section"><h2>Forma e condições de pagamento</h2><Paragraphs text={snapshot.document.paymentTerms} /></section>
        {snapshot.clauses.map((clause, index) => <section className="sign-section" key={`${clause.code}-${index}`}><h2>{index + 1}. {clause.title}</h2><Paragraphs text={clause.body} /></section>)}
        {snapshot.document.terms && <section className="sign-section"><h2>Condições complementares</h2><Paragraphs text={snapshot.document.terms} /></section>}
        {snapshot.document.notes && <section className="sign-section"><h2>Observações</h2><Paragraphs text={snapshot.document.notes} /></section>}

        <footer className="sign-hash"><span>HASH SHA-256 DA VERSÃO</span><code>{data.document_hash}</code><small>O hash identifica exatamente o conteúdo apresentado nesta assinatura.</small></footer>
      </article>

      {!signed ? (
        <form onSubmit={submitSignature} className="sign-form-card">
          <div className="sign-form-head"><span>ASSINATURA DO CONTRATANTE</span><h2>Confirme seus dados e assine</h2><p>Leia o documento integralmente antes de continuar.</p></div>
          <div className="sign-fields"><label>Nome completo<input required minLength={3} value={signerName} onChange={(event) => setSignerName(event.target.value)} /></label><label>E-mail<input type="email" value={signerEmail} onChange={(event) => setSignerEmail(event.target.value)} /></label><label>WhatsApp / telefone<input value={signerPhone} onChange={(event) => setSignerPhone(event.target.value)} /></label></div>
          <div className="sign-methods"><button type="button" className={method === "typed" ? "active" : ""} onClick={() => setMethod("typed")}>Nome digitado</button><button type="button" className={method === "drawn" ? "active" : ""} onClick={() => setMethod("drawn")}>Desenhar assinatura</button></div>
          {method === "typed" ? <div className="sign-typed-preview">{signerName || "Sua assinatura aparecerá aqui"}</div> : <div className="sign-canvas-wrap"><canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} /><button type="button" onClick={clearSignature}>Limpar</button></div>}
          <label className="sign-consent"><input type="checkbox" required checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Declaro que li integralmente o documento, compreendi suas condições, reconheço os dados apresentados e concordo em assiná-lo eletronicamente.</span></label>
          <div className="sign-legal-note"><strong>Importante</strong><p>Esta é uma assinatura eletrônica realizada dentro do Nassus CRM, com identificação, código de acesso, versão, hash e registros técnicos. Ela não é um certificado ICP-Brasil nem uma assinatura Gov.br.</p></div>
          <button type="submit" className="sign-submit" disabled={loading}>{loading ? "Registrando assinatura..." : "Assinar documento"}</button>
        </form>
      ) : (
        <section className="sign-complete-card"><div>✓</div><span>ASSINATURA CONCLUÍDA</span><h2>{signed.signer_name}</h2><p>Assinatura registrada em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "medium" }).format(new Date(signed.signed_at))}.</p><code>{signed.document_hash}</code><button type="button" onClick={() => window.print()}>Imprimir / salvar em PDF</button></section>
      )}
    </main>
  );
}
