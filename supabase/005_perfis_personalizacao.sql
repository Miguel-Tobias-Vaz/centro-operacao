-- =============================================================================
-- Perfis personalizáveis (estilo Steam → trabalho)
-- Compatível com projetos antigos (migration_admin_usuarios) e com 001_baseline.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Garantir coluna ativo + helpers RLS (podem faltar em projetos antigos)
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;

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
        WHERE id = auth.uid()
          AND role = 'admin'
          AND COALESCE(ativo, true) = true
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
        WHERE id = auth.uid()
          AND role IN ('admin', 'editor')
          AND COALESCE(ativo, true) = true
    );
$$;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = auth.uid()
          AND COALESCE(ativo, true) = true
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_content() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

-- -----------------------------------------------------------------------------
-- Colunas de personalização em profiles
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS bio text,
    ADD COLUMN IF NOT EXISTS cargo text,
    ADD COLUMN IF NOT EXISTS avatar_url text,
    ADD COLUMN IF NOT EXISTS fundo_url text,
    ADD COLUMN IF NOT EXISTS cor_destaque text DEFAULT '#2B8CFF',
    ADD COLUMN IF NOT EXISTS tema_perfil text NOT NULL DEFAULT 'escuro';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'profiles_tema_perfil_check'
    ) THEN
        ALTER TABLE public.profiles
            ADD CONSTRAINT profiles_tema_perfil_check
            CHECK (tema_perfil IN ('escuro', 'claro'));
    END IF;
END $$;

COMMENT ON COLUMN public.profiles.bio IS 'Bio curta do perfil';
COMMENT ON COLUMN public.profiles.cargo IS 'Função / cargo no trabalho';
COMMENT ON COLUMN public.profiles.avatar_url IS 'Caminho no bucket perfis-midia';
COMMENT ON COLUMN public.profiles.fundo_url IS 'Caminho no bucket perfis-midia';
COMMENT ON COLUMN public.profiles.cor_destaque IS 'Cor hex do tema do perfil';
COMMENT ON COLUMN public.profiles.tema_perfil IS 'escuro | claro (só na página de perfil)';

-- -----------------------------------------------------------------------------
-- RLS profiles: visitar outros + self-update de personalização
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_select_ativos" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_nome" ON public.profiles;

-- Próprio registo sempre; restantes se o visitante estiver ativo
CREATE POLICY "profiles_select_ativos"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR public.is_active_user()
    );

-- Dono ativo atualiza o próprio perfil (campos sensíveis bloqueados no trigger)
CREATE POLICY "profiles_update_self"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid() AND public.is_active_user())
    WITH CHECK (id = auth.uid());

-- Impede não-admin de alterar role / ativo / email
CREATE OR REPLACE FUNCTION public.profiles_guard_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        IF NEW.role IS DISTINCT FROM OLD.role
            OR NEW.ativo IS DISTINCT FROM OLD.ativo
            OR NEW.email IS DISTINCT FROM OLD.email
            OR NEW.id IS DISTINCT FROM OLD.id
        THEN
            RAISE EXCEPTION 'Sem permissão para alterar campos sensíveis do perfil';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_sensitive ON public.profiles;
CREATE TRIGGER profiles_guard_sensitive
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.profiles_guard_sensitive_columns();

-- -----------------------------------------------------------------------------
-- Logs: feed do perfil visitável (além de admin ver tudo)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.logs_atividade (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    criado_em timestamptz NOT NULL DEFAULT now(),
    acao text NOT NULL,
    detalhe text,
    entidade text,
    usuario_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    usuario_nome text,
    usuario_email text
);

ALTER TABLE public.logs_atividade ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS logs_atividade_usuario_id_idx
    ON public.logs_atividade (usuario_id, criado_em DESC);

DROP POLICY IF EXISTS "logs_select_admin" ON public.logs_atividade;
DROP POLICY IF EXISTS "logs_select_admin_ou_feed_perfil" ON public.logs_atividade;
DROP POLICY IF EXISTS "logs_insert_autenticado" ON public.logs_atividade;

CREATE POLICY "logs_select_admin_ou_feed_perfil"
    ON public.logs_atividade
    FOR SELECT
    TO authenticated
    USING (
        public.is_admin()
        OR (
            public.is_active_user()
            AND usuario_id IS NOT NULL
        )
    );

CREATE POLICY "logs_insert_autenticado"
    ON public.logs_atividade
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL AND public.is_active_user());

GRANT SELECT, INSERT ON public.logs_atividade TO authenticated;

-- -----------------------------------------------------------------------------
-- Storage: bucket de mídia de perfil
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('perfis-midia', 'perfis-midia', true, 2097152)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- Leitura pública (getPublicUrl)
DROP POLICY IF EXISTS "storage_public_read_perfis" ON storage.objects;
CREATE POLICY "storage_public_read_perfis"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id = 'perfis-midia');

-- Escrita só no próprio prefixo {user_id}/...
DROP POLICY IF EXISTS "storage_write_perfis_own" ON storage.objects;
CREATE POLICY "storage_write_perfis_own"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id = 'perfis-midia'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = auth.uid()::text
    )
    WITH CHECK (
        bucket_id = 'perfis-midia'
        AND public.is_active_user()
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
