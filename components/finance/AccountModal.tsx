"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ColorSwatches, ErrorNote, Field, MoneyInput, Toggle } from "@/components/finance/ui";
import { apiDelete, apiPatch, apiPost } from "@/lib/fetcher";
import { ACCOUNT_TYPES, PALETTE } from "@/lib/finance/constants";
import { formatYmd } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { FinAccount } from "@/lib/finance/types";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

export default function AccountModal({ account, onClose, onSaved }: { account: FinAccount | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { refresh, today } = useFinance();
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState(account?.type ?? "checking");
  const [institution, setInstitution] = useState(account?.institution ?? "");
  const [color, setColor] = useState(account?.color ?? PALETTE[0]);
  const [initial, setInitial] = useState<number | null>(account?.initialBalanceCents ?? 0);
  const [initialDate, setInitialDate] = useState(account?.initialBalanceDate ?? today);
  const [includeInTotals, setIncludeInTotals] = useState(account?.includeInTotals ?? true);
  const [archived, setArchived] = useState(account?.archived ?? false);
  const [balance, setBalance] = useState<number | null>(account?.balanceCents ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Dê um nome para a conta");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = { name, type, institution, color, includeInTotals, initialBalanceCents: initial ?? 0, initialBalanceDate: initialDate };
      let id = account?.id ?? "";
      if (account) {
        const adjust = balance !== null && balance !== account.balanceCents ? { balanceCents: balance } : {};
        await apiPatch(`/api/financas/accounts/${account.id}`, { ...body, archived, ...adjust });
      } else {
        id = (await apiPost<{ id: string }>("/api/financas/accounts", body)).id;
      }
      await refresh();
      onSaved(id);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!account || !confirm(`Excluir a conta ${account.name}?`)) return;
    setSaving(true);
    try {
      await apiDelete(`/api/financas/accounts/${account.id}`);
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
      title={account ? `Editar conta · ${account.name}` : "Nova conta"}
      footer={
        <>
          {account && (
            <Button variant="ghost" className="text-rose-600 sm:mr-auto" onClick={remove} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Excluir
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : account ? "Salvar" : "Criar conta"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome" htmlFor="account-name">
            <Input id="account-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Nubank, Itaú, Carteira" />
          </Field>
          <Field label="Tipo" htmlFor="account-type">
            <Select id="account-type" value={type} onChange={(event) => setType(event.target.value)}>
              {ACCOUNT_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Banco ou instituição (opcional)" htmlFor="account-bank">
            <Input id="account-bank" value={institution} onChange={(event) => setInstitution(event.target.value)} placeholder="Ex.: Banco Inter" />
          </Field>
          <Field label="Cor">
            <ColorSwatches colors={PALETTE.slice(0, 14)} value={color} onChange={setColor} />
          </Field>
        </div>

        <div className="rounded-2xl bg-black/[0.03] p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Saldo inicial" hint="O saldo que a conta tinha nesta data.">
              <MoneyInput value={initial} onChange={setInitial} allowNegative />
            </Field>
            <Field label="Saldo em" htmlFor="account-date" hint="Lançamentos pagos antes desta data ficam só no histórico.">
              <Input id="account-date" type="date" value={initialDate} onChange={(event) => setInitialDate(event.target.value)} />
            </Field>
          </div>
          {account && (
            <div className="mt-4 border-t border-black/[0.06] pt-4">
              <Field
                label="Ajustar saldo: quanto tem hoje no banco?"
                hint={`Hoje o app calcula ${formatBRL(account.balanceCents)}. Se mudar, lançamos um ajuste com a diferença (não conta como receita nem despesa).`}
              >
                <MoneyInput value={balance} onChange={setBalance} allowNegative />
              </Field>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Toggle checked={includeInTotals} onChange={setIncludeInTotals} label="Somar no saldo total" hint="Desligue para benefícios (VR/VA) ou reservas que não quer ver no saldo do dia a dia." />
          {account && <Toggle checked={archived} onChange={setArchived} label="Arquivada" hint="Some das listas, mas o histórico continua." />}
        </div>
        {account && <p className="text-[11px] text-[var(--muted)]">Saldo inicial desde {formatYmd(account.initialBalanceDate)}.</p>}
      </div>
    </Modal>
  );
}
