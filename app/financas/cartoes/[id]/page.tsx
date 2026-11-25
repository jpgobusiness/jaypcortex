import { Suspense } from "react";
import type { Metadata } from "next";
import CardView from "@/components/finance/CardView";

export const metadata: Metadata = { title: "Finanças · Cartão" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <CardView id={id} />
    </Suspense>
  );
}
