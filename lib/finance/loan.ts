// Empréstimos e financiamentos: tabela Price ou SAC, taxa implícita, CET e quitação.
import { addMonthsYmd, diffDays, type Ymd } from "./dates";

export type Amortization = "price" | "sac";

export type LoanTerms = {
  principalCents: number;
  /** Juros em % ao mês. */
  monthlyRate: number;
  installmentCount: number;
  amortization: Amortization;
  /** Parcela fixa informada (Price). Sem ela, sai da taxa. */
  installmentCents?: number | null;
  firstDueDate: Ymd;
};

export type ScheduleRow = {
  number: number;
  dueDate: Ymd;
  amountCents: number;
  interestCents: number;
  principalCents: number;
  /** Saldo devedor depois desta parcela. */
  balanceCents: number;
};

/** Parcela da tabela Price: P·i / (1 − (1 + i)^−n). */
export function pricePayment(principalCents: number, monthlyRate: number, count: number): number {
  const rate = monthlyRate / 100;
  if (rate <= 0) return Math.round(principalCents / count);
  return Math.round((principalCents * rate) / (1 - Math.pow(1 + rate, -count)));
}

/**
 * Tabela de parcelas. Price: parcela igual, amortização crescente.
 * SAC: amortização igual, parcela decrescente. A última parcela zera o saldo.
 */
export function buildSchedule(terms: LoanTerms): ScheduleRow[] {
  const rate = terms.monthlyRate / 100;
  const count = terms.installmentCount;
  const payment =
    terms.amortization === "price"
      ? terms.installmentCents ?? pricePayment(terms.principalCents, terms.monthlyRate, count)
      : 0;
  const constantPrincipal = Math.round(terms.principalCents / count);
  const rows: ScheduleRow[] = [];
  let balance = terms.principalCents;
  for (let number = 1; number <= count; number += 1) {
    const interest = Math.round(balance * rate);
    let principal = terms.amortization === "price" ? payment - interest : constantPrincipal;
    if (number === count || principal > balance) principal = balance;
    principal = Math.max(0, principal);
    balance -= principal;
    rows.push({
      number,
      dueDate: addMonthsYmd(terms.firstDueDate, number - 1),
      amountCents: principal + interest,
      interestCents: interest,
      principalCents: principal,
      balanceCents: balance,
    });
  }
  return rows;
}

