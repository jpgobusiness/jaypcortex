"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Tags } from "lucide-react";
import FinanceProvider, { useFinance } from "@/components/finance/FinanceProvider";
import { Button } from "@/components/ui/form";

const TABS = [
  { href: "/financas", label: "Visão geral" },
  { href: "/financas/despesas", label: "Despesas" },
  { href: "/financas/contas-a-pagar", label: "Contas a pagar" },
  { href: "/financas/lancamentos", label: "Lançamentos" },
  { href: "/financas/contas", label: "Contas e cartões" },
  { href: "/financas/recorrentes", label: "Recorrentes" },
  { href: "/financas/emprestimos", label: "Empréstimos" },
  { href: "/financas/dashboards", label: "Dashboards" },
];

function Header() {
  const pathname = usePathname();
  const { openEntry, openCategories, error, refresh } = useFinance();
  // Prefixo com "/" para "/financas/contas" não acender em "/financas/contas-a-pagar".
  const within = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const active = (href: string) => (href === "/financas" ? pathname === href : within(href) || (href === "/financas/contas" && within("/financas/cartoes")));
  return (
    <div className="sticky top-0 z-30 shrink-0 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-6">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-[var(--foreground)] sm:text-xl">Finanças</h1>
          <p className="hidden text-sm text-[var(--muted)] sm:block">Contas, cartões, lançamentos e para onde vai o seu dinheiro.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" onClick={openCategories} aria-label="Categorias" title="Categorias">
            <Tags className="h-4 w-4" /> <span className="hidden lg:inline">Categorias</span>
          </Button>
          <Button onClick={() => openEntry()}>
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Novo lançamento</span>
            <span className="sm:hidden">Lançar</span>
          </Button>
        </div>
      </div>
      <nav className="scroll-x-fade mt-3 flex gap-1 px-3 sm:px-5" aria-label="Seções de finanças">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative shrink-0 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active(tab.href) ? "text-[var(--brand-600)]" : "text-[var(--muted)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
            {active(tab.href) && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[var(--brand)]" />}
          </Link>
        ))}
      </nav>
      {error && (
        <div className="mx-4 mb-3 flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-6">
          {error}
          <button type="button" onClick={() => void refresh()} className="font-medium underline">
            Tentar de novo
          </button>
        </div>
      )}
    </div>
  );
}

/** Moldura do módulo: cabeçalho com abas, botão de lançar e os modais compartilhados. */
export default function FinanceShell({ children }: { children: React.ReactNode }) {
  return (
    <FinanceProvider>
      <div className="flex min-h-full flex-col">
        <Header />
        <div className="flex-1 p-4 sm:p-6">{children}</div>
      </div>
    </FinanceProvider>
  );
}
