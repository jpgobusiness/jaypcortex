"use client";

import { useState } from "react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ErrorNote, Field, MoneyInput } from "@/components/finance/ui";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { apiPost } from "@/lib/fetcher";
import { shortMonth } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { FinCard, FinInvoice } from "@/lib/finance/types";

/** Registrar o pagamento (total ou parcial) de uma fatura de cartão. */
export default function InvoicePayModal({
  card,
  invoice,
  onClose,
  onDone,
}: {
  card: FinCard;
  invoice: Pick<FinInvoice, "month" | "openCents">;
  onClose: () => void;
  onDone: () => void;
}) {
  const { accounts, today } = useFinance();
  const [accountId, setAccountId] = useState(card.paymentAccountId ?? accounts.find((account) => !account.archived)?.id ?? "");
  const [amount, setAmount] = useState<number | null>(invoice.openCents || null);
  const [date, setDate] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function pay() {
    if (!amount || amount <= 0) return setError("Informe o valor pago");
    if (!accountId) return setError("Escolha a conta");
    setSaving(true);
    try {
      await apiPost(`/api/financas/cards/${card.id}/invoices/${invoice.month}`, { accountId, amountCents: amount, date });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar");
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Pagar fatura de ${shortMonth(invoice.month)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={pay} disabled={saving}>
            {saving ? "Pagando..." : "Registrar pagamento"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Valor pago" hint={`Em aberto: ${formatBRL(invoice.openCents)}. Pode pagar parte (o resto fica em aberto).`}>
            <MoneyInput value={amount} onChange={setAmount} large autoFocus />
          </Field>
          <Field label="Data">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Pago com a conta" className="sm:col-span-2">
            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts
                .filter((account) => !account.archived)
                .map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name} · {formatBRL(account.balanceCents)}
                  </option>
                ))}
            </Select>
          </Field>
        </div>
        <p className="text-xs text-[var(--muted)]">O pagamento sai da conta, mas não conta como despesa de novo: as compras da fatura já contam.</p>
      </div>
    </Modal>
  );
}
