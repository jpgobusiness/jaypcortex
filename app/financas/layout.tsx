import FinanceShell from "@/components/finance/FinanceShell";

export default function FinancasLayout({ children }: { children: React.ReactNode }) {
  return <FinanceShell>{children}</FinanceShell>;
}
