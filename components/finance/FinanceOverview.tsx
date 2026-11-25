"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CreditCard, Landmark, Lightbulb, PiggyBank, Plus, Repeat, ShieldCheck, Wallet } from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { EmptyState, MonthSwitcher, Panel, Stat } from "@/components/finance/ui";
import { AgendaList, WidgetBody, type WidgetContext } from "@/components/finance/widgets";
import { Button } from "@/components/ui/form";
import { useApi } from "@/components/finance/ui";
import { apiPatch } from "@/lib/fetcher";
import { inRange, kpiValue, makeLookup, totals } from "@/lib/finance/analytics";
import { addMonthsToKey, diffDays, longMonth, monthOf } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import type { AgendaItem, FinAnalytics, WidgetConfig } from "@/lib/finance/types";

const widget = (config: Omit<WidgetConfig, "id">): WidgetConfig => ({ id: config.type, ...config });
const num = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

type Insight = { tone: "good" | "warn" | "bad"; text: string };

export default function FinanceOverview() {
  const { today, accounts, cards, categories, ready, version, refresh, openEntry, openAccount, openCard } = useFinance();
  const [month, setMonth] = useState(monthOf(today));
  const from = addMonthsToKey(month, -6);
  const to = addMonthsToKey(month, 5);
  const { data, loading } = useApi<FinAnalytics>(ready ? `/api/financas/analytics?from=${from}&to=${to}` : null, version);
  const lookup = useMemo(() => makeLookup(categories, accounts, cards), [categories, accounts, cards]);

  async function pay(item: AgendaItem) {
    await apiPatch(`/api/financas/transactions/${item.id}`, { paidAt: item.date <= today ? item.date : today });
    await refresh();
  }

  if (!ready) return <p className="py-10 text-center text-sm text-[var(--muted)]">Carregando...</p>;

  if (accounts.length === 0) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <EmptyState
          icon={<Wallet className="h-5 w-5" />}
          title="Vamos montar suas finanças"
          text="Três passos: suas contas, seus cartões e o que entra e sai todo mês. Depois disso, as visões e os dashboards se montam sozinhos."
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { icon: Landmark, title: "1. Contas", text: "Corrente, poupança, carteira, investimentos.", action: () => openAccount(), label: "Criar conta" },
            { icon: CreditCard, title: "2. Cartões", text: "Limite, fechamento e vencimento.", action: () => openCard(), label: "Criar cartão" },
            { icon: Repeat, title: "3. Fixos do mês", text: "Salário, aluguel, luz, assinaturas.", action: () => openEntry({ flow: "income", mode: "recurring" }), label: "Lançar salário" },
          ].map((step) => (
            <div key={step.title} className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <step.icon className="h-5 w-5 text-[var(--brand-600)]" />
              <p className="mt-2 text-sm font-semibold">{step.title}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">{step.text}</p>
              <Button variant="outline" className="mt-3 w-full" onClick={step.action}>
                <Plus className="h-4 w-4" /> {step.label}
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return <p className="py-10 text-center text-sm text-[var(--muted)]">{loading ? "Montando a visão geral..." : "Sem dados"}</p>;

  const ctx: WidgetContext = { analytics: data, lookup, range: { from: month, to: month }, includeProjected: true, today, cards, onPay: (item) => void pay(item) };
  const monthFacts = inRange(data.facts, month, month);
  const monthTotals = totals(monthFacts);
  const realized = totals(monthFacts.filter((fact) => fact.realized));
  const endOfMonth = data.balance.find((point) => point.month === month);
  const kpiInput = { facts: inRange(data.facts, addMonthsToKey(month, -2), month), previous: [], from: addMonthsToKey(month, -2), to: month, analytics: data, lookup };
  const debt = kpiValue("debt_ratio", kpiInput).value;
  const reserve = kpiValue("emergency_months", kpiInput).value;

  const insights: Insight[] = [];
  const overdue = data.agenda.filter((item) => item.overdue);
  if (overdue.length) {
    insights.push({ tone: "bad", text: `${overdue.length} ${overdue.length === 1 ? "conta atrasada" : "contas atrasadas"}: ${formatBRL(overdue.reduce((sum, item) => sum + item.amountCents, 0))}.` });
  }
  for (const card of cards.filter((item) => !item.archived && item.limitCents > 0)) {
    const used = card.usedCents / card.limitCents;
    if (used >= 0.8) insights.push({ tone: used >= 1 ? "bad" : "warn", text: `${card.name} está com ${(used * 100).toFixed(0)}% do limite usado.` });
  }
  if (monthTotals.savingsRate !== null) {
    if (monthTotals.savingsRate >= 20) insights.push({ tone: "good", text: `Você vai guardar ${monthTotals.savingsRate.toFixed(0)}% da renda em ${longMonth(month)}. Acima dos 20% recomendados.` });
    else if (monthTotals.savingsRate < 0) insights.push({ tone: "bad", text: `As despesas de ${longMonth(month)} passam a renda em ${formatBRL(-monthTotals.net)}.` });
    else insights.push({ tone: "warn", text: `Taxa de poupança de ${monthTotals.savingsRate.toFixed(0)}% no mês. A meta saudável é 20%.` });
  }
  if (debt !== null && debt > 30) insights.push({ tone: "warn", text: `Parcelas e empréstimos levam ${debt.toFixed(0)}% da renda. O ideal é até 30%.` });
  if (reserve !== null) {
    insights.push(
      reserve >= 6
        ? { tone: "good", text: `Seu saldo cobre ${num(reserve)} meses de gastos essenciais. Reserva de emergência completa.` }
        : { tone: "warn", text: `Seu saldo cobre ${num(reserve)} meses de gastos essenciais. A recomendação é 6 meses.` }
    );
  }
  const nextBig = data.agenda.find((item) => !item.overdue && diffDays(today, item.date) <= 7 && item.kind === "expense");
  if (nextBig) insights.push({ tone: "warn", text: `${nextBig.description} vence em ${diffDays(today, nextBig.date)} dias: ${formatBRL(nextBig.amountCents)}.` });

  const toneStyle = { good: "bg-emerald-50 text-emerald-800", warn: "bg-amber-50 text-amber-800", bad: "bg-rose-50 text-rose-800" };
  const toneIcon = { good: ShieldCheck, warn: Lightbulb, bad: AlertTriangle };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher month={month} onChange={setMonth} />
        <p className="text-xs text-[var(--muted)]">Compras no cartão contam no mês da fatura.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Saldo em contas hoje"
          value={formatBRL(data.currentBalanceCents)}
          hint={endOfMonth ? `Previsto no fim do mês: ${formatBRL(endOfMonth.balanceCents)}` : undefined}
          icon={<Wallet className="h-3.5 w-3.5" />}
          tone={data.currentBalanceCents < 0 ? "expense" : "default"}
        />
        <Stat label="Receitas do mês" value={formatBRL(monthTotals.income)} hint={`Recebido: ${formatBRL(realized.income)}`} tone="income" />
        <Stat label="Despesas do mês" value={formatBRL(monthTotals.expense)} hint={`Já pago ou no cartão: ${formatBRL(realized.expense)}`} tone="expense" />
        <Stat
          label="Resultado do mês"
          value={formatBRL(monthTotals.net)}
          hint={monthTotals.savingsRate === null ? "Sem receitas no mês" : `Taxa de poupança: ${monthTotals.savingsRate.toFixed(0)}%`}
          icon={<PiggyBank className="h-3.5 w-3.5" />}
          tone={monthTotals.net < 0 ? "expense" : "brand"}
        />
      </div>

      {insights.length > 0 && (
        <div className="grid gap-2 md:grid-cols-2">
          {insights.slice(0, 4).map((insight) => {
            const Icon = toneIcon[insight.tone];
            return (
              <p key={insight.text} className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm ${toneStyle[insight.tone]}`}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                {insight.text}
              </p>
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        <Panel title="Receitas × despesas" subtitle="Últimos 6 meses e os próximos (mais claros)" className="col-span-12 xl:col-span-8">
          <WidgetBody widget={widget({ type: "cashflow", size: "lg" })} ctx={ctx} range={{ from: addMonthsToKey(month, -5), to: addMonthsToKey(month, 2) }} height={360} />
        </Panel>
        <Panel title="Próximos vencimentos" className="col-span-12 xl:col-span-4" action={<Link href="/financas/lancamentos" className="text-xs font-medium text-[var(--brand-600)]">Ver tudo</Link>}>
          <AgendaList items={data.agenda} today={today} onPay={(item) => void pay(item)} limit={7} />
        </Panel>
        <Panel title={`Despesas de ${longMonth(month)}`} subtitle="Por categoria" className="col-span-12 lg:col-span-6 xl:col-span-5">
          <WidgetBody widget={widget({ type: "breakdown", size: "md", kind: "expense", dimension: "group", chart: "donut", limit: 7 })} ctx={ctx} />
        </Panel>
        <Panel title="Tipo de gasto" subtitle="Fixa, variável, pontual, parcelada, empréstimo" className="col-span-12 lg:col-span-6 xl:col-span-3">
          <WidgetBody widget={widget({ type: "breakdown", size: "sm", kind: "expense", dimension: "nature", chart: "bars" })} ctx={ctx} />
        </Panel>
        <Panel title="Cartões" className="col-span-12 lg:col-span-6 xl:col-span-4" action={<Link href="/financas/contas" className="text-xs font-medium text-[var(--brand-600)]">Gerenciar</Link>}>
          <WidgetBody widget={widget({ type: "cards", size: "md" })} ctx={ctx} />
        </Panel>
        <Panel title="Saldo no tempo" subtitle="Linha tracejada = previsão com o que está agendado" className="col-span-12 lg:col-span-6 xl:col-span-7">
          <WidgetBody widget={widget({ type: "balance", size: "md" })} ctx={ctx} range={{ from: addMonthsToKey(month, -3), to: addMonthsToKey(month, 5) }} />
        </Panel>
        <Panel title="Maiores despesas do mês" className="col-span-12 lg:col-span-6 xl:col-span-5">
          <WidgetBody widget={widget({ type: "top", size: "md", kind: "expense", limit: 6 })} ctx={ctx} />
        </Panel>
      </div>
    </div>
  );
}
