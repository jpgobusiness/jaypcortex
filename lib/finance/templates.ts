// Dashboards prontos (criados na primeira visita à tela de dashboards).
import type { WidgetConfig } from "./types";

type Template = { key: string; name: string; description: string; widgets: Omit<WidgetConfig, "id">[] };

export const DASHBOARD_TEMPLATES: Template[] = [
  {
    key: "mes",
    name: "Visão do mês",
    description: "Quanto entrou, quanto saiu, o que vence e para onde foi.",
    widgets: [
      { type: "kpi", size: "sm", metric: "income" },
      { type: "kpi", size: "sm", metric: "expense" },
      { type: "kpi", size: "sm", metric: "net" },
      { type: "kpi", size: "sm", metric: "savings_rate" },
      { type: "cashflow", size: "md", title: "Receitas × despesas", period: "last6" },
      { type: "breakdown", size: "md", kind: "expense", dimension: "group", chart: "donut", title: "Despesas por categoria" },
      { type: "agenda", size: "md", title: "Próximos vencimentos" },
      { type: "top", size: "md", kind: "expense", title: "Maiores despesas", limit: 8 },
    ],
  },
  {
    key: "dinheiro",
    name: "Para onde vai o dinheiro",
    description: "Fluxo do dinheiro, tipos de gasto e hábitos.",
    widgets: [
      { type: "sankey", size: "full", title: "Fluxo do dinheiro" },
      { type: "breakdown", size: "md", kind: "expense", dimension: "nature", chart: "donut", title: "Fixas × variáveis × pontuais" },
      { type: "breakdown", size: "md", kind: "expense", dimension: "payment", chart: "bars", title: "Por conta e cartão" },
      { type: "stacked", size: "full", kind: "expense", dimension: "group", title: "Categorias mês a mês", period: "last6" },
      { type: "breakdown", size: "md", kind: "expense", dimension: "weekday", chart: "bars", title: "Gasto por dia da semana" },
      { type: "kpi", size: "sm", metric: "avg_daily_expense" },
      { type: "kpi", size: "sm", metric: "commitments" },
    ],
  },
  {
    key: "cartoes",
    name: "Cartões de crédito",
    description: "Limite, faturas e o que pesa em cada cartão.",
    widgets: [
      { type: "kpi", size: "sm", metric: "card_spend" },
      { type: "kpi", size: "sm", metric: "invoices_open" },
      { type: "cards", size: "md", title: "Uso do limite e faturas" },
      { type: "stacked", size: "full", kind: "expense", dimension: "card", title: "Faturas por mês", period: "next6" },
      { type: "breakdown", size: "md", kind: "expense", dimension: "nature", chart: "donut", title: "À vista × parcelado × assinaturas" },
      { type: "top", size: "md", kind: "expense", title: "Maiores despesas", limit: 8 },
    ],
  },
  {
    key: "futuro",
    name: "Dívidas e futuro",
    description: "Compromissos dos próximos meses, empréstimos e saldo previsto.",
    widgets: [
      { type: "kpi", size: "sm", metric: "loan_balance" },
      { type: "kpi", size: "sm", metric: "debt_ratio" },
      { type: "kpi", size: "sm", metric: "emergency_months" },
      { type: "kpi", size: "sm", metric: "balance" },
      { type: "balance", size: "md", title: "Saldo realizado e previsto", period: "next6" },
      { type: "cashflow", size: "md", title: "Próximos 6 meses", period: "next6" },
      { type: "loans", size: "md", title: "Empréstimos" },
      { type: "agenda", size: "md", title: "Próximos vencimentos" },
      { type: "stacked", size: "full", kind: "expense", dimension: "nature", title: "Compromissos por tipo", period: "next6" },
    ],
  },
  {
    key: "receitas",
    name: "Receitas",
    description: "Salário, horas extras, reembolsos e bônus.",
    widgets: [
      { type: "kpi", size: "sm", metric: "income" },
      { type: "kpi", size: "sm", metric: "savings_rate" },
      { type: "breakdown", size: "md", kind: "income", dimension: "category", chart: "donut", title: "De onde vem a renda" },
      { type: "stacked", size: "full", kind: "income", dimension: "category", title: "Receitas por tipo", period: "last12" },
      { type: "breakdown", size: "md", kind: "income", dimension: "nature", chart: "bars", title: "Recorrente × pontual" },
      { type: "top", size: "md", kind: "income", title: "Maiores receitas", limit: 8 },
    ],
  },
];

let counter = 0;
export function newWidgetId(): string {
  counter += 1;
  return `w${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function templateWidgets(key: string): WidgetConfig[] {
  const template = DASHBOARD_TEMPLATES.find((item) => item.key === key) ?? DASHBOARD_TEMPLATES[0];
  return template.widgets.map((widget) => ({ ...widget, id: newWidgetId() }));
}
