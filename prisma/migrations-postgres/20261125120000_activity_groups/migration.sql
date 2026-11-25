-- Grupos de atividade (N:N). Apagar o grupo não apaga Activity.
-- Nome único por usuário, sem diferenciar maiúsculas.
-- RLS igual às tabelas de negócio: authenticated com perfil ativo.

CREATE TABLE IF NOT EXISTS "ActivityGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT DEFAULT '#6366f1',
  "icon" TEXT,
  "ownerId" UUID,
  "assigneeEmail" TEXT,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityGroup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityGroupMember" (
  "activityId" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityGroupMember_pkey" PRIMARY KEY ("activityId", "groupId")
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityGroup_ownerId_name_key') THEN
    ALTER TABLE "ActivityGroup"
      ADD CONSTRAINT "ActivityGroup_ownerId_name_key" UNIQUE ("ownerId", "name");
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityGroupMember_activityId_fkey') THEN
    ALTER TABLE "ActivityGroupMember"
      ADD CONSTRAINT "ActivityGroupMember_activityId_fkey"
      FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityGroupMember_groupId_fkey') THEN
    ALTER TABLE "ActivityGroupMember"
      ADD CONSTRAINT "ActivityGroupMember_groupId_fkey"
      FOREIGN KEY ("groupId") REFERENCES "ActivityGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "ActivityGroup_ownerId_archived_idx" ON "ActivityGroup" ("ownerId", "archived");
CREATE INDEX IF NOT EXISTS "ActivityGroup_assigneeEmail_idx" ON "ActivityGroup" ("assigneeEmail");
CREATE INDEX IF NOT EXISTS "ActivityGroupMember_groupId_idx" ON "ActivityGroupMember" ("groupId");

CREATE UNIQUE INDEX IF NOT EXISTS "ActivityGroup_owner_name_ci"
  ON "ActivityGroup" ((COALESCE("ownerId"::text, '')), (lower(btrim("name"))));

GRANT ALL ON TABLE "ActivityGroup", "ActivityGroupMember" TO service_role, authenticated;
REVOKE ALL ON TABLE "ActivityGroup", "ActivityGroupMember" FROM anon;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['ActivityGroup', 'ActivityGroupMember']
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

-- Grupos padrão. Responsável do acompanhamento: dpsilva@nuageit.com.br.
-- Espelha DEFAULT_ACTIVITY_GROUPS em lib/activities/group-logic.ts.
WITH admin AS (
  SELECT id
  FROM public.profiles
  WHERE role = 'admin' AND active = true
  ORDER BY created_at
  LIMIT 1
),
wanted(id, name, color, icon, assignee) AS (
  VALUES
    ('grp_nuage', 'Nuage', '#6366f1', 'briefcase', NULL::text),
    ('grp_pessoal', 'Pessoal', '#16a34a', 'user', NULL::text),
    ('grp_david', 'Acompanhamento David', '#d97706', 'users', 'dpsilva@nuageit.com.br')
)
INSERT INTO "ActivityGroup" ("id", "name", "color", "icon", "ownerId", "assigneeEmail", "archived", "createdAt", "updatedAt")
SELECT w.id, w.name, w.color, w.icon, admin.id, w.assignee, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM wanted w
LEFT JOIN admin ON true
WHERE NOT EXISTS (
  SELECT 1 FROM "ActivityGroup" g
  WHERE lower(btrim(g.name)) = lower(w.name)
    AND COALESCE(g."ownerId"::text, '') = COALESCE(admin.id::text, '')
);
