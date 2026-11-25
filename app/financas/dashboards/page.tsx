import type { Metadata } from "next";
import DashboardsView from "@/components/finance/DashboardsView";

export const metadata: Metadata = { title: "Finanças · Dashboards" };

export default function Page() {
  return <DashboardsView />;
}
