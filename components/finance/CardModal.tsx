"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ColorSwatches, ErrorNote, Field, MoneyInput, Toggle } from "@/components/finance/ui";
import { apiDelete, apiPatch, apiPost } from "@/lib/fetcher";
import { CARD_BRANDS, PALETTE } from "@/lib/finance/constants";
import { formatYmd, shortMonth } from "@/lib/finance/dates";
import { invoiceDates, invoiceMonthFor } from "@/lib/finance/invoice";
import type { FinCard } from "@/lib/finance/types";

const CARD_COLORS = ["#15171c", "#8a05be", "#ff7a00", "#ec0000", "#003da5", "#0f766e", "#334155", "#7b68ee", "#b45309", "#1d4ed8"];
const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");
const toDay = (value: string) => Math.min(31, Math.max(1, Number(value) || 1));

export default function CardModal({ card, onClose, onSaved }: { card: FinCard | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { refresh, accounts, openAccount, today } = useFinance();
  const activeAccounts = accounts.filter((account) => !account.archived);
  const [name, setName] = useState(card?.name ?? "");
  const [brand, setBrand] = useState(card?.brand ?? "mastercard");
  const [last4, setLast4] = useState(card?.last4 ?? "");
  const [color, setColor] = useState(card?.color ?? CARD_COLORS[0]);
  const [limit, setLimit] = useState<number | null>(card?.limitCents ?? null);
  const [closingDay, setClosingDay] = useState(String(card?.closingDay ?? ""));
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? ""));
  const [paymentAccountId, setPaymentAccountId] = useState(card?.paymentAccountId ?? activeAccounts[0]?.id ?? "");
  const [archived, setArchived] = useState(card?.archived ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const daysReady = Number(closingDay) >= 1 && Number(dueDay) >= 1;
  const preview = daysReady
    ? (() => {
        const days = { closingDay: toDay(closingDay), dueDay: toDay(dueDay) };
        const month = invoiceMonthFor(today, days);
        return { month, ...invoiceDates(month, days) };
      })()
    : null;

  async function save() {
    if (!name.trim()) return setError("Dê um nome para o cartão");
    if (limit === null) return setError("Informe o limite (pode ser 0)");
    if (!daysReady) return setError("Informe o dia do fechamento e o do vencimento");
    if (last4 && !/^\d{4}$/.test(last4)) return setError("O final do cartão tem 4 números");
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        brand,
        last4: last4 || null,
        color,
        limitCents: limit,
        closingDay: toDay(closingDay),
        dueDay: toDay(dueDay),
        paymentAccountId: paymentAccountId || null,
      };
      let id = card?.id ?? "";
      if (card) await apiPatch(`/api/financas/cards/${card.id}`, { ...body, archived });
      else id = (await apiPost<{ id: string }>("/api/financas/cards", body)).id;
      await refresh();
      onSaved(id);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!card || !confirm(`Excluir o cartão ${card.name}?`)) return;
    setSaving(true);
    try {
      await apiDelete(`/api/financas/cards/${card.id}`);
      await refresh();
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={card ? `Editar cartão · ${card.name}` : "Novo cartão de crédito"}
      footer={
        <>
          {card && (
            <Button variant="ghost" className="text-rose-600 sm:mr-auto" onClick={remove} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : card ? "Salvar" : "Criar cartão"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <div
          className="relative h-28 overflow-hidden rounded-2xl p-4 text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, ${color} 0%, ${color}cc 55%, #00000055 100%)` }}
        >
          <span className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/10" />
          <p className="text-sm font-semibold">{name || "Nome do cartão"}</p>
          <p className="mt-6 font-mono text-sm tracking-[0.25em] text-white/80">•••• {last4 || "0000"}</p>
          <p className="absolute bottom-3 right-4 text-xs font-semibold uppercase text-white/80">{CARD_BRANDS.find((item) => item.value === brand)?.label}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="card-name">
            <Input id="card-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Nubank Ultravioleta" />
          </Field>
          <Field label="Limite total">
            <MoneyInput value={limit} onChange={setLimit} />
          </Field>
          <Field label="Bandeira" htmlFor="card-brand">
            <Select id="card-brand" value={brand} onChange={(event) => setBrand(event.target.value)}>
              {CARD_BRANDS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Final do cartão (opcional)" htmlFor="card-last4" hint="Só os 4 últimos números. Nunca guarde o número inteiro.">
            <Input id="card-last4" inputMode="numeric" maxLength={4} value={last4} onChange={(event) => setLast4(event.target.value.replace(/\D/g, ""))} placeholder="1234" />
          </Field>
          <Field label="Dia do fechamento" htmlFor="card-closing" hint="É o melhor dia de compra: o que você compra a partir dele vai para a fatura seguinte.">
            <Input id="card-closing" type="number" min={1} max={31} value={closingDay} onChange={(event) => setClosingDay(event.target.value)} placeholder="Ex.: 3" />
          </Field>
          <Field label="Dia do vencimento" htmlFor="card-due" hint="Sábado e domingo passam para segunda.">
            <Input id="card-due" type="number" min={1} max={31} value={dueDay} onChange={(event) => setDueDay(event.target.value)} placeholder="Ex.: 10" />
          </Field>
        </div>
        {preview && (
          <p className="rounded-xl bg-[var(--brand)]/[0.07] px-3 py-2 text-xs text-[var(--brand-600)]">
            Uma compra hoje entra na fatura de <strong>{shortMonth(preview.month)}</strong>, que fecha em {formatYmd(preview.closingDate)} e vence em{" "}
            {formatYmd(preview.dueDate)}.
          </p>
        )}
        <Field label="Conta que paga a fatura">
          <div className="flex gap-2">
            <Select value={paymentAccountId} onChange={(event) => setPaymentAccountId(event.target.value)}>
              <option value="">Escolher depois</option>
              {activeAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
            <Button variant="outline" onClick={() => openAccount(null, setPaymentAccountId)} title="Nova conta" aria-label="Nova conta">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Field>
        <Field label="Cor do cartão">
          <ColorSwatches colors={[...CARD_COLORS, ...PALETTE.slice(0, 4)]} value={color} onChange={setColor} />
        </Field>
        {card && <Toggle checked={archived} onChange={setArchived} label="Arquivado" hint="Some das listas, mas as faturas antigas continuam." />}
      </div>
    </Modal>
  );
}
