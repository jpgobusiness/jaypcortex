"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarRange,
  ChartColumn,
  ChartLine,
  ChartPie,
  CreditCard,
  Hash,
  LayoutDashboard,
  ListOrdered,
  Pencil,
  Plus,
  Save,
  Settings2,
  Trash2,
  Waypoints,
  Landmark,
  CalendarClock,
  Layers,
} from "lucide-react";
import { useFinance } from "@/components/finance/FinanceProvider";
import { EmptyState, ErrorNote, Field, Panel, Segmented, Toggle, useApi } from "@/components/finance/ui";
import { coveringRange, SIZE_CLASSES, WidgetBody, widgetTitle, type WidgetContext } from "@/components/finance/widgets";
import Modal from "@/components/ui/Modal";
import { Button, Input, Select } from "@/components/ui/form";
import { apiDelete, apiPatch, apiPost } from "@/lib/fetcher";
import { KPI_LABELS, makeLookup, PERIOD_LABELS, periodRange } from "@/lib/finance/analytics";
import { shortMonth } from "@/lib/finance/dates";
import { DASHBOARD_TEMPLATES, newWidgetId, templateWidgets } from "@/lib/finance/templates";
import type { Dimension, FinAnalytics, FinDashboard, KpiMetric, PeriodPreset, WidgetConfig, WidgetSize } from "@/lib/finance/types";

const DIMENSIONS: Record<Dimension, string> = {
  group: "Categoria principal",
  category: "Categoria (com subcategorias)",
  nature: "Tipo: fixa, variável, pontual, parcelada, empréstimo",
  payment: "Conta ou cartão",
  card: "Cartão",
  tag: "Tag",
  weekday: "Dia da semana",
};

const SIZES: { value: WidgetSize; label: string }[] = [
  { value: "sm", label: "1/4" },
  { value: "md", label: "1/2" },
  { value: "lg", label: "3/4" },
  { value: "full", label: "Inteiro" },
];

const CATALOG: { title: string; text: string; icon: typeof Hash; widget: Omit<WidgetConfig, "id"> }[] = [
  { title: "Número (KPI)", text: "Receitas, despesas, taxa de poupança, reserva de emergência, dívida...", icon: Hash, widget: { type: "kpi", size: "sm", metric: "net" } },
  { title: "Receitas × despesas", text: "Barras por mês com a linha do resultado.", icon: ChartColumn, widget: { type: "cashflow", size: "md", period: "last6" } },
  { title: "Saldo no tempo", text: "Saldo realizado e a previsão com o que está agendado.", icon: ChartLine, widget: { type: "balance", size: "md", period: "next6" } },
  { title: "Pizza", text: "Divisão por categoria, tipo de gasto, conta, cartão ou tag.", icon: ChartPie, widget: { type: "breakdown", size: "md", kind: "expense", dimension: "group", chart: "donut" } },
  { title: "Ranking", text: "Barras do maior para o menor.", icon: ListOrdered, widget: { type: "breakdown", size: "md", kind: "expense", dimension: "group", chart: "bars" } },
  { title: "Mês a mês empilhado", text: "Como cada grupo evolui ao longo dos meses.", icon: Layers, widget: { type: "stacked", size: "full", kind: "expense", dimension: "group", period: "last6" } },
  { title: "Fluxo do dinheiro", text: "Sankey: de onde vem e para onde vai cada real.", icon: Waypoints, widget: { type: "sankey", size: "full" } },
  { title: "Maiores lançamentos", text: "Lista das maiores despesas ou receitas.", icon: ListOrdered, widget: { type: "top", size: "md", kind: "expense", limit: 8 } },
  { title: "Próximos vencimentos", text: "Contas a pagar, a receber e faturas.", icon: CalendarClock, widget: { type: "agenda", size: "md" } },
  { title: "Cartões", text: "Limite usado e faturas de cada cartão.", icon: CreditCard, widget: { type: "cards", size: "md" } },
  { title: "Empréstimos", text: "Saldo devedor e progresso das parcelas.", icon: Landmark, widget: { type: "loans", size: "md" } },
];

const errorText = (cause: unknown) => (cause instanceof Error ? cause.message : "Não foi possível salvar");

