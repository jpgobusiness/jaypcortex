import type { Metadata } from "next";
import LoanDetailView from "@/components/finance/LoanDetailView";

export const metadata: Metadata = { title: "Finanças · Empréstimo" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoanDetailView id={id} />;
}