/** Busca por bisseção a taxa (fração) em que `presentValue(taxa)` = alvo. presentValue cai com a taxa. */
function solveRate(target: number, presentValue: (rate: number) => number): number {
  let low = 0;
  let high = 1; // até 100% ao mês
  for (let step = 0; step < 200; step += 1) {
    const mid = (low + high) / 2;
    if (presentValue(mid) > target) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/** Juros % a.m. embutidos numa parcela fixa (Price). Útil quando o contrato só mostra a parcela. */
export function impliedMonthlyRate(principalCents: number, paymentCents: number, count: number): number {
  if (paymentCents * count <= principalCents) return 0;
  const rate = solveRate(principalCents, (r) => (r === 0 ? paymentCents * count : (paymentCents * (1 - Math.pow(1 + r, -count))) / r));
  return rate * 100;
}

/** Taxa anual equivalente: (1 + i)^12 − 1. */
export function annualRate(monthlyRate: number): number {
  return (Math.pow(1 + monthlyRate / 100, 12) - 1) * 100;
}

const DAYS_PER_MONTH = 365 / 12;

/**
 * CET (Res. CMN 4.881/2020): taxa que iguala o valor líquido recebido (contratado
 * menos IOF, tarifas e seguro) às parcelas, com prazos em dias corridos.
 */
export function effectiveCost(input: {
  principalCents: number;
  feesCents: number;
  contractDate: Ymd | null;
  firstDueDate: Ymd;
  schedule: ScheduleRow[];
}): { monthly: number; annual: number } | null {
  const received = input.principalCents - input.feesCents;
  if (received <= 0 || input.schedule.length === 0) return null;
  const start = input.contractDate ?? addMonthsYmd(input.firstDueDate, -1);
  const flows = input.schedule.map((row) => ({
    amount: row.amountCents,
    months: Math.max(diffDays(start, row.dueDate), 1) / DAYS_PER_MONTH,
  }));
  const total = flows.reduce((sum, flow) => sum + flow.amount, 0);
  if (total <= received) return { monthly: 0, annual: 0 };
  const rate = solveRate(received, (r) => flows.reduce((sum, flow) => sum + flow.amount / Math.pow(1 + r, flow.months), 0));
  return { monthly: rate * 100, annual: (Math.pow(1 + rate, 12) - 1) * 100 };
}

/**
 * Quanto custaria quitar hoje: parcelas em aberto trazidas a valor presente pela
 * taxa do contrato (CDC art. 52 §2º; Res. CMN 5.004/2022 art. 7º). Parcela já
 * vencida entra cheia. É uma estimativa: o banco informa o valor oficial.
 */
export function payoffToday(open: { dueDate: Ymd; amountCents: number }[], monthlyRate: number, today: Ymd) {
  const rate = monthlyRate / 100;
  let payoff = 0;
  let nominal = 0;
  for (const row of open) {
    nominal += row.amountCents;
    const days = diffDays(today, row.dueDate);
    payoff += days <= 0 ? row.amountCents : row.amountCents / Math.pow(1 + rate, days / DAYS_PER_MONTH);
  }
  const payoffCents = Math.round(payoff);
  return { payoffCents, nominalCents: nominal, savingsCents: nominal - payoffCents };
}

export type PayoffQuoteKey = "cdc" | "nominal";

export type PayoffQuote = {
  key: PayoffQuoteKey;
  label: string;
  hint: string;
  payoffCents: number;
  savingsCents: number;
  principalCents: number;
  nominalCents: number;
};

/**
 * Simulação de juntar as parcelas de uma vez. O padrão dos bancos no Brasil é o
 * CDC art. 52 §2º + Res. CMN 5.004/2022: valor presente das parcelas restantes
 * pela taxa do contrato — desconta os juros que ainda não venceram. Não é um
 * percentual fixo (10%/20%); quanto mais parcelas e maior a taxa, maior o desconto.
 */
export type PayoffSimulation = {
  asOf: Ymd;
  assumedPaidCount: number;
  assumedPaidCents: number;
  remainingCount: number;
  quotes: PayoffQuote[];
};

/**
 * Simula quitar numa data: parcelas com vencimento até esse dia entram como já
 * pagas (não vão no boleto). As que vencem depois recebem o desconto CDC.
 * Ex.: em 27/02, depois do dia 18, nov/dez/jan/fev já saíram; restam mar–jul.
 */
export function simulatePayoff(
  open: { dueDate: Ymd; amountCents: number; principalCents: number }[],
  monthlyRate: number,
  asOf: Ymd
): PayoffSimulation {
  const assumedPaid = open.filter((row) => row.dueDate <= asOf);
  const remaining = open.filter((row) => row.dueDate > asOf);
  return {
    asOf,
    assumedPaidCount: assumedPaid.length,
    assumedPaidCents: assumedPaid.reduce((sum, row) => sum + row.amountCents, 0),
    remainingCount: remaining.length,
    quotes: remaining.length > 0 ? payoffQuotes(remaining, monthlyRate, asOf) : [],
  };
}

export function payoffQuotes(
  open: { dueDate: Ymd; amountCents: number; principalCents: number }[],
  monthlyRate: number,
  asOf: Ymd
): PayoffQuote[] {
  const cdc = payoffToday(open, monthlyRate, asOf);
  const principalCents = open.reduce((sum, row) => sum + row.principalCents, 0);
  const nominalCents = cdc.nominalCents;
  const make = (key: PayoffQuoteKey, label: string, hint: string, payoffCents: number): PayoffQuote => ({
    key,
    label,
    hint,
    payoffCents,
    savingsCents: nominalCents - payoffCents,
    principalCents,
    nominalCents,
  });
  return [
    make(
      "cdc",
      "Padrão dos bancos",
      "Ao juntar as parcelas, o banco desconta os juros futuros pela taxa do contrato (CDC art. 52 §2º). Peça o boleto oficial: o valor do banco manda.",
      cdc.payoffCents
    ),
    make(
      "nominal",
      "Sem desconto",
      "Soma das parcelas que faltam, se você pagasse todas cheias — o que o banco não pode exigir na quitação antecipada.",
      nominalCents
    ),
  ];
}
