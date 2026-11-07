-- GoTrue não deixa a service role alterar disable_signup (só o painel / Management API).
-- Este trigger bloqueia INSERT em auth.users sem e-mail confirmado e sem convite,
-- que é o caminho do "Sign up" público. Admin createUser usa email_confirm=true.

CREATE OR REPLACE FUNCTION public.prevent_self_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL AND NEW.invited_at IS NULL THEN
    RAISE EXCEPTION 'Cadastro público desativado. Usuários só podem ser criados pelo admin.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_signup ON auth.users;
CREATE TRIGGER prevent_self_signup
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_signup();
