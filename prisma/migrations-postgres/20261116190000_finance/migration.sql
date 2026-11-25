-- Finanças pessoais (/financas): contas, cartões e faturas, categorias,
-- recorrências, empréstimos, lançamentos e dashboards.
-- Só cria objetos novos: nenhuma tabela existente é alterada.
-- Valores em centavos (integer). Datas civis em DATE.

-- CreateTable
CREATE TABLE "FinanceAccount" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'checking',
    "institution" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#7b68ee',
    "initialBalanceCents" INTEGER NOT NULL DEFAULT 0,
    "initialBalanceDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "includeInTotals" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL DEFAULT 'other',
    "last4" TEXT,
    "color" TEXT NOT NULL DEFAULT '#15171c',
    "limitCents" INTEGER NOT NULL DEFAULT 0,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "paymentAccountId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardInvoice" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "closingDate" DATE,
    "dueDate" DATE,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CardInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'tag',
    "color" TEXT NOT NULL DEFAULT '#94a3b8',
    "parentId" TEXT,
    "essential" BOOLEAN NOT NULL DEFAULT false,
    "system" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceRecurrence" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'fixed',
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "cardId" TEXT,
    "intervalMonths" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "generatedUntil" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceRecurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lender" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'personal',
    "principalCents" INTEGER NOT NULL,
    "feesCents" INTEGER NOT NULL DEFAULT 0,
    "monthlyRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amortization" TEXT NOT NULL DEFAULT 'price',
    "installmentCount" INTEGER NOT NULL,
    "installmentCents" INTEGER,
    "firstDueDate" DATE NOT NULL,
    "contractDate" DATE,
    "paidBeforeCount" INTEGER NOT NULL DEFAULT 0,
    "accountId" TEXT,
    "categoryId" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceTransaction" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "paidAt" DATE,
    "accountId" TEXT,
    "toAccountId" TEXT,
    "cardId" TEXT,
    "invoiceMonth" TEXT,
    "categoryId" TEXT,
    "recurrenceId" TEXT,
    "recurrenceKey" TEXT,
    "installmentGroupId" TEXT,
    "installmentNumber" INTEGER,
    "installmentCount" INTEGER,
    "loanId" TEXT,
    "interestCents" INTEGER,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceDashboard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinanceDashboard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CardInvoice_cardId_month_key" ON "CardInvoice"("cardId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceCategory_system_key" ON "FinanceCategory"("system");

-- CreateIndex
CREATE INDEX "FinanceCategory_kind_order_idx" ON "FinanceCategory"("kind", "order");

-- CreateIndex
CREATE INDEX "FinanceTransaction_date_idx" ON "FinanceTransaction"("date");

-- CreateIndex
CREATE INDEX "FinanceTransaction_kind_date_idx" ON "FinanceTransaction"("kind", "date");

-- CreateIndex
CREATE INDEX "FinanceTransaction_accountId_date_idx" ON "FinanceTransaction"("accountId", "date");

