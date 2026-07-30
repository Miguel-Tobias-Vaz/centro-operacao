-- Insígnias de perfil (catálogo + atribuição por admin)
-- Requer is_admin() (001 ou 005)

CREATE TABLE IF NOT EXISTS public.insignias (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slug text NOT NULL UNIQUE,
    nome text NOT NULL,
    descricao text,
    icone_path text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.perfil_insignias (
    perfil_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    insignia_id uuid NOT NULL REFERENCES public.insignias(id) ON DELETE CASCADE,
    concedida_em timestamptz NOT NULL DEFAULT now(),
    concedida_por uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    PRIMARY KEY (perfil_id, insignia_id)
);

CREATE INDEX IF NOT EXISTS idx_perfil_insignias_perfil
    ON public.perfil_insignias (perfil_id);

ALTER TABLE public.insignias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_insignias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insignias_select_all" ON public.insignias;
CREATE POLICY "insignias_select_all"
    ON public.insignias FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "insignias_admin_write" ON public.insignias;
CREATE POLICY "insignias_admin_write"
    ON public.insignias FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "perfil_insignias_select_all" ON public.perfil_insignias;
CREATE POLICY "perfil_insignias_select_all"
    ON public.perfil_insignias FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "perfil_insignias_admin_write" ON public.perfil_insignias;
CREATE POLICY "perfil_insignias_admin_write"
    ON public.perfil_insignias FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

INSERT INTO public.insignias (slug, nome, descricao, icone_path)
VALUES (
    'trofeu',
    'Troféu',
    'Reconhecimento especial da equipa.',
    'assets/insignias/trofeu.png'
)
ON CONFLICT (slug) DO UPDATE
SET
    nome = EXCLUDED.nome,
    descricao = EXCLUDED.descricao,
    icone_path = EXCLUDED.icone_path;

COMMENT ON TABLE public.insignias IS 'Catálogo de insígnias (pixel art) do perfil';
COMMENT ON TABLE public.perfil_insignias IS 'Insígnias concedidas a cada perfil (só admin atribui)';
