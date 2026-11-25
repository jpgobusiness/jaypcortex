-- Saldo das contas: "a receber" e "a pagar" passam a contar só até o fim do mês
-- atual (inclui os atrasados). O total de tudo que está agendado (recorrências
-- dos próximos 12 meses, parcelas) fica nas colunas novas *_total.
CREATE OR REPLACE VIEW public.v_fin_contas WITH (security_invoker = true) AS
SELECT
  a.id AS conta_id,
  a.name AS conta,
  a.type AS tipo,
  a.institution AS instituicao,
  a."includeInTotals" AS soma_no_total,
  a.archived AS arquivada,
  round(a."initialBalanceCents" / 100.0, 2) AS saldo_inicial,
  a."initialBalanceDate" AS data_saldo_inicial,
  round((a."initialBalanceCents" + COALESCE(m.realizado, 0)) / 100.0, 2) AS saldo_atual,
  round(COALESCE(m.a_receber, 0) / 100.0, 2) AS a_receber,
  round(COALESCE(m.a_pagar, 0) / 100.0, 2) AS a_pagar,
  round((a."initialBalanceCents" + COALESCE(m.realizado, 0) + COALESCE(m.a_receber, 0) - COALESCE(m.a_pagar, 0)) / 100.0, 2)
    AS saldo_previsto,
  round(COALESCE(m.a_receber_total, 0) / 100.0, 2) AS a_receber_total,
  round(COALESCE(m.a_pagar_total, 0) / 100.0, 2) AS a_pagar_total
FROM "FinanceAccount" a
LEFT JOIN LATERAL (
  SELECT
    SUM(x.delta) FILTER (WHERE x.pago_em IS NOT NULL AND x.pago_em >= a."initialBalanceDate") AS realizado,
    SUM(x.delta) FILTER (WHERE x.pago_em IS NULL AND x.delta > 0 AND x.data <= f.fim_mes) AS a_receber,
    SUM(-x.delta) FILTER (WHERE x.pago_em IS NULL AND x.delta < 0 AND x.data <= f.fim_mes) AS a_pagar,
    SUM(x.delta) FILTER (WHERE x.pago_em IS NULL AND x.delta > 0) AS a_receber_total,
    SUM(-x.delta) FILTER (WHERE x.pago_em IS NULL AND x.delta < 0) AS a_pagar_total
  FROM (
    SELECT
      CASE WHEN t.kind IN ('income', 'loan_disbursement', 'adjustment') THEN t."amountCents" ELSE -t."amountCents" END AS delta,
      t."paidAt" AS pago_em,
      t.date AS data
    FROM "FinanceTransaction" t
    WHERE t."accountId" = a.id
    UNION ALL
    SELECT t."amountCents", t."paidAt", t.date
    FROM "FinanceTransaction" t
    WHERE t."toAccountId" = a.id AND t.kind = 'transfer'
  ) x
  CROSS JOIN (
    SELECT (date_trunc('month', public.fin_hoje()::timestamp) + interval '1 month - 1 day')::date AS fim_mes
  ) f
) m ON true;
