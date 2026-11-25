"use client";

import { useState } from "react";
import { Building2, CalendarX2, Home, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { CategorySelect } from "@/components/finance/EntryModal";
import { useFinance } from "@/components/finance/FinanceProvider";
import HousingRecurrenceModal from "@/components/finance/HousingRecurrenceModal";
import { IconBubble } from "@/components/finance/icons";
import { EmptyState, ErrorNote, Field, MoneyInput, Panel, Segmented, Stat, useApi } from "@/components/finance/ui";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { apiDelete, apiPatch } from "@/lib/fetcher";
import { INTERVALS, intervalLabel } from "@/lib/finance/constants";
import { formatYmd } from "@/lib/finance/dates";
import { HOUSING_LABELS, housingSystemOf, type HousingSystem } from "@/lib/finance/housing";
import { formatBRL } from "@/lib/finance/money";
import type { FinRecurrence } from "@/lib/finance/types";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

function RecurrenceModal({ rule, onClose, onDone }: { rule: FinRecurrence; onClose: () => void; onDone: () => void }) {
  const { categories, accounts, cards } = useFinance();
  const [description, setDescription] = useState(rule.description);
  const [amount, setAmount] = useState<number | null>(rule.amountCents);
  const [type, setType] = useState(rule.type);
  const [categoryId, setCategoryId] = useState(rule.categoryId ?? "");
  const [source, setSource] = useState(rule.cardId ? `card:${rule.cardId}` : `account:${rule.accountId ?? ""}`);
  const [dayOfMonth, setDayOfMonth] = useState(String(rule.dayOfMonth));
  const [intervalMonths, setIntervalMonths] = useState(rule.intervalMonths);
  const [startDate, setStartDate] = useState(rule.startDate);
  const [endDate, setEndDate] = useState(rule.endDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!amount || amount <= 0) return setError("Informe o valor");
    const day = Number(dayOfMonth);
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError("Dia inválido");
    setSaving(true);
    try {
      await apiPatch(`/api/financas/recurrences/${rule.id}`, {
        description,
        amountCents: amount,
        type,
        categoryId: categoryId || null,
        ...(source.startsWith("card:") ? { cardId: source.slice(5) } : { accountId: source.slice(8) }),
        dayOfMonth: day,
        intervalMonths,
        startDate,
        endDate: endDate || null,
      });
      onDone();
    } catch (cause) {
      setError(errorText(cause));
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar ${rule.kind === "income" ? "receita" : "despesa"} recorrente`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando..." : "Salvar e atualizar os próximos"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Descrição" className="sm:col-span-2">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label={type === "variable" ? "Valor estimado" : "Valor"}>
            <MoneyInput value={amount} onChange={setAmount} large />
          </Field>
          <Field label="Tipo">
            <Segmented
              size="sm"
              value={type}
              onChange={setType}
              options={[
                { value: "fixed", label: "Valor fixo" },
                { value: "variable", label: "Valor varia" },
              ]}
            />
          </Field>
          <Field label="Dia" hint="Meses mais curtos usam o último dia.">
            <Input type="number" min={1} max={31} value={dayOfMonth} onChange={(event) => setDayOfMonth(event.target.value)} />
          </Field>
          <Field label="Frequência">
            <Select value={intervalMonths} onChange={(event) => setIntervalMonths(Number(event.target.value))}>
              {INTERVALS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoria">
            <CategorySelect kind={rule.kind} value={categoryId} onChange={setCategoryId} categories={categories} />
          </Field>
          <Field label={rule.kind === "income" ? "Entra na conta" : "Paga com"}>
            <Select value={source} onChange={(event) => setSource(event.target.value)}>
              <optgroup label="Contas">
                {accounts.map((account) => (
                  <option key={account.id} value={`account:${account.id}`}>
                    {account.name}
                  </option>
                ))}
              </optgroup>
              {rule.kind === "expense" && cards.length > 0 && (
                <optgroup label="Cartões">
                  {cards.map((card) => (
                    <option key={card.id} value={`card:${card.id}`}>
                      {card.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
          </Field>
          <Field label="Começa em">
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <Field label="Termina em (opcional)" hint="Vazio = continua sem data para acabar.">
            <Input type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} />
          </Field>
        </div>
        <p className="text-xs text-[var(--muted)]">Os lançamentos já pagos não mudam. Os pendentes de hoje em diante são refeitos com a regra nova.</p>
      </div>
    </Modal>
  );
}

export default function RecurrencesView() {
  const { ready, version, refresh, openEntry, category, account, card } = useFinance();
  const { data, loading } = useApi<FinRecurrence[]>(ready ? "/api/financas/recurrences" : null, version);
  const [editing, setEditing] = useState<FinRecurrence | null>(null);
  const [housing, setHousing] = useState<{ system: HousingSystem; rule?: FinRecurrence | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openRule(rule: FinRecurrence) {
    const system = housingSystemOf(category(rule.categoryId)?.system, rule.description);
    if (system) {
      setHousing({ system, rule });
      return;
    }
    setEditing(rule);
  }
  const rules = data ?? [];
  const active = rules.filter((rule) => !rule.ended);
  const income = active.filter((rule) => rule.kind === "income").reduce((sum, rule) => sum + rule.monthlyCents, 0);
  const fixed = active.filter((rule) => rule.kind === "expense").reduce((sum, rule) => sum + rule.monthlyCents, 0);

  async function end(rule: FinRecurrence, scope: "future" | "all") {
    const message =
      scope === "all"
        ? `Apagar "${rule.description}" e TODO o histórico (${rule.paidCount} já pagos)?`
        : rule.cardId
          ? `Cancelar a assinatura "${rule.description}"? Ela para de entrar nas próximas faturas. O que já foi lançado no cartão fica.`
          : `Encerrar "${rule.description}"? Os lançamentos pendentes de hoje em diante saem; o histórico fica.`;
    if (!confirm(message)) return;
    try {
      await apiDelete(`/api/financas/recurrences/${rule.id}?scope=${scope}`);
      await refresh();
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  const renderList = (kind: "income" | "expense") => {
    const list = rules.filter((rule) => rule.kind === kind);
    if (list.length === 0) {
      return <p className="py-6 text-center text-sm text-[var(--muted)]">{kind === "income" ? "Nenhuma receita recorrente." : "Nenhuma despesa recorrente."}</p>;
    }
    return (
      <ul className="divide-y divide-[var(--border)]">
        {list.map((rule) => {
          const cat = category(rule.categoryId);
          const where = rule.cardId ? card(rule.cardId)?.name : account(rule.accountId)?.name;
          return (
            <li key={rule.id} className={`flex items-center gap-3 py-3 ${rule.ended ? "opacity-50" : ""}`}>
              <IconBubble icon={cat?.icon ?? "repeat"} color={cat?.color ?? "#7b68ee"} />
              <button type="button" onClick={() => openRule(rule)} className="min-w-0 flex-1 text-left">
                <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <span className="truncate">{rule.description}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${rule.type === "variable" ? "bg-sky-50 text-sky-700" : "bg-[var(--brand)]/10 text-[var(--brand-600)]"}`}>
                    {rule.housing ? "Valor por mês" : rule.type === "variable" ? "Variável" : "Fixa"}
                  </span>
                  {rule.cardId && !rule.ended && !rule.housing && (
                    <span className="shrink-0 rounded-full bg-[var(--brand)]/10 px-2 py-0.5 text-[10.5px] font-medium text-[var(--brand-600)]">Assinatura</span>
                  )}
                  {rule.ended && <span className="shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[10.5px]">{rule.cardId ? "Cancelada" : "Encerrada"}</span>}
                </p>
                <p className="truncate text-xs text-[var(--muted)]">
                  {intervalLabel(rule.intervalMonths)} · dia {rule.dayOfMonth}
                  {where ? ` · ${where}` : ""}
                  {rule.nextDate ? ` · próximo ${formatYmd(rule.nextDate)}` : ""}
                  {rule.endDate ? ` · até ${formatYmd(rule.endDate)}` : ""}
                </p>
              </button>
              <div className="text-right">
                <p className={`text-sm font-semibold tabular-nums ${kind === "income" ? "text-emerald-600" : "text-slate-800"}`}>{formatBRL(rule.amountCents)}</p>
                {rule.intervalMonths > 1 && <p className="text-[11px] text-[var(--muted)]">≈ {formatBRL(rule.monthlyCents)}/mês</p>}
              </div>
              <div className="flex shrink-0">
                <button type="button" onClick={() => openRule(rule)} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]" title={rule.housing ? "Valores por mês" : "Editar"}>
                  <Pencil className="h-4 w-4" />
                </button>
                {!rule.ended && (
                  <button type="button" onClick={() => void end(rule, "future")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05]" title={rule.cardId ? "Cancelar assinatura" : "Encerrar"}>
                    <CalendarX2 className="h-4 w-4" />
                  </button>
                )}
                <button type="button" onClick={() => void end(rule, "all")} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50" title="Apagar com o histórico">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  };

  if (loading && !data) return <p className="py-10 text-center text-sm text-[var(--muted)]">Carregando...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Renda recorrente por mês" value={formatBRL(income)} tone="income" />
        <Stat label="Custo fixo por mês" value={formatBRL(fixed)} hint="Fixas e variáveis (estimadas)" tone="expense" />
        <Stat label="Sobra estrutural" value={formatBRL(income - fixed)} hint="Antes dos gastos pontuais" tone={income - fixed < 0 ? "expense" : "brand"} />
        <Stat label="Renda comprometida" value={income > 0 ? `${Math.round((fixed / income) * 100)}%` : "—"} hint="Custo fixo ÷ renda recorrente" />
      </div>
      <ErrorNote message={error} />
      {rules.length === 0 ? (
        <EmptyState
          icon={<Repeat className="h-5 w-5" />}
          title="Nada recorrente ainda"
          text="Salário, aluguel, luz, internet, assinaturas, bônus... Cadastre uma vez e o app lança todo mês."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => openEntry({ flow: "income", mode: "recurring" })}>
                <Plus className="h-4 w-4" /> Receita recorrente
              </Button>
              <Button variant="outline" onClick={() => openEntry({ flow: "expense", mode: "fixed" })}>
                <Plus className="h-4 w-4" /> Despesa fixa
              </Button>
              <Button variant="outline" onClick={() => setHousing({ system: "aluguel" })}>
                <Home className="h-4 w-4" /> Aluguel
              </Button>
              <Button variant="outline" onClick={() => setHousing({ system: "condominio" })}>
                <Building2 className="h-4 w-4" /> Condomínio
              </Button>
            </div>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Receitas recorrentes" action={<Button variant="ghost" onClick={() => openEntry({ flow: "income", mode: "recurring" })}><Plus className="h-4 w-4" /></Button>}>
            {renderList("income")}
          </Panel>
          <Panel
            title="Despesas fixas e variáveis"
            action={
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => setHousing({ system: "aluguel" })} title="Aluguel">
                  <Home className="h-4 w-4" />
                  <span className="hidden sm:inline">{HOUSING_LABELS.aluguel}</span>
                </Button>
                <Button variant="ghost" onClick={() => setHousing({ system: "condominio" })} title="Condomínio">
                  <Building2 className="h-4 w-4" />
                  <span className="hidden sm:inline">{HOUSING_LABELS.condominio}</span>
                </Button>
                <Button variant="ghost" onClick={() => openEntry({ flow: "expense", mode: "fixed" })}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            }
          >
            {renderList("expense")}
          </Panel>
        </div>
      )}
      {editing && (
        <RecurrenceModal
          rule={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            void refresh();
          }}
        />
      )}
      {housing && (
        <HousingRecurrenceModal
          system={housing.system}
          rule={housing.rule}
          onClose={() => setHousing(null)}
          onDone={() => {
            setHousing(null);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
