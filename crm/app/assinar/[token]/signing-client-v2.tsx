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

type TimelinePoint = { key: string; label: string; at: string };
type Evidence = {
  evidence_id: string;
  signature_id: string;
  document_id: string;
  document_number: string;
  document_title: string;
  document_version: number;
  document_hash: string;
  signed_at: string;
  signer_name: string;
  signer_document_masked: string;
  signature_method: string;
  consent_version: string;
  issuer_name: string;
  client_name: string;
  timeline: TimelinePoint[];
  verification_note: string;
};

type SignResult = {
  success: boolean;
  signed_at: string;
  document_hash: string;
  signer_name: string;
  signer_document?: string;
  evidence: Evidence;
};

function value(record: Record<string, unknown>, key: string): string {
  const item = record[key];
  return item == null ? "" : String(item);
}

function fullAddress(record: Record<string, unknown>): string {
  return [value(record,"address"),value(record,"addressNumber"),value(record,"complement"),value(record,"neighborhood"),value(record,"city"),value(record,"state"),value(record,"zipCode")].filter(Boolean).join(", ");
}

function dateLabel(date: string | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(new Date(`${date}T12:00:00`));
}

function dateTime(valueText: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "medium" }).format(new Date(valueText));
}

function currency(valueNumber: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valueNumber || 0);
}

function documentDigits(valueText: string): string {
  return valueText.replace(/\D/g, "").slice(0, 14);
}

