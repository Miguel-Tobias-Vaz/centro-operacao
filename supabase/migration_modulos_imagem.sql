-- Imagem circular nos módulos
-- Execute no SQL Editor do Supabase

ALTER TABLE modulos ADD COLUMN IF NOT EXISTS imagem_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('modulos-imagens', 'modulos-imagens', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "modulos_imagens_select" ON storage.objects;
DROP POLICY IF EXISTS "modulos_imagens_insert" ON storage.objects;
DROP POLICY IF EXISTS "modulos_imagens_update" ON storage.objects;
DROP POLICY IF EXISTS "modulos_imagens_delete" ON storage.objects;

CREATE POLICY "modulos_imagens_select" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'modulos-imagens');

CREATE POLICY "modulos_imagens_insert" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'modulos-imagens');

CREATE POLICY "modulos_imagens_update" ON storage.objects
    FOR UPDATE TO anon, authenticated
    USING (bucket_id = 'modulos-imagens');

CREATE POLICY "modulos_imagens_delete" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id = 'modulos-imagens');
