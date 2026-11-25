"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/form";
import { apiGet } from "@/lib/fetcher";
import { addMonthsToKey, longMonth, type MonthKey } from "@/lib/finance/dates";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@/lib/finance/invoice";
import { centsToInput, formatBRL, toCents } from "@/lib/finance/money";
import type { TransactionStatus } from "@/lib/finance/types";

/** Busca na API e refaz quando a URL ou a `version` mudam. Mantém o dado anterior enquanto carrega. */
export function useApi<T>(url: string | null, version = 0) {
  const key = url ? `${url}#${version}` : null;
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!url || !key) return;
    let alive = true;
    apiGet<T>(url).then(
      (data) => {
        if (alive) setState({ key, data, error: null });
      },
      (error: unknown) => {
        if (alive) setState({ key, data: null, error: error instanceof Error ? error.message : "Erro ao carregar" });
      }
    );
    return () => {
      alive = false;
    };
  }, [url, key]);
  return {
    data: state?.data ?? null,
    error: state?.key === key ? (state?.error ?? null) : null,
    loading: key !== null && state?.key !== key,
  };
}

/** Campo de valor em reais. Guarda centavos; aceita "1.234,56". */
export function MoneyInput({
  value,
  onChange,
  allowNegative = false,
  id,
  autoFocus,
  placeholder = "0,00",
  large = false,
}: {
  value: number | null;
  onChange: (cents: number | null) => void;
  allowNegative?: boolean;
  id?: string;
  autoFocus?: boolean;
  placeholder?: string;
  large?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : centsToInput(value));
  return (
    <div className="relative">
      <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-medium text-[var(--muted)] ${large ? "text-base" : "text-sm"}`}>
        R$
      </span>
      <Input
        id={id}
        autoFocus={autoFocus}
        inputMode="decimal"
        placeholder={placeholder}
        value={shown}
        onFocus={() => setDraft(shown)}
        onBlur={() => setDraft(null)}
        onChange={(event) => {
          const raw = event.target.value.replace(allowNegative ? /[^\d,.-]/g : /[^\d,.]/g, "");
          setDraft(raw);
          const cents = toCents(raw);
          onChange(cents);
        }}
        className={`pl-10 tabular-nums ${large ? "text-xl! font-semibold md:py-2.5!" : ""}`}
      />
    </div>
  );
}

export function Field({ label, hint, htmlFor, children, className = "" }: { label: string; hint?: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-[var(--muted)]">{hint}</p>}
    </div>
  );
}

export type SegmentOption<T extends string> = { value: T; label: string; icon?: ReactNode; activeClass?: string };

export function Segmented<T extends string>({ options, value, onChange, size = "md" }: { options: SegmentOption<T>[]; value: T; onChange: (value: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="flex w-full gap-1 rounded-xl bg-black/[0.04] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg font-medium transition-all ${size === "sm" ? "h-8 px-2 text-xs" : "h-9 px-3 text-sm"} ${
              active ? `bg-white shadow-sm ${option.activeClass ?? "text-[var(--foreground)]"}` : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Panel({ title, subtitle, action, children, className = "", bodyClass = "p-5" }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            {title && <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, tone = "default", icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "default" | "income" | "expense" | "warning" | "brand"; icon?: ReactNode }) {
  const colors = {
    default: "text-[var(--foreground)]",
    income: "text-emerald-600",
    expense: "text-rose-600",
    warning: "text-amber-600",
    brand: "text-[var(--brand-600)]",
  };
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--muted)]">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <p className={`mt-1.5 truncate text-xl font-semibold tabular-nums tracking-tight ${colors[tone]}`}>{value}</p>
      {hint && <div className="mt-0.5 truncate text-xs text-[var(--muted)]">{hint}</div>}
    </div>
  );
}

export function Money({ cents, kind, className = "" }: { cents: number; kind?: "income" | "expense" | "neutral"; className?: string }) {
  const color = kind === "income" ? "text-emerald-600" : kind === "expense" ? "text-rose-600" : "";
  const sign = kind === "income" ? "+ " : kind === "expense" ? "− " : "";
  return <span className={`tabular-nums ${color} ${className}`}>{sign}{formatBRL(Math.abs(cents))}</span>;
}

export function Progress({ value, max, color = "var(--brand)", warnAt = 0.8 }: { value: number; max: number; color?: string; warnAt?: number }) {
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const fill = ratio >= 1 ? "#ef4444" : ratio >= warnAt ? "#f59e0b" : color;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${ratio * 100}%`, backgroundColor: fill }} />
    </div>
  );
}

const STATUS_STYLE: Record<TransactionStatus, { label: string; className: string }> = {
  paid: { label: "Pago", className: "bg-emerald-50 text-emerald-700" },
  pending: { label: "Pendente", className: "bg-amber-50 text-amber-700" },
  overdue: { label: "Atrasado", className: "bg-rose-50 text-rose-700" },
  card: { label: "No cartão", className: "bg-slate-100 text-slate-600" },
};

export function StatusPill({ status, income = false }: { status: TransactionStatus; income?: boolean }) {
  const style = STATUS_STYLE[status];
  const label = income && status === "paid" ? "Recebido" : income && status === "pending" ? "A receber" : style.label;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.className}`}>{label}</span>;
}

const INVOICE_STYLE: Record<InvoiceStatus, string> = {
  open: "bg-sky-50 text-sky-700",
  future: "bg-slate-100 text-slate-600",
  closed: "bg-amber-50 text-amber-700",
  overdue: "bg-rose-50 text-rose-700",
  paid: "bg-emerald-50 text-emerald-700",
};

export function InvoicePill({ status }: { status: InvoiceStatus }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${INVOICE_STYLE[status]}`}>{INVOICE_STATUS_LABELS[status]}</span>;
}

export function MonthSwitcher({ month, onChange }: { month: MonthKey; onChange: (month: MonthKey) => void }) {
  return (
    <div className="flex items-center rounded-xl border border-[var(--border)] bg-white">
      <button type="button" onClick={() => onChange(addMonthsToKey(month, -1))} className="inline-flex h-10 w-10 items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]" aria-label="Mês anterior">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-36 flex-1 text-center text-sm font-semibold first-letter:uppercase">{longMonth(month)}</span>
      <button type="button" onClick={() => onChange(addMonthsToKey(month, 1))} className="inline-flex h-10 w-10 items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]" aria-label="Próximo mês">
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--border)] bg-white/60 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand)]/10 text-[var(--brand-600)]">{icon}</span>
      <h3 className="mt-3 text-sm font-semibold text-[var(--foreground)]">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-[var(--muted)]">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ColorSwatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          aria-label={`Cor ${color}`}
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full transition-transform hover:scale-110 ${value === color ? "ring-2 ring-offset-2 ring-[var(--brand)]" : ""}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--brand)]" : "bg-black/15"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${checked ? "left-[18px]" : "left-0.5"}`} />
      </button>
      <span className="min-w-0">
        <span className="block text-sm text-[var(--foreground)]">{label}</span>
        {hint && <span className="block text-xs text-[var(--muted)]">{hint}</span>}
      </span>
    </label>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>;
}
