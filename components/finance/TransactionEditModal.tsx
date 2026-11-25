"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CreditCard, Landmark, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select, Textarea } from "@/components/ui/form";
import { CategorySelect, EXPENSE_MODES, Hint, ModeCards, type ExpenseMode } from "@/components/finance/EntryModal";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ErrorNote, Field, MoneyInput, Segmented, Toggle } from "@/components/finance/ui";
import { apiDelete, apiGet, apiPatch } from "@/lib/fetcher";
import { INTERVALS, MAX_CARD_INSTALLMENTS } from "@/lib/finance/constants";
import { addMonthsToKey, formatYmd, monthOf, parseYmd, shortMonth } from "@/lib/finance/dates";
import { currentCardInstallment, purchaseDateOf } from "@/lib/finance/installments";
import { invoiceDates, invoiceMonthFor } from "@/lib/finance/invoice";
import { formatBRL, splitInstallments } from "@/lib/finance/money";
import type { FinRecurrence, FinTransaction } from "@/lib/finance/types";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");
const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 10);

function initialMode(t: FinTransaction): ExpenseMode {
  if (t.loanId) return "loan";
  if (t.recurrenceId) return t.nature === "variable" ? "variable" : "fixed";
  if (t.cardId) return "card";
  return "one_off";
}

