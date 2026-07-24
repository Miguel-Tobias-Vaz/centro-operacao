# Supabase — migrations

Ordem de execução no **SQL Editor** (projeto novo):

| # | Ficheiro | Conteúdo |
|---|----------|----------|
| 1 | `001_schema_baseline.sql` | Tabelas (`profiles`, `categorias_modulo`, `modulos`, `publicacoes`), helpers RLS, trigger de signup, buckets Storage |
| 2 | `002_admin_excluir_usuario.sql` | RPC `admin_excluir_usuario` |
| 3 | `003_logs_atividade.sql` | Tabela + RLS de logs |
| 4 | `004_promover_primeiro_admin.sql` | RPC `promover_primeiro_admin` |

Os ficheiros `migration_*.sql` antigos são equivalentes parciais; preferir a numeração `001`–`004`.

Documentação de políticas: [`Doc/supabase-rls.md`](../Doc/supabase-rls.md).
