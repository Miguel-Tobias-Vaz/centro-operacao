-- LEGADO: preferir 001_schema_baseline.sql + 002_admin_excluir_usuario.sql
-- Mantido para projetos que já correram este ficheiro.

-- Gestão avançada de usuários (admin)

ALTER TABLE public.profiles    ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

UPDATE public.profiles SET ativo = true WHERE ativo IS NULL;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin' AND ativo = true
    );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_content()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid() AND role IN ('admin', 'editor') AND ativo = true
    );
$$;

CREATE OR REPLACE FUNCTION public.admin_excluir_usuario(target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Sem permissão para excluir usuários';
    END IF;

    IF target_id = auth.uid() THEN
        RAISE EXCEPTION 'Você não pode excluir sua própria conta';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_id) THEN
        RAISE EXCEPTION 'Usuário não encontrado';
    END IF;

    DELETE FROM auth.users WHERE id = target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_excluir_usuario(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_excluir_usuario(uuid) TO authenticated;
