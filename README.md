# Central OPTO

Hub interno da equipe (módulos, publicações, login) e ferramentas de documentos que correm **só no browser** (PDF e normalização de nomes).

Site em produção (exemplo): [centro-operacao-eight.vercel.app](https://centro-operacao-eight.vercel.app)

## Páginas

| Página | Função | Login |
|--------|--------|-------|
| `index.html` | Módulos, publicações, busca, editor | Sim (Supabase) |
| `admin.html` | Dashboard, utilizadores, logs e configuração | Sim (admin) |
| `separador-pdf.html` | Separar / Mesclar / Word → PDF | Não |
| `tratamento.html` | Normalizar nomes de ficheiros e texto | Não |

## Requisitos

- Conta [Supabase](https://supabase.com) (Auth + Postgres + Storage)
- Node.js 18+ (build de `config.js` e testes)
- Python 3 (servidor local opcional) **ou** qualquer static server

## Setup local

### 1. Clonar e dependências

```bash
git clone https://github.com/Miguel-Tobias-Vaz/centro-operacao.git
cd centro-operacao
npm install
```

### 2. Configuração Supabase

1. Crie um projeto no Supabase.
2. Em **Project Settings → API**, copie **Project URL** e **anon public** key.
3. Copie o exemplo de config:

```bash
cp config.example.js config.js
```

4. Edite `config.js`:

```js
window.SUPABASE_URL = "https://SEU_PROJETO.supabase.co";
window.SUPABASE_ANON_KEY = "sua-chave-anon-aqui";
```

`config.js` está no `.gitignore` — não o commitas.

### 3. Base de dados (projeto novo)

No **SQL Editor** do Supabase, execute **nesta ordem**:

1. [`supabase/001_schema_baseline.sql`](supabase/001_schema_baseline.sql) — tabelas, RLS, Storage, trigger de signup  
2. [`supabase/002_admin_excluir_usuario.sql`](supabase/002_admin_excluir_usuario.sql)  
3. [`supabase/003_logs_atividade.sql`](supabase/003_logs_atividade.sql)  
4. [`supabase/004_promover_primeiro_admin.sql`](supabase/004_promover_primeiro_admin.sql)  

Detalhes: [`supabase/README.md`](supabase/README.md) e políticas em [`Doc/supabase-rls.md`](Doc/supabase-rls.md).

### 4. Primeiro administrador

1. Em Authentication, ative o provider **Email**.
2. Crie a primeira conta (signup na app ou no painel Auth).
3. Com essa sessão, no SQL Editor:

```sql
SELECT public.promover_primeiro_admin();
```

Ou, manualmente:

```sql
UPDATE public.profiles
SET role = 'admin', ativo = true
WHERE email = 'seu@email.com';
```

### 5. Servidor local

```bash
npm start
```

Abre [http://localhost:5500](http://localhost:5500) (Python `http.server` na porta 5500).

Ferramentas PDF / Normalizar **precisam de HTTP** (não abras como `file://`).

## Deploy na Vercel

1. Importe o repositório.
2. Defina as variáveis de ambiente:

| Variável | Valor |
|----------|--------|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_ANON_KEY` | chave **anon** (nunca a `service_role`) |

3. O `vercel.json` corre `node scripts/generate-config.js` no build e gera `config.js`.

Não é preciso `outputDirectory` especial além do já configurado (`.` = site estático).

## Scripts npm

| Comando | Descrição |
|---------|-----------|
| `npm start` | Serve estático em `:5500` |
| `npm run build` | Gera `config.js` a partir de env (CI/Vercel) |
| `npm run build:acentos` | Regenera `assets/data/acentos-pt.json(.gz)` |
| `npm run test:nomes` | Testes do motor de renomeação |
| `npm run test:separador` | Testes de lógica do separador PDF |
| `npm test` | Corre `test:nomes` e `test:separador` |

## Segurança (importante)

- A UI esconde ações de admin/editor, mas **a proteção real é o RLS** no Supabase.
- Depois de aplicar o SQL, confirma que RLS está ativo nas tabelas e no Storage.
- Guia: [`Doc/supabase-rls.md`](Doc/supabase-rls.md).

## Documentação extra

- Normalização de nomes: [`Doc/tratamento-nomes.md`](Doc/tratamento-nomes.md)
- Migrations: [`supabase/README.md`](supabase/README.md)

## Stack

- Frontend: HTML/CSS/JS (sem bundler)
- Backend: Supabase (Auth, Postgres, Storage)
- PDF: pdf.js, pdf-lib, docx-preview, html2canvas, jsPDF, JSZip (CDN)
- Hosting: Vercel
