"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarCog, CalendarX2, ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Wallet } from "lucide-react";
import { CardVisual } from "@/components/finance/AccountsView";
import CardSubscriptionModal from "@/components/finance/CardSubscriptionModal";
import InvoicePayModal from "@/components/finance/InvoicePayModal";
import { useFinance } from "@/components/finance/FinanceProvider";
import { IconBubble } from "@/components/finance/icons";
import { ErrorNote, Field, InvoicePill, Panel, Progress, Stat, useApi } from "@/components/finance/ui";
import { breakdown, makeLookup } from "@/lib/finance/analytics";
import Modal from "@/components/ui/Modal";
import { Button, Input, Textarea } from "@/components/ui/form";
import { apiDelete, apiPatch } from "@/lib/fetcher";
import { addMonthsToKey, formatYmd, longMonth, shortMonth } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { FactRow, FinCard, FinInvoice, FinInvoiceDetail, FinRecurrence } from "@/lib/finance/types";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

function DatesModal({ card, invoice, onClose, onDone }: { card: FinCard; invoice: FinInvoiceDetail; onClose: () => void; onDone: () => void }) {
  const [closingDate, setClosingDate] = useState(invoice.closingDate);
  const [dueDate, setDueDate] = useState(invoice.dueDate);
  const [notes, setNotes] = useState(invoice.notes);
  const [error, setError] = useState<string | null>(null);
  async function save(reset = false) {
    try {
      await apiPatch(`/api/financas/cards/${card.id}/invoices/${invoice.month}`, reset ? { closingDate: null, dueDate: null } : { closingDate, dueDate, notes });
      onDone();
    } catch (cause) {
      setError(errorText(cause));
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={`Datas da fatura de ${shortMonth(invoice.month)}`}
      footer={
        <>
          {invoice.customDates && (
            <Button variant="ghost" className="sm:mr-auto" onClick={() => void save(true)}>
              Voltar ao padrão do cartão
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()}>Salvar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <p className="text-sm text-[var(--muted)]">Use quando o banco mudar as datas deste mês (feriado, ajuste de calendário).</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Fecha em">
            <Input type="date" value={closingDate} onChange={(event) => setClosingDate(event.target.value)} />
          </Field>
          <Field label="Vence em">
            <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <Field label="Observação" className="sm:col-span-2">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} className="min-h-11!" />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

export default function CardView({ id }: { id: string }) {
  const params = useSearchParams();
  const { ready, version, refresh, openEntry, openCard, editTransaction, category, categories, accounts, cards, account } = useFinance();
  const { data, error } = useApi<{ card: FinCard; invoices: FinInvoice[] }>(ready ? `/api/financas/cards/${id}` : null, version);
  const recurrences = useApi<FinRecurrence[]>(ready ? "/api/financas/recurrences" : null, version);
  const [picked, setPicked] = useState<string | null>(params.get("fatura"));
  const [modal, setModal] = useState<"pay" | "dates" | null>(null);
  const [subscription, setSubscription] = useState<FinRecurrence | null | "new">(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const card = data?.card;
  const month = picked ?? card?.dueInvoice?.month ?? card?.openInvoice.month ?? null;
  const detail = useApi<FinInvoiceDetail>(month ? `/api/financas/cards/${id}/invoices/${month}` : null, version);
  const invoice = detail.data;

  if (error) return <p className="py-10 text-center text-sm text-rose-600">{error}</p>;
  if (!card || !data) return <p className="py-10 text-center text-sm text-[var(--muted)]">Carregando cartão...</p>;

  const lookup = makeLookup(categories, accounts, cards);
  const facts: FactRow[] = (invoice?.charges ?? []).map((row) => ({
    id: row.id,
    kind: "expense",
    month: row.invoiceMonth ?? "",
    date: row.date,
    amountCents: row.amountCents,
    realized: true,
    categoryId: row.categoryId,
    accountId: null,
    cardId: row.cardId,
    nature: row.nature ?? "one_off",
    description: row.description,
    tags: row.tags,
    interestCents: 0,
    loanId: null,
  }));
  const byCategory = breakdown(facts, "group", lookup, 6);
  const maxSlice = Math.max(1, ...byCategory.map((slice) => slice.value));

  const subscriptions = (recurrences.data ?? []).filter((rule) => rule.cardId === card.id);
  const activeSubs = subscriptions.filter((rule) => !rule.ended);
  const subTotal = activeSubs.reduce((sum, rule) => sum + rule.monthlyCents, 0);

  async function move(chargeId: string, target: string) {
    await apiPatch(`/api/financas/transactions/${chargeId}`, { invoiceMonth: target });
    await refresh();
  }

  async function cancelSubscription(rule: FinRecurrence) {
    if (
      !confirm(
        `Cancelar "${rule.description}"? Ela para de entrar nas próximas faturas. O que já foi lançado neste cartão continua no histórico.`
      )
    ) {
      return;
    }
    try {
      await apiDelete(`/api/financas/recurrences/${rule.id}?scope=future`);
      await refresh();
    } catch (cause) {
      setActionError(errorText(cause));
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Link href="/financas/contas" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
        <ArrowLeft className="h-4 w-4" /> Contas e cartões
      </Link>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <CardVisual card={card} />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Stat label="Limite" value={formatBRL(card.limitCents)} hint={<Progress value={card.usedCents} max={card.limitCents} />} />
          <Stat label="Usado" value={formatBRL(card.usedCents)} hint="Inclui parcelas futuras" tone="expense" />
          <Stat label="Disponível" value={formatBRL(card.availableCents)} tone="income" />
          <Stat label="Melhor dia de compra" value={`Dia ${card.closingDay}`} hint="Compras a partir dele vão para a fatura seguinte" />
          <Stat label="Vencimento" value={`Dia ${card.dueDay}`} hint={account(card.paymentAccountId)?.name ? `Paga com ${account(card.paymentAccountId)?.name}` : "Sem conta de pagamento"} />
          <div className="flex flex-col justify-center gap-2 rounded-2xl border border-[var(--border)] bg-white p-3">
            <Button onClick={() => openEntry({ flow: "expense", mode: "card", cardId: card.id })}>
              <Plus className="h-4 w-4" /> Nova compra
            </Button>
            <Button variant="outline" onClick={() => setSubscription("new")}>
              <Repeat className="h-4 w-4" /> Nova assinatura
            </Button>
            <Button variant="outline" onClick={() => openCard(card)}>
              <Pencil className="h-4 w-4" /> Editar cartão
            </Button>
          </div>
        </div>
      </div>

      <ErrorNote message={actionError} />

      <Panel
        title="Assinaturas neste cartão"
        subtitle={activeSubs.length > 0 ? `${activeSubs.length} ativas · ${formatBRL(subTotal)}/mês, sem fim. Não é parcelamento.` : "Netflix, iCloud, academia… cobra todo mês na fatura, sem parcelas e sem data para acabar."}
        action={
          <Button variant="ghost" onClick={() => setSubscription("new")}>
            <Plus className="h-4 w-4" />
          </Button>
        }
      >
        {subscriptions.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">Nenhuma assinatura neste cartão.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {subscriptions.map((rule) => {
              const cat = category(rule.categoryId);
              return (
                <li key={rule.id} className={`flex items-center gap-3 py-2.5 ${rule.ended ? "opacity-50" : ""}`}>
                  <IconBubble icon={cat?.icon ?? "repeat"} color={cat?.color ?? "#a855f7"} size="sm" />
                  <button type="button" onClick={() => setSubscription(rule)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-slate-800">{rule.description}</span>
                      <span className="shrink-0 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10.5px] font-medium text-[var(--brand-600)]">
                        {rule.ended ? "Cancelada" : "Assinatura"}
                      </span>
                    </span>
                    <span className="block text-xs text-[var(--muted)]">
                      dia {rule.dayOfMonth}
                      {rule.type === "variable" ? " · valor varia" : ""}
                      {rule.ended ? " · parou de lançar" : " · sem fim"}
                    </span>
                  </button>
                  <span className="text-sm font-semibold tabular-nums">{formatBRL(rule.amountCents)}</span>
                  {!rule.ended && (
                    <button
                      type="button"
                      onClick={() => void cancelSubscription(rule)}
                      title="Cancelar assinatura"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]"
                    >
                      <CalendarX2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="scroll-x-fade -mx-1 flex gap-2 px-1 pb-1">
        {data.invoices.map((item) => (
          <button
            key={item.month}
            type="button"
            onClick={() => setPicked(item.month)}
            className={`min-w-28 shrink-0 rounded-2xl border px-3 py-2.5 text-left transition-all ${
              item.month === month ? "border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-2 ring-[var(--brand)]/20" : "border-[var(--border)] bg-white hover:border-black/20"
            }`}
          >
            <p className="text-xs font-semibold capitalize text-slate-700">{shortMonth(item.month)}</p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums">{formatBRL(item.totalCents)}</p>
            <div className="mt-1">
              <InvoicePill status={item.status} />
            </div>
          </button>
        ))}
      </div>

      {invoice && (
        <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
          <Panel
            title={`Fatura de ${longMonth(invoice.month)}`}
            subtitle={
              <span className="flex flex-wrap items-center gap-2">
                <InvoicePill status={invoice.status} /> Fecha {formatYmd(invoice.closingDate)} · vence {formatYmd(invoice.dueDate)}
                {invoice.customDates && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[10.5px]">datas ajustadas</span>}
              </span>
            }
            action={
              <div className="flex gap-1">
                <button type="button" onClick={() => setPicked(addMonthsToKey(invoice.month, -1))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]" aria-label="Fatura anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setPicked(addMonthsToKey(invoice.month, 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]" aria-label="Próxima fatura">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            }
          >
            <div className="grid grid-cols-3 gap-3 rounded-2xl bg-black/[0.03] p-3">
              <div>
                <p className="text-xs text-[var(--muted)]">Total</p>
                <p className="text-lg font-semibold tabular-nums">{formatBRL(invoice.totalCents)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Pago</p>
                <p className="text-lg font-semibold tabular-nums text-emerald-600">{formatBRL(invoice.paidCents)}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Em aberto</p>
                <p className={`text-lg font-semibold tabular-nums ${invoice.openCents > 0 ? "text-rose-600" : ""}`}>{formatBRL(invoice.openCents)}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {invoice.openCents > 0 && (
                <Button onClick={() => setModal("pay")}>
                  <Wallet className="h-4 w-4" /> Pagar fatura
                </Button>
              )}
              <Button variant="outline" onClick={() => setModal("dates")}>
                <CalendarCog className="h-4 w-4" /> Ajustar datas
              </Button>
            </div>

            {invoice.charges.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--muted)]">Nenhuma compra nesta fatura.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[var(--border)]">
                {invoice.charges.map((charge) => {
                  const cat = category(charge.categoryId);
                  return (
                    <li key={charge.id} className="flex items-center gap-3 py-2.5">
                      <button type="button" onClick={() => editTransaction(charge)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                        <IconBubble icon={cat?.icon ?? "tag"} color={cat?.color ?? "#94a3b8"} size="sm" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm text-slate-800">{charge.description}</span>
                            {charge.installmentNumber && (
                              <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-slate-600">
                                {charge.installmentNumber}/{charge.installmentCount}
                              </span>
                            )}
                            {charge.nature === "fixed" && <span className="shrink-0 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10.5px] font-medium text-[var(--brand-600)]">Assinatura</span>}
                          </span>
                          <span className="block text-xs text-[var(--muted)]">
                            {formatYmd(charge.date)} · {cat?.name ?? "Sem categoria"}
                          </span>
                        </span>
                      </button>
                      <span className="text-sm font-medium tabular-nums">{formatBRL(charge.amountCents)}</span>
                      <span className="flex">
                        <button type="button" onClick={() => void move(charge.id, addMonthsToKey(invoice.month, -1))} title="Mover para a fatura anterior" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05]">
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => void move(charge.id, addMonthsToKey(invoice.month, 1))} title="Mover para a próxima fatura" className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05]">
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {invoice.payments.length > 0 && (
              <div className="mt-4 rounded-2xl bg-emerald-50/60 p-3">
                <p className="text-xs font-semibold text-emerald-800">Pagamentos</p>
                <ul className="mt-1 space-y-1">
                  {invoice.payments.map((payment) => (
                    <li key={payment.id} className="flex justify-between text-sm text-emerald-900">
                      <button type="button" onClick={() => editTransaction(payment)} className="hover:underline">
                        {formatYmd(payment.date)} · {account(payment.accountId)?.name ?? "Conta"}
                      </button>
                      <span className="tabular-nums">{formatBRL(payment.amountCents)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {invoice.notes && <p className="mt-3 text-xs text-[var(--muted)]">Obs.: {invoice.notes}</p>}
          </Panel>

          <Panel title="Onde foi a fatura" subtitle="Por categoria">
            {byCategory.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted)]">Sem compras.</p>
            ) : (
              <ul className="space-y-3">
                {byCategory.map((slice) => (
                  <li key={slice.key}>
                    <div className="flex justify-between text-sm">
                      <span className="truncate text-slate-700">{slice.label}</span>
                      <span className="tabular-nums">{formatBRL(slice.value)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                      <div className="h-full rounded-full" style={{ width: `${(slice.value / maxSlice) * 100}%`, backgroundColor: slice.color }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {modal === "pay" && invoice && (
        <InvoicePayModal card={card} invoice={invoice} onClose={() => setModal(null)} onDone={() => { setModal(null); void refresh(); }} />
      )}
      {modal === "dates" && invoice && (
        <DatesModal card={card} invoice={invoice} onClose={() => setModal(null)} onDone={() => { setModal(null); void refresh(); }} />
      )}
      {subscription && (
        <CardSubscriptionModal
          cardId={card.id}
          rule={subscription === "new" ? null : subscription}
          onClose={() => setSubscription(null)}
          onDone={() => {
            setSubscription(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