function formatDocument(valueText: string): string {
  const digits = documentDigits(valueText);
  if (digits.length <= 11) return digits.replace(/^(\d{3})(\d)/,"$1.$2").replace(/^(\d{3})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1-$2");
  return digits.replace(/^(\d{2})(\d)/,"$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/,"$1.$2.$3").replace(/\.(\d{3})(\d)/,".$1/$2").replace(/(\d{4})(\d)/,"$1-$2");
}

function Paragraphs({ text }: { text: string }) {
  return <>{text.split(/\n+/).filter(Boolean).map((paragraph)=><p key={paragraph}>{paragraph}</p>)}</>;
}

function Certificate({ evidence }: { evidence: Evidence }) {
  return <section className="sign-complete-card sign-certificate">
    <div>✓</div>
    <span>CERTIFICADO DE EVIDÊNCIA</span>
    <h2>{evidence.document_number}</h2>
    <p>{evidence.document_title}</p>
    <div className="sign-evidence-grid">
      <section><span>Signatário</span><strong>{evidence.signer_name}</strong><small>{evidence.signer_document_masked}</small></section>
      <section><span>Assinado em</span><strong>{dateTime(evidence.signed_at)}</strong><small>Método: {evidence.signature_method === "drawn" ? "assinatura desenhada" : "nome digitado"}</small></section>
      <section><span>Versão</span><strong>{evidence.document_version}</strong><small>{evidence.issuer_name} ↔ {evidence.client_name}</small></section>
      <section><span>Referência</span><strong>{evidence.evidence_id}</strong><small>Consentimento: {evidence.consent_version || "registrado"}</small></section>
    </div>
    <div className="sign-evidence-timeline"><h3>Linha do tempo</h3>{evidence.timeline.map((point)=><div key={`${point.key}-${point.at}`}><i>✓</i><section><strong>{point.label}</strong><small>{dateTime(point.at)}</small></section></div>)}</div>
    <div className="sign-hash"><span>HASH SHA-256 DA VERSÃO ASSINADA</span><code>{evidence.document_hash}</code><small>{evidence.verification_note}</small></div>
    <button type="button" onClick={()=>window.print()}>Imprimir / salvar certificado em PDF</button>
  </section>;
}

export default function SigningClientV2({ token }: { token: string }) {
  const [code,setCode]=useState("");
  const [signerDocument,setSignerDocument]=useState("");
  const [data,setData]=useState<OpenResult|null>(null);
  const [loading,setLoading]=useState(false);
  const [notice,setNotice]=useState("");
  const [signerName,setSignerName]=useState("");
  const [signerEmail,setSignerEmail]=useState("");
  const [signerPhone,setSignerPhone]=useState("");
  const [method,setMethod]=useState<"typed"|"drawn">("typed");
  const [consent,setConsent]=useState(false);
  const [signed,setSigned]=useState<SignResult|null>(null);
  const [evidence,setEvidence]=useState<Evidence|null>(null);
  const [accessMode,setAccessMode]=useState<"document"|"evidence">("document");
  const canvasRef=useRef<HTMLCanvasElement|null>(null);
  const drawingRef=useRef(false);
  const hasDrawingRef=useRef(false);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas||method!=="drawn") return;
    const ratio=window.devicePixelRatio||1;
    canvas.width=canvas.clientWidth*ratio; canvas.height=canvas.clientHeight*ratio;
    const context=canvas.getContext("2d"); if(!context) return;
    context.scale(ratio,ratio); context.lineWidth=2.2; context.lineCap="round"; context.lineJoin="round"; context.strokeStyle="#eaf1ff";
  },[method]);

  function point(event:PointerEvent<HTMLCanvasElement>){const rect=event.currentTarget.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
  function startDrawing(event:PointerEvent<HTMLCanvasElement>){const ctx=event.currentTarget.getContext("2d");if(!ctx)return;event.currentTarget.setPointerCapture(event.pointerId);const p=point(event);drawingRef.current=true;ctx.beginPath();ctx.moveTo(p.x,p.y);}
  function draw(event:PointerEvent<HTMLCanvasElement>){if(!drawingRef.current)return;const ctx=event.currentTarget.getContext("2d");if(!ctx)return;const p=point(event);ctx.lineTo(p.x,p.y);ctx.stroke();hasDrawingRef.current=true;}
  function stopDrawing(event:PointerEvent<HTMLCanvasElement>){drawingRef.current=false;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}
  function clearSignature(){const canvas=canvasRef.current;if(!canvas)return;canvas.getContext("2d")?.clearRect(0,0,canvas.width,canvas.height);hasDrawingRef.current=false;}

  function identityDocument():string|null{const normalized=documentDigits(signerDocument);if(![11,14].includes(normalized.length)){setNotice("Informe o CPF ou CNPJ completo do contratante.");return null;}return normalized;}

  async function access(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault(); const normalizedDocument=identityDocument(); if(!normalizedDocument)return;
    setLoading(true);setNotice("");
    try{
      const [tokenHash,codeHash]=await Promise.all([sha256Hex(token),sha256Hex(code.trim())]);
      if(accessMode==="evidence"){
        const result=await callPublicSigningRpc<Evidence>("public_get_signature_evidence",{p_token_hash:tokenHash,p_access_code_hash:codeHash,p_signer_document:normalizedDocument});
        setEvidence(result);setNotice("Certificado verificado no servidor.");return;
      }
      const result=await callPublicSigningRpc<OpenResult>("public_open_signing_document",{p_token_hash:tokenHash,p_access_code_hash:codeHash,p_signer_document:normalizedDocument});
      setData(result);const client=result.document.client;setSignerName(value(client,"name"));setSignerEmail(value(client,"email"));setSignerPhone(value(client,"whatsapp")||value(client,"phone"));
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Não foi possível validar o acesso.");}
    finally{setLoading(false);}
  }

  async function submitSignature(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(!data)return;const normalizedDocument=identityDocument();if(!normalizedDocument)return;
    if(method==="drawn"&&!hasDrawingRef.current){setNotice("Desenhe sua assinatura no campo indicado.");return;}
    setLoading(true);setNotice("");
    try{
      const signatureData=method==="typed"?signerName.trim():canvasRef.current?.toDataURL("image/png")||"";
      const [tokenHash,codeHash]=await Promise.all([sha256Hex(token),sha256Hex(code.trim())]);
      const result=await callPublicSigningRpc<SignResult>("public_submit_document_signature",{p_token_hash:tokenHash,p_access_code_hash:codeHash,p_signer_document:normalizedDocument,p_signer_name:signerName,p_signer_email:signerEmail,p_signer_phone:signerPhone,p_signature_method:method,p_signature_data:signatureData,p_consent:consent,p_document_hash:data.document_hash});
      setSigned(result);setEvidence(result.evidence);setSignerDocument("");setCode("");setNotice("Documento assinado e certificado de evidência gerado com sucesso.");
    }catch(reason){setNotice(reason instanceof Error?reason.message:"Não foi possível registrar a assinatura.");}
    finally{setLoading(false);}
  }

  if(evidence) return <main className="sign-shell sign-document-shell"><header className="sign-topbar"><div className="sign-brand"><span/><div><strong>Nassus CRM</strong><small>EVIDÊNCIA VERIFICADA</small></div></div><div><span>Documento</span><strong>{evidence.document_number}</strong></div></header>{notice&&<div className="sign-notice sign-success" role="status">{notice}</div>}<Certificate evidence={evidence}/></main>;

  if(!data) return <main className="sign-shell"><section className="sign-unlock-card"><div className="sign-brand"><span/><div><strong>Nassus CRM</strong><small>ASSINATURA ELETRÔNICA V2</small></div></div><div className="sign-lock-icon">✓</div><span className="sign-eyebrow">LINK PRIVADO</span><h1>{accessMode==="document"?"Acesse o documento para leitura e assinatura":"Consultar certificado de uma assinatura concluída"}</h1><p>Confirme sua identidade com CPF/CNPJ e o código enviado separadamente. Os dados são usados somente para validar este acesso.</p>{notice&&<div className="sign-notice sign-error" role="alert">{notice}</div>}<div className="sign-methods"><button type="button" className={accessMode==="document"?"active":""} onClick={()=>setAccessMode("document")}>Ler e assinar</button><button type="button" className={accessMode==="evidence"?"active":""} onClick={()=>setAccessMode("evidence")}>Consultar evidência</button></div><form onSubmit={access} className="sign-unlock-form"><label>CPF ou CNPJ do contratante<input inputMode="numeric" autoComplete="off" maxLength={18} required value={signerDocument} onChange={event=>setSignerDocument(formatDocument(event.target.value))} placeholder="000.000.000-00"/></label><label>Código de acesso<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="000000"/></label><button type="submit" disabled={loading||code.length!==6||![11,14].includes(documentDigits(signerDocument).length)}>{loading?"Validando identidade...":accessMode==="document"?"Abrir documento":"Verificar certificado"}</button></form><small className="sign-privacy">O CPF/CNPJ e o código não são gravados em logs do gateway. Eventos de segurança utilizam identificadores minimizados.</small></section></main>;

  const snapshot=data.document;const issuer=snapshot.issuer;const client=snapshot.client;const project=snapshot.project;
  return <main className="sign-shell sign-document-shell"><header className="sign-topbar"><div className="sign-brand"><span/><div><strong>Nassus CRM</strong><small>DOCUMENTO SEGURO V2</small></div></div><div><span>Documento</span><strong>{snapshot.document.number}</strong></div></header>{notice&&<div className={`sign-notice ${signed?"sign-success":"sign-error"}`} role="status">{notice}</div>}<div className="sign-process"><div className="done"><i>✓</i><span>Identidade confirmada</span></div><div className="active"><i>2</i><span>Leitura do documento</span></div><div><i>3</i><span>Assinatura e evidência</span></div></div><article className="sign-paper"><header className="sign-paper-head"><div><span>{snapshot.document.type.toUpperCase()}</span><h1>{snapshot.document.title}</h1></div><dl><div><dt>Emissão</dt><dd>{dateLabel(snapshot.document.issueDate)}</dd></div><div><dt>Versão</dt><dd>{snapshot.document.version}</dd></div></dl></header><section className="sign-parties"><div><span>CONTRATADA</span><strong>{value(issuer,"tradeName")||value(issuer,"displayName")}</strong><p>{value(issuer,"legalName")}</p><p>{value(issuer,"documentType").toUpperCase()}: {value(issuer,"documentNumber")||"não informado"}</p><p>{fullAddress(issuer)}</p></div><div><span>CONTRATANTE</span><strong>{value(client,"tradeName")||value(client,"company")||value(client,"name")}</strong><p>Responsável: {value(client,"name")}</p><p>{value(client,"documentType").toUpperCase()}: {value(client,"documentNumber")}</p><p>{fullAddress(client)}</p></div></section>{project&&<section className="sign-project"><span>PROJETO VINCULADO</span><strong>{value(project,"name")}</strong><p>{value(project,"serviceType")}</p></section>}<section className="sign-value"><div><span>Valor contratado</span><strong>{currency(snapshot.document.amount)}</strong></div><p>{snapshot.document.amountInWords}</p></section>{snapshot.services.length>0&&<section className="sign-section"><h2>Serviços contratados</h2><div className="sign-services">{snapshot.services.map((service,index)=><article key={`${service.name}-${index}`}><div><strong>{service.name}</strong><p>{service.description}</p></div><span>{currency(service.amount)}</span></article>)}</div></section>}<section className="sign-section"><h2>Escopo e entregas</h2><Paragraphs text={snapshot.document.scope}/></section><section className="sign-section"><h2>Forma e condições de pagamento</h2><Paragraphs text={snapshot.document.paymentTerms}/></section>{snapshot.clauses.map((clause,index)=><section className="sign-section" key={`${clause.code}-${index}`}><h2>{index+1}. {clause.title}</h2><Paragraphs text={clause.body}/></section>)}{snapshot.document.terms&&<section className="sign-section"><h2>Condições complementares</h2><Paragraphs text={snapshot.document.terms}/></section>}{snapshot.document.notes&&<section className="sign-section"><h2>Observações</h2><Paragraphs text={snapshot.document.notes}/></section>}<footer className="sign-hash"><span>HASH SHA-256 DA VERSÃO</span><code>{data.document_hash}</code><small>Este hash identifica exatamente o conteúdo apresentado para assinatura.</small></footer></article><form onSubmit={submitSignature} className="sign-form-card"><div className="sign-form-head"><span>ASSINATURA DO CONTRATANTE</span><h2>Confirme seus dados e assine</h2><p>Leia o documento integralmente antes de continuar.</p></div><div className="sign-fields"><label>Nome completo<input required minLength={3} value={signerName} onChange={event=>setSignerName(event.target.value)}/></label><label>E-mail<input type="email" value={signerEmail} onChange={event=>setSignerEmail(event.target.value)}/></label><label>WhatsApp / telefone<input value={signerPhone} onChange={event=>setSignerPhone(event.target.value)}/></label></div><div className="sign-methods"><button type="button" className={method==="typed"?"active":""} onClick={()=>setMethod("typed")}>Nome digitado</button><button type="button" className={method==="drawn"?"active":""} onClick={()=>setMethod("drawn")}>Desenhar assinatura</button></div>{method==="typed"?<div className="sign-typed-preview">{signerName||"Sua assinatura aparecerá aqui"}</div>:<div className="sign-canvas-wrap"><canvas ref={canvasRef} onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing} onPointerCancel={stopDrawing}/><button type="button" onClick={clearSignature}>Limpar</button></div>}<label className="sign-consent"><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)}/><span>Declaro que li integralmente o documento, compreendi suas condições, reconheço os dados apresentados e concordo em assiná-lo eletronicamente.</span></label><div className="sign-legal-note"><strong>Privacidade e validade técnica</strong><p>A assinatura registra versão, hash, consentimento e eventos técnicos de segurança. Após a conclusão, o CRM gera um certificado de evidência vinculado ao mesmo hash. Não é certificado ICP-Brasil nem assinatura Gov.br.</p></div><button type="submit" className="sign-submit" disabled={loading}>{loading?"Registrando assinatura e evidência...":"Assinar documento"}</button></form></main>;
}
