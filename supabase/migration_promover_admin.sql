-- Promove o primeiro usuário a admin (quando ainda não existe nenhum).
-- Execute no SQL Editor do Supabase.

CREATE OR REPLACE FUNCTION public.promover_primeiro_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE role = 'admin' AND COALESCE(ativo, true) = true
    ) THEN
        RETURN false;
    END IF;

    UPDATE public.profiles
    SET role = 'admin',
        ativo = COALESCE(ativo, true)
    WHERE id = auth.uid();

    RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.promover_primeiro_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.promover_primeiro_admin() TO authenticated;

-- Atalho manual: force admin no seu e-mail (descomente e ajuste se precisar)
-- UPDATE public.profiles
-- SET role = 'admin', ativo = true
-- WHERE email = 'tobiasmiguel007@gmail.com';
