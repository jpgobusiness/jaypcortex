// Opções e rótulos do módulo de finanças (usados na API e na tela).

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Conta corrente", icon: "landmark" },
  { value: "savings", label: "Poupança", icon: "piggy-bank" },
  { value: "cash", label: "Dinheiro / carteira", icon: "wallet" },
  { value: "investment", label: "Investimentos", icon: "trending-up" },
  { value: "benefit", label: "Benefício (VR/VA)", icon: "utensils" },
  { value: "other", label: "Outra", icon: "circle-dashed" },
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number]["value"];

export const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "other", label: "Outra" },
] as const;
export type CardBrand = (typeof CARD_BRANDS)[number]["value"];

export const LOAN_TYPES = [
  { value: "personal", label: "Empréstimo pessoal" },
  { value: "payroll", label: "Consignado" },
  { value: "vehicle", label: "Financiamento de veículo" },
  { value: "mortgage", label: "Financiamento imobiliário" },
  { value: "person", label: "Com uma pessoa" },
  { value: "other", label: "Outro" },
] as const;
export type LoanType = (typeof LOAN_TYPES)[number]["value"];

export const INTERVALS = [
  { value: 1, label: "Mensal" },
  { value: 2, label: "Bimestral" },
  { value: 3, label: "Trimestral" },
  { value: 6, label: "Semestral" },
  { value: 12, label: "Anual" },
] as const;

export function intervalLabel(months: number): string {
  return INTERVALS.find((item) => item.value === months)?.label ?? `A cada ${months} meses`;
}

/** Frequência sugerida ao escolher a categoria numa receita recorrente. */
export const SUGGESTED_INTERVAL: Record<string, number> = {
  "bonus-quarter": 3,
  "bonus-anual": 12,
  "decimo-terceiro": 12,
  ferias: 12,
};

export const TRANSACTION_KINDS = ["income", "expense", "transfer", "card_payment", "adjustment", "loan_disbursement"] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export const KIND_LABELS: Record<TransactionKind, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
  card_payment: "Pagamento de fatura",
  adjustment: "Ajuste de saldo",
  loan_disbursement: "Entrada de empréstimo",
};

/** Natureza do lançamento (base das visões fixa × variável × pontual...). */
export type Nature = "one_off" | "fixed" | "variable" | "installment" | "loan";

export const EXPENSE_NATURE_LABELS: Record<Nature, string> = {
  one_off: "Pontual",
  fixed: "Fixa",
  variable: "Variável",
  installment: "Parcelada no cartão",
  loan: "Empréstimo",
};

export const INCOME_NATURE_LABELS: Record<Nature, string> = {
  one_off: "Pontual",
  fixed: "Recorrente",
  variable: "Recorrente",
  installment: "Parcelada",
  loan: "Empréstimo",
};

export const NATURE_COLORS: Record<Nature, string> = {
  fixed: "#7b68ee",
  variable: "#0ea5e9",
  one_off: "#f59e0b",
  installment: "#ec4899",
  loan: "#ef4444",
};

/** Cores sugeridas para contas, cartões e categorias. */
export const PALETTE = [
  "#7b68ee", "#4f46e5", "#2563eb", "#0ea5e9", "#14b8a6", "#16a34a", "#84cc16",
  "#eab308", "#f59e0b", "#f97316", "#ef4444", "#e11d48", "#ec4899", "#a855f7",
  "#8a05be", "#15171c", "#475569", "#94a3b8",
];

export const MAX_CARD_INSTALLMENTS = 48;
export const MAX_LOAN_INSTALLMENTS = 600;
/** Meses para trás na aba Despesas: cobre uma compra no máximo de parcelas. */
export const EXPENSE_HISTORY_MONTHS = MAX_CARD_INSTALLMENTS;
