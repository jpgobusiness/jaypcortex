"use client";

import { useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Building2, CreditCard, Home, Infinity, Info, Landmark, Plus, Receipt, Repeat, Waves } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select, Textarea } from "@/components/ui/form";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ErrorNote, Field, MoneyInput, Segmented, Toggle } from "@/components/finance/ui";
import { apiPost } from "@/lib/fetcher";
import { INTERVALS, LOAN_TYPES, MAX_CARD_INSTALLMENTS, SUGGESTED_INTERVAL } from "@/lib/finance/constants";
import { addMonthsToKey, addMonthsYmd, formatYmd, monthOf, shortMonth } from "@/lib/finance/dates";
import { currentCardInstallment } from "@/lib/finance/installments";
import { invoiceDates, invoiceMonthFor } from "@/lib/finance/invoice";
import { annualRate, buildSchedule, effectiveCost, impliedMonthlyRate } from "@/lib/finance/loan";
import { formatBRL, splitInstallments } from "@/lib/finance/money";
import type { FinCategory, FlowKind } from "@/lib/finance/types";

type Flow = "expense" | "income" | "transfer";

export type EntryPrefill = {
  flow?: Flow;
  mode?: ExpenseMode | IncomeMode;
  cardId?: string;
  accountId?: string;
  date?: string;
  categorySystem?: string;
};

export type ExpenseMode = "one_off" | "fixed" | "variable" | "card" | "subscription" | "loan";
type IncomeMode = "recurring" | "one_off";

export const EXPENSE_MODES: { value: ExpenseMode; label: string; hint: string; icon: typeof Receipt }[] = [
  { value: "one_off", label: "Pontual", hint: "Uma vez só", icon: Receipt },
  { value: "fixed", label: "Fixa", hint: "Todo mês, mesmo valor", icon: Repeat },
  { value: "variable", label: "Variável", hint: "Todo mês, valor muda", icon: Waves },
  { value: "card", label: "Cartão", hint: "À vista ou parcelado", icon: CreditCard },
  { value: "subscription", label: "Assinatura", hint: "No cartão, todo mês, sem fim", icon: Infinity },
  { value: "loan", label: "Empréstimo", hint: "Parcelas com juros", icon: Landmark },
];

const INCOME_MODES: { value: IncomeMode; label: string; hint: string; icon: typeof Receipt }[] = [
  { value: "recurring", label: "Recorrente", hint: "Salário, bônus, aluguel", icon: Repeat },
  { value: "one_off", label: "Pontual", hint: "Reembolso, venda, hora extra", icon: Receipt },
];

type LoanDraft = {
  name: string;
  lender: string;
  type: string;
  principal: number | null;
  count: string;
  rateMode: "rate" | "installment";
  rate: string;
  installment: number | null;
  amortization: "price" | "sac";
  firstDue: string;
  contractDate: string;
  paidBefore: string;
  fees: number | null;
  accountId: string;
  disbursed: boolean;
  disbursementAccountId: string;
  disbursementDate: string;
};

const parseRate = (value: string) => {
  const number = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(number) && number >= 0 ? number : null;
};
const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const parseTags = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 10);
const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

