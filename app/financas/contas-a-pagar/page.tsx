import { Suspense } from "react";
import type { Metadata } from "next";
import BillsView from "@/components/finance/BillsView";

export const metadata: Metadata = { title: "Finanças · Contas a pagar" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BillsView />
    </Suspense>
  );
}
