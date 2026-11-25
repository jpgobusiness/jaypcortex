"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, CreditCard, Landmark, Pencil, Plus, ReceiptText } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { FinIcon } from "@/components/finance/icons";
import { EmptyState, InvoicePill, Progress, Stat } from "@/components/finance/ui";
import { Button } from "@/components/ui/form";
import { ACCOUNT_TYPES, CARD_BRANDS } from "@/lib/finance/constants";
import { formatYmd, shortMonth } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { FinAccount, FinCard } from "@/lib/finance/types";

export function CardVisual({ card, compact = false }: { card: FinCard; compact?: boolean }) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl text-white shadow-[0_14px_30px_-12px_rgba(15,23,42,0.45)] ${compact ? "h-36 p-4" : "h-44 p-5"}`}
      style={{ background: `linear-gradient(135deg, ${card.color} 0%, ${card.color}d9 50%, #0b0b12 140%)` }}
    >
      <span className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
      <span className="absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-white/[0.06]" />
      <div className="relative flex items-start justify-between">
        <p className="max-w-[70%] truncate text-sm font-semibold">{card.name}</p>
        <CreditCard className="h-5 w-5 text-white/70" />
      </div>
      <div className="relative mt-3 h-6 w-9 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />
      <p className="relative mt-3 font-mono text-sm tracking-[0.25em] text-white/85">•••• {card.last4 ?? "····"}</p>
      <div className="absolute inset-x-5 bottom-4 flex items-end justify-between text-xs">
        <span className="text-white/70">
          Fecha dia {card.closingDay} · vence dia {card.dueDay}
        </span>
        <span className="font-semibold uppercase tracking-wide text-white/85">{CARD_BRANDS.find((item) => item.value === card.brand)?.label}</span>
      </div>
    </div>
  );
}

