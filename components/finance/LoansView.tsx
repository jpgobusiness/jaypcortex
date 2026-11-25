"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgePercent, CalendarClock, Landmark, Plus, Trash2 } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { EmptyState, ErrorNote, Progress, Stat, useApi } from "@/components/finance/ui";
import Modal from "@/components/ui/Modal";
import { Button } from "@/components/ui/form";
import { apiDelete } from "@/lib/fetcher";
import { LOAN_TYPES } from "@/lib/finance/constants";
import { formatYmd } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { FinLoan } from "@/lib/finance/types";

const pct = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;

export default function LoansView() {
  const { ready, version, refresh, openEntry } = useFinance();
  const { data, loading } = useApi<FinLoan[]>(ready ? "/api/financas/loans" : null, version);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FinLoan | null>(null);
  const loans = data ?? [];
  const active = loans.filter((loan) => loan.remainingCount > 0);
  const monthly = active.reduce((sum, loan) => sum + (loan.nextDue?.amountCents ?? 0), 0);

  async function remove(loan: FinLoan) {
    setBusy(loan.id);
    setError(null);
    try {
      await apiDelete(`/api/financas/loans/${loan.id}`);
      await refresh();
      setPendingDelete(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Erro ao excluir");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !data) return <p className="py-10 text-center text-sm text-[var(--muted)]">Carregando...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid flex-1 grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Saldo devedor total" value={formatBRL(active.reduce((sum, loan) => sum + loan.balanceCents, 0))} tone="expense" />
          <Stat label="Parcelas por mês" value={formatBRL(monthly)} hint={`${active.length} ativo(s)`} />
          <Stat label="Juros ainda a pagar" value={formatBRL(active.reduce((sum, loan) => sum + loan.interestRemainingCents, 0))} tone="warning" />
          <Stat label="Economia se quitar hoje" value={formatBRL(active.reduce((sum, loan) => sum + loan.payoff.savingsCents, 0))} tone="income" />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={() => openEntry({ flow: "expense", mode: "loan" })}>
          <Plus className="h-4 w-4" /> Novo empréstimo
        </Button>
      </div>
      <ErrorNote message={error} />
      {loans.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-5 w-5" />}
          title="Nenhum empréstimo ou financiamento"
          text="Cadastre com a taxa (ou só a parcela) e veja a tabela, o acumulado pago e quanto custaria quitar hoje."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {loans.map((loan) => (
            <div key={loan.id} className="relative rounded-2xl border border-[var(--border)] bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <Link href={`/financas/emprestimos/${loan.id}`} className="block text-left">
                <div className="flex items-start justify-between gap-3 pr-10">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{loan.name}</p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {LOAN_TYPES.find((item) => item.value === loan.type)?.label}
                      {loan.lender ? ` · ${loan.lender}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {loan.overdueCount > 0 ? (
                      <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">{loan.overdueCount} atrasada(s)</span>
                    ) : loan.remainingCount === 0 ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">Quitado</span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-4 text-2xl font-semibold tabular-nums tracking-tight">{formatBRL(loan.balanceCents)}</p>
                <p className="text-xs text-[var(--muted)]">
                  {loan.remainingCount > 0
                    ? `${loan.remainingCount} parcela(s) em aberto · quitar agora ${formatBRL(loan.payoff.payoffCents)}`
                    : `contratado ${formatBRL(loan.principalCents)}`}
                </p>
                <div className="mt-3">
                  <Progress value={loan.paidCount} max={loan.installmentCount} warnAt={2} color="#16a34a" />
                  <p className="mt-1 flex justify-between text-xs text-[var(--muted)]">
                    <span>
                      {loan.paidCount}/{loan.installmentCount} parcelas pagas
                    </span>
                    {loan.nextDue && (
                      <span className="flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {formatBRL(loan.nextDue.amountCents)} em {formatYmd(loan.nextDue.date, false)}
                      </span>
                    )}
                  </p>
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-600">
                  <BadgePercent className="h-3.5 w-3.5 text-[var(--muted)]" /> {pct(loan.monthlyRate)} a.m. · {pct(loan.annualRate)} a.a.
                </p>
              </Link>
              <button
                type="button"
                title="Excluir empréstimo"
                aria-label={`Excluir ${loan.name}`}
                onClick={() => setPendingDelete(loan)}
                className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {pendingDelete && (
        <Modal
          open
          onClose={() => setPendingDelete(null)}
          title="Excluir empréstimo"
          footer={
            <>
              <Button variant="outline" onClick={() => setPendingDelete(null)}>
                Cancelar
              </Button>
              <Button variant="danger" onClick={() => void remove(pendingDelete)} disabled={busy !== null}>
                {busy === pendingDelete.id ? "Excluindo..." : "Excluir empréstimo"}
              </Button>
            </>
          }
        >
          <p className="text-sm text-slate-700">
            Excluir <strong>{pendingDelete.name}</strong> e todas as parcelas lançadas, inclusive as já pagas? Isso não dá para desfazer.
          </p>
        </Modal>
      )}
    </div>
  );
}
