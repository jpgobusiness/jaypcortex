import type { Metadata } from "next";
import AccountsView from "@/components/finance/AccountsView";

export const metadata: Metadata = { title: "Finanças · Contas e cartões" };

export default function Page() {
  return <AccountsView />;
}