-- CreateIndex
CREATE INDEX "FinanceTransaction_toAccountId_idx" ON "FinanceTransaction"("toAccountId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_cardId_invoiceMonth_idx" ON "FinanceTransaction"("cardId", "invoiceMonth");

-- CreateIndex
CREATE INDEX "FinanceTransaction_categoryId_idx" ON "FinanceTransaction"("categoryId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_loanId_idx" ON "FinanceTransaction"("loanId");

-- CreateIndex
CREATE INDEX "FinanceTransaction_installmentGroupId_idx" ON "FinanceTransaction"("installmentGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTransaction_recurrenceId_recurrenceKey_key" ON "FinanceTransaction"("recurrenceId", "recurrenceKey");

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardInvoice" ADD CONSTRAINT "CardInvoice_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceCategory" ADD CONSTRAINT "FinanceCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FinanceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrence" ADD CONSTRAINT "FinanceRecurrence_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrence" ADD CONSTRAINT "FinanceRecurrence_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceRecurrence" ADD CONSTRAINT "FinanceRecurrence_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "FinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinanceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_recurrenceId_fkey" FOREIGN KEY ("recurrenceId") REFERENCES "FinanceRecurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTransaction" ADD CONSTRAINT "FinanceTransaction_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "Loan"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Regras de integridade (o Prisma não gera CHECK; a API valida o mesmo).
-- ---------------------------------------------------------------------------
ALTER TABLE "FinanceAccount"
  ADD CONSTRAINT "FinanceAccount_type_check"
    CHECK ("type" IN ('checking', 'savings', 'cash', 'investment', 'benefit', 'other'));

ALTER TABLE "CreditCard"
  ADD CONSTRAINT "CreditCard_brand_check"
    CHECK ("brand" IN ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other')),
  ADD CONSTRAINT "CreditCard_days_check"
    CHECK ("closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31),
  ADD CONSTRAINT "CreditCard_limit_check" CHECK ("limitCents" >= 0),
  ADD CONSTRAINT "CreditCard_last4_check" CHECK ("last4" IS NULL OR "last4" ~ '^[0-9]{4}$');

ALTER TABLE "CardInvoice"
  ADD CONSTRAINT "CardInvoice_month_check" CHECK ("month" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');

ALTER TABLE "FinanceCategory"
  ADD CONSTRAINT "FinanceCategory_kind_check" CHECK ("kind" IN ('income', 'expense'));

ALTER TABLE "FinanceRecurrence"
  ADD CONSTRAINT "FinanceRecurrence_kind_check" CHECK ("kind" IN ('income', 'expense')),
  ADD CONSTRAINT "FinanceRecurrence_type_check" CHECK ("type" IN ('fixed', 'variable')),
  ADD CONSTRAINT "FinanceRecurrence_amount_check" CHECK ("amountCents" > 0),
  ADD CONSTRAINT "FinanceRecurrence_interval_check" CHECK ("intervalMonths" IN (1, 2, 3, 6, 12)),
  ADD CONSTRAINT "FinanceRecurrence_day_check" CHECK ("dayOfMonth" BETWEEN 1 AND 31),
  ADD CONSTRAINT "FinanceRecurrence_source_check"
    CHECK (NOT ("accountId" IS NOT NULL AND "cardId" IS NOT NULL) AND ("cardId" IS NULL OR "kind" = 'expense'));

ALTER TABLE "Loan"
  ADD CONSTRAINT "Loan_type_check"
    CHECK ("type" IN ('personal', 'payroll', 'vehicle', 'mortgage', 'person', 'other')),
  ADD CONSTRAINT "Loan_amortization_check" CHECK ("amortization" IN ('price', 'sac')),
  ADD CONSTRAINT "Loan_values_check"
    CHECK ("principalCents" > 0 AND "feesCents" >= 0 AND "monthlyRate" >= 0 AND "monthlyRate" < 100),
  ADD CONSTRAINT "Loan_installments_check"
    CHECK ("installmentCount" BETWEEN 1 AND 600 AND "paidBeforeCount" >= 0 AND "paidBeforeCount" < "installmentCount");

ALTER TABLE "FinanceTransaction"
  ADD CONSTRAINT "FinanceTransaction_kind_check"
    CHECK ("kind" IN ('income', 'expense', 'transfer', 'card_payment', 'adjustment', 'loan_disbursement')),
  ADD CONSTRAINT "FinanceTransaction_amount_check"
    CHECK (("kind" = 'adjustment' AND "amountCents" <> 0) OR ("kind" <> 'adjustment' AND "amountCents" > 0)),
  ADD CONSTRAINT "FinanceTransaction_invoice_month_check"
    CHECK ("invoiceMonth" IS NULL OR "invoiceMonth" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  -- Receita entra numa conta; despesa sai de uma conta OU de um cartão.
  ADD CONSTRAINT "FinanceTransaction_source_check" CHECK (
    CASE "kind"
      WHEN 'income' THEN "accountId" IS NOT NULL AND "cardId" IS NULL
      WHEN 'expense' THEN ("accountId" IS NOT NULL) <> ("cardId" IS NOT NULL)
        AND ("cardId" IS NULL OR "invoiceMonth" IS NOT NULL)
      WHEN 'transfer' THEN "accountId" IS NOT NULL AND "toAccountId" IS NOT NULL AND "accountId" <> "toAccountId"
      WHEN 'card_payment' THEN "accountId" IS NOT NULL AND "cardId" IS NOT NULL AND "invoiceMonth" IS NOT NULL
      WHEN 'adjustment' THEN "accountId" IS NOT NULL
      WHEN 'loan_disbursement' THEN "accountId" IS NOT NULL AND "loanId" IS NOT NULL
      ELSE false
    END
  );

-- ---------------------------------------------------------------------------
-- Acesso: igual às demais tabelas de negócio (authenticated + perfil ativo).
-- O servidor (Prisma / service role) ignora RLS. anon: nada.
-- ---------------------------------------------------------------------------
GRANT ALL ON TABLE "FinanceAccount", "CreditCard", "CardInvoice", "FinanceCategory",
  "FinanceRecurrence", "Loan", "FinanceTransaction", "FinanceDashboard"
  TO service_role, authenticated;
REVOKE ALL ON TABLE "FinanceAccount", "CreditCard", "CardInvoice", "FinanceCategory",
  "FinanceRecurrence", "Loan", "FinanceTransaction", "FinanceDashboard"
  FROM anon;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['FinanceAccount', 'CreditCard', 'CardInvoice', 'FinanceCategory',
    'FinanceRecurrence', 'Loan', 'FinanceTransaction', 'FinanceDashboard']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS authenticated_active_all ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY authenticated_active_all ON public.%I
       FOR ALL TO authenticated
       USING (public.is_active_user())
       WITH CHECK (public.is_active_user())',
      t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Categorias padrão (podem ser renomeadas ou arquivadas; `system` não muda).
-- ---------------------------------------------------------------------------
INSERT INTO "FinanceCategory" ("id", "name", "kind", "icon", "color", "essential", "system", "order", "updatedAt") VALUES
  ('fincat-salario',         'Salário',              'income', 'briefcase',     '#16a34a', false, 'salario',         1, now()),
  ('fincat-hora-extra',      'Hora extra',           'income', 'timer',         '#0ea5e9', false, 'hora-extra',      2, now()),
  ('fincat-reembolso',       'Reembolso',            'income', 'receipt',       '#14b8a6', false, 'reembolso',       3, now()),
  ('fincat-bonus-quarter',   'Bônus quarter',        'income', 'trophy',        '#f59e0b', false, 'bonus-quarter',   4, now()),
  ('fincat-bonus-anual',     'Bônus anual',          'income', 'award',         '#eab308', false, 'bonus-anual',     5, now()),
  ('fincat-decimo-terceiro', '13º salário',          'income', 'gift',          '#22c55e', false, 'decimo-terceiro', 6, now()),
  ('fincat-ferias',          'Férias',               'income', 'sun',           '#f97316', false, 'ferias',          7, now()),
  ('fincat-plr',             'PLR',                  'income', 'coins',         '#84cc16', false, 'plr',             8, now()),
  ('fincat-rendimentos',     'Rendimentos',          'income', 'trending-up',   '#6366f1', false, 'rendimentos',     9, now()),
  ('fincat-freelance',       'Freelance e serviços', 'income', 'laptop',        '#8b5cf6', false, 'freelance',      10, now()),
  ('fincat-vendas',          'Vendas',               'income', 'tag',           '#ec4899', false, 'vendas',         11, now()),
  ('fincat-outras-receitas', 'Outras receitas',      'income', 'circle-plus',   '#64748b', false, 'outras-receitas',12, now()),
  ('fincat-moradia',         'Moradia',              'expense', 'home',           '#7b68ee', true,  'moradia',          1, now()),
  ('fincat-contas-casa',     'Contas da casa',       'expense', 'zap',            '#0ea5e9', true,  'contas-casa',      2, now()),
  ('fincat-mercado',         'Mercado',              'expense', 'shopping-cart',  '#16a34a', true,  'mercado',          3, now()),
  ('fincat-restaurantes',    'Restaurantes e delivery','expense','utensils',      '#f97316', false, 'restaurantes',     4, now()),
  ('fincat-transporte',      'Transporte',           'expense', 'car',            '#3b82f6', true,  'transporte',       5, now()),
  ('fincat-saude',           'Saúde',                'expense', 'heart-pulse',    '#ef4444', true,  'saude',            6, now()),
  ('fincat-educacao',        'Educação',             'expense', 'graduation-cap', '#8b5cf6', true,  'educacao',         7, now()),
  ('fincat-assinaturas',     'Assinaturas e apps',   'expense', 'repeat',         '#a855f7', false, 'assinaturas',      8, now()),
  ('fincat-lazer',           'Lazer',                'expense', 'party-popper',   '#ec4899', false, 'lazer',            9, now()),
  ('fincat-compras',         'Compras',              'expense', 'shopping-bag',   '#f43f5e', false, 'compras',         10, now()),
  ('fincat-cuidados',        'Cuidados pessoais',    'expense', 'sparkles',       '#d946ef', false, 'cuidados',        11, now()),
  ('fincat-pets',            'Pets',                 'expense', 'paw-print',      '#a16207', false, 'pets',            12, now()),
  ('fincat-viagens',         'Viagens',              'expense', 'plane',          '#06b6d4', false, 'viagens',         13, now()),
  ('fincat-impostos',        'Impostos e taxas',     'expense', 'landmark',       '#64748b', true,  'impostos',        14, now()),
  ('fincat-seguros',         'Seguros',              'expense', 'shield',         '#0f766e', true,  'seguros',         15, now()),
  ('fincat-emprestimos',     'Empréstimos e financiamentos','expense','banknote', '#b91c1c', true,  'emprestimos',     16, now()),
  ('fincat-encargos',        'Juros e tarifas',      'expense', 'percent',        '#dc2626', false, 'encargos',        17, now()),
  ('fincat-presentes',       'Presentes e doações',  'expense', 'gift',           '#e11d48', false, 'presentes',       18, now()),
  ('fincat-outras-despesas', 'Outras despesas',      'expense', 'circle-dashed',  '#94a3b8', false, 'outras-despesas', 19, now())
ON CONFLICT ("system") DO NOTHING;

-- ---------------------------------------------------------------------------
-- Camada para dashboards (Supabase, Metabase, Looker Studio, Power BI...).
-- Views com security_invoker: respeitam a RLS de quem consulta.
-- Regras de fatura iguais às de lib/finance/invoice.ts.
-- ---------------------------------------------------------------------------

-- "Hoje" no fuso da plataforma.
CREATE OR REPLACE FUNCTION public.fin_hoje()
RETURNS date LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date
$$;

-- Dia `dia` do mês "YYYY-MM", limitado ao último dia (31 em fevereiro → 28/29).
CREATE OR REPLACE FUNCTION public.fin_dia_no_mes(mes text, dia int)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT make_date(
    split_part(mes, '-', 1)::int,
    split_part(mes, '-', 2)::int,
    LEAST(dia, EXTRACT(DAY FROM (to_date(mes || '-01', 'YYYY-MM-DD')::timestamp + interval '1 month - 1 day'))::int)
  )
$$;

-- Fatura ("YYYY-MM" do vencimento) em que entra uma compra do dia `d`.
-- Compras a partir do dia do fechamento (melhor dia de compra) vão para a seguinte.
CREATE OR REPLACE FUNCTION public.fin_fatura_do_dia(d date, fechamento int, vencimento int)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  WITH c AS (
    SELECT CASE
      WHEN d >= public.fin_dia_no_mes(to_char(d::timestamp, 'YYYY-MM'), fechamento)
        THEN date_trunc('month', d::timestamp) + interval '1 month'
      ELSE date_trunc('month', d::timestamp)
    END AS mes_fechamento
  )
  SELECT to_char(
    CASE WHEN vencimento > fechamento THEN mes_fechamento ELSE mes_fechamento + interval '1 month' END,
    'YYYY-MM'
  ) FROM c
$$;

-- Vencimento em sábado/domingo passa para segunda (Lei 7.089/1983; feriado: ajuste manual na fatura).
CREATE OR REPLACE FUNCTION public.fin_proximo_dia_util(d date)
RETURNS date LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE EXTRACT(ISODOW FROM d::timestamp)::int WHEN 6 THEN d + 2 WHEN 7 THEN d + 1 ELSE d END
$$;

REVOKE ALL ON FUNCTION public.fin_hoje(), public.fin_dia_no_mes(text, int),
  public.fin_fatura_do_dia(date, int, int), public.fin_proximo_dia_util(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fin_hoje(), public.fin_dia_no_mes(text, int),
  public.fin_fatura_do_dia(date, int, int), public.fin_proximo_dia_util(date)
  TO authenticated, service_role;

-- Tabela-fato: um lançamento por linha, com nomes e o mês de competência e de caixa.
CREATE OR REPLACE VIEW public.v_fin_lancamentos WITH (security_invoker = true) AS
SELECT
  t.id,
  t.kind AS tipo,
  CASE t.kind
    WHEN 'income' THEN 'Receita'
    WHEN 'expense' THEN 'Despesa'
    WHEN 'transfer' THEN 'Transferência'
    WHEN 'card_payment' THEN 'Pagamento de fatura'
    WHEN 'adjustment' THEN 'Ajuste de saldo'
    WHEN 'loan_disbursement' THEN 'Entrada de empréstimo'
  END AS tipo_nome,
  CASE
    WHEN t.kind = 'income' THEN CASE WHEN t."recurrenceId" IS NOT NULL THEN 'recorrente' ELSE 'pontual' END
    WHEN t.kind = 'expense' THEN CASE
      WHEN t."loanId" IS NOT NULL THEN 'emprestimo'
      WHEN t."installmentGroupId" IS NOT NULL THEN 'parcelada'
      WHEN t."recurrenceId" IS NOT NULL THEN CASE WHEN r.type = 'variable' THEN 'variavel' ELSE 'fixa' END
      ELSE 'pontual'
    END
  END AS natureza,
  CASE WHEN t."cardId" IS NOT NULL AND t.kind = 'expense' THEN 'cartao' ELSE 'conta' END AS forma_pagamento,
  t.description AS descricao,
  round(t."amountCents" / 100.0, 2) AS valor,
  -- Efeito no resultado do mês: receita soma, despesa subtrai, o resto não conta.
  round(CASE t.kind WHEN 'income' THEN t."amountCents" WHEN 'expense' THEN -t."amountCents" ELSE 0 END / 100.0, 2)
    AS valor_resultado,
  t.date AS data,
  t."paidAt" AS pago_em,
  CASE
    WHEN t."cardId" IS NOT NULL AND t.kind = 'expense' THEN 'no_cartao'
    WHEN t."paidAt" IS NOT NULL THEN 'pago'
    WHEN t.date < public.fin_hoje() THEN 'atrasado'
    ELSE 'pendente'
  END AS status,
  (t."paidAt" IS NOT NULL OR (t."cardId" IS NOT NULL AND t.date <= public.fin_hoje())) AS realizado,
  to_char(t.date, 'YYYY-MM') AS mes_competencia,
  CASE WHEN t."cardId" IS NOT NULL AND t.kind = 'expense' THEN t."invoiceMonth" ELSE to_char(t.date, 'YYYY-MM') END
    AS mes_caixa,
  c.name AS categoria,
  COALESCE(pc.name, c.name) AS categoria_grupo,
  COALESCE(c.color, '#94a3b8') AS categoria_cor,
  COALESCE(c.essential, false) AS essencial,
  a.name AS conta,
  ta.name AS conta_destino,
  cc.name AS cartao,
  CASE WHEN t."cardId" IS NOT NULL AND t.kind = 'expense' THEN cc.name ELSE a.name END AS meio_pagamento,
  t."invoiceMonth" AS fatura,
  t."installmentNumber" AS parcela,
  t."installmentCount" AS total_parcelas,
  l.name AS emprestimo,
  round(COALESCE(t."interestCents", 0) / 100.0, 2) AS juros,
  t.tags,
  t."accountId" AS conta_id,
  t."toAccountId" AS conta_destino_id,
  t."cardId" AS cartao_id,
  t."categoryId" AS categoria_id,
  t."recurrenceId" AS recorrencia_id,
  t."loanId" AS emprestimo_id,
  t."createdAt" AS criado_em
FROM "FinanceTransaction" t
LEFT JOIN "FinanceCategory" c ON c.id = t."categoryId"
LEFT JOIN "FinanceCategory" pc ON pc.id = c."parentId"
LEFT JOIN "FinanceAccount" a ON a.id = t."accountId"
LEFT JOIN "FinanceAccount" ta ON ta.id = t."toAccountId"
LEFT JOIN "CreditCard" cc ON cc.id = t."cardId"
LEFT JOIN "FinanceRecurrence" r ON r.id = t."recurrenceId"
LEFT JOIN "Loan" l ON l.id = t."loanId";

-- Receitas x despesas por mês (regime de caixa: compra no cartão conta no mês da fatura).
CREATE OR REPLACE VIEW public.v_fin_fluxo_mensal WITH (security_invoker = true) AS
SELECT
  mes_caixa AS mes,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'income'), 0) AS receitas,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense'), 0) AS despesas,
  COALESCE(SUM(valor_resultado), 0) AS resultado,
  CASE WHEN SUM(valor) FILTER (WHERE tipo = 'income') > 0
    THEN round(SUM(valor_resultado) / SUM(valor) FILTER (WHERE tipo = 'income') * 100, 1)
  END AS taxa_poupanca_pct,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'income' AND realizado), 0) AS receitas_realizadas,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND realizado), 0) AS despesas_realizadas,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND natureza = 'fixa'), 0) AS despesas_fixas,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND natureza = 'variavel'), 0) AS despesas_variaveis,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND natureza = 'pontual'), 0) AS despesas_pontuais,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND natureza = 'parcelada'), 0) AS parcelas_cartao,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND natureza = 'emprestimo'), 0) AS parcelas_emprestimo,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND forma_pagamento = 'cartao'), 0) AS gasto_no_cartao,
  COALESCE(SUM(valor) FILTER (WHERE tipo = 'expense' AND essencial), 0) AS despesas_essenciais
