"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgePercent, Trash2 } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ErrorNote, Field, Panel, Segmented, Stat, useApi } from "@/components/finance/ui";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { apiDelete, apiPatch, apiPost } from "@/lib/fetcher";
import { LOAN_TYPES } from "@/lib/finance/constants";
import { formatYmd, isYmd } from "@/lib/finance/dates";
import { simulatePayoff, type PayoffQuoteKey } from "@/lib/finance/loan";
import { formatBRL } from "@/lib/finance/money";
import type { FinLoanDetail, LoanRowStatus } from "@/lib/finance/types";

const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");
const STATUS: Record<LoanRowStatus, { label: string; className: string }> = {
  paid_before: { label: "Paga antes", className: "bg-slate-100 text-slate-600" },
  paid: { label: "Paga", className: "bg-emerald-50 text-emerald-700" },
  pending: { label: "A pagar", className: "bg-amber-50 text-amber-700" },
  overdue: { label: "Atrasada", className: "bg-rose-50 text-rose-700" },
  settled: { label: "Quitada", className: "bg-violet-50 text-violet-700" },
};

type Tab = "parcelas" | "quitar";

export default function LoanDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { ready, version, refresh, today, account, accounts } = useFinance();
  const { data: loan, error: loadError, loading } = useApi<FinLoanDetail>(ready ? `/api/financas/loans/${id}` : null, version);
  const [tab, setTab] = useState<Tab>("parcelas");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [paidAt, setPaidAt] = useState("");
  const [paid, setPaid] = useState(false);
  const [scenario, setScenario] = useState<PayoffQuoteKey>("cdc");
  const [settleOn, setSettleOn] = useState(today);
  const [accountId, setAccountId] = useState("");
  const [confirmSettle, setConfirmSettle] = useState(false);
  const activeAccounts = accounts.filter((item) => !item.archived || item.id === loan?.accountId);
  const openRows = useMemo(() => loan?.schedule.filter((row) => row.status === "pending" || row.status === "overdue") ?? [], [loan]);
  const lastDue = openRows.at(-1)?.dueDate ?? today;
  const asOf = isYmd(settleOn) ? (settleOn < today ? today : settleOn) : today;
  const simulation = useMemo(
    () => (loan && openRows.length > 0 ? simulatePayoff(openRows, loan.monthlyRate, asOf) : null),
    [loan, openRows, asOf]
  );
  const quotes = simulation?.quotes ?? [];
  const quote = quotes.find((item) => item.key === scenario) ?? quotes[0] ?? null;
  const todayQuote = loan?.quotes.find((item) => item.key === "cdc") ?? null;
  const paidSoFarCents = useMemo(
    () =>
      (loan?.schedule ?? [])
        .filter((row) => row.status === "paid" || row.status === "paid_before" || row.status === "settled")
        .reduce((sum, row) => sum + row.amountCents, 0),
    [loan]
  );
  const scheduleWithAccumulated = useMemo(() => {
    let accumulatedCents = 0;
    return (loan?.schedule ?? []).map((row) => {
      accumulatedCents += row.amountCents;
      return { ...row, accumulatedCents };
    });
  }, [loan]);

  async function run(label: string, work: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await work();
      await refresh();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(null);
    }
  }

  function startEdit(row: FinLoanDetail["schedule"][number]) {
    setEditing(row.number);
    setDueDate(row.dueDate);
    setPaid(row.status === "paid");
    setPaidAt(row.paidAt ?? row.dueDate);
  }

  async function saveEdit(row: FinLoanDetail["schedule"][number]) {
    if (!row.transactionId) return;
    await run(`edit-${row.number}`, () =>
      apiPatch(`/api/financas/transactions/${row.transactionId}`, {
        date: dueDate,
        paidAt: paid ? paidAt || dueDate : null,
      })
    );
    setEditing(null);
  }

  async function pay(row: FinLoanDetail["schedule"][number]) {
    if (!row.transactionId) return;
    await run(`pay-${row.number}`, () => apiPatch(`/api/financas/transactions/${row.transactionId}`, { paidAt: row.dueDate }));
  }

  async function unpay(row: FinLoanDetail["schedule"][number]) {
    if (!row.transactionId) return;
    await run(`unpay-${row.number}`, () => apiPatch(`/api/financas/transactions/${row.transactionId}`, { paidAt: null }));
  }

  async function remove() {
    await run("delete", async () => {
      await apiDelete(`/api/financas/loans/${id}`);
      router.push("/financas/emprestimos");
    });
  }

  async function settle() {
    if (!todayQuote) return;
    await run("settle", async () => {
      await apiPost(`/api/financas/loans/${id}/settle`, {
        scenario: "cdc",
        payoffCents: todayQuote.payoffCents,
        accountId: accountId || loan?.accountId || undefined,
      });
      setConfirmSettle(false);
      setTab("parcelas");
    });
  }

  if (!loan) {
    return (
      <p className={`py-10 text-center text-sm ${loadError ? "text-rose-600" : "text-[var(--muted)]"}`}>
        {loadError ?? (loading ? "Carregando empréstimo..." : "Empréstimo não encontrado")}
      </p>
    );
  }

  const payAccount = accountId || loan.accountId || activeAccounts[0]?.id || "";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href="/financas/emprestimos" className="inline-flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)]">
            <ArrowLeft className="h-4 w-4" /> Empréstimos
          </Link>
          <h2 className="mt-1 text-xl font-semibold text-slate-800">{loan.name}</h2>
          <p className="text-sm text-[var(--muted)]">
            {LOAN_TYPES.find((item) => item.value === loan.type)?.label}
            {loan.lender ? ` · ${loan.lender}` : ""} · {loan.amortization === "sac" ? "SAC" : "Price"} · {loan.installmentCount} parcelas · paga com{" "}
            {account(loan.accountId)?.name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="text-rose-600" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" /> Excluir
          </Button>
        </div>
      </div>

      <ErrorNote message={error} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Saldo das parcelas"
          value={formatBRL(loan.balanceCents)}
          tone="expense"
          hint={
            loan.remainingCount > 0
              ? `${loan.remainingCount} × ${formatBRL(Math.round(loan.balanceCents / loan.remainingCount))}`
              : "Nada em aberto"
          }
        />
        <Stat
          label="Já paguei"
          value={formatBRL(paidSoFarCents)}
          tone="income"
          hint={`${loan.paidCount} de ${loan.installmentCount} parcelas`}
        />
        <Stat label="Juros" value={`${pct(loan.monthlyRate)} a.m.`} hint={`${pct(loan.annualRate)} a.a.`} />
        <Stat label="Custo total" value={formatBRL(loan.totalCostCents)} hint={`${formatBRL(loan.totalInterestCents + loan.feesCents)} de juros e custos`} />
      </div>

      {simulation && openRows.length > 0 && (
        <div className="rounded-2xl bg-gradient-to-br from-[#15171c] to-[#2b2350] p-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              {simulation.remainingCount === 0 ? (
                <>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">
                    <BadgePercent className="h-3.5 w-3.5" /> Nessa data já estaria quitado
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(0)}</p>
                  <p className="mt-1 text-sm text-white/75">
                    Até {formatYmd(asOf)}, as {simulation.assumedPaidCount} parcelas em aberto ({formatBRL(simulation.assumedPaidCents)}) já teriam sido pagas no vencimento.
                  </p>
                </>
              ) : quote ? (
                <>
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-white/60">
                    <BadgePercent className="h-3.5 w-3.5" /> Se juntar as {simulation.remainingCount} parcelas que ainda faltam
                  </p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{formatBRL(quote.payoffCents)}</p>
                  <p className="mt-1 text-sm text-white/75">
                    Em vez de {formatBRL(quote.nominalCents)}
                    {quote.savingsCents > 0 ? (
                      <>
                        : o banco desconta <strong className="text-emerald-300">{formatBRL(quote.savingsCents)}</strong> dos juros que ainda não venceram (CDC).
                      </>
                    ) : (
                      ". Sem juros futuros para descontar."
                    )}
                  </p>
                </>
              ) : null}
            </div>
            <label className="text-xs text-white/70">
              Quitar em
              <input
                type="date"
                value={asOf}
                min={today}
                max={lastDue}
                onChange={(event) => setSettleOn(event.target.value)}
                className="mt-1 block rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white [color-scheme:dark]"
              />
            </label>
          </div>
          {simulation.assumedPaidCount > 0 && (
            <p className="mt-3 text-sm text-white/80">
              Até {formatYmd(asOf)}, {simulation.assumedPaidCount} parcela{simulation.assumedPaidCount === 1 ? "" : "s"} ({formatBRL(simulation.assumedPaidCents)}) já teriam sido pagas no vencimento — saem da conta. O desconto vale só no que vence depois.
            </p>
          )}
          <p className="mt-3 text-xs text-white/55">
            Passe do dia de vencimento e aquela parcela entra como paga. Padrão dos bancos: valor presente pela taxa do contrato (CDC art. 52 §2º). O boleto oficial manda. Registrar a quitação debita o mês de hoje com as parcelas que ainda estão em aberto agora.
          </p>
        </div>
      )}

      {loan.settlement && (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Quitado em {formatYmd(loan.settlement.date)} por {formatBRL(loan.settlement.amountCents)}. O débito entrou no mês da quitação.
        </p>
      )}

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "parcelas", label: "Parcelas" },
          { value: "quitar", label: "Quitar" },
        ]}
      />

      {tab === "parcelas" ? (
        <Panel
          title="Tabela de parcelas"
          subtitle="Marcar como paga usa a data de vencimento — não joga o gasto para o mês de hoje. Acumulado soma da 1ª até aquela linha."
          bodyClass="p-0"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-black/[0.02] text-left text-xs text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 font-medium">Nº</th>
                  <th className="px-3 py-2 font-medium">Vencimento</th>
                  <th className="px-3 py-2 text-right font-medium">Parcela</th>
                  <th className="px-3 py-2 text-right font-medium">Acumulado</th>
                  <th className="px-3 py-2 font-medium">Situação</th>
                  <th className="px-3 py-2 text-right font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {scheduleWithAccumulated.map((row) => {
                  const locked = row.status === "paid_before" || row.status === "settled" || !row.transactionId;
                  const isEditing = editing === row.number;
                  return (
                    <tr key={row.number} className={row.status === "paid_before" || row.status === "settled" ? "text-[var(--muted)]" : ""}>
                      <td className="px-3 py-2 tabular-nums">{row.number}</td>
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="max-w-[11rem]" />
                        ) : (
                          formatYmd(row.dueDate)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatBRL(row.amountCents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums font-medium">{formatBRL(row.accumulatedCents)}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS[row.status].className}`}>{STATUS[row.status].label}</span>
                        {row.paidAt && row.status === "paid" && (
                          <span className="mt-1 block text-[11px] text-[var(--muted)]">pago em {formatYmd(row.paidAt, false)}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {locked ? null : isEditing ? (
                          <div className="flex flex-col items-end gap-2">
                            <label className="flex items-center gap-2 text-xs text-slate-700">
                              <input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} />
                              Paga
                            </label>
                            {paid && (
                              <Input type="date" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="max-w-[11rem]" />
                            )}
                            <div className="flex gap-2">
                              <Button variant="ghost" onClick={() => setEditing(null)} disabled={busy !== null}>
                                Cancelar
                              </Button>
                              <Button onClick={() => void saveEdit(row)} disabled={busy !== null}>
                                {busy === `edit-${row.number}` ? "Salvando..." : "Salvar"}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-2">
                            {(row.status === "pending" || row.status === "overdue") && (
                              <button
                                type="button"
                                onClick={() => void pay(row)}
                                disabled={busy !== null}
                                className="text-xs font-medium text-[var(--brand-600)] hover:underline disabled:opacity-50"
                              >
                                {busy === `pay-${row.number}` ? "..." : "Pagar"}
                              </button>
                            )}
                            {row.status === "paid" && (
                              <button
                                type="button"
                                onClick={() => void unpay(row)}
                                disabled={busy !== null}
                                className="text-xs font-medium text-[var(--muted)] hover:underline disabled:opacity-50"
                              >
                                Desfazer
                              </button>
                            )}
                            <button type="button" onClick={() => startEdit(row)} className="text-xs font-medium text-slate-700 hover:underline">
                              Editar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : (
        <Panel
          title="Quitar o empréstimo"
          subtitle="Simulação. Nada é debitado até você confirmar Quitar todas. Aí o valor entra pago no mês de hoje e as parcelas em aberto saem da agenda."
        >
          {loan.settlement || openRows.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Não há parcelas em aberto para quitar.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {quotes.map((item) => {
                  const active = item.key === (quote?.key ?? scenario);
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setScenario(item.key)}
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        active ? "border-[var(--brand)] bg-[var(--brand)]/5" : "border-[var(--border)] hover:border-slate-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{formatBRL(item.payoffCents)}</p>
                      <p className="mt-1 text-xs text-emerald-700">
                        {item.savingsCents > 0 ? `Economia de ${formatBRL(item.savingsCents)} vs ${formatBRL(item.nominalCents)}` : "Sem desconto"}
                      </p>
                      <p className="mt-2 text-xs leading-snug text-[var(--muted)]">{item.hint}</p>
                    </button>
                  );
                })}
              </div>
              <Field label="Conta que paga a quitação">
                <Select value={payAccount} onChange={(event) => setAccountId(event.target.value)}>
                  {activeAccounts.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button onClick={() => setConfirmSettle(true)} disabled={!todayQuote || busy !== null}>
                Quitar todas agora
              </Button>
              {todayQuote && asOf !== today && (
                <p className="text-xs text-[var(--muted)]">
                  A simulação acima é para {formatYmd(asOf)}. Registrar a quitação lança {formatBRL(todayQuote.payoffCents)} pago hoje, com as {openRows.length} parcelas ainda em aberto agora.
                </p>
              )}
            </div>
          )}
        </Panel>
      )}

      {confirmDelete && (
        <Modal
          open
          onClose={() => setConfirmDelete(false)}
          title="Excluir empréstimo"
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmDelete(false)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void remove()} disabled={busy !== null}>
                {busy === "delete" ? "Excluindo..." : "Excluir empréstimo"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            Excluir <strong>{loan.name}</strong> e todas as parcelas lançadas, inclusive as já pagas? Isso não dá para desfazer.
          </p>
        </Modal>
      )}

      {confirmSettle && todayQuote && (
        <Modal
          open
          onClose={() => setConfirmSettle(false)}
          title="Quitar todas as parcelas"
          footer={
            <>
              <Button variant="outline" onClick={() => setConfirmSettle(false)}>
                Cancelar
              </Button>
              <Button onClick={() => void settle()} disabled={busy !== null}>
                {busy === "settle" ? "Quitando..." : `Quitar todas · ${formatBRL(todayQuote.payoffCents)}`}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            Vai lançar <strong>{formatBRL(todayQuote.payoffCents)}</strong> pago hoje ({formatYmd(today)}) na conta{" "}
            <strong>{account(payAccount)?.name ?? "escolhida"}</strong> — o padrão dos bancos, com desconto dos juros futuros — e tirar as{" "}
            {openRows.length} parcelas em aberto ({formatBRL(loan.balanceCents)}) da agenda. As parcelas já pagas ficam no histórico.
          </p>
        </Modal>
      )}
    </div>
  );
}
