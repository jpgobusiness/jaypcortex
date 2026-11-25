-- Subcategorias de Moradia para aluguel e condomínio (valor mês a mês nas recorrentes).
INSERT INTO "FinanceCategory" ("id", "name", "kind", "icon", "color", "essential", "system", "parentId", "order", "updatedAt") VALUES
  ('fincat-aluguel',    'Aluguel',    'expense', 'home',     '#7b68ee', true, 'aluguel',    'fincat-moradia', 1, now()),
  ('fincat-condominio', 'Condomínio', 'expense', 'building', '#6366f1', true, 'condominio', 'fincat-moradia', 2, now())
ON CONFLICT ("system") DO NOTHING;