export function ModeCards<T extends string>({ modes, value, onChange }: { modes: { value: T; label: string; hint: string; icon: typeof Receipt }[]; value: T; onChange: (value: T) => void }) {
  return (
    <div className={`grid gap-2 ${modes.length > 4 ? "grid-cols-2 sm:grid-cols-3" : modes.length > 2 ? "grid-cols-2 sm:grid-cols-5" : "grid-cols-2"}`}>
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = mode.value === value;
        return (
          <button
            key={mode.value}
            type="button"
            onClick={() => onChange(mode.value)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all ${
              active ? "border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-2 ring-[var(--brand)]/20" : "border-[var(--border)] bg-white hover:border-black/20"
            }`}
          >
            <Icon className={`h-4 w-4 ${active ? "text-[var(--brand-600)]" : "text-[var(--muted)]"}`} />
            <span className="text-sm font-semibold text-[var(--foreground)]">{mode.label}</span>
            <span className="text-[11px] leading-tight text-[var(--muted)]">{mode.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CategorySelect({ kind, value, onChange, categories, id, emptyLabel = "Sem categoria" }: { kind: FlowKind; value: string; onChange: (id: string) => void; categories: FinCategory[]; id?: string; emptyLabel?: string }) {
  const list = categories.filter((category) => category.kind === kind && (!category.archived || category.id === value));
  const parents = list.filter((category) => !category.parentId);
  return (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {parents.map((parent) => [
        <option key={parent.id} value={parent.id}>
          {parent.name}
        </option>,
        ...list
          .filter((child) => child.parentId === parent.id)
          .map((child) => (
            <option key={child.id} value={child.id}>
              {"\u00a0\u00a0\u00a0"}↳ {child.name}
            </option>
          )),
      ])}
    </Select>
  );
}

export function Hint({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "muted" }) {
  return (
    <p className={`flex items-start gap-2 rounded-xl px-3 py-2 text-xs leading-relaxed ${tone === "brand" ? "bg-[var(--brand)]/[0.07] text-[var(--brand-600)]" : "bg-black/[0.03] text-[var(--muted)]"}`}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Modal de novo lançamento: despesa (pontual, fixa, variável, cartão, assinatura, empréstimo), receita ou transferência. */
export default function EntryModal({ prefill, onClose }: { prefill: EntryPrefill; onClose: () => void }) {
  const { today, accounts, cards, categories, refresh, openAccount, openCard } = useFinance();
  const pathname = usePathname();
  const router = useRouter();
  const activeAccounts = accounts.filter((account) => !account.archived);
  const activeCards = cards.filter((card) => !card.archived);
  const systemId = (key: string) => categories.find((category) => category.system === key)?.id ?? "";

  const startMode = prefill.mode;
  const [flow, setFlow] = useState<Flow>(prefill.flow ?? (startMode === "recurring" ? "income" : "expense"));
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>(
    startMode === "subscription"
      ? "subscription"
      : prefill.cardId
        ? "card"
        : startMode && startMode !== "recurring"
          ? (startMode as ExpenseMode)
          : "one_off"
  );
  const [incomeMode, setIncomeMode] = useState<IncomeMode>(startMode === "recurring" ? "recurring" : "one_off");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [date, setDate] = useState(prefill.date ?? today);
  const [categoryId, setCategoryId] = useState(
    prefill.categorySystem
      ? systemId(prefill.categorySystem)
      : startMode === "recurring"
        ? systemId("salario")
        : startMode === "loan"
          ? systemId("emprestimos")
          : startMode === "subscription"
            ? systemId("assinaturas")
            : ""
  );
  const [payWith, setPayWith] = useState<"account" | "card">(prefill.cardId ? "card" : "account");
  const [accountId, setAccountId] = useState(prefill.accountId ?? activeAccounts[0]?.id ?? "");
  const [cardId, setCardId] = useState(prefill.cardId ?? activeCards[0]?.id ?? "");
  const [toAccountId, setToAccountId] = useState(activeAccounts.find((account) => account.id !== (prefill.accountId ?? activeAccounts[0]?.id))?.id ?? "");
  const [paid, setPaid] = useState(true);
  const [installments, setInstallments] = useState(1);
  const [intervalMonths, setIntervalMonths] = useState(1);
  const [endDate, setEndDate] = useState("");
  const [variableIncome, setVariableIncome] = useState(false);
  const [tags, setTags] = useState("");
  const [notes, setNotes] = useState("");
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loan, setLoan] = useState<LoanDraft>(() => ({
    name: "",
    lender: "",
    type: "personal",
    principal: null,
    count: "12",
    rateMode: "rate",
    rate: "",
    installment: null,
    amortization: "price",
    firstDue: addMonthsYmd(today, 1),
    contractDate: today,
    paidBefore: "0",
    fees: null,
    accountId: prefill.accountId ?? activeAccounts[0]?.id ?? "",
    disbursed: false,
    disbursementAccountId: prefill.accountId ?? activeAccounts[0]?.id ?? "",
    disbursementDate: today,
  }));
  const setLoanField = <K extends keyof LoanDraft>(key: K, value: LoanDraft[K]) => setLoan((current) => ({ ...current, [key]: value }));

  const isLoan = flow === "expense" && expenseMode === "loan";
  const isSubscription = flow === "expense" && expenseMode === "subscription";
  const isRecurring = (flow === "expense" && (expenseMode === "fixed" || expenseMode === "variable" || isSubscription)) || (flow === "income" && incomeMode === "recurring");
  const housingSystem = categories.find((item) => item.id === categoryId)?.system;
  const isHousing = housingSystem === "aluguel" || housingSystem === "condominio";
  const onCard = flow === "expense" && (expenseMode === "card" || isSubscription || (payWith === "card" && expenseMode !== "loan"));
  const card = activeCards.find((item) => item.id === cardId);
  const invoice = onCard && card ? (() => {
    const month = invoiceMonthFor(date, card);
    return { month, ...invoiceDates(month, card) };
  })() : null;

  function changeFlow(next: Flow) {
    setFlow(next);
    setError(null);
    setCategoryId(next === "income" && incomeMode === "recurring" ? systemId("salario") : next === "expense" && expenseMode === "loan" ? systemId("emprestimos") : "");
  }

  function changeExpenseMode(next: ExpenseMode) {
    setExpenseMode(next);
    setError(null);
    if (next === "card" || next === "subscription") setPayWith("card");
    if (next === "loan") setCategoryId(systemId("emprestimos"));
    else if (next === "subscription") {
      setCategoryId(systemId("assinaturas"));
      setIntervalMonths(1);
      setEndDate("");
    } else if (expenseMode === "loan" || expenseMode === "subscription") setCategoryId("");
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

  function changeIncomeMode(next: IncomeMode) {
    setIncomeMode(next);
    if (next === "recurring" && !categoryId) setCategoryId(systemId("salario"));
  }

  function changeCategory(id: string) {
    setCategoryId(id);
    const suggested = SUGGESTED_INTERVAL[categories.find((category) => category.id === id)?.system ?? ""];
    if (isRecurring && suggested) setIntervalMonths(suggested);
  }

  const loanPreview = useMemo(() => {
    const count = Number(loan.count);
    if (!isLoan || !loan.principal || !Number.isInteger(count) || count < 1 || !loan.firstDue) return null;
    let rate = parseRate(loan.rate);
    let installment: number | null = null;
    if (loan.amortization === "price" && loan.rateMode === "installment") {
      if (!loan.installment) return null;
      installment = loan.installment;
      rate = impliedMonthlyRate(loan.principal, installment, count);
    }
    if (rate === null) return null;
    const schedule = buildSchedule({ principalCents: loan.principal, monthlyRate: rate, installmentCount: count, amortization: loan.amortization, installmentCents: installment, firstDueDate: loan.firstDue });
    const paidBefore = Math.min(count - 1, Math.max(0, Number(loan.paidBefore) || 0));
    return {
      rate,
      annual: annualRate(rate),
      first: schedule[0].amountCents,
      last: schedule[schedule.length - 1].amountCents,
      interest: schedule.reduce((sum, row) => sum + row.interestCents, 0),
      total: schedule.reduce((sum, row) => sum + row.amountCents, 0),
      cet: effectiveCost({ principalCents: loan.principal, feesCents: loan.fees ?? 0, contractDate: loan.contractDate || null, firstDueDate: loan.firstDue, schedule }),
      balance: paidBefore > 0 ? schedule[paidBefore - 1].balanceCents : loan.principal,
      lastDue: schedule[schedule.length - 1].dueDate,
    };
  }, [isLoan, loan]);

  async function send(url: string, body: unknown, monthToShow?: string) {
    setSaving(true);
    setError(null);
    try {
      const created = await apiPost<{ id?: string; recurrenceId?: string }>(url, body);
      await refresh();
      if (url === "/api/financas/loans" && created.id) {
        onClose();
        router.push(`/financas/emprestimos/${created.id}`);
        return;
      }
      const housingCat = categories.find((item) => item.id === categoryId);
      if (created.recurrenceId && (housingCat?.system === "aluguel" || housingCat?.system === "condominio")) {
        onClose();
        router.push("/financas/recorrentes");
        return;
      }
      if (monthToShow) revealDespesasMonth(monthToShow);
      onClose();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    setError(null);
    const extras = { categoryId: categoryId || null, tags: parseTags(tags), notes: notes.trim() || undefined };
    if (isLoan) {
      const count = Number(loan.count);
      if (!loan.name.trim()) return setError("Dê um nome ao empréstimo");
      if (!loan.principal) return setError("Informe o valor contratado");
      if (!loanPreview) return setError(loan.rateMode === "installment" ? "Informe o valor da parcela" : "Informe a taxa de juros");
      if (!loan.accountId) return setError("Escolha a conta que paga as parcelas");
      const paidBefore = Number(loan.paidBefore) || 0;
      return send(
        "/api/financas/loans",
        {
          name: loan.name,
          lender: loan.lender,
          type: loan.type,
          principalCents: loan.principal,
          feesCents: loan.fees ?? 0,
          amortization: loan.amortization,
          installmentCount: count,
          ...(loan.amortization === "price" && loan.rateMode === "installment" ? { installmentCents: loan.installment } : { monthlyRate: parseRate(loan.rate) }),
          firstDueDate: loan.firstDue,
          contractDate: loan.contractDate || null,
          paidBeforeCount: paidBefore,
          accountId: loan.accountId,
          categoryId: extras.categoryId,
          notes: extras.notes,
          disbursement: loan.disbursed
            ? { accountId: loan.disbursementAccountId, date: loan.disbursementDate, amountCents: loan.principal - (loan.fees ?? 0) }
            : null,
        },
        monthOf(addMonthsYmd(loan.firstDue, paidBefore))
      );
    }
    if (!amount || amount <= 0) return setError("Informe o valor");
    if (flow === "transfer") {
      if (!accountId || !toAccountId) return setError("Escolha a conta de origem e a de destino");
      return send("/api/financas/transactions", { mode: "transfer", amountCents: amount, date, accountId, toAccountId, description: description.trim() || undefined, tags: extras.tags, notes: extras.notes });
    }
    if (!description.trim()) return setError("Dê uma descrição");
    if (onCard && !cardId) return setError("Escolha ou crie um cartão");
    if (!onCard && !accountId) return setError("Escolha ou crie uma conta");
    if (isRecurring) {
      const type = flow === "income" ? (variableIncome ? "variable" : "fixed") : expenseMode === "variable" ? "variable" : "fixed";
      return send(
        "/api/financas/transactions",
        {
          mode: "recurring",
          kind: flow,
          type,
          description,
          amountCents: amount,
          ...(onCard ? { cardId } : { accountId }),
          intervalMonths: isSubscription ? 1 : intervalMonths,
          dayOfMonth: Number(date.slice(8, 10)),
          startDate: date,
          endDate: isSubscription ? null : endDate || null,
          firstPaid: !onCard && paid && date <= today,
          ...extras,
        },
        date > today ? monthOf(date) : monthOf(today)
      );
    }
    if (onCard) {
      const dueMonth = card && invoice ? monthOf(invoice.dueDate) : monthOf(date);
      return send(
        "/api/financas/transactions",
        {
          mode: "card",
          description,
          amountCents: amount,
          date,
          cardId,
          installments: expenseMode === "card" ? installments : 1,
          ...extras,
        },
        dueMonth
      );
    }
    return send("/api/financas/transactions", { mode: "one_off", kind: flow, description, amountCents: amount, date, accountId, paid, ...extras });
  }

  const accountPicker = (value: string, onChange: (id: string) => void, label: string, exclude?: string) => (
    <Field label={label}>
      <div className="flex gap-2">
        <Select value={value} onChange={(event) => onChange(event.target.value)}>
          {activeAccounts.length === 0 && <option value="">Crie uma conta →</option>}
          {activeAccounts
            .filter((account) => account.id !== exclude)
            .map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
        </Select>
        <Button variant="outline" onClick={() => openAccount(null, onChange)} title="Nova conta" aria-label="Nova conta">
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

  const payWithPicker = (
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
      {payWith === "card" ? cardPicker : accountPicker(accountId, setAccountId, "Conta")}
    </div>
  );

  const kind: FlowKind = flow === "income" ? "income" : "expense";
  const parts = amount && installments > 1 ? splitInstallments(amount, installments) : null;
  const titles: Record<Flow, string> = { expense: "Nova despesa", income: "Nova receita", transfer: "Nova transferência" };
  const action = isLoan ? "Criar empréstimo" : isSubscription ? "Salvar assinatura" : flow === "transfer" ? "Transferir" : flow === "income" ? "Lançar receita" : "Lançar despesa";

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={isLoan ? "Novo empréstimo ou financiamento" : titles[flow]}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando..." : action}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={flow}
          onChange={changeFlow}
          options={[
            { value: "expense", label: "Despesa", icon: <ArrowDownRight className="h-4 w-4" />, activeClass: "text-rose-600" },
            { value: "income", label: "Receita", icon: <ArrowUpRight className="h-4 w-4" />, activeClass: "text-emerald-600" },
            { value: "transfer", label: "Transferência", icon: <ArrowLeftRight className="h-4 w-4" />, activeClass: "text-[var(--brand-600)]" },
          ]}
        />
        {flow === "expense" && <ModeCards modes={EXPENSE_MODES} value={expenseMode} onChange={changeExpenseMode} />}
        {flow === "income" && <ModeCards modes={INCOME_MODES} value={incomeMode} onChange={changeIncomeMode} />}
        {flow === "expense" && expenseMode === "fixed" && (
          <div className="flex flex-wrap gap-2">
            {(["aluguel", "condominio"] as const).map((key) => {
              const id = systemId(key);
              const active = categoryId === id;
              const Icon = key === "aluguel" ? Home : Building2;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    changeCategory(id);
                    if (!description.trim() || description === "Aluguel" || description === "Condomínio") {
                      setDescription(key === "aluguel" ? "Aluguel" : "Condomínio");
                    }
                    setIntervalMonths(1);
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active ? "border-[var(--brand)] bg-[var(--brand)]/10 text-[var(--brand-600)]" : "border-[var(--border)] text-[var(--muted)] hover:border-black/20"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {key === "aluguel" ? "Aluguel" : "Condomínio"}
                </button>
              );
            })}
          </div>
        )}
        <ErrorNote message={error} />

        {isLoan ? (
          <LoanFields loan={loan} setField={setLoanField} preview={loanPreview} accountPicker={accountPicker} />
        ) : flow === "transfer" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {accountPicker(accountId, setAccountId, "De")}
            {accountPicker(toAccountId, setToAccountId, "Para", accountId)}
            <Field label="Valor">
              <MoneyInput value={amount} onChange={setAmount} large autoFocus />
            </Field>
            <Field label="Data" htmlFor="entry-date">
              <Input id="entry-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Descrição (opcional)" className="sm:col-span-2">
              <Input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Aporte na reserva" />
            </Field>
            <div className="sm:col-span-2">
              <Hint tone="muted">Transferência entre contas suas não conta como receita nem despesa.</Hint>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Descrição" htmlFor="entry-description">
              <Input
                id="entry-description"
                autoFocus
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={flow === "income" ? (incomeMode === "recurring" ? "Ex.: Salário" : "Ex.: Reembolso da viagem") : isSubscription ? "Ex.: Netflix, iCloud, academia" : expenseMode === "card" ? "Ex.: Notebook" : expenseMode === "variable" ? "Ex.: Conta de luz" : expenseMode === "fixed" ? "Ex.: Aluguel" : "Ex.: Farmácia"}
              />
            </Field>
            <Field label={expenseMode === "card" && flow === "expense" ? "Valor total da compra" : isRecurring && (expenseMode === "variable" || variableIncome) ? "Valor estimado" : "Valor"}>
              <MoneyInput value={amount} onChange={setAmount} large />
            </Field>
            <Field
              label={isHousing ? "Pago desde" : isSubscription ? "Cobra desde" : isRecurring ? (flow === "income" ? "Primeiro recebimento" : "Primeiro vencimento") : onCard ? "Data da compra" : "Data"}
              htmlFor="entry-date"
              hint={isHousing ? "Os meses desde esta data entram no histórico. Depois você ajusta o valor de cada um em Recorrentes." : isSubscription ? `Todo dia ${Number(date.slice(8, 10))}, na fatura do cartão.` : isRecurring ? `Repete todo dia ${Number(date.slice(8, 10))} (ou no último dia do mês).` : undefined}
            >
              <Input id="entry-date" type="date" value={date} onChange={(event) => setPurchaseDate(event.target.value)} />
            </Field>
            <Field label="Categoria" htmlFor="entry-category">
              <CategorySelect id="entry-category" kind={kind} value={categoryId} onChange={changeCategory} categories={categories} />
            </Field>

            {isRecurring && !isSubscription && (
              <>
                <Field label="Frequência" htmlFor="entry-interval">
                  <Select id="entry-interval" value={intervalMonths} onChange={(event) => setIntervalMonths(Number(event.target.value))}>
                    {INTERVALS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Termina em (opcional)" htmlFor="entry-end" hint="Vazio = sem data para acabar.">
                  <Input id="entry-end" type="date" value={endDate} min={date} onChange={(event) => setEndDate(event.target.value)} />
                </Field>
              </>
            )}

            {expenseMode === "card" && flow === "expense" && (
              <>
                <Field label="Parcelas" htmlFor="entry-installments">
                  <Select id="entry-installments" value={installments} onChange={(event) => setInstallmentCount(Number(event.target.value))}>
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

            <div className="sm:col-span-2">
              {flow === "income"
                ? accountPicker(accountId, setAccountId, "Entra na conta")
                : expenseMode === "card" || isSubscription
                  ? cardPicker
                  : payWithPicker}
            </div>

            {invoice && (
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
                      {isRecurring ? "O primeiro lançamento" : "Esta compra"} entra na fatura de <strong>{shortMonth(invoice.month)}</strong>, que vence em{" "}
                      {formatYmd(invoice.dueDate)}.
                    </>
                  )}
                </Hint>
              </div>
            )}

            {!onCard && (
              <div className="space-y-3 sm:col-span-2">
                {isRecurring && flow === "income" && (
                  <Toggle checked={variableIncome} onChange={setVariableIncome} label="O valor muda todo mês" hint="Ex.: comissão. Você confirma o valor real quando receber." />
                )}
                {(!isRecurring || date <= today) && (
                  <Toggle
                    checked={paid}
                    onChange={setPaid}
                    label={isRecurring ? (flow === "income" ? "Já recebi o primeiro" : "Já paguei o primeiro") : flow === "income" ? "Já recebi" : "Já paguei"}
                    hint={paid ? "Entra no saldo da conta." : "Fica pendente na agenda até você confirmar."}
                  />
                )}
              </div>
            )}

            {isSubscription && (
              <div className="sm:col-span-2">
                <Hint>
                  Entra na fatura todo mês, sem parcelamento e sem data para acabar. Cancelar depois só para de lançar os próximos — o que já foi para a fatura fica.
                </Hint>
              </div>
            )}
            {isRecurring && !isSubscription && (
              <div className="sm:col-span-2">
                <Hint tone="muted">
                  Lançamos os próximos 12 meses sozinhos e seguimos renovando.{" "}
                  {expenseMode === "variable" || variableIncome ? "Todo mês você confirma o valor real." : "Cada mês aparece para você confirmar o pagamento."}
                </Hint>
              </div>
            )}
          </div>
        )}

        {!isLoan && (
          <div>
            <button type="button" onClick={() => setMore((value) => !value)} className="text-xs font-medium text-[var(--brand-600)] hover:underline">
              {more ? "Menos opções" : "Mais opções (tags e observação)"}
            </button>
            {more && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Tags" hint="Separe por vírgula. Ex.: viagem-2026, casa">
                  <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="viagem-2026" />
                </Field>
                <Field label="Observação">
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-11!" rows={2} />
                </Field>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

function LoanFields({
  loan,
  setField,
  preview,
  accountPicker,
}: {
  loan: LoanDraft;
  setField: <K extends keyof LoanDraft>(key: K, value: LoanDraft[K]) => void;
  preview: {
    rate: number;
    annual: number;
    first: number;
    last: number;
    interest: number;
    total: number;
    cet: { monthly: number; annual: number } | null;
    balance: number;
    lastDue: string;
  } | null;
  accountPicker: (value: string, onChange: (id: string) => void, label: string) => ReactNode;
}) {
  const count = Number(loan.count) || 0;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome" htmlFor="loan-name">
          <Input id="loan-name" autoFocus value={loan.name} onChange={(event) => setField("name", event.target.value)} placeholder="Ex.: Financiamento do carro" />
        </Field>
        <Field label="Banco ou credor" htmlFor="loan-lender">
          <Input id="loan-lender" value={loan.lender} onChange={(event) => setField("lender", event.target.value)} placeholder="Ex.: Itaú" />
        </Field>
        <Field label="Tipo" htmlFor="loan-type">
          <Select id="loan-type" value={loan.type} onChange={(event) => setField("type", event.target.value)}>
            {LOAN_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Valor contratado">
          <MoneyInput value={loan.principal} onChange={(value) => setField("principal", value)} />
        </Field>
        <Field label="Número de parcelas" htmlFor="loan-count">
          <Input id="loan-count" type="number" min={1} max={600} value={loan.count} onChange={(event) => setField("count", event.target.value)} />
        </Field>
        <Field label="Sistema" hint={loan.amortization === "price" ? "Price: parcelas iguais (o mais comum)." : "SAC: parcela cai todo mês, menos juros no total."}>
          <Segmented
            size="sm"
            value={loan.amortization}
            onChange={(value) => setField("amortization", value)}
            options={[
              { value: "price", label: "Price" },
              { value: "sac", label: "SAC" },
            ]}
          />
        </Field>
        {loan.amortization === "price" && (
          <div className="sm:col-span-2">
            <Segmented
              size="sm"
              value={loan.rateMode}
              onChange={(value) => setField("rateMode", value)}
              options={[
                { value: "rate", label: "Sei a taxa de juros" },
                { value: "installment", label: "Sei o valor da parcela" },
              ]}
            />
          </div>
        )}
        {loan.amortization === "price" && loan.rateMode === "installment" ? (
          <Field label="Valor da parcela" hint="Calculamos os juros que estão embutidos.">
            <MoneyInput value={loan.installment} onChange={(value) => setField("installment", value)} />
          </Field>
        ) : (
          <Field label="Juros ao mês (%)" htmlFor="loan-rate" hint="Está no contrato. Ex.: 1,99">
            <Input id="loan-rate" inputMode="decimal" value={loan.rate} onChange={(event) => setField("rate", event.target.value.replace(/[^\d,.]/g, ""))} placeholder="1,99" />
          </Field>
        )}
        <Field label="Primeiro vencimento" htmlFor="loan-first">
          <Input id="loan-first" type="date" value={loan.firstDue} onChange={(event) => setField("firstDue", event.target.value)} />
        </Field>
        <Field label="Parcelas já pagas" htmlFor="loan-paid" hint="Para empréstimos em andamento. Só lançamos as que faltam.">
          <Input id="loan-paid" type="number" min={0} max={Math.max(0, count - 1)} value={loan.paidBefore} onChange={(event) => setField("paidBefore", event.target.value)} />
        </Field>
        <div className="sm:col-span-2">{accountPicker(loan.accountId, (id) => setField("accountId", id), "Conta que paga as parcelas")}</div>
        <Field label="IOF e tarifas (opcional)" hint="Descontados do valor recebido. Entram no CET.">
          <MoneyInput value={loan.fees} onChange={(value) => setField("fees", value)} />
        </Field>
        <Field label="Data do contrato" htmlFor="loan-contract">
          <Input id="loan-contract" type="date" value={loan.contractDate} onChange={(event) => setField("contractDate", event.target.value)} />
        </Field>
        <div className="space-y-3 sm:col-span-2">
          <Toggle
            checked={loan.disbursed}
            onChange={(value) => setField("disbursed", value)}
            label="O dinheiro entrou numa conta minha"
            hint="Soma no saldo, mas não conta como receita. Deixe desligado se o empréstimo é antigo."
          />
          {loan.disbursed && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {accountPicker(loan.disbursementAccountId, (id) => setField("disbursementAccountId", id), "Conta que recebeu")}
              <Field label="Data da entrada">
                <Input type="date" value={loan.disbursementDate} onChange={(event) => setField("disbursementDate", event.target.value)} />
              </Field>
            </div>
          )}
        </div>
      </div>

      <aside className="h-fit rounded-2xl bg-gradient-to-br from-[#15171c] to-[#2b2350] p-4 text-white lg:sticky lg:top-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-white/60">Simulação</p>
        {preview ? (
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs text-white/60">{loan.amortization === "sac" ? "1ª parcela → última" : "Parcela"}</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {formatBRL(preview.first)}
                {loan.amortization === "sac" && <span className="text-sm font-normal text-white/70"> → {formatBRL(preview.last)}</span>}
              </dd>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <dt className="text-xs text-white/60">Juros</dt>
                <dd className="font-medium">{pct(preview.rate)} a.m.</dd>
                <dd className="text-xs text-white/60">{pct(preview.annual)} a.a.</dd>
              </div>
              <div>
                <dt className="text-xs text-white/60">CET</dt>
                <dd className="font-medium">{preview.cet ? `${pct(preview.cet.monthly)} a.m.` : "—"}</dd>
                <dd className="text-xs text-white/60">{preview.cet ? `${pct(preview.cet.annual)} a.a.` : ""}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-white/60">Você paga no total</dt>
              <dd className="font-medium tabular-nums">{formatBRL(preview.total + (loan.fees ?? 0))}</dd>
              <dd className="text-xs text-rose-300">{formatBRL(preview.interest + (loan.fees ?? 0))} de juros e custos</dd>
            </div>
            <div>
              <dt className="text-xs text-white/60">Saldo devedor hoje</dt>
              <dd className="font-medium tabular-nums">{formatBRL(preview.balance)}</dd>
              <dd className="text-xs text-white/60">Última parcela em {formatYmd(preview.lastDue)}</dd>
            </div>
          </dl>
        ) : (
          <p className="mt-3 text-sm text-white/70">Preencha valor, parcelas e a taxa (ou a parcela) para ver o custo real.</p>
        )}
      </aside>
    </div>
  );
}
