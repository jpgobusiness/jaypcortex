import type { Metadata } from "next";
import FinanceOverview from "@/components/finance/FinanceOverview";

export const metadata: Metadata = { title: "Finanças · Visão geral" };

export default function Page() {
  return <FinanceOverview />;
}
