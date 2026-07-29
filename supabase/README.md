# Supabase — migrations

Ordem de execução no **SQL Editor** (projeto novo):

| # | Ficheiro | Conteúdo |
|---|----------|----------|
| 1 | `001_schema_baseline.sql` | Tabelas (`profiles`, `categorias_modulo`, `modulos`, `publicacoes`), helpers RLS, trigger de signup, buckets Storage |
| 2 | `002_admin_excluir_usuario.sql` | RPC `admin_excluir_usuario` |
| 3 | `003_logs_atividade.sql` | Tabela + RLS de logs |
| 4 | `004_promover_primeiro_admin.sql` | RPC `promover_primeiro_admin` |
| 5 | `005_perfis_personalizacao.sql` | Campos de perfil, bucket `perfis-midia`, RLS visitar/self-update, feed de logs |
| 6 | `006_perfil_barras_laterais.sql` | Cores/imagens das barras laterais e tom do painel central |
| 7 | `007_perfil_anotacoes.sql` | Campo `anotacoes` no perfil |
| 8 | `008_imagem_posicao.sql` | Posição de enquadramento (avatar, fundo, barras, módulos) |
| 9 | `009_imagens_qualidade.sql` | Limite Storage 3 MB para mídia de perfil/módulos |
| 10 | `010_gif_limite_8mb.sql` | Limite Storage 8 MB (GIFs maiores) |
| 11 | `011_gif_limite_15mb.sql` | Limite Storage 15 MB (GIFs de fundo/perfil) |

Os ficheiros `migration_*.sql` antigos são equivalentes parciais; preferir a numeração `001`–`011`.

Documentação de políticas: [`Doc/supabase-rls.md`](../Doc/supabase-rls.md).
Roadmap de perfis: [`Doc/perfil-roadmap.md`](../Doc/perfil-roadmap.md).