FROM public.v_fin_lancamentos
WHERE tipo IN ('income', 'expense')
GROUP BY mes_caixa;

-- Total por categoria e mês.
CREATE OR REPLACE VIEW public.v_fin_categorias_mes WITH (security_invoker = true) AS
SELECT
  mes_caixa AS mes,
  tipo,
  categoria_grupo,
  COALESCE(categoria, 'Sem categoria') AS categoria,
  categoria_cor,
  SUM(valor) AS total,
  COUNT(*) AS lancamentos
FROM public.v_fin_lancamentos
WHERE tipo IN ('income', 'expense')
GROUP BY mes_caixa, tipo, categoria_grupo, categoria, categoria_cor;

-- Faturas: total, pago, em aberto e status (aberta, futura, fechada, paga, vencida).
CREATE OR REPLACE VIEW public.v_fin_faturas WITH (security_invoker = true) AS
WITH mov AS (
  SELECT
    t."cardId" AS cartao_id,
    t."invoiceMonth" AS fatura,
    COALESCE(SUM(t."amountCents") FILTER (WHERE t.kind = 'expense'), 0) AS compras_c,
    COALESCE(SUM(t."amountCents") FILTER (WHERE t.kind = 'card_payment'), 0) AS pago_c,
    COUNT(*) FILTER (WHERE t.kind = 'expense') AS lancamentos
  FROM "FinanceTransaction" t
  WHERE t."cardId" IS NOT NULL AND t."invoiceMonth" IS NOT NULL
  GROUP BY t."cardId", t."invoiceMonth"
),
datas AS (
  SELECT
    m.*,
    cc.name AS cartao,
    cc."paymentAccountId",
    COALESCE(ci."closingDate", public.fin_dia_no_mes(
      CASE WHEN cc."dueDay" > cc."closingDay" THEN m.fatura
        ELSE to_char(to_date(m.fatura || '-01', 'YYYY-MM-DD') - interval '1 month', 'YYYY-MM') END,
      cc."closingDay")) AS fechamento,
    COALESCE(ci."dueDate", public.fin_proximo_dia_util(public.fin_dia_no_mes(m.fatura, cc."dueDay"))) AS vencimento,
    public.fin_fatura_do_dia(public.fin_hoje(), cc."closingDay", cc."dueDay") AS fatura_aberta
  FROM mov m
  JOIN "CreditCard" cc ON cc.id = m.cartao_id
  LEFT JOIN "CardInvoice" ci ON ci."cardId" = m.cartao_id AND ci.month = m.fatura
)
SELECT
  d.cartao_id,
  d.cartao,
  d.fatura,
  d.fechamento,
  d.vencimento,
  round(d.compras_c / 100.0, 2) AS total,
  round(d.pago_c / 100.0, 2) AS pago,
  round(GREATEST(d.compras_c - d.pago_c, 0) / 100.0, 2) AS em_aberto,
  d.lancamentos,
  CASE
    WHEN d.compras_c > 0 AND d.pago_c >= d.compras_c THEN 'paga'
    WHEN d.fatura = d.fatura_aberta THEN 'aberta'
    WHEN d.fatura > d.fatura_aberta THEN 'futura'
    WHEN public.fin_hoje() > d.vencimento THEN 'vencida'
    ELSE 'fechada'
  END AS status,
  a.name AS conta_pagamento
