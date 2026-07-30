-- Ordem global do catálogo + missões ligadas a insígnias
-- Requer 012_insignias.sql

ALTER TABLE public.insignias
    ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.insignias.ordem IS 'Ordem de exibição no perfil (menor = primeiro)';

-- Inicializa ordem do catálogo se ainda estiver tudo a 0
WITH ordenadas AS (
    SELECT
        id,
        (ROW_NUMBER() OVER (ORDER BY nome ASC, created_at ASC) - 1)::integer AS nova_ordem
    FROM public.insignias
)
UPDATE public.insignias i
SET ordem = o.nova_ordem
FROM ordenadas o
WHERE i.id = o.id
  AND NOT EXISTS (
      SELECT 1 FROM public.insignias x WHERE x.ordem <> 0
  );

CREATE TABLE IF NOT EXISTS public.missoes_insignia (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL,
    descricao text,
    insignia_id uuid NOT NULL REFERENCES public.insignias(id) ON DELETE CASCADE,
    ativo boolean NOT NULL DEFAULT true,
    ordem integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_missoes_insignia_insignia
    ON public.missoes_insignia (insignia_id);

CREATE INDEX IF NOT EXISTS idx_missoes_insignia_ordem
    ON public.missoes_insignia (ordem);

ALTER TABLE public.missoes_insignia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "missoes_insignia_select_all" ON public.missoes_insignia;
CREATE POLICY "missoes_insignia_select_all"
    ON public.missoes_insignia FOR SELECT
    TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "missoes_insignia_admin_write" ON public.missoes_insignia;
CREATE POLICY "missoes_insignia_admin_write"
    ON public.missoes_insignia FOR ALL
    TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

COMMENT ON TABLE public.missoes_insignia IS 'Missões / como ganhar cada insígnia (catálogo admin)';
