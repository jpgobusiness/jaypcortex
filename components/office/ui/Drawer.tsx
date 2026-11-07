"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Painel lateral sobre o escritório (chat do Cortex, base de conhecimento). */
export default function Drawer({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      className={`animate-slide-in-right absolute inset-y-3 right-3 z-50 flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.18)] ${wide ? "w-[min(560px,calc(100%-1.5rem))]" : "w-[min(380px,calc(100%-1.5rem))]"}`}
      aria-label={title}
    >
      <header className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3.5">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          {subtitle && <div className="mt-0.5 text-xs text-[var(--muted)]">{subtitle}</div>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-black/[0.05] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      {footer && <footer className="border-t border-[var(--border)] px-4 py-3">{footer}</footer>}
    </aside>
  );
}
