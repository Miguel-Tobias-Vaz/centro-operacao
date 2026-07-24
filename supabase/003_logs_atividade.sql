-- Log de atividades (admin)
-- Requer 001_schema_baseline.sql (is_admin)

CREATE TABLE IF NOT EXISTS public.logs_atividade (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    criado_em timestamptz NOT NULL DEFAULT now(),
    acao text NOT NULL,
    detalhe text,
    entidade text,
    usuario_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
    usuario_nome text,
    usuario_email text
);

CREATE INDEX IF NOT EXISTS logs_atividade_criado_em_idx
    ON public.logs_atividade (criado_em DESC);

ALTER TABLE public.logs_atividade ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "logs_select_admin" ON public.logs_atividade;
DROP POLICY IF EXISTS "logs_insert_autenticado" ON public.logs_atividade;

CREATE POLICY "logs_select_admin"
    ON public.logs_atividade
    FOR SELECT
    TO authenticated
    USING (public.is_admin());

CREATE POLICY "logs_insert_autenticado"
    ON public.logs_atividade
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() IS NOT NULL AND public.is_active_user());

GRANT SELECT, INSERT ON public.logs_atividade TO authenticated;