function AccountTile({ account, onEdit }: { account: FinAccount; onEdit: () => void }) {
  const type = ACCOUNT_TYPES.find((item) => item.value === account.type);
  return (
    <div className={`group relative overflow-hidden rounded-2xl border border-[var(--border)] bg-white p-4 ${account.archived ? "opacity-60" : ""}`}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: account.color }} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${account.color}1f`, color: account.color }}>
            <FinIcon name={type?.icon ?? "landmark"} className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-800">{account.name}</p>
            <p className="truncate text-xs text-[var(--muted)]">
              {type?.label}
              {account.institution ? ` · ${account.institution}` : ""}
              {!account.includeInTotals ? " · fora do total" : ""}
            </p>
          </div>
        </div>
        <button type="button" onClick={onEdit} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]" aria-label="Editar conta">
          <Pencil className="h-4 w-4" />
        </button>
      </div>
      <p className={`mt-4 text-2xl font-semibold tabular-nums tracking-tight ${account.balanceCents < 0 ? "text-rose-600" : "text-slate-900"}`}>{formatBRL(account.balanceCents)}</p>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-[var(--muted)]">
        {account.pendingInCents > 0 && <span className="text-emerald-600">+ {formatBRL(account.pendingInCents)} a receber</span>}
        {account.pendingOutCents > 0 && <span className="text-rose-600">− {formatBRL(account.pendingOutCents)} a pagar</span>}
        {account.pendingInCents === 0 && account.pendingOutCents === 0 && <span>Nada pendente</span>}
      </div>
      <Link href={`/financas/lancamentos?conta=${account.id}`} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-[var(--brand-600)] hover:underline">
        Ver extrato <ChevronRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

function CardTile({ card, onEdit }: { card: FinCard; onEdit: () => void }) {
  const due = card.dueInvoice;
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-white p-3 ${card.archived ? "opacity-60" : ""}`}>
      <Link href={`/financas/cartoes/${card.id}`} className="block transition-transform hover:-translate-y-0.5">
        <CardVisual card={card} compact />
      </Link>
      <div className="space-y-3 px-1 pb-1 pt-4">
        <div>
          <div className="mb-1.5 flex justify-between text-xs text-[var(--muted)]">
            <span>Limite usado {card.limitCents > 0 ? `${Math.round((card.usedCents / card.limitCents) * 100)}%` : ""}</span>
            <span>{formatBRL(card.availableCents)} livres</span>
          </div>
          <Progress value={card.usedCents} max={card.limitCents} />
        </div>
        <div className="flex items-center justify-between rounded-xl bg-black/[0.03] px-3 py-2">
          <div>
            <p className="text-[11px] text-[var(--muted)]">Fatura de {shortMonth(card.openInvoice.month)}</p>
            <p className="text-sm font-semibold tabular-nums">{formatBRL(card.openInvoice.totalCents)}</p>
          </div>
          <div className="text-right">
            <InvoicePill status={card.openInvoice.status} />
            <p className="mt-0.5 text-[11px] text-[var(--muted)]">Fecha {formatYmd(card.openInvoice.closingDate, false)}</p>
          </div>
        </div>
        {due && (
          <Link
            href={`/financas/cartoes/${card.id}?fatura=${due.month}`}
            className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${due.status === "overdue" ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-800"}`}
          >
            <span>
              {due.status === "overdue" ? "Venceu em" : "A pagar até"} {formatYmd(due.dueDate, false)}
            </span>
            <span className="font-semibold tabular-nums">{formatBRL(due.openCents)}</span>
          </Link>
        )}
        <div className="flex gap-2">
          <Link href={`/financas/cartoes/${card.id}`} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] py-2 text-sm font-medium hover:bg-black/[0.03]">
            <ReceiptText className="h-4 w-4" /> Faturas
          </Link>
          <button type="button" onClick={onEdit} className="inline-flex items-center justify-center rounded-lg border border-[var(--border)] px-3 text-[var(--muted)] hover:bg-black/[0.03]" aria-label="Editar cartão">
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AccountsView() {
  const { accounts, cards, ready, openAccount, openCard } = useFinance();
  const [showArchived, setShowArchived] = useState(false);
  if (!ready) return <p className="py-10 text-center text-sm text-[var(--muted)]">Carregando...</p>;

  const visibleAccounts = accounts.filter((account) => showArchived || !account.archived);
  const visibleCards = cards.filter((card) => showArchived || !card.archived);
  const counted = accounts.filter((account) => account.includeInTotals && !account.archived);
  const activeCards = cards.filter((card) => !card.archived);
  const toPay = activeCards.reduce((sum, card) => sum + (card.dueInvoice?.openCents ?? 0) + card.openInvoice.openCents, 0);
  const archivedCount = accounts.filter((account) => account.archived).length + cards.filter((card) => card.archived).length;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Saldo total" value={formatBRL(counted.reduce((sum, account) => sum + account.balanceCents, 0))} hint={`${counted.length} conta(s) no total`} />
        <Stat label="A receber no mês" value={formatBRL(counted.reduce((sum, account) => sum + account.pendingInCents, 0))} tone="income" />
        <Stat label="A pagar no mês" value={formatBRL(counted.reduce((sum, account) => sum + account.pendingOutCents, 0))} tone="expense" />
        <Stat
          label="Cartões"
          value={formatBRL(activeCards.reduce((sum, card) => sum + card.availableCents, 0))}
          hint={`livres · ${formatBRL(toPay)} em faturas`}
          tone="brand"
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Landmark className="h-4 w-4 text-[var(--muted)]" /> Contas
          </h2>
          <Button variant="outline" onClick={() => openAccount()}>
            <Plus className="h-4 w-4" /> Nova conta
          </Button>
        </div>
        {visibleAccounts.length === 0 ? (
          <EmptyState icon={<Landmark className="h-5 w-5" />} title="Nenhuma conta ainda" text="Cadastre onde seu dinheiro fica: conta corrente, poupança, carteira, investimentos ou VR/VA." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleAccounts.map((account) => (
              <AccountTile key={account.id} account={account} onEdit={() => openAccount(account)} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <CreditCard className="h-4 w-4 text-[var(--muted)]" /> Cartões de crédito
          </h2>
          <Button variant="outline" onClick={() => openCard()}>
            <Plus className="h-4 w-4" /> Novo cartão
          </Button>
        </div>
        {visibleCards.length === 0 ? (
          <EmptyState icon={<CreditCard className="h-5 w-5" />} title="Nenhum cartão ainda" text="Com limite, fechamento e vencimento, as faturas se montam sozinhas a cada compra." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleCards.map((card) => (
              <CardTile key={card.id} card={card} onEdit={() => openCard(card)} />
            ))}
          </div>
        )}
      </section>

      {archivedCount > 0 && (
        <button type="button" onClick={() => setShowArchived((value) => !value)} className="text-xs font-medium text-[var(--brand-600)] hover:underline">
          {showArchived ? "Esconder arquivados" : `Mostrar arquivados (${archivedCount})`}
        </button>
      )}
    </div>
  );
}
