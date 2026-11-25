"use client";

import { useState } from "react";
import { CategorySelect, Hint } from "@/components/finance/EntryModal";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ErrorNote, Field, MoneyInput, Segmented } from "@/components/finance/ui";
import Modal from "@/components/ui/Modal";
import { Button, Input } from "@/components/ui/form";
import { apiPatch, apiPost } from "@/lib/fetcher";
import { parseYmd } from "@/lib/finance/dates";
import type { FinRecurrence } from "@/lib/finance/types";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

export default function CardSubscriptionModal({
  cardId,
  rule,
  onClose,
  onDone,
}: {
  cardId: string;
  rule?: FinRecurrence | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { today, categories } = useFinance();
  const assinaturasId = categories.find((item) => item.system === "assinaturas")?.id ?? "";
  const [description, setDescription] = useState(rule?.description ?? "");
  const [amount, setAmount] = useState<number | null>(rule?.amountCents ?? null);
  const [type, setType] = useState<"fixed" | "variable">(rule?.type ?? "fixed");
  const [categoryId, setCategoryId] = useState(rule?.categoryId ?? assinaturasId);
  const [startDate, setStartDate] = useState(rule?.startDate ?? today);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!description.trim()) return setError("Dê um nome à assinatura");
    if (!amount || amount <= 0) return setError("Informe o valor");
    if (!startDate) return setError("Informe desde quando ela cobra");
    setSaving(true);
    setError(null);
    const dayOfMonth = parseYmd(startDate).d;
    try {
      if (rule) {
        await apiPatch(`/api/financas/recurrences/${rule.id}`, {
          description: description.trim(),
          amountCents: amount,
          type,
          categoryId: categoryId || null,
          cardId,
          dayOfMonth,
          intervalMonths: 1,
          startDate,
          endDate: null,
        });
      } else {
        await apiPost("/api/financas/transactions", {
          mode: "recurring",
          kind: "expense",
          type,
          description: description.trim(),
          amountCents: amount,
          cardId,
          intervalMonths: 1,
          dayOfMonth,
          startDate,
          endDate: null,
          categoryId: categoryId || null,
        });
      }
      onDone();
    } catch (cause) {
      setError(errorText(cause));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? "Editar assinatura" : "Nova assinatura no cartão"}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Salvando..." : "Salvar assinatura"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <Hint>
          Entra na fatura todo mês, sem parcelamento e sem data para acabar. Cancelar depois só para de lançar os próximos — o que já foi para a fatura fica.
        </Hint>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" className="sm:col-span-2">
            <Input
              autoFocus
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ex.: Netflix, iCloud, academia"
            />
          </Field>
          <Field label={type === "variable" ? "Valor estimado" : "Valor por mês"}>
            <MoneyInput value={amount} onChange={setAmount} large />
          </Field>
          <Field label="O valor">
            <Segmented
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: "fixed", label: "É sempre igual" },
                { value: "variable", label: "Muda" },
              ]}
            />
          </Field>
          <Field label="Cobra desde" hint={`Todo dia ${Number(startDate.slice(8, 10))}, na fatura do cartão.`}>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="Categoria">
            <CategorySelect kind="expense" value={categoryId} onChange={setCategoryId} categories={categories} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
