import { Suspense } from "react";
import type { Metadata } from "next";
import TransactionsView from "@/components/finance/TransactionsView";

export const metadata: Metadata = { title: "Finanças · Lançamentos" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TransactionsView />
    </Suspense>
  );
}
