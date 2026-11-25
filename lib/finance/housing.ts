// Aluguel e condomínio: despesa fixa com valor próprio em cada mês.
import { addMonthsToKey, monthOf, type MonthKey, type Ymd } from "./dates";
import { occurrences, RECURRENCE_HORIZON_MONTHS } from "./recurrence";

export const HOUSING_SYSTEMS = ["aluguel", "condominio"] as const;
export type HousingSystem = (typeof HOUSING_SYSTEMS)[number];

export const HOUSING_LABELS: Record<HousingSystem, string> = {
  aluguel: "Aluguel",
  condominio: "Condomínio",
};

export function isHousingSystem(value: string | null | undefined): value is HousingSystem {
  return value === "aluguel" || value === "condominio";
}

function foldedName(description: string) {
  return description.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export function isHousingDescription(description: string): boolean {
  const name = foldedName(description);
  return /(^|[^a-z])aluguel([^a-z]|$)/.test(name) || /(^|[^a-z])condominio([^a-z]|$)/.test(name);
}

export function housingSystemOf(categorySystem: string | null | undefined, description: string): HousingSystem | null {
  if (categorySystem === "condominio" || /(^|[^a-z])condominio([^a-z]|$)/.test(foldedName(description))) {
    return "condominio";
  }
  if (isHousingSystem(categorySystem) || isHousingDescription(description)) return "aluguel";
  return null;
}

export type HousingMonth = {
  key: MonthKey;
  date: Ymd;
  amountCents: number;
};

export function housingHorizon(today: Ymd): MonthKey {
  return addMonthsToKey(monthOf(today), RECURRENCE_HORIZON_MONTHS);
}

/** Meses desde o início até o horizonte, com o valor de cada um (ou o previsto). */
export function housingMonths(input: {
  startDate: Ymd;
  dayOfMonth: number;
  untilKey: MonthKey;
  forecastCents: number;
  amounts?: Map<string, number> | Record<string, number>;
}): HousingMonth[] {
  const list = occurrences(
    { startDate: input.startDate, endDate: null, intervalMonths: 1, dayOfMonth: input.dayOfMonth },
    null,
    input.untilKey
  );
  const lookup = (key: string) => {
    if (!input.amounts) return input.forecastCents;
    if (input.amounts instanceof Map) return input.amounts.get(key) ?? input.forecastCents;
    return input.amounts[key] ?? input.forecastCents;
  };
  return list.map((item) => ({ key: item.key, date: item.date, amountCents: lookup(item.key) }));
}

/** O valor previsto vale deste mês em diante; o passado não muda. */
export function applyForecast(months: HousingMonth[], fromKey: MonthKey, forecastCents: number): HousingMonth[] {
  return months.map((item) => (item.key >= fromKey ? { ...item, amountCents: forecastCents } : item));
}
