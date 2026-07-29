-- Anotações no perfil (acima da atividade)
-- Requer 005_perfis_personalizacao.sql

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS anotacoes text;

COMMENT ON COLUMN public.profiles.anotacoes IS 'Notas livres no perfil (visíveis a quem visita)';
