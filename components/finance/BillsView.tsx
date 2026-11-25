"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, CalendarCheck, CalendarClock, CheckCircle2, CreditCard, HandCoins, Landmark, Receipt, Repeat, Undo2, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFinance } from "@/components/finance/FinanceProvider";
import InvoicePayModal from "@/components/finance/InvoicePayModal";
import { EmptyState, ErrorNote, MonthSwitcher, Panel, Stat, useApi } from "@/components/finance/ui";
import { MoneyTooltip } from "@/components/finance/widgets";
import { Button } from "@/components/ui/form";
import { apiPatch } from "@/lib/fetcher";
import { addMonthsToKey, diffDays, formatYmd, isMonthKey, longMonth, monthOf, shortMonth, type MonthKey, type Ymd } from "@/lib/finance/dates";
import { formatBRL, formatBRLCompact } from "@/lib/finance/money";
import type { BillStatus, FinBill, FinBills } from "@/lib/finance/types";

const PAID = "#16a34a";
const PENDING = "#f43f5e";
const axis = { fontSize: 11, fill: "#94a3b8" };
const sum = (list: FinBill[]) => list.reduce((total, bill) => total + bill.amountCents, 0);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

const GROUPS: { status: Exclude<BillStatus, "paid">; title: string; className: string }[] = [
  { status: "overdue", title: "Atrasadas", className: "text-rose-700" },
  { status: "today", title: "Vencem hoje", className: "text-amber-700" },
  { status: "upcoming", title: "A vencer", className: "text-slate-600" },
];

const DATE_TONE: Record<BillStatus, string> = {
  overdue: "bg-rose-50 text-rose-700",
  today: "bg-amber-50 text-amber-700",
  upcoming: "bg-black/[0.04] text-slate-700",
  paid: "bg-emerald-50 text-emerald-700",
};

const DUE_TONE: Record<BillStatus, string> = {
  overdue: "font-medium text-rose-600",
  today: "font-medium text-amber-600",
  upcoming: "",
  paid: "text-emerald-600",
};

function OriginIcon({ bill }: { bill: FinBill }) {
  const props = { className: "h-3.5 w-3.5 shrink-0", color: bill.origin.color };
  if (bill.source === "invoice") return <CreditCard {...props} />;
  if (bill.origin.key === "loans") return <Landmark {...props} />;
  if (bill.origin.key === "people") return <HandCoins {...props} />;
  if (bill.origin.key === "fixed" || bill.origin.key === "variable") return <Repeat {...props} />;
  return <Receipt {...props} />;
}

