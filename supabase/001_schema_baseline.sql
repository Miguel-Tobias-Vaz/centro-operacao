-- =============================================================================
-- Central OPTO — schema baseline (projeto novo)
-- Execute no SQL Editor do Supabase, nesta ordem com os ficheiros 002…004.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- Profiles (espelha auth.users)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    email text NOT NULL,
    nome text,
    role text NOT NULL DEFAULT 'editor'
        CHECK (role IN ('admin', 'editor')),
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles (email);
CREATE INDEX IF NOT EXISTS profiles_role_idx ON public.profiles (role);

-- -----------------------------------------------------------------------------
-- Categorias de módulos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.categorias_modulo (
    id text PRIMARY KEY,
    titulo text NOT NULL,
    descricao text NOT NULL DEFAULT '',
    ordem integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.categorias_modulo (id, titulo, descricao, ordem)
VALUES
    ('site', 'Site', 'Módulos e conteúdos voltados ao site público.', 1),
    ('interno', 'Interno', '', 2),
    ('portal', 'Portal', 'Conteúdos e acessos do portal institucional.', 3)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- Módulos
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.modulos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    categoria text NOT NULL DEFAULT 'site'
        REFERENCES public.categorias_modulo (id) ON DELETE RESTRICT,
    ordem integer NOT NULL DEFAULT 0,
    imagem_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS modulos_ordem_idx ON public.modulos (ordem);
CREATE INDEX IF NOT EXISTS modulos_categoria_idx ON public.modulos (categoria);

-- -----------------------------------------------------------------------------
-- Publicações
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.publicacoes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    modulo_id uuid NOT NULL REFERENCES public.modulos (id) ON DELETE CASCADE,
    titulo text NOT NULL,
    conteudo text NOT NULL DEFAULT '',
    ordem integer NOT NULL DEFAULT 0,
    arquivo_url text,
    arquivo_nome text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS publicacoes_modulo_id_idx ON public.publicacoes (modulo_id);
CREATE INDEX IF NOT EXISTS publicacoes_ordem_idx ON public.publicacoes (modulo_id, ordem);

-- -----------------------------------------------------------------------------
-- Helpers de autorização (usados pelas policies)
-- -----------------------------------------------------------------------------

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
          AND ativo = true
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
          AND ativo = true
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
          AND ativo = true
    );
$$;

-- -----------------------------------------------------------------------------
-- Trigger: cria profile ao registar utilizador
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    meta_nome text;
    meta_role text;
BEGIN
    meta_nome := COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1));
    meta_role := COALESCE(NEW.raw_user_meta_data ->> 'role', 'editor');

    IF meta_role NOT IN ('admin', 'editor') THEN
        meta_role := 'editor';
    END IF;

    -- Só o primeiro utilizador (ou signup com meta admin) pode nascer admin
    -- via metadata; a promoção segura é promover_primeiro_admin() / painel.
    IF meta_role = 'admin' AND EXISTS (
        SELECT 1 FROM public.profiles WHERE role = 'admin' AND ativo = true
    ) THEN
        meta_role := 'editor';
    END IF;

    INSERT INTO public.profiles (id, email, nome, role, ativo)
    VALUES (NEW.id, NEW.email, meta_nome, meta_role, true)
    ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email,
            nome = COALESCE(EXCLUDED.nome, public.profiles.nome);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- -----------------------------------------------------------------------------
-- RLS — profiles
-- -----------------------------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self_or_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_admin" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_self_nome" ON public.profiles;

-- Utilizador ativo vê o próprio perfil; admin vê todos
CREATE POLICY "profiles_select_self_or_admin"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid()
        OR public.is_admin()
    );

-- Só admin altera role / ativo / dados de outros
CREATE POLICY "profiles_update_admin"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Sem INSERT/DELETE diretos pelo client (trigger + RPC de exclusão)

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- -----------------------------------------------------------------------------
-- RLS — conteúdo (categorias, módulos, publicações)
-- Leitura: qualquer utilizador autenticado e ativo
-- Escrita: admin ou editor ativos (can_edit_content)
-- -----------------------------------------------------------------------------

ALTER TABLE public.categorias_modulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorias_select_ativo" ON public.categorias_modulo;
DROP POLICY IF EXISTS "categorias_write_editor" ON public.categorias_modulo;
DROP POLICY IF EXISTS "modulos_select_ativo" ON public.modulos;
DROP POLICY IF EXISTS "modulos_write_editor" ON public.modulos;
DROP POLICY IF EXISTS "publicacoes_select_ativo" ON public.publicacoes;
DROP POLICY IF EXISTS "publicacoes_write_editor" ON public.publicacoes;

CREATE POLICY "categorias_select_ativo"
    ON public.categorias_modulo FOR SELECT TO authenticated
    USING (public.is_active_user());

CREATE POLICY "categorias_write_editor"
    ON public.categorias_modulo FOR ALL TO authenticated
    USING (public.can_edit_content())
    WITH CHECK (public.can_edit_content());

CREATE POLICY "modulos_select_ativo"
    ON public.modulos FOR SELECT TO authenticated
    USING (public.is_active_user());

CREATE POLICY "modulos_write_editor"
    ON public.modulos FOR ALL TO authenticated
    USING (public.can_edit_content())
    WITH CHECK (public.can_edit_content());

CREATE POLICY "publicacoes_select_ativo"
    ON public.publicacoes FOR SELECT TO authenticated
    USING (public.is_active_user());

CREATE POLICY "publicacoes_write_editor"
    ON public.publicacoes FOR ALL TO authenticated
    USING (public.can_edit_content())
    WITH CHECK (public.can_edit_content());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_modulo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modulos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publicacoes TO authenticated;

-- -----------------------------------------------------------------------------
-- Storage buckets (públicos para leitura via getPublicUrl)
-- -----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
    ('publicacoes-arquivos', 'publicacoes-arquivos', true, 10485760),
    ('modulos-imagens', 'modulos-imagens', true, 2097152)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

-- Leitura pública dos objetos destes buckets
DROP POLICY IF EXISTS "storage_public_read_opto" ON storage.objects;
CREATE POLICY "storage_public_read_opto"
    ON storage.objects FOR SELECT
    TO public
    USING (bucket_id IN ('publicacoes-arquivos', 'modulos-imagens'));

-- Upload / update / delete só editores/admins ativos
DROP POLICY IF EXISTS "storage_write_opto_editor" ON storage.objects;
CREATE POLICY "storage_write_opto_editor"
    ON storage.objects FOR ALL
    TO authenticated
    USING (
        bucket_id IN ('publicacoes-arquivos', 'modulos-imagens')
        AND public.can_edit_content()
    )
    WITH CHECK (
        bucket_id IN ('publicacoes-arquivos', 'modulos-imagens')
        AND public.can_edit_content()
    );
