-- Marcado como pago na aba Despesas, sem debitar o saldo (paidAt).
ALTER TABLE "FinanceTransaction" ADD COLUMN "clearedAt" DATE;

-- Contas que já tinham paidAt aparecem como Pago na tabela.
UPDATE "FinanceTransaction"
SET "clearedAt" = "paidAt"
WHERE "kind" = 'expense' AND "paidAt" IS NOT NULL AND "clearedAt" IS NULL;