FROM datas d
LEFT JOIN "FinanceAccount" a ON a.id = d."paymentAccountId";

-- Saldo de cada conta. Antes de `initialBalanceDate` é histórico (já está no saldo inicial).
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
    AS saldo_previsto
FROM "FinanceAccount" a
LEFT JOIN LATERAL (
  SELECT
    SUM(x.delta) FILTER (WHERE x.pago_em IS NOT NULL AND x.pago_em >= a."initialBalanceDate") AS realizado,
    SUM(x.delta) FILTER (WHERE x.pago_em IS NULL AND x.delta > 0) AS a_receber,
    SUM(-x.delta) FILTER (WHERE x.pago_em IS NULL AND x.delta < 0) AS a_pagar
  FROM (
    SELECT
      CASE WHEN t.kind IN ('income', 'loan_disbursement', 'adjustment') THEN t."amountCents" ELSE -t."amountCents" END AS delta,
      t."paidAt" AS pago_em
    FROM "FinanceTransaction" t
    WHERE t."accountId" = a.id
    UNION ALL
    SELECT t."amountCents", t."paidAt"
    FROM "FinanceTransaction" t
    WHERE t."toAccountId" = a.id AND t.kind = 'transfer'
  ) x
) m ON true;

-- Cartões: limite usado (compras ainda não pagas, inclusive parcelas futuras) e disponível.
CREATE OR REPLACE VIEW public.v_fin_cartoes WITH (security_invoker = true) AS
SELECT
  cc.id AS cartao_id,
  cc.name AS cartao,
  cc.brand AS bandeira,
  cc.last4 AS final,
  cc.archived AS arquivado,
  cc."closingDay" AS dia_fechamento,
  cc."dueDay" AS dia_vencimento,
  round(cc."limitCents" / 100.0, 2) AS limite,
  round(GREATEST(COALESCE(u.devido, 0), 0) / 100.0, 2) AS limite_usado,
  round((cc."limitCents" - GREATEST(COALESCE(u.devido, 0), 0)) / 100.0, 2) AS limite_disponivel,
  CASE WHEN cc."limitCents" > 0
    THEN round(GREATEST(COALESCE(u.devido, 0), 0)::numeric / cc."limitCents" * 100, 1)
  END AS uso_pct,
  public.fin_fatura_do_dia(public.fin_hoje(), cc."closingDay", cc."dueDay") AS fatura_aberta,
  a.name AS conta_pagamento
