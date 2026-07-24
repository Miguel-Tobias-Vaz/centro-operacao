# Supabase RLS e permissões

A UI (`auth.js`, `admin.html`) esconde botões e bloqueia ações no browser.
**A segurança real é o Row Level Security (RLS)** nas tabelas e no Storage.
Sem estas policies, qualquer cliente com a `anon key` poderia ler/escrever dados.

## Papéis

| Role | Quem | Pode |
|------|------|------|
| `admin` | gestão | Tudo de editor + gerir utilizadores + ver logs |
| `editor` | conteúdo | Criar/editar/apagar categorias, módulos, publicações e ficheiros |
| (conta `ativo = false`) | — | Login rejeitado; policies tratam como sem acesso |

Helpers (SECURITY DEFINER):

- `is_admin()` — admin ativo
- `can_edit_content()` — admin ou editor ativos
- `is_active_user()` — qualquer profile com `ativo = true`

## Tabelas

### `profiles`

| Operação | Quem |
|----------|------|
| SELECT | Próprio registo **ou** admin |
| UPDATE | Só admin (role, ativo, nome de outros) |
| INSERT | Trigger `handle_new_user` em `auth.users` (não pelo client) |
| DELETE | Indireto via `admin_excluir_usuario` (apaga `auth.users` → CASCADE) |

### `categorias_modulo`, `modulos`, `publicacoes`

| Operação | Quem |
|----------|------|
| SELECT | Utilizador autenticado e ativo |
| INSERT / UPDATE / DELETE | `can_edit_content()` |

Anon **não** lê conteúdo do hub (é preciso login).

### `logs_atividade`

| Operação | Quem |
|----------|------|
| SELECT | Só admin |
| INSERT | Utilizador autenticado ativo |

## Storage

Buckets públicos (leitura via URL):

- `publicacoes-arquivos` (máx. 10 MB)
- `modulos-imagens` (máx. 2 MB)

| Operação | Quem |
|----------|------|
| SELECT | Público (getPublicUrl) |
| INSERT / UPDATE / DELETE | `can_edit_content()` |

Os campos `imagem_url` / `arquivo_url` guardam o **caminho** dentro do bucket, não a URL completa.

## O que a UI não substitui

1. Desativar conta no admin → `profiles.ativo = false` + policies `is_active_user` / `can_edit_content`.
2. Esconder `admin.html` no JS → policies em `profiles` e `logs_atividade` + `is_admin()`.
3. Upload de anexos → policies em `storage.objects`.

## Checklist após aplicar SQL

1. Authentication → Providers: Email ligado.
2. Correr `001` … `004` no SQL Editor.
3. Criar o primeiro utilizador (signup ou painel).
4. `SELECT public.promover_primeiro_admin();` (logado como esse user) **ou** UPDATE manual do role.
5. Confirmar no Table Editor que RLS está **Enabled** em todas as tabelas acima.
6. Testar: conta `editor` não lista utilizadores; conta desativada não autentica de forma útil.

## Variáveis (client)

Só a **anon key** vai para o browser (`config.js`). Nunca commitir a **service_role** key.