function dueText(dueDate: Ymd, today: Ymd) {
  const days = diffDays(today, dueDate);
  if (days < 0) return `Venceu há ${plural(-days, "dia", "dias")}`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function DateBlock({ date, status }: { date: Ymd; status: BillStatus }) {
  return (
    <span className={`flex w-12 shrink-0 flex-col items-center rounded-xl py-1 ${DATE_TONE[status]}`}>
      <span className="text-sm font-semibold leading-none">{date.slice(8, 10)}</span>
      <span className="text-[10px] uppercase">{shortMonth(monthOf(date)).slice(0, 3)}</span>
    </span>
  );
}

/** Abre o lançamento para editar ou a fatura do cartão. */
function Opener({ bill, className, children }: { bill: FinBill; className: string; children: ReactNode }) {
  const { editTransaction } = useFinance();
  if (bill.source === "invoice") {
    return (
      <Link href={`/financas/cartoes/${bill.cardId}?fatura=${bill.invoiceMonth}`} className={className}>
        {children}
      </Link>
    );
  }
  const transaction = bill.transaction;
  return (
    <button type="button" onClick={() => transaction && editTransaction(transaction)} className={className}>
      {children}
    </button>
  );
}

function BillRow({ bill, today, busy, onPay }: { bill: FinBill; today: Ymd; busy: boolean; onPay: (bill: FinBill) => void }) {
  const { account } = useFinance();
  const from = account(bill.accountId)?.name;
  return (
    <li className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-black/[0.015]">
      <DateBlock date={bill.dueDate} status={bill.status} />
      <Opener bill={bill} className="min-w-0 flex-1 text-left">
        <span className="flex items-center gap-1.5">
          <OriginIcon bill={bill} />
          <span className="truncate text-sm font-medium text-slate-800">{bill.description}</span>
        </span>
        <span className="block truncate text-xs text-[var(--muted)]">
          <span className={DUE_TONE[bill.status]}>{dueText(bill.dueDate, today)}</span> · {bill.detail}
          {from ? ` · ${from}` : ""}
        </span>
      </Opener>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-semibold tabular-nums text-slate-800">{formatBRL(bill.amountCents)}</span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onPay(bill)}
          aria-label={`Pagar ${bill.description}`}
          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[var(--brand-600)] hover:bg-[var(--brand)]/10 disabled:opacity-50"
        >
          {busy ? "Salvando..." : "Pagar"}
        </button>
      </div>
    </li>
  );
}

function PaidRow({ bill, busy, onUndo }: { bill: FinBill; busy: boolean; onUndo: (bill: FinBill) => void }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      <Opener bill={bill} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-sm text-slate-700">{bill.description}</span>
        <span className="block truncate text-xs text-[var(--muted)]">
          {bill.paidAt ? `Pago em ${formatYmd(bill.paidAt, false)}` : "Pago"} · {bill.detail}
        </span>
      </Opener>
      <span className="text-sm tabular-nums text-slate-700">{formatBRL(bill.amountCents)}</span>
      {bill.source === "transaction" && (
        <button
          type="button"
          disabled={busy}
          onClick={() => onUndo(bill)}
          title="Desfazer pagamento"
          aria-label={`Desfazer pagamento de ${bill.description}`}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)] disabled:opacity-50"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

/** Pago e a pagar de cada mês. Clicar num mês abre as contas dele. */
function MonthsChart({ months, selected, onPick }: { months: FinBills["months"]; selected: MonthKey; onPick: (month: MonthKey) => void }) {
  const data = months.map((row) => ({ month: row.month, paid: row.paidCents, pending: row.pendingCents }));
  if (data.every((row) => row.paid === 0 && row.pending === 0)) {
    return <p className="flex h-40 items-center justify-center text-sm text-[var(--muted)]">Nada a pagar nos próximos 12 meses.</p>;
  }
  const opacity = (month: MonthKey) => (month === selected ? 1 : 0.4);
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
        className="cursor-pointer"
        onClick={(state) => {
          const label = state.activeLabel;
          const month = typeof label === "string" && isMonthKey(label) ? label : data[Number(state.activeTooltipIndex)]?.month;
          if (month) onPick(month);
        }}
      >
        <CartesianGrid vertical={false} stroke="#eef0f3" />
        <XAxis dataKey="month" tickFormatter={shortMonth} tick={axis} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={(value: number) => formatBRLCompact(value)} tick={axis} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<MoneyTooltip />} cursor={{ fill: "rgba(123,104,238,0.06)" }} />
        <Bar dataKey="paid" name="Pago" stackId="month" fill={PAID} maxBarSize={36}>
          {data.map((row) => (
            <Cell key={row.month} fillOpacity={opacity(row.month)} />
          ))}
        </Bar>
        <Bar dataKey="pending" name="A pagar" stackId="month" fill={PENDING} maxBarSize={36} radius={[6, 6, 0, 0]}>
          {data.map((row) => (
            <Cell key={row.month} fillOpacity={opacity(row.month)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** O que falta pagar no mês, por cartão, empréstimos, dívidas, fixas... */
function OriginChart({ bills }: { bills: FinBill[] }) {
  const map = new Map<string, { key: string; label: string; color: string; value: number }>();
  for (const bill of bills) {
    const slice = map.get(bill.origin.key) ?? { ...bill.origin, value: 0 };
    slice.value += bill.amountCents;
    map.set(bill.origin.key, slice);
  }
  const slices = [...map.values()].sort((a, b) => b.value - a.value);
  const total = slices.reduce((value, slice) => value + slice.value, 0);
  if (total === 0) return <p className="py-8 text-center text-sm text-[var(--muted)]">Nada a pagar neste mês.</p>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row xl:flex-col">
      <div className="relative h-40 w-40 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius="64%" outerRadius="100%" paddingAngle={2} stroke="none">
              {slices.map((slice) => (
                <Cell key={slice.key} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip content={<MoneyTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] text-[var(--muted)]">A pagar</span>
          <span className="text-sm font-semibold tabular-nums">{formatBRLCompact(total)}</span>
        </div>
      </div>
      <ul className="w-full min-w-0 space-y-1.5">
        {slices.map((slice) => (
          <li key={slice.key} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
            <span className="min-w-0 flex-1 truncate text-slate-700">{slice.label}</span>
            <span className="tabular-nums text-slate-800">{formatBRL(slice.value)}</span>
            <span className="w-9 text-right text-xs tabular-nums text-[var(--muted)]">{Math.round((slice.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function BillsView() {
  const params = useSearchParams();
  const pathname = usePathname();
  const { today, ready, version, refresh, card } = useFinance();
  const current = monthOf(today);
  const param = params.get("mes");
  const month = isMonthKey(param) ? param : current;
  const { data, error: loadError, loading } = useApi<FinBills>(ready ? `/api/financas/bills?month=${month}` : null, version);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<FinBill | null>(null);
  const payingCard = card(paying?.cardId);

  // O mês fica na URL: voltar de uma fatura cai no mesmo mês.
  function setMonth(next: MonthKey) {
    setError(null);
    window.history.replaceState(null, "", next === current ? pathname : `${pathname}?mes=${next}`);
  }

  async function setPaid(bill: FinBill, paidAt: Ymd | null) {
    setBusy(bill.id);
    setError(null);
    try {
      await apiPatch(`/api/financas/transactions/${bill.id}`, { paidAt });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar");
    } finally {
      setBusy(null);
    }
  }

  function pay(bill: FinBill) {
    if (bill.source === "invoice") {
      if (card(bill.cardId)) setPaying(bill);
      else setError("Cartão não encontrado. Recarregue a página.");
      return;
    }
    void setPaid(bill, bill.dueDate <= today ? bill.dueDate : today);
  }

  if (!data) {
    return <p className={`py-10 text-center text-sm ${loadError ? "text-rose-600" : "text-[var(--muted)]"}`}>{loadError ?? "Carregando contas a pagar..."}</p>;
  }

  // Enquanto o mês novo carrega, a tela mostra o anterior esmaecido.
  const shown = data.month;
  const stale = loading || shown !== month;
  const next = addMonthsToKey(month, 1);
  const nextRow = data.months.find((row) => row.month === next);
  // "Falta pagar este mês" fica no mês de hoje, mesmo navegando: atrasado + a vencer.
  const thisMonth = data.months.find((row) => row.month === monthOf(data.today));
  const leftCents = thisMonth?.pendingCents ?? 0;
  const leftOverdueCents = thisMonth?.overdueCents ?? 0;
  const { pendingCents, paidCents, overdueCents, overdueCount } = data.totals;
  const monthTotal = pendingCents + paidCents;
  const carried = data.pending.some((bill) => monthOf(bill.dueDate) < shown);
  const groups = GROUPS.map((group) => ({ ...group, bills: data.pending.filter((bill) => bill.status === group.status) })).filter((group) => group.bills.length > 0);
  const after = addMonthsToKey(shown, 1);
  const seeNext = (
    <Button variant="outline" onClick={() => setMonth(after)}>
      Ver {shortMonth(after)} <ArrowRight className="h-4 w-4" />
    </Button>
  );

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <MonthSwitcher month={month} onChange={setMonth} />
        <Button variant="outline" onClick={() => setMonth(next)}>
          Ver {shortMonth(next)}
          {nextRow && <span className="tabular-nums text-[var(--muted)]">{formatBRL(nextRow.pendingCents)}</span>}
          <ArrowRight className="h-4 w-4" />
        </Button>
        {month !== current && (
          <Button variant="ghost" onClick={() => setMonth(current)}>
            Voltar para {shortMonth(current)}
          </Button>
        )}
        <p className="ml-auto hidden text-xs text-[var(--muted)] lg:block">Cartão entra pelo total da fatura, no vencimento.</p>
      </div>

      <ErrorNote message={error ?? loadError} />

      <div className={`space-y-5 transition-opacity ${stale ? "opacity-60" : ""}`}>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label={`A pagar em ${shortMonth(shown)}`}
            value={formatBRL(pendingCents)}
            tone={pendingCents > 0 ? "expense" : "default"}
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            hint={data.pending.length ? `${plural(data.pending.length, "conta", "contas")}${carried ? " · com atrasadas de antes" : ""}` : "Nada pendente"}
          />
          <Stat
            label={`Pago em ${shortMonth(shown)}`}
            value={formatBRL(paidCents)}
            tone="income"
            icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            hint={paidCents > 0 ? `${Math.round((paidCents / monthTotal) * 100)}% das contas do mês` : monthTotal > 0 ? "Nada pago ainda" : "Sem contas no mês"}
          />
          <Stat
            label="Atrasado"
            value={formatBRL(overdueCents)}
            tone={overdueCount > 0 ? "expense" : "default"}
            icon={<AlertTriangle className="h-3.5 w-3.5" />}
            hint={overdueCount > 0 ? plural(overdueCount, "conta atrasada", "contas atrasadas") : "Nada atrasado"}
          />
          <Stat
            label="Falta pagar este mês"
            value={formatBRL(leftCents)}
            tone={leftCents > 0 ? "expense" : "default"}
            icon={<Wallet className="h-3.5 w-3.5" />}
            hint={
              <>
                <span className={`block truncate ${leftOverdueCents > 0 ? "text-rose-600" : ""}`}>Em atraso: {formatBRL(leftOverdueCents)}</span>
                <span className="block truncate">A vencer: {formatBRL(leftCents - leftOverdueCents)}</span>
              </>
            }
          />
        </div>

        <Panel
          title="Quanto falta pagar por mês"
          subtitle="Clique num mês para ver as contas dele"
          action={
            <span className="flex shrink-0 items-center gap-3 pt-0.5 text-xs text-slate-600">
              <Legend color={PAID} label="Pago" />
              <Legend color={PENDING} label="A pagar" />
            </span>
          }
        >
          <MonthsChart months={data.months} selected={month} onPick={setMonth} />
        </Panel>

        <div className="grid grid-cols-12 gap-4">
          <Panel
            title={`A pagar em ${longMonth(shown)}`}
            subtitle={carried ? "Inclui o que venceu antes e ainda não foi pago." : "Do vencimento mais próximo ao mais distante."}
            className="col-span-12 xl:col-span-8"
            bodyClass="pb-3 pt-3"
          >
            {data.pending.length === 0 ? (
              data.paid.length > 0 ? (
                <div className="flex flex-col items-center px-6 py-10 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">Tudo pago em {longMonth(shown)}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Veja o que vence no mês seguinte.</p>
                  <div className="mt-4">{seeNext}</div>
                </div>
              ) : (
                <div className="px-5">
                  <EmptyState icon={<CalendarCheck className="h-5 w-5" />} title={`Nenhuma conta em ${longMonth(shown)}`} text="Nada vence neste mês." action={seeNext} />
                </div>
              )
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <section key={group.status}>
                    <header className="flex items-center justify-between bg-black/[0.02] px-5 py-1.5 text-xs font-medium">
                      <span className={group.className}>
                        {group.title} · {group.bills.length}
                      </span>
                      <span className="tabular-nums text-[var(--muted)]">{formatBRL(sum(group.bills))}</span>
                    </header>
                    <ul className="divide-y divide-[var(--border)]">
                      {group.bills.map((bill) => (
                        <BillRow key={bill.id} bill={bill} today={today} busy={busy === bill.id} onPay={pay} />
                      ))}
                    </ul>
                  </section>
                ))}
                <p className="px-5 text-xs text-[var(--muted)]">Fatura ainda aberta pode crescer com novas compras até fechar.</p>
              </div>
            )}
          </Panel>

          <div className="col-span-12 space-y-4 xl:col-span-4">
            <Panel title="Por origem" subtitle={`O que falta pagar em ${shortMonth(shown)}`}>
              <OriginChart bills={data.pending} />
            </Panel>
            <Panel
              title={`Pagas em ${shortMonth(shown)}`}
              subtitle={data.paid.length ? `${plural(data.paid.length, "conta", "contas")} · ${formatBRL(paidCents)}` : undefined}
              bodyClass="px-5 pb-3 pt-1"
            >
              {data.paid.length === 0 ? (
                <p className="py-4 text-center text-sm text-[var(--muted)]">Nada pago neste mês ainda.</p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {data.paid.map((bill) => (
                    <PaidRow key={bill.id} bill={bill} busy={busy === bill.id} onUndo={(item) => void setPaid(item, null)} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>

      {paying && payingCard && paying.invoiceMonth && (
        <InvoicePayModal
          card={payingCard}
          invoice={{ month: paying.invoiceMonth, openCents: paying.amountCents }}
          onClose={() => setPaying(null)}
          onDone={() => {
            setPaying(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
