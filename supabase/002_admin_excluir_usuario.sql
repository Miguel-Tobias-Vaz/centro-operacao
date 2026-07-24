-- RPC: exclusão permanente de utilizador (só admin)
-- Requer 001_schema_baseline.sql

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