/** Editar um lançamento: mesma visão do novo lançamento (tipo, cartão, parcelas, início e fim). */
export default function TransactionEditModal({ transaction: t, onClose }: { transaction: FinTransaction; onClose: () => void }) {
  const { refresh, categories, accounts, cards, card: cardOf, today, openAccount, openCard } = useFinance();
  const pathname = usePathname();
  const router = useRouter();
  const flow = t.kind === "income" || t.kind === "expense";
  const isExpense = t.kind === "expense";
  const isLoan = Boolean(t.loanId) && isExpense;
  const activeAccounts = accounts.filter((account) => !account.archived || account.id === t.accountId);
  const activeCards = cards.filter((card) => !card.archived || card.id === t.cardId);

  const [mode, setMode] = useState<ExpenseMode>(initialMode(t));
  const [description, setDescription] = useState(t.description);
  const [amount, setAmount] = useState<number | null>(Math.abs(t.amountCents));
  const [date, setDate] = useState(t.loanId ? t.date : purchaseDateOf(t.date, t.installmentNumber));
  const [categoryId, setCategoryId] = useState(t.categoryId ?? "");
  const [accountId, setAccountId] = useState(t.accountId ?? activeAccounts[0]?.id ?? "");
  const [cardId, setCardId] = useState(t.cardId ?? activeCards[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(t.toAccountId ?? "");
  const [invoiceMonth, setInvoiceMonth] = useState(t.invoiceMonth ?? "");
  const [paid, setPaid] = useState(t.paidAt !== null);
  const [paidAt, setPaidAt] = useState(t.paidAt ?? (t.date <= today ? t.date : today));
  const [installments, setInstallments] = useState(t.installmentCount ?? 1);
  const [groupMeta, setGroupMeta] = useState({
    total: Math.abs(t.amountCents),
    date: purchaseDateOf(t.date, t.installmentNumber),
    start: t.installmentNumber ?? 1,
    count: t.installmentCount ?? 1,
  });
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [startDate, setStartDate] = useState(t.date);
  const [rule, setRule] = useState<FinRecurrence | null>(null);
  const [payWith, setPayWith] = useState<"account" | "card">(t.cardId ? "card" : "account");
  const [tags, setTags] = useState(t.tags.join(", "));
  const [notes, setNotes] = useState(t.notes);
  const [applyToGroup, setApplyToGroup] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (t.installmentGroupId || (t.cardId && (t.installmentCount ?? 1) > 1)) {
      void apiGet<{ purchaseDate: string; purchaseTotalCents: number; startInstallment: number }>(`/api/financas/transactions/${t.id}`).then(
        (detail) => {
          if (cancelled) return;
          setDate(detail.purchaseDate);
          setAmount(detail.purchaseTotalCents);
          setInstallments(t.installmentCount ?? 1);
          setGroupMeta({
            total: detail.purchaseTotalCents,
            date: detail.purchaseDate,
            start: detail.startInstallment,
            count: t.installmentCount ?? 1,
          });
        },
        () => undefined
      );
    }
    if (t.recurrenceId) {
      void apiGet<FinRecurrence[]>("/api/financas/recurrences").then(
        (list) => {
          if (cancelled) return;
          const found = list.find((item) => item.id === t.recurrenceId);
          if (!found) return;
          setRule(found);
          setStartDate(found.startDate);
          setEndDate(found.endDate ?? "");
          if (t.kind === "expense") {
            setAmount(found.amountCents);
            setDate(found.startDate);
          }
          setIntervalMonths(found.intervalMonths);
          setPayWith(found.cardId ? "card" : "account");
          if (found.cardId) setCardId(found.cardId);
          if (found.accountId) setAccountId(found.accountId);
        },
        () => undefined
      );
    }
    return () => {
      cancelled = true;
    };
  }, [t]);

  const isRecurring = isExpense && (mode === "fixed" || mode === "variable");
  const onCard = isExpense && !isLoan && (mode === "card" || (isRecurring && payWith === "card"));
  const card = cardOf(cardId) ?? activeCards.find((item) => item.id === cardId);
  const invoice =
    onCard && card
      ? (() => {
          const computed = invoiceMonthFor(date, card);
          const month = mode === "card" && installments === 1 && invoiceMonth ? invoiceMonth : computed;
          return { month, ...invoiceDates(month, card) };
        })()
      : null;
  const parts = amount && onCard && mode === "card" && installments > 1 ? splitInstallments(amount, installments) : null;
  const invoiceOptions = invoiceMonth
    ? [-2, -1, 0, 1, 2, 3].map((delta) => addMonthsToKey(invoiceMonth, delta))
    : invoice
      ? [-2, -1, 0, 1, 2, 3].map((delta) => addMonthsToKey(invoice.month, delta))
      : [];
  const editModes = useMemo(
    () =>
      isLoan
        ? EXPENSE_MODES.filter((item) => item.value === "loan")
        : EXPENSE_MODES.filter((item) => item.value !== "loan" && item.value !== "subscription"),
    [isLoan]
  );

  async function run(action: () => Promise<unknown>, monthToShow?: string) {
    setSaving(true);
    setError(null);
    try {
      await action();
      await refresh();
      if (monthToShow) revealDespesasMonth(monthToShow);
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function changeMode(next: ExpenseMode) {
    if (isLoan) return;
    setMode(next);
    setError(null);
    if (next === "card") {
      setPayWith("card");
      setDate(startDate || date);
    }
    if (next === "fixed" || next === "variable") setStartDate(date);
  }

  function setPurchaseDate(next: string) {
    setDate(next);
  }

  function setInstallmentCount(count: number) {
    setInstallments(count);
  }

  function revealDespesasMonth(month: string) {
    if (!pathname.startsWith("/financas/despesas")) return;
    router.replace(month === monthOf(today) ? "/financas/despesas" : `/financas/despesas?mes=${month}`);
  }

  function save() {
    if (amount === null || amount === 0 || (t.kind !== "adjustment" && amount < 0)) return setError("Informe um valor válido");
    if (!description.trim()) return setError("Dê uma descrição");
    const nextTags = parseTags(tags);
    const body: Record<string, unknown> = {};

    if (!isExpense || t.kind === "transfer") {
      if (description !== t.description) body.description = description;
      if (amount !== t.amountCents) body.amountCents = amount;
      if (date !== t.date) body.date = date;
      if (flow && (categoryId || null) !== t.categoryId) body.categoryId = categoryId || null;
      if (t.accountId && accountId && accountId !== t.accountId) body.accountId = accountId;
      if (t.kind === "transfer" && toAccountId !== t.toAccountId) body.toAccountId = toAccountId;
      if (flow && !t.cardId) {
        const next = paid ? paidAt : null;
        if (next !== t.paidAt) body.paidAt = next;
      }
      if (nextTags.join(",") !== t.tags.join(",")) body.tags = nextTags;
      if (notes !== t.notes) body.notes = notes;
      if (Object.keys(body).length === 0) return onClose();
      return void run(() => apiPatch(`/api/financas/transactions/${t.id}`, body));
    }

    if (isLoan) {
      if (description !== t.description) body.description = description;
      if (date !== t.date) body.date = date;
      if ((categoryId || null) !== t.categoryId) body.categoryId = categoryId || null;
      const nextPaid = paid ? paidAt : null;
      if (nextPaid !== t.paidAt) body.paidAt = nextPaid;
      if (nextTags.join(",") !== t.tags.join(",")) body.tags = nextTags;
      if (notes !== t.notes) body.notes = notes;
      if (Object.keys(body).length === 0) return onClose();
      return void run(() => apiPatch(`/api/financas/transactions/${t.id}`, body), monthOf(date));
    }

    if (description !== t.description) body.description = description;
    if ((categoryId || null) !== t.categoryId) body.categoryId = categoryId || null;
    if (nextTags.join(",") !== t.tags.join(",")) body.tags = nextTags;
    if (notes !== t.notes) body.notes = notes;

    if (isRecurring) {
      if (!onCard && !accountId) return setError("Escolha a conta");
      if (onCard && !cardId) return setError("Escolha o cartão");
      body.amountCents = amount;
      body.recurrence = {
        type: mode === "variable" ? "variable" : "fixed",
        intervalMonths,
        startDate,
        endDate: endDate || null,
        dayOfMonth: parseYmd(startDate).d,
      };
      if (onCard) body.cardId = cardId;
      else body.accountId = accountId;
      return void run(() => apiPatch(`/api/financas/transactions/${t.id}`, body));
    }

    if (mode === "card") {
      if (!cardId) return setError("Escolha o cartão");
      const originalCount = groupMeta.count;
      const originalDate = groupMeta.date;
      const cardChanged = cardId !== t.cardId;
      const planChanged = installments !== originalCount || date !== originalDate || amount !== groupMeta.total || groupMeta.start > 1;
      body.cardId = cardId;
      body.installmentCount = installments;
      body.startInstallment = 1;
      body.date = date;
      body.amountCents = amount;
      if (installments === 1 && invoiceMonth && invoiceMonth !== t.invoiceMonth) body.invoiceMonth = invoiceMonth;
      if (t.installmentGroupId && applyToGroup && !planChanged && !cardChanged) body.applyToGroup = true;
      const dueMonth = card && invoice ? monthOf(invoice.dueDate) : monthOf(date);
      return void run(() => apiPatch(`/api/financas/transactions/${t.id}`, body), planChanged || cardChanged ? dueMonth : undefined);
    }

    // Pontual na conta (pode estar saindo do cartão).
    if (!accountId) return setError("Escolha a conta");
    const leavingCard = Boolean(t.cardId);
    if (leavingCard) {
      body.cardId = null;
      body.accountId = accountId;
      body.date = date;
      body.amountCents = amount;
      body.paidAt = paid ? paidAt : null;
    } else {
      if (amount !== t.amountCents) body.amountCents = amount;
      if (date !== t.date) body.date = date;
      if (accountId !== t.accountId) body.accountId = accountId;
      const next = paid ? paidAt : null;
      if (next !== t.paidAt) body.paidAt = next;
    }
    if (Object.keys(body).length === 0) return onClose();
    void run(() => apiPatch(`/api/financas/transactions/${t.id}`, body));
  }

  const remove = (scope: "one" | "group" | "future") => run(() => apiDelete(`/api/financas/transactions/${t.id}?scope=${scope}`));
  const multi = Boolean(t.installmentGroupId || t.recurrenceId);

  const accountPicker = (
    <Field label={t.kind === "transfer" ? "De" : "Conta"}>
      <div className="flex gap-2">
        <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          {activeAccounts.length === 0 && <option value="">Crie uma conta →</option>}
          {activeAccounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => openAccount(null, setAccountId)} title="Nova conta" aria-label="Nova conta">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Field>
  );

  const cardPicker = (
    <Field label="Cartão">
      <div className="flex gap-2">
        <Select value={cardId} onChange={(event) => setCardId(event.target.value)}>
          {activeCards.length === 0 && <option value="">Crie um cartão →</option>}
          {activeCards.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
              {item.last4 ? ` •••• ${item.last4}` : ""}
            </option>
          ))}
        </Select>
        <Button variant="outline" onClick={() => openCard(null, setCardId)} title="Novo cartão" aria-label="Novo cartão">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </Field>
  );

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Editar lançamento"
      footer={
        <>
          <Button
            variant="ghost"
            className="text-rose-600 sm:mr-auto"
            disabled={saving}
            onClick={() =>
              isLoan || multi ? setConfirmDelete(true) : confirm("Excluir este lançamento?") && void remove("one")
            }
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <ErrorNote message={error} />
        {confirmDelete && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            {isLoan ? (
              <>
                <p className="text-sm font-medium text-rose-800">Excluir o empréstimo e todas as parcelas?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant="danger"
                    onClick={() => void run(() => apiDelete(`/api/financas/loans/${t.loanId}`))}
                    disabled={saving}
                  >
                    Excluir empréstimo
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-rose-800">O que você quer excluir?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void remove("one")} disabled={saving}>
                    {t.installmentGroupId ? "Só esta parcela" : "Só este mês"}
                  </Button>
                  <Button variant="danger" onClick={() => void remove(t.installmentGroupId ? "group" : "future")} disabled={saving}>
                    {t.installmentGroupId ? "Todas as parcelas" : "Este e os próximos"}
                  </Button>
                  <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {isExpense && <ModeCards modes={editModes} value={mode} onChange={changeMode} />}

        {isLoan && (
          <Hint>
            Clique no empréstimo para a visão completa (parcelas, pago e quitação).{" "}
            <Link href={`/financas/emprestimos/${t.loanId}`} className="font-semibold underline" onClick={onClose}>
              Abrir empréstimo
            </Link>
            {t.installmentNumber && t.installmentCount ? ` (parcela ${t.installmentNumber}/${t.installmentCount}).` : "."}
          </Hint>
        )}

        {t.kind === "transfer" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Descrição" className="sm:col-span-2">
              <Input value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <Field label="Valor">
              <MoneyInput value={amount} onChange={setAmount} large />
            </Field>
            <Field label="Data">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            {accountPicker}
            <Field label="Para">
              <Select value={toAccountId} onChange={(event) => setToAccountId(event.target.value)}>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Descrição" htmlFor="edit-description">
              <Input id="edit-description" autoFocus value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <Field
              label={
                mode === "card"
                  ? "Valor total da compra"
                  : isRecurring && mode === "variable"
                    ? "Valor estimado"
                    : t.recurrenceId && t.nature === "variable"
                      ? "Valor real"
                      : "Valor"
              }
            >
              <MoneyInput value={amount} onChange={setAmount} large allowNegative={t.kind === "adjustment"} />
            </Field>
            <Field
              label={isLoan ? "Vencimento" : isRecurring ? "Começa em" : onCard ? "Data da compra" : "Data"}
              htmlFor="edit-date"
              hint={
                isLoan
                  ? "O mês da despesa segue o vencimento. Pago em (abaixo) é só o caixa."
                  : isRecurring
                    ? `Repete todo dia ${parseYmd(startDate).d} (ou no último dia do mês).`
                    : undefined
              }
            >
              <Input
                id="edit-date"
                type="date"
                value={isRecurring ? startDate : date}
                onChange={(event) => {
                  if (isRecurring) setStartDate(event.target.value);
                  else setPurchaseDate(event.target.value);
                }}
              />
            </Field>
            {flow && (
              <Field label="Categoria">
                <CategorySelect kind={t.kind === "income" ? "income" : "expense"} value={categoryId} onChange={setCategoryId} categories={categories} />
              </Field>
            )}

            {isRecurring && (
              <>
                <Field label="Frequência" htmlFor="edit-interval">
                  <Select id="edit-interval" value={intervalMonths} onChange={(event) => setIntervalMonths(Number(event.target.value))}>
                    {INTERVALS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Termina em (opcional)" htmlFor="edit-end" hint="Vazio = sem data para acabar.">
                  <Input id="edit-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
                </Field>
              </>
            )}

            {mode === "card" && (
              <>
                <Field label="Parcelas" htmlFor="edit-installments">
                  <Select
                    id="edit-installments"
                    value={installments}
                    onChange={(event) => setInstallmentCount(Number(event.target.value))}
                  >
                    {Array.from({ length: MAX_CARD_INSTALLMENTS }, (_, index) => index + 1).map((count) => (
                      <option key={count} value={count}>
                        {count === 1 ? "À vista (1x)" : `${count}x`}
                      </option>
                    ))}
                  </Select>
                </Field>
                {installments > 1 && currentCardInstallment(date, installments, today) > 1 && (
                  <p className="text-sm text-[var(--muted)]">
                    Hoje esta compra estaria na {currentCardInstallment(date, installments, today)}ª de {installments}.
                    As {installments} parcelas entram nos meses desde {shortMonth(date.slice(0, 7))} — a data da compra manda, não o mês de hoje.
                  </p>
                )}
              </>
            )}

            {isLoan && t.installmentCount ? (
              <Field label="Parcelas">
                <div className="flex h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-sm text-[var(--muted)]">
                  <Landmark className="h-4 w-4" />
                  {t.installmentNumber}/{t.installmentCount}
                </div>
              </Field>
            ) : null}

            {isExpense && !isLoan && (
              <div className="sm:col-span-2">
                {mode === "card" ? (
                  cardPicker
                ) : isRecurring ? (
                  <div className="space-y-2">
                    <Segmented
                      size="sm"
                      value={payWith}
                      onChange={setPayWith}
                      options={[
                        { value: "account", label: "Pagar com conta", icon: <Landmark className="h-3.5 w-3.5" /> },
                        { value: "card", label: "Pagar no cartão", icon: <CreditCard className="h-3.5 w-3.5" /> },
                      ]}
                    />
                    {payWith === "card" ? cardPicker : accountPicker}
                  </div>
                ) : (
                  accountPicker
                )}
              </div>
            )}

            {mode === "card" && invoice && (
              <div className="sm:col-span-2">
                <Hint>
                  {parts ? (
                    <>
                      {installments}x de <strong>{formatBRL(parts[1])}</strong>
                      {parts[0] !== parts[1] && ` (1ª de ${formatBRL(parts[0])})`}. A 1ª entra na fatura de{" "}
                      <strong>{shortMonth(invoice.month)}</strong> e a última na de{" "}
                      {shortMonth(addMonthsToKey(invoice.month, installments - 1))}.
                    </>
                  ) : (
                    <>
                      Esta compra entra na fatura de <strong>{shortMonth(invoice.month)}</strong>, que vence em {formatYmd(invoice.dueDate)}.
                    </>
                  )}
                </Hint>
              </div>
            )}

            {mode === "card" && installments === 1 && invoiceOptions.length > 0 && (
              <Field label="Fatura" hint="Mude se o banco jogou a compra em outra fatura." className="sm:col-span-2">
                <Select value={invoiceMonth || invoice?.month || ""} onChange={(event) => setInvoiceMonth(event.target.value)}>
                  {invoiceOptions.map((month) => (
                    <option key={month} value={month}>
                      Fatura de {shortMonth(month)}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </div>
        )}

        {isExpense && !onCard && (isLoan || mode === "one_off") && (
          <div className="grid grid-cols-1 items-end gap-4 rounded-2xl bg-black/[0.03] p-4 sm:grid-cols-2">
            <Toggle
              checked={paid}
              onChange={setPaid}
              label="Pago"
              hint={
                paid
                  ? isLoan
                    ? "A data de pagamento manda no caixa; o vencimento continua no mês da parcela."
                    : "Conta no saldo."
                  : "Pendente na agenda."
              }
            />
            {paid && (
              <Field label="Pago em">
                <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
              </Field>
            )}
          </div>
        )}

        {t.kind === "income" && !t.cardId && (
          <div className="grid grid-cols-1 items-end gap-4 rounded-2xl bg-black/[0.03] p-4 sm:grid-cols-2">
            <Toggle checked={paid} onChange={setPaid} label="Recebido" hint={paid ? "Conta no saldo." : "Pendente na agenda."} />
            {paid && (
              <Field label="Recebido em">
                <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
              </Field>
            )}
          </div>
        )}

        {t.installmentGroupId && mode === "card" && (
          <Toggle checked={applyToGroup} onChange={setApplyToGroup} label="Levar descrição, categoria e tags para todas as parcelas" />
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tags" hint="Separe por vírgula.">
            <Input value={tags} onChange={(event) => setTags(event.target.value)} />
          </Field>
          <Field label="Observação">
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-11!" rows={2} />
          </Field>
        </div>
        {isRecurring && (
          <p className="text-xs text-[var(--muted)]">
            {rule
              ? "Isto atualiza a regra e refaz os lançamentos ainda não pagos de hoje em diante."
              : "Ao salvar, este lançamento vira uma recorrência (os próximos meses são gerados)."}
          </p>
        )}
      </div>
    </Modal>
  );
}
