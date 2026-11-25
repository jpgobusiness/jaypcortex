// Dinheiro em centavos (inteiros), para não perder precisão com float.
// Sem imports com "@/": também roda nos testes (node --test).

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "R$ 1.234,56" */
export function formatBRL(cents: number): string {
  return BRL.format(cents / 100);
}

/** "R$ 12,3 mil" acima de mil; valor cheio abaixo. */
export function formatBRLCompact(cents: number): string {
  return Math.abs(cents) >= 100_000 ? BRL_COMPACT.format(cents / 100) : formatBRL(cents);
}

/** Valor com sinal para extratos: "+ R$ 10,00" / "− R$ 10,00". */
export function formatSigned(cents: number): string {
  if (cents === 0) return formatBRL(0);
  return `${cents > 0 ? "+" : "−"} ${formatBRL(Math.abs(cents))}`;
}

/**
 * Centavos a partir de número (reais) ou texto ("1.234,56", "1234.56", "R$ 10").
 * Retorna null se não for um valor válido.
 */
export function toCents(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) : null;
  if (typeof value !== "string") return null;
  let text = value.replace(/R\$|\s/g, "");
  if (!text) return null;
  const negative = text.startsWith("-");
  if (negative) text = text.slice(1);
  if (text.includes(",")) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const [whole, fraction = ""] = text.split(".");
  const cents = Number(whole) * 100 + Math.round(Number(`${fraction}000`.slice(0, 3)) / 10);
  return negative ? -cents : cents;
}

const PLAIN = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Centavos → texto do campo ("1.234,56"), sem símbolo. */
export function centsToInput(cents: number): string {
  return PLAIN.format(cents / 100);
}

/**
 * Divide um total em parcelas iguais. A diferença de centavos vai na 1ª parcela,
 * como fazem os cartões.
 */
export function splitInstallments(totalCents: number, count: number): number[] {
  const base = Math.floor(totalCents / count);
  const rest = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => (index === 0 ? base + rest : base));
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
