"use client";

import { useEffect, useMemo, useState } from "react";
import { PAYMENT_COLUMNS, Client, Payment, Project, mapPayment } from "@/lib/crm-pro";
import { neonClient } from "@/lib/neon";
import { INSTALLMENT_COLUMNS, PaymentInstallment, clientLabel, compactCurrency, currency, dateLabel, errorMessage, mapInstallment, recordActivity, rows, today } from "./shared";

type InstallmentsPanelProps = {
  payments: Payment[];
  clients: Client[];
  projects: Project[];
  onPaymentChange: (payment: Payment) => void;
};

export function InstallmentsPanel({ payments, clients, projects, onPaymentChange }: InstallmentsPanelProps) {
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const paymentMap = useMemo(() => new Map(payments.map((payment) => [payment.id, payment])), [payments]);
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const projectMap = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);

  async function loadInstallments() {
    setLoading(true);
    const query = await neonClient.from("payment_installments").select(INSTALLMENT_COLUMNS).order("due_date", { ascending: true }).order("installment_number", { ascending: true });
    if (query.error) setNotice(query.error.message || "Não foi possível carregar as parcelas.");
    else setInstallments(rows(query.data).map(mapInstallment));
    setLoading(false);
  }

  useEffect(() => {
    void loadInstallments();
  }, [payments.length]);

  const openInstallments = installments.filter((installment) => installment.status !== "pago" && installment.status !== "cancelado");
  const overdue = openInstallments.filter((installment) => installment.dueDate && installment.dueDate < today());
  const nextDue = openInstallments.find((installment) => installment.dueDate && installment.dueDate >= today());

  async function markInstallmentPaid(installment: PaymentInstallment) {
    const result = await (neonClient.from("payment_installments") as any)
      .update({ status: "pago", paid_amount: installment.amount, paid_at: today(), updated_at: new Date().toISOString() })
      .eq("id", installment.id)
      .select(INSTALLMENT_COLUMNS);
    if (result.error) return setNotice(errorMessage(result.error, "Não foi possível receber a parcela."));
    const saved = mapInstallment(rows(result.data)[0] || result.data);
    const nextRows = installments.map((item) => item.id === saved.id ? saved : item);
    setInstallments(nextRows);

    const paymentRows = nextRows.filter((item) => item.paymentId === saved.paymentId);
    const paidAmount = paymentRows.reduce((sum, item) => sum + item.paidAmount, 0);
    const allPaid = paymentRows.length > 0 && paymentRows.every((item) => item.status === "pago");
    const paymentResult = await (neonClient.from("payments") as any)
      .update({ paid_amount: paidAmount, status: allPaid ? "pago" : "pendente", paid_at: allPaid ? today() : null, updated_at: new Date().toISOString() })
      .eq("id", saved.paymentId)
      .select(PAYMENT_COLUMNS);
    if (!paymentResult.error) {
      const updatedPayment = mapPayment(rows(paymentResult.data)[0] || paymentResult.data);
      onPaymentChange(updatedPayment);
      void recordActivity({ clientId: saved.clientId, projectId: updatedPayment.projectId, type: "parcela_recebida", title: `Parcela ${saved.installmentNumber} recebida`, description: currency.format(saved.amount) });
    }
    setNotice("Parcela marcada como recebida.");
  }

  return (
    <section className="installments-panel">
      <header className="ops-panel-head"><div><span>CRONOGRAMA DE PARCELAS</span><h2>Recebimentos detalhados</h2></div><button type="button" className="pro-secondary" onClick={loadInstallments}>Atualizar</button></header>
      {notice && <div className="ops-notice">{notice}</div>}
      <div className="installment-summary"><article><span>Em aberto</span><strong>{compactCurrency.format(openInstallments.reduce((sum, item) => sum + Math.max(0, item.amount - item.paidAmount), 0))}</strong></article><article><span>Atrasadas</span><strong>{overdue.length}</strong></article><article><span>Próximo vencimento</span><strong>{nextDue ? dateLabel(nextDue.dueDate) : "Tudo em dia"}</strong></article></div>
      {loading ? <p className="ops-muted">Carregando parcelas...</p> : installments.length ? (
        <div className="compact-table-wrap"><table className="compact-table"><thead><tr><th>Cliente / projeto</th><th>Parcela</th><th>Vencimento</th><th>Valor</th><th>Recebido</th><th>Status</th><th /></tr></thead><tbody>{installments.map((installment) => {
          const payment = paymentMap.get(installment.paymentId);
          const project = payment?.projectId ? projectMap.get(payment.projectId) : null;
          const effectiveStatus = installment.status === "pendente" && installment.dueDate && installment.dueDate < today() ? "atrasado" : installment.status;
          return <tr key={installment.id}><td><strong>{clientLabel(clientMap.get(installment.clientId))}</strong><small>{project?.name || payment?.description || "Cobrança"}</small></td><td>{installment.installmentNumber}/{payment?.installments || "—"}</td><td>{dateLabel(installment.dueDate)}</td><td>{currency.format(installment.amount)}</td><td>{currency.format(installment.paidAmount)}</td><td><span className={`payment-pill payment-${effectiveStatus}`}>{effectiveStatus === "pago" ? "Pago" : effectiveStatus === "atrasado" ? "Atrasado" : effectiveStatus === "cancelado" ? "Cancelado" : "Pendente"}</span></td><td>{effectiveStatus !== "pago" && effectiveStatus !== "cancelado" && <button type="button" className="ops-receive" onClick={() => markInstallmentPaid(installment)}>Receber</button>}</td></tr>;
        })}</tbody></table></div>
      ) : <div className="ops-empty"><strong>Nenhuma parcela gerada</strong><p>As parcelas aparecem automaticamente quando uma cobrança é cadastrada.</p></div>}
    </section>
  );
}
