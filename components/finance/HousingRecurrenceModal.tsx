"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Hint } from "@/components/finance/EntryModal";
import { useFinance } from "@/components/finance/FinanceProvider";
import { ErrorNote, Field, MoneyInput } from "@/components/finance/ui";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import { monthOf, parseYmd, shortMonth } from "@/lib/finance/dates";
import { applyForecast, HOUSING_LABELS, housingHorizon, housingMonths, type HousingMonth, type HousingSystem } from "@/lib/finance/housing";
import { formatBRL } from "@/lib/finance/money";
import type { FinRecurrence, FinRecurrenceDetail } from "@/lib/finance/types";

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

function amountsOf(months: HousingMonth[]) {
  return Object.fromEntries(months.map((item) => [item.key, item.amountCents]));
}

export default function HousingRecurrenceModal({
  system,
  rule,
  onClose,
  onDone,
}: {
  system: HousingSystem;
  rule?: FinRecurrence | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const { today, accounts, cards, openAccount, openCard } = useFinance();
  const label = HOUSING_LABELS[system];
  const activeAccounts = accounts.filter((account) => !account.archived);
  const activeCards = cards.filter((card) => !card.archived);
  const [description, setDescription] = useState(rule?.description ?? label);
  const [startDate, setStartDate] = useState(rule?.startDate ?? today);
  const [forecast, setForecast] = useState<number | null>(rule?.amountCents ?? null);
  const [source, setSource] = useState(rule?.cardId ? `card:${rule.cardId}` : `account:${rule?.accountId ?? activeAccounts[0]?.id ?? ""}`);
  const [months, setMonths] = useState<HousingMonth[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(rule));

  function rebuild(nextStart: string, nextForecast: number | null, previous: HousingMonth[]) {
    if (!nextForecast || nextForecast <= 0 || !nextStart) {
      setMonths([]);
      return;
    }
    setMonths(
      housingMonths({
        startDate: nextStart,
        dayOfMonth: parseYmd(nextStart).d,
        untilKey: housingHorizon(today),
        forecastCents: nextForecast,
        amounts: amountsOf(previous),
      })
    );
  }

  useEffect(() => {
    if (!rule) {
      rebuild(startDate, forecast, []);
      return;
    }
    let alive = true;
    apiGet<FinRecurrenceDetail>(`/api/financas/recurrences/${rule.id}`).then(
      (detail) => {
        if (!alive) return;
        setDescription(detail.description);
        setStartDate(detail.startDate);
        setForecast(detail.amountCents);
        setSource(detail.cardId ? `card:${detail.cardId}` : `account:${detail.accountId ?? ""}`);
        const loaded = detail.months.map((item) => ({ key: item.key, date: item.date, amountCents: item.amountCents }));
        setMonths(
          housingMonths({
            startDate: detail.startDate,
            dayOfMonth: detail.dayOfMonth,
            untilKey: housingHorizon(today),
            forecastCents: detail.amountCents,
            amounts: amountsOf(loaded),
          })
        );
        setLoading(false);
      },
      (cause: unknown) => {
        if (!alive) return;
        setError(errorText(cause));
        setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
    // Só na abertura: o resto é estado controlado pelo formulário.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rule?.id]);

  const current = monthOf(today);
  const past = months.filter((item) => item.key < current);
  const fromNow = months.filter((item) => item.key >= current);
  const pastTotal = past.reduce((sum, item) => sum + item.amountCents, 0);
  const years = useMemo(() => [...new Set(months.map((item) => item.key.slice(0, 4)))], [months]);

  function changeStart(next: string) {
    setStartDate(next);
    rebuild(next, forecast, months.map((item) => (item.key >= current ? { ...item, amountCents: forecast ?? item.amountCents } : item)));
  }

  function changeForecast(cents: number | null) {
    setForecast(cents);
    if (!cents || cents <= 0) return;
    if (months.length === 0) rebuild(startDate, cents, []);
    else setMonths(applyForecast(months, current, cents));
  }

  function changeMonth(key: string, cents: number | null) {
    if (!cents || cents <= 0) return;
    setMonths((currentMonths) => currentMonths.map((item) => (item.key === key ? { ...item, amountCents: cents } : item)));
  }

  async function save() {
    if (!description.trim()) return setError("Dê uma descrição");
    if (!forecast || forecast <= 0) return setError("Informe o valor daqui pra frente");
    if (!startDate) return setError("Informe desde quando você paga");
    if (!source.startsWith("card:") && !source.startsWith("account:")) return setError("Escolha uma conta ou um cartão");
    if (months.length === 0) return setError("Informe o início e o valor para montar os meses");
    setSaving(true);
    setError(null);
    const payload = {
      description: description.trim(),
      amountCents: forecast,
      startDate,
      ...(source.startsWith("card:") ? { cardId: source.slice(5) } : { accountId: source.slice(8) }),
      months: months.map((item) => ({ key: item.key, amountCents: item.amountCents })),
    };
    try {
      if (rule) await apiPatch(`/api/financas/recurrences/${rule.id}`, payload);
      else await apiPost("/api/financas/recurrences", { system, ...payload });
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
      size="lg"
      title={rule ? `Editar ${label.toLowerCase()}` : `Novo ${label.toLowerCase()}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={saving || loading}>
            {saving ? "Salvando..." : "Salvar meses"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <Hint>
          Informe desde quando você paga este {label.toLowerCase()}. Os meses passados guardam quanto foi de verdade; o valor daqui pra frente preenche este mês e os próximos.
        </Hint>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Descrição" className="sm:col-span-2">
            <Input value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field label="Pago desde" hint="Primeiro vencimento. Os meses anteriores a hoje viram o histórico.">
            <Input type="date" value={startDate} onChange={(event) => changeStart(event.target.value)} />
          </Field>
          <Field label="Valor daqui pra frente" hint="Preenche este mês e os próximos. O passado não muda.">
            <MoneyInput value={forecast} onChange={changeForecast} large />
          </Field>
          <Field label="Paga com" className="sm:col-span-2">
            <div className="flex gap-2">
              <Select value={source} onChange={(event) => setSource(event.target.value)}>
                <optgroup label="Contas">
                  {activeAccounts.length === 0 && <option value="account:">Crie uma conta →</option>}
                  {activeAccounts.map((account) => (
                    <option key={account.id} value={`account:${account.id}`}>
                      {account.name}
                    </option>
                  ))}
                </optgroup>
                {activeCards.length > 0 && (
                  <optgroup label="Cartões">
                    {activeCards.map((card) => (
                      <option key={card.id} value={`card:${card.id}`}>
                        {card.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </Select>
              <Button variant="outline" onClick={() => openAccount(null, (id) => setSource(`account:${id}`))} title="Nova conta" aria-label="Nova conta">
                <Plus className="h-4 w-4" />
              </Button>
              <Button variant="outline" onClick={() => openCard(null, (id) => setSource(`card:${id}`))} title="Novo cartão" aria-label="Novo cartão">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Field>
        </div>

        {loading ? (
          <p className="py-6 text-center text-sm text-[var(--muted)]">Carregando os meses...</p>
        ) : months.length === 0 ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">Informe a data de início e o valor daqui pra frente para montar os meses.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-800">
                {past.length} {past.length === 1 ? "mês passado" : "meses passados"}
                {past.length > 0 ? ` · ${formatBRL(pastTotal)}` : ""}
                {fromNow.length > 0 ? ` · ${fromNow.length} daqui pra frente` : ""}
              </p>
              <Button variant="ghost" onClick={() => forecast && setMonths(applyForecast(months, current, forecast))} disabled={!forecast}>
                Preencher deste mês em diante
              </Button>
            </div>
            <div className="max-h-[44vh] space-y-4 overflow-y-auto rounded-xl border border-[var(--border)] p-3">
              {years.map((year) => (
                <section key={year}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{year}</h3>
                  <ul className="divide-y divide-[var(--border)]">
                    {months
                      .filter((item) => item.key.startsWith(year))
                      .map((item) => {
                        const future = item.key >= current;
                        return (
                          <li key={item.key} className="flex items-center gap-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-slate-800">{shortMonth(item.key)}</p>
                              <p className="text-[11px] text-[var(--muted)]">{future ? "Previsão" : "Quanto foi"} · dia {parseYmd(item.date).d}</p>
                            </div>
                            <div className="w-36">
                              <MoneyInput value={item.amountCents} onChange={(cents) => changeMonth(item.key, cents)} />
                            </div>
                          </li>
                        );
                      })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
