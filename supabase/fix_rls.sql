-- Corrija o erro "violates row-level security policy"
-- Rode no SQL Editor do projeto tuqnbzdgxiytnmigmlbn (ou o seu projeto atual)

ALTER TABLE modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE publicacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "modulos_publico" ON modulos;
DROP POLICY IF EXISTS "publicacoes_publico" ON publicacoes;

CREATE POLICY "modulos_publico" ON modulos
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

CREATE POLICY "publicacoes_publico" ON publicacoes
    FOR ALL
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON modulos TO anon, authenticated;
GRANT ALL ON publicacoes TO anon, authenticated;
