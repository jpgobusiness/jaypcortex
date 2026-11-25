import type { Metadata } from "next";
import LoansView from "@/components/finance/LoansView";

export const metadata: Metadata = { title: "Finanças · Empréstimos" };

export default function Page() {
  return <LoansView />;
}
