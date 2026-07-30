-- Ordem das insígnias no perfil (admin define a sequência)
-- Requer 012_insignias.sql

ALTER TABLE public.perfil_insignias
    ADD COLUMN IF NOT EXISTS ordem integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.perfil_insignias.ordem IS 'Ordem de exibição no perfil (menor = primeiro)';

-- Inicializa ordem estável para linhas existentes (por data de concessão)
WITH ordenadas AS (
    SELECT
        perfil_id,
        insignia_id,
        (ROW_NUMBER() OVER (
            PARTITION BY perfil_id
            ORDER BY concedida_em ASC NULLS LAST, insignia_id
        ) - 1)::integer AS nova_ordem
    FROM public.perfil_insignias
)
UPDATE public.perfil_insignias p
SET ordem = o.nova_ordem
FROM ordenadas o
WHERE p.perfil_id = o.perfil_id
  AND p.insignia_id = o.insignia_id;