FROM "CreditCard" cc
LEFT JOIN "FinanceAccount" a ON a.id = cc."paymentAccountId"
LEFT JOIN LATERAL (
  SELECT SUM(CASE WHEN t.kind = 'expense' THEN t."amountCents" ELSE -t."amountCents" END) AS devido
  FROM "FinanceTransaction" t
  WHERE t."cardId" = cc.id AND t.kind IN ('expense', 'card_payment')
) u ON true;

-- Empréstimos: saldo devedor (amortização das parcelas em aberto), juros pagos e a pagar.
CREATE OR REPLACE VIEW public.v_fin_emprestimos WITH (security_invoker = true) AS
SELECT
  l.id AS emprestimo_id,
  l.name AS emprestimo,
  l.lender AS credor,
  l.type AS tipo,
  l.amortization AS sistema,
  round(l."principalCents" / 100.0, 2) AS valor_contratado,
  l."monthlyRate" AS juros_mes_pct,
  round(((power(1 + l."monthlyRate" / 100.0, 12) - 1) * 100)::numeric, 2) AS juros_ano_pct,
  l."installmentCount" AS parcelas,
  l."paidBeforeCount" + COALESCE(p.pagas, 0) AS parcelas_pagas,
  l."installmentCount" - l."paidBeforeCount" - COALESCE(p.pagas, 0) AS parcelas_restantes,
  round(COALESCE(p.saldo_devedor_c, 0) / 100.0, 2) AS saldo_devedor,
  round(COALESCE(p.juros_pagos_c, 0) / 100.0, 2) AS juros_pagos,
  round(COALESCE(p.juros_a_pagar_c, 0) / 100.0, 2) AS juros_a_pagar,
  p.proximo_vencimento,
  round(p.proxima_parcela_c / 100.0, 2) AS proxima_parcela
