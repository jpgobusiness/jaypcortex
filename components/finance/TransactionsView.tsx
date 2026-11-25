"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeftRight, CreditCard, ListX, Plus, Search } from "lucide-react";
import { CategorySelect } from "@/components/finance/EntryModal";
import { useFinance } from "@/components/finance/FinanceProvider";
import { IconBubble } from "@/components/finance/icons";
import { EmptyState, MonthSwitcher, Segmented, Stat, StatusPill, useApi } from "@/components/finance/ui";
import { Button, Input, Select } from "@/components/ui/form";
import { apiPatch } from "@/lib/fetcher";
import { EXPENSE_NATURE_LABELS, KIND_LABELS } from "@/lib/finance/constants";
import { isMonthKey, monthOf, shortMonth, weekday } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { FinTransaction } from "@/lib/finance/types";

const WEEK = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dayLabel = (date: string) => `${WEEK[weekday(date)]}, ${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

export default function TransactionsView() {
  const params = useSearchParams();
  const { today, accounts, cards, categories, ready, version, refresh, editTransaction, openEntry, account, card, category } = useFinance();
  const initialMonth = params.get("mes");
  const [month, setMonth] = useState(isMonthKey(initialMonth) ? initialMonth : monthOf(today));
  const [kind, setKind] = useState<"all" | "income" | "expense" | "other">("all");
  const [source, setSource] = useState(params.get("conta") ? `account:${params.get("conta")}` : params.get("cartao") ? `card:${params.get("cartao")}` : "");
  const [categoryId, setCategoryId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const query = new URLSearchParams({ month });
  if (kind !== "all") query.set("kind", kind);
  if (source.startsWith("account:")) query.set("accountId", source.slice(8));
  if (source.startsWith("card:")) query.set("cardId", source.slice(5));
  if (categoryId) query.set("categoryId", categoryId);
  if (status) query.set("status", status);
  const { data, loading } = useApi<FinTransaction[]>(ready ? `/api/financas/transactions?${query}` : null, version);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((row) => !term || row.description.toLowerCase().includes(term) || row.tags.some((tag) => tag.includes(term)));
  }, [data, q]);
  const groups = useMemo(() => {
    const map = new Map<string, FinTransaction[]>();
    for (const row of rows) map.set(row.date, [...(map.get(row.date) ?? []), row]);
    return [...map.entries()];
  }, [rows]);
  const income = rows.filter((row) => row.kind === "income").reduce((sum, row) => sum + row.amountCents, 0);
  const expense = rows.filter((row) => row.kind === "expense").reduce((sum, row) => sum + row.amountCents, 0);
  const pending = rows.filter((row) => row.status === "pending" || row.status === "overdue");
  const overdue = pending.filter((row) => row.status === "overdue");

  async function markPaid(row: FinTransaction) {
    await apiPatch(`/api/financas/transactions/${row.id}`, { paidAt: row.date <= today ? row.date : today });
    await refresh();
  }

  function meta(row: FinTransaction) {
    const parts: string[] = [];
    const cat = category(row.categoryId);
    if (cat) parts.push(cat.name);
    if (row.kind === "transfer") parts.push(`${account(row.accountId)?.name ?? "?"} → ${account(row.toAccountId)?.name ?? "?"}`);
    else if (row.cardId) parts.push(`${card(row.cardId)?.name ?? "Cartão"} · fatura ${shortMonth(row.invoiceMonth ?? "")}`);
    else if (row.accountId) parts.push(account(row.accountId)?.name ?? "");
    return parts.filter(Boolean).join(" · ");
  }

  function badge(row: FinTransaction) {
    if (row.installmentNumber && row.installmentCount) return `${row.loanId ? "Empréstimo" : "Parcela"} ${row.installmentNumber}/${row.installmentCount}`;
    if (row.nature === "fixed" || row.nature === "variable") return row.kind === "income" ? "Recorrente" : EXPENSE_NATURE_LABELS[row.nature];
    if (row.kind !== "income" && row.kind !== "expense") return KIND_LABELS[row.kind];
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <MonthSwitcher month={month} onChange={setMonth} />
        <div className="w-full lg:w-[440px]">
          <Segmented
            size="sm"
            value={kind}
            onChange={setKind}
            options={[
              { value: "all", label: "Tudo" },
              { value: "income", label: "Receitas", activeClass: "text-emerald-600" },
              { value: "expense", label: "Despesas", activeClass: "text-rose-600" },
              { value: "other", label: "Transferências" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <Input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Buscar descrição ou tag" className="pl-9" />
        </div>
        <Select value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="">Todas as contas e cartões</option>
          <optgroup label="Contas">
            {accounts.map((item) => (
              <option key={item.id} value={`account:${item.id}`}>
                {item.name}
              </option>
            ))}
          </optgroup>
          {cards.length > 0 && (
            <optgroup label="Cartões">
              {cards.map((item) => (
                <option key={item.id} value={`card:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </optgroup>
          )}
        </Select>
        <CategorySelect kind={kind === "income" ? "income" : "expense"} value={categoryId} onChange={setCategoryId} categories={categories} emptyLabel="Todas as categorias" />
        <Select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Qualquer situação</option>
          <option value="paid">Pagos / recebidos</option>
          <option value="pending">Pendentes</option>
          <option value="overdue">Atrasados</option>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Receitas" value={formatBRL(income)} tone="income" />
        <Stat label="Despesas" value={formatBRL(expense)} tone="expense" />
        <Stat label="Resultado" value={formatBRL(income - expense)} tone={income - expense < 0 ? "expense" : "brand"} />
        <Stat
          label="Pendentes"
          value={String(pending.length)}
          hint={overdue.length ? `${overdue.length} atrasado(s)` : pending.length ? formatBRL(pending.reduce((sum, row) => sum + row.amountCents, 0)) : "Tudo em dia"}
          tone={overdue.length ? "expense" : pending.length ? "warning" : "default"}
        />
      </div>

      {loading && !data ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">Carregando lançamentos...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<ListX className="h-5 w-5" />}
          title="Nenhum lançamento aqui"
          text="Mude o mês ou os filtros, ou lance algo agora."
          action={
            <Button onClick={() => openEntry()}>
              <Plus className="h-4 w-4" /> Novo lançamento
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {groups.map(([date, list]) => {
            const net = list.reduce((sum, row) => sum + (row.kind === "income" ? row.amountCents : row.kind === "expense" ? -row.amountCents : 0), 0);
            return (
              <section key={date} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-white">
                <header className="flex items-center justify-between bg-black/[0.02] px-4 py-2 text-xs font-medium text-[var(--muted)]">
                  <span className="capitalize">{date === today ? `Hoje · ${dayLabel(date)}` : dayLabel(date)}</span>
                  {net !== 0 && <span className={`tabular-nums ${net > 0 ? "text-emerald-600" : "text-rose-600"}`}>{net > 0 ? "+" : "−"} {formatBRL(Math.abs(net))}</span>}
                </header>
                <ul className="divide-y divide-[var(--border)]">
                  {list.map((row) => {
                    const cat = category(row.categoryId);
                    const tag = badge(row);
                    const flow = row.kind === "income" || row.kind === "expense";
                    return (
                      <li key={row.id} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-black/[0.015]">
                        <button type="button" onClick={() => editTransaction(row)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                          {flow ? (
                            <IconBubble icon={cat?.icon ?? (row.cardId ? "tag" : "circle-dashed")} color={cat?.color ?? "#94a3b8"} />
                          ) : (
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand-600)]">
                              {row.kind === "card_payment" ? <CreditCard className="h-4 w-4" /> : <ArrowLeftRight className="h-4 w-4" />}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium text-slate-800">{row.description}</span>
                              {tag && <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-slate-600">{tag}</span>}
                            </span>
                            <span className="block truncate text-xs text-[var(--muted)]">{meta(row)}</span>
                          </span>
                        </button>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`text-sm font-semibold tabular-nums ${
                              row.kind === "income" ? "text-emerald-600" : row.kind === "expense" ? "text-slate-800" : "text-[var(--muted)]"
                            }`}
                          >
                            {row.kind === "income" ? "+ " : row.kind === "expense" ? "− " : ""}
                            {formatBRL(Math.abs(row.amountCents))}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {(row.status === "pending" || row.status === "overdue") && (
                              <button type="button" onClick={() => void markPaid(row)} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--brand-600)] hover:bg-[var(--brand)]/10">
                                {row.kind === "income" ? "Receber" : "Pagar"}
                              </button>
                            )}
                            {flow && <StatusPill status={row.status} income={row.kind === "income"} />}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
          <p className="text-center text-xs text-[var(--muted)]">Compras no cartão aparecem na data da compra. O total de cada fatura está em Contas e cartões.</p>
        </div>
      )}
    </div>
  );
}
