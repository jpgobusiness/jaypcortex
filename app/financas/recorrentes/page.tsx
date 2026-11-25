import type { Metadata } from "next";
import RecurrencesView from "@/components/finance/RecurrencesView";

export const metadata: Metadata = { title: "Finanças · Recorrentes" };

export default function Page() {
  return <RecurrencesView />;
}
