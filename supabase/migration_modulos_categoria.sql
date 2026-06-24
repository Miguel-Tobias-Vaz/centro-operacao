-- Categorias dos módulos: site, interno, portal
-- Execute no SQL Editor do Supabase

ALTER TABLE modulos ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'site';

UPDATE modulos SET categoria = 'site' WHERE categoria IS NULL OR trim(categoria) = '';

ALTER TABLE modulos DROP CONSTRAINT IF EXISTS modulos_categoria_check;

ALTER TABLE modulos ADD CONSTRAINT modulos_categoria_check
    CHECK (categoria IN ('site', 'interno', 'portal'));

CREATE INDEX IF NOT EXISTS idx_modulos_categoria_ordem ON modulos (categoria, ordem);
