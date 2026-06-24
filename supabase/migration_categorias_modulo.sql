-- Tabela de categorias de módulos (dinâmicas)
-- Execute no SQL Editor do Supabase

CREATE TABLE IF NOT EXISTS categorias_modulo (
    id text PRIMARY KEY,
    titulo text NOT NULL,
    descricao text NOT NULL DEFAULT '',
    ordem integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO categorias_modulo (id, titulo, descricao, ordem) VALUES
    ('site', 'Site', 'Módulos e conteúdos voltados ao site público.', 1),
    ('interno', 'Interno', 'Ferramentas e referências de uso interno da equipe.', 2),
    ('portal', 'Portal', 'Conteúdos e acessos do portal institucional.', 3)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE modulos ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'site';

UPDATE modulos SET categoria = 'site'
WHERE categoria IS NULL OR trim(categoria) = '';

ALTER TABLE modulos DROP CONSTRAINT IF EXISTS modulos_categoria_check;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'modulos_categoria_fkey'
    ) THEN
        ALTER TABLE modulos
            ADD CONSTRAINT modulos_categoria_fkey
            FOREIGN KEY (categoria) REFERENCES categorias_modulo (id)
            ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_modulos_categoria_ordem ON modulos (categoria, ordem);
CREATE INDEX IF NOT EXISTS idx_categorias_modulo_ordem ON categorias_modulo (ordem);

ALTER TABLE categorias_modulo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categorias_modulo_select" ON categorias_modulo;
DROP POLICY IF EXISTS "categorias_modulo_insert" ON categorias_modulo;
DROP POLICY IF EXISTS "categorias_modulo_update" ON categorias_modulo;
DROP POLICY IF EXISTS "categorias_modulo_delete" ON categorias_modulo;

CREATE POLICY "categorias_modulo_select" ON categorias_modulo
    FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "categorias_modulo_insert" ON categorias_modulo
    FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "categorias_modulo_update" ON categorias_modulo
    FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

CREATE POLICY "categorias_modulo_delete" ON categorias_modulo
    FOR DELETE TO anon, authenticated USING (true);