function WidgetEditor({ widget, onClose, onSave }: { widget: WidgetConfig; onClose: () => void; onSave: (widget: WidgetConfig) => void }) {
  const [draft, setDraft] = useState<WidgetConfig>(widget);
  const set = (patch: Partial<WidgetConfig>) => setDraft((current) => ({ ...current, ...patch }));
  const hasKind = draft.type === "breakdown" || draft.type === "stacked" || draft.type === "top";
  const hasDimension = draft.type === "breakdown" || draft.type === "stacked";
  const hasPeriod = !["agenda", "cards", "loans"].includes(draft.type);
  return (
    <Modal
      open
      onClose={onClose}
      title="Configurar visão"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onSave(draft)}>Aplicar</Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Título">
          <Input value={draft.title ?? ""} onChange={(event) => set({ title: event.target.value || undefined })} placeholder={widgetTitle({ ...draft, title: undefined })} />
        </Field>
        <Field label="Tamanho">
          <Segmented size="sm" value={draft.size} onChange={(size) => set({ size })} options={SIZES} />
        </Field>
        {draft.type === "kpi" && (
          <Field label="Indicador">
            <Select value={draft.metric ?? "net"} onChange={(event) => set({ metric: event.target.value as KpiMetric })}>
              {(Object.keys(KPI_LABELS) as KpiMetric[]).map((metric) => (
                <option key={metric} value={metric}>
                  {KPI_LABELS[metric]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {hasKind && (
          <Field label="Olhar para">
            <Segmented
              size="sm"
              value={draft.kind ?? "expense"}
              onChange={(kind) => set({ kind })}
              options={[
                { value: "expense", label: "Despesas" },
                { value: "income", label: "Receitas" },
              ]}
            />
          </Field>
        )}
        {hasDimension && (
          <Field label="Agrupar por">
            <Select value={draft.dimension ?? "group"} onChange={(event) => set({ dimension: event.target.value as Dimension })}>
              {(Object.keys(DIMENSIONS) as Dimension[]).map((dimension) => (
                <option key={dimension} value={dimension}>
                  {DIMENSIONS[dimension]}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {draft.type === "breakdown" && (
          <Field label="Visual">
            <Segmented
              size="sm"
              value={draft.chart ?? "donut"}
              onChange={(chart) => set({ chart })}
              options={[
                { value: "donut", label: "Pizza" },
                { value: "bars", label: "Barras" },
              ]}
            />
          </Field>
        )}
        {(hasDimension || draft.type === "top" || draft.type === "agenda") && (
          <Field label="Quantos itens mostrar">
            <Input type="number" min={3} max={20} value={draft.limit ?? 8} onChange={(event) => set({ limit: Math.min(20, Math.max(3, Number(event.target.value) || 8)) })} />
          </Field>
        )}
        {hasPeriod && (
          <Field label="Período" hint="Deixe no período do dashboard para mudar tudo junto lá em cima.">
            <Select value={draft.period ?? ""} onChange={(event) => set({ period: (event.target.value || undefined) as PeriodPreset | undefined })}>
              <option value="">Usar o período do dashboard</option>
              {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {PERIOD_LABELS[preset]}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}

function NewDashboardModal({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, template: string | null) => Promise<void> }) {
  const [name, setName] = useState("");
  const [template, setTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title="Novo dashboard"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              const finalName = name.trim() || DASHBOARD_TEMPLATES.find((item) => item.key === template)?.name || "Meu dashboard";
              onCreate(finalName, template).catch((cause) => setError(errorText(cause)));
            }}
          >
            Criar
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <ErrorNote message={error} />
        <Field label="Nome">
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Planejamento 2027" />
        </Field>
        <div className="grid gap-2 sm:grid-cols-2">
          {[{ key: null, name: "Em branco", description: "Comece do zero e adicione as visões que quiser." }, ...DASHBOARD_TEMPLATES].map((item) => (
            <button
              key={item.key ?? "blank"}
              type="button"
              onClick={() => setTemplate(item.key)}
              className={`rounded-xl border p-3 text-left transition-all ${template === item.key ? "border-[var(--brand)] bg-[var(--brand)]/[0.06] ring-2 ring-[var(--brand)]/20" : "border-[var(--border)] hover:border-black/20"}`}
            >
              <p className="text-sm font-semibold">{item.name}</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">{item.description}</p>
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function DashboardsView() {
  const { today, ready, accounts, cards, categories, version, refresh } = useFinance();
  const [listVersion, setListVersion] = useState(0);
  const { data: dashboards, loading } = useApi<FinDashboard[]>(ready ? "/api/financas/dashboards" : null, listVersion);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodPreset>("month");
  const [includeProjected, setIncludeProjected] = useState(true);
  const [draft, setDraft] = useState<{ name: string; widgets: WidgetConfig[] } | null>(null);
  const [configuring, setConfiguring] = useState<WidgetConfig | null>(null);
  const [catalog, setCatalog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const active = dashboards?.find((item) => item.id === activeId) ?? dashboards?.[0] ?? null;
  const widgets = draft?.widgets ?? active?.widgets ?? [];
  const base = periodRange(period, today);
  const range = coveringRange(widgets, base, today);
  const { data: analytics } = useApi<FinAnalytics>(ready && widgets.length ? `/api/financas/analytics?from=${range.from}&to=${range.to}` : null, version);
  const lookup = useMemo(() => makeLookup(categories, accounts, cards), [categories, accounts, cards]);

  const editing = draft !== null;
  const updateWidgets = (next: WidgetConfig[]) => setDraft((current) => (current ? { ...current, widgets: next } : current));
  const move = (index: number, delta: number) => {
    const next = [...widgets];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateWidgets(next);
  };

  async function save() {
    if (!active || !draft) return;
    setSaving(true);
    setError(null);
    try {
      await apiPatch(`/api/financas/dashboards/${active.id}`, { name: draft.name.trim() || active.name, widgets: draft.widgets });
      setDraft(null);
      setListVersion((value) => value + 1);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  async function create(name: string, template: string | null) {
    const created = await apiPost<FinDashboard>("/api/financas/dashboards", { name, widgets: template ? templateWidgets(template) : [] });
    setCreating(false);
    setActiveId(created.id);
    setListVersion((value) => value + 1);
    if (!template) setDraft({ name: created.name, widgets: [] });
  }

  async function remove() {
    if (!active || !confirm(`Excluir o dashboard "${active.name}"?`)) return;
    await apiDelete(`/api/financas/dashboards/${active.id}`);
    setDraft(null);
    setActiveId(null);
    setListVersion((value) => value + 1);
  }

  if (!ready || (loading && !dashboards)) return <p className="py-10 text-center text-sm text-[var(--muted)]">Carregando dashboards...</p>;

  const ctx: WidgetContext | null = analytics
    ? { analytics, lookup, range: base, includeProjected, today, cards }
    : null;

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="scroll-x-fade flex min-w-0 flex-1 gap-1.5">
          {(dashboards ?? []).map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={editing}
              onClick={() => setActiveId(item.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                item.id === active?.id ? "bg-[#15171c] text-white" : "bg-white text-slate-700 ring-1 ring-[var(--border)] hover:bg-black/[0.03]"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> {item.name}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => setCreating(true)} disabled={editing}>
          <Plus className="h-4 w-4" /> Novo dashboard
        </Button>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-white p-3 sm:flex-row sm:items-center">
        {editing ? (
          <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} className="sm:max-w-xs" aria-label="Nome do dashboard" />
        ) : (
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-[var(--muted)]" />
            <Select value={period} onChange={(event) => setPeriod(event.target.value as PeriodPreset)} className="sm:w-52" aria-label="Período">
              {(Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((preset) => (
                <option key={preset} value={preset}>
                  {PERIOD_LABELS[preset]}
                </option>
              ))}
            </Select>
            <span className="hidden text-xs text-[var(--muted)] lg:inline">
              {shortMonth(base.from)}
              {base.from !== base.to ? ` → ${shortMonth(base.to)}` : ""}
            </span>
          </div>
        )}
        {!editing && (
          <div className="sm:ml-2">
            <Toggle checked={includeProjected} onChange={setIncludeProjected} label="Incluir previstos" />
          </div>
        )}
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {editing ? (
            <>
              <Button variant="ghost" className="text-rose-600" onClick={() => void remove()}>
                <Trash2 className="h-4 w-4" /> Excluir
              </Button>
              <Button variant="outline" onClick={() => setCatalog(true)}>
                <Plus className="h-4 w-4" /> Adicionar visão
              </Button>
              <Button variant="outline" onClick={() => setDraft(null)}>
                Cancelar
              </Button>
              <Button onClick={() => void save()} disabled={saving}>
                <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
              </Button>
            </>
          ) : (
            active && (
              <Button variant="outline" onClick={() => setDraft({ name: active.name, widgets: active.widgets })}>
                <Pencil className="h-4 w-4" /> Editar dashboard
              </Button>
            )
          )}
        </div>
      </div>
      <ErrorNote message={error} />

      {!active ? (
        <EmptyState icon={<LayoutDashboard className="h-5 w-5" />} title="Nenhum dashboard" text="Crie um em branco ou a partir de um modelo." />
      ) : widgets.length === 0 ? (
        <EmptyState
          icon={<LayoutDashboard className="h-5 w-5" />}
          title="Dashboard vazio"
          text="Adicione visões: números, gráficos, Sankey, rankings, cartões, empréstimos..."
          action={
            <Button
              onClick={() => {
                if (!editing) setDraft({ name: active.name, widgets: [] });
                setCatalog(true);
              }}
            >
              <Plus className="h-4 w-4" /> Adicionar visão
            </Button>
          }
        />
      ) : !ctx ? (
        <p className="py-10 text-center text-sm text-[var(--muted)]">Calculando...</p>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {widgets.map((widget, index) => (
            <Panel
              key={widget.id}
              className={`${SIZE_CLASSES[widget.size]} ${widget.type === "kpi" ? "self-start" : ""} ${editing ? "outline-2 outline-dashed outline-offset-2 outline-[var(--brand)]/30" : ""}`}
              title={widgetTitle(widget)}
              subtitle={widget.period ? PERIOD_LABELS[widget.period] : undefined}
              action={
                editing ? (
                  <div className="flex shrink-0 items-center">
                    <button type="button" onClick={() => move(index, -1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05]" aria-label="Mover para trás">
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => move(index, 1)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05]" aria-label="Mover para frente">
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => setConfiguring(widget)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--muted)] hover:bg-black/[0.05]" aria-label="Configurar">
                      <Settings2 className="h-3.5 w-3.5" />
                    </button>
                    <button type="button" onClick={() => updateWidgets(widgets.filter((item) => item.id !== widget.id))} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-rose-500 hover:bg-rose-50" aria-label="Remover">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : undefined
              }
              bodyClass={widget.type === "kpi" ? "px-5 pb-4 pt-2" : "p-5"}
            >
              <WidgetBody widget={widget} ctx={ctx} />
            </Panel>
          ))}
        </div>
      )}

      {catalog && (
        <Modal open onClose={() => setCatalog(false)} title="Adicionar visão" size="lg">
          <div className="grid gap-2 sm:grid-cols-2">
            {CATALOG.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => {
                  const widget = { ...item.widget, id: newWidgetId() };
                  updateWidgets([...widgets, widget]);
                  setCatalog(false);
                  setConfiguring(widget);
                }}
                className="flex items-start gap-3 rounded-xl border border-[var(--border)] p-3 text-left transition-all hover:border-[var(--brand)] hover:bg-[var(--brand)]/[0.04]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand)]/10 text-[var(--brand-600)]">
                  <item.icon className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">{item.title}</span>
                  <span className="block text-xs text-[var(--muted)]">{item.text}</span>
                </span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {configuring && (
        <WidgetEditor
          widget={configuring}
          onClose={() => setConfiguring(null)}
          onSave={(next) => {
            updateWidgets(widgets.map((item) => (item.id === next.id ? next : item)));
            setConfiguring(null);
          }}
        />
      )}
      {creating && <NewDashboardModal onClose={() => setCreating(false)} onCreate={create} />}
      <p className="text-center text-xs text-[var(--muted)]">
        Os mesmos números estão no Supabase nas views <code>v_fin_*</code>, prontos para Metabase, Looker Studio ou Power BI.{" "}
        <button type="button" onClick={() => void refresh()} className="font-medium text-[var(--brand-600)] hover:underline">
          Atualizar dados
        </button>
      </p>
    </div>
  );
}