FROM "Loan" l
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE t."paidAt" IS NOT NULL) AS pagas,
    SUM(t."amountCents" - COALESCE(t."interestCents", 0)) FILTER (WHERE t."paidAt" IS NULL) AS saldo_devedor_c,
    SUM(COALESCE(t."interestCents", 0)) FILTER (WHERE t."paidAt" IS NOT NULL) AS juros_pagos_c,
    SUM(COALESCE(t."interestCents", 0)) FILTER (WHERE t."paidAt" IS NULL) AS juros_a_pagar_c,
    MIN(t.date) FILTER (WHERE t."paidAt" IS NULL) AS proximo_vencimento,
    (array_agg(t."amountCents" ORDER BY t.date) FILTER (WHERE t."paidAt" IS NULL))[1] AS proxima_parcela_c
  FROM "FinanceTransaction" t
  WHERE t."loanId" = l.id AND t.kind = 'expense'
) p ON true;

-- Agenda: tudo que ainda vai entrar ou sair (lançamentos pendentes + faturas em aberto).
CREATE OR REPLACE VIEW public.v_fin_agenda WITH (security_invoker = true) AS
SELECT
  'lancamento' AS origem,
  t.id AS ref_id,
  t.kind AS tipo,
  t.description AS descricao,
  t.date AS vencimento,
  round(t."amountCents" / 100.0, 2) AS valor,
  a.name AS conta,
  (t.date < public.fin_hoje()) AS atrasado
FROM "FinanceTransaction" t
LEFT JOIN "FinanceAccount" a ON a.id = t."accountId"
WHERE t."paidAt" IS NULL AND t.kind IN ('income', 'expense') AND t."cardId" IS NULL
UNION ALL
SELECT
  'fatura',
  f.cartao_id,
  'card_invoice',
  'Fatura ' || f.cartao || ' (' || f.fatura || ')',
  f.vencimento,
  f.em_aberto,
  f.conta_pagamento,
  (f.status = 'vencida')
FROM public.v_fin_faturas f
WHERE f.em_aberto > 0;

GRANT SELECT ON public.v_fin_lancamentos, public.v_fin_fluxo_mensal, public.v_fin_categorias_mes,
  public.v_fin_faturas, public.v_fin_contas, public.v_fin_cartoes, public.v_fin_emprestimos, public.v_fin_agenda
  TO authenticated, service_role;
REVOKE ALL ON public.v_fin_lancamentos, public.v_fin_fluxo_mensal, public.v_fin_categorias_mes,
  public.v_fin_faturas, public.v_fin_contas, public.v_fin_cartoes, public.v_fin_emprestimos, public.v_fin_agenda
  FROM anon;
