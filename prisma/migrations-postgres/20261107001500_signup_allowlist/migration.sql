-- Public signup continua bloqueado. Admin coloca o e-mail na allowlist
-- imediatamente antes de createUser (email_confirm ainda chega NULL no INSERT).

CREATE TABLE IF NOT EXISTS public.signup_allowlist (
  email TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_allowlist ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.signup_allowlist FROM anon, authenticated;
GRANT ALL ON public.signup_allowlist TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_self_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.signup_allowlist a
    WHERE lower(a.email) = lower(NEW.email)
  ) THEN
    DELETE FROM public.signup_allowlist WHERE lower(email) = lower(NEW.email);
    RETURN NEW;
  END IF;

  IF NEW.email_confirmed_at IS NOT NULL OR NEW.invited_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cadastro público desativado. Usuários só podem ser criados pelo admin.';
END;
$$;
