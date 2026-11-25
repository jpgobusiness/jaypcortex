import { Suspense } from "react";
import type { Metadata } from "next";
import ExpensesView from "@/components/finance/ExpensesView";

export const metadata: Metadata = { title: "Finanças · Despesas" };

export default function Page() {
  return (
    <Suspense fallback={<p className="py-10 text-center text-sm text-[var(--muted)]">Carregando despesas...</p>}>
      <ExpensesView />
    </Suspense>
  );
}
