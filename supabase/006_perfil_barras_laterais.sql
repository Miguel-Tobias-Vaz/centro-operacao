-- Barras laterais do perfil (layout Steam)
-- Requer 005_perfis_personalizacao.sql

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS barra_esq_url text,
    ADD COLUMN IF NOT EXISTS barra_dir_url text,
    ADD COLUMN IF NOT EXISTS barra_esq_cor text,
    ADD COLUMN IF NOT EXISTS barra_dir_cor text,
    ADD COLUMN IF NOT EXISTS meio_cor text;

COMMENT ON COLUMN public.profiles.barra_esq_url IS 'Imagem da barra esquerda (bucket perfis-midia)';
COMMENT ON COLUMN public.profiles.barra_dir_url IS 'Imagem da barra direita (bucket perfis-midia)';
COMMENT ON COLUMN public.profiles.barra_esq_cor IS 'Cor de fundo da barra esquerda';
COMMENT ON COLUMN public.profiles.barra_dir_cor IS 'Cor de fundo da barra direita';
COMMENT ON COLUMN public.profiles.meio_cor IS 'Tom do painel central (hex)';
