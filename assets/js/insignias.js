/**
 * Insígnias + missões — catálogo, atribuição (insígnia → utilizadores) e perfil.
 */
(() => {
    const BUCKET = "perfis-midia";
    const FALLBACK = [
        {
            id: null,
            slug: "trofeu",
            nome: "Troféu",
            descricao: "Reconhecimento especial da equipa.",
            icone_path: "assets/insignias/trofeu.png",
            ordem: 0
        }
    ];

    let clientCache = null;

    function cliente() {
        if (window.Auth?.getClient) {
            const viaAuth = window.Auth.getClient();
            if (viaAuth) return viaAuth;
        }
        if (clientCache) return clientCache;
        if (window.supabase && window.SUPABASE_URL && window.SUPABASE_ANON_KEY) {
            clientCache = window.supabase.createClient(
                window.SUPABASE_URL,
                window.SUPABASE_ANON_KEY
            );
            return clientCache;
        }
        return null;
    }

    function slugificar(texto) {
        return String(texto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 40);
    }

    function urlIcone(path) {
        if (!path) return "assets/insignias/trofeu.png";
        if (/^https?:\/\//i.test(path)) return path;
        return String(path).replace(/^\//, "");
    }

    function caminhoStorageDeUrl(urlOuPath) {
        if (!urlOuPath || !/^https?:\/\//i.test(urlOuPath)) return null;
        const marker = `/storage/v1/object/public/${BUCKET}/`;
        const idx = urlOuPath.indexOf(marker);
        if (idx === -1) return null;
        return decodeURIComponent(urlOuPath.slice(idx + marker.length).split("?")[0]);
    }

    async function listarCatalogo() {
        const client = cliente();
        if (!client) return FALLBACK.map((x) => ({ ...x }));
        try {
            let { data, error } = await client
                .from("insignias")
                .select("id, slug, nome, descricao, icone_path, ordem")
                .order("nome", { ascending: true });

            if (error && /ordem/i.test(error.message || "")) {
                ({ data, error } = await client
                    .from("insignias")
                    .select("id, slug, nome, descricao, icone_path")
                    .order("nome"));
            }
            if (error) throw error;
            return data || [];
        } catch (erro) {
            console.warn("Insígnias: catálogo indisponível —", erro.message || erro);
            return FALLBACK.map((x) => ({ ...x }));
        }
    }

    async function listarDoPerfil(perfilId) {
        if (!perfilId) return [];
        const client = cliente();
        if (!client) return [];
        try {
            let { data, error } = await client
                .from("perfil_insignias")
                .select("insignia_id, ordem, insignias ( id, slug, nome, descricao, icone_path )")
                .eq("perfil_id", perfilId)
                .order("ordem", { ascending: true });

            if (error && /ordem/i.test(error.message || "")) {
                ({ data, error } = await client
                    .from("perfil_insignias")
                    .select("insignia_id, insignias ( id, slug, nome, descricao, icone_path )")
                    .eq("perfil_id", perfilId));
            }
            if (error) throw error;

            return (data || [])
                .map((row, i) => {
                    if (!row.insignias) return null;
                    return { ...row.insignias, ordem: row.ordem ?? i };
                })
                .filter(Boolean);
        } catch (erro) {
            console.warn("Insígnias: falha ao carregar do perfil —", erro.message || erro);
            return [];
        }
    }

    async function idsDoPerfil(perfilId) {
        const lista = await listarDoPerfil(perfilId);
        return new Set(lista.map((i) => i.id).filter(Boolean));
    }

    async function idsComInsignia(insigniaId) {
        if (!insigniaId) return [];
        const client = cliente();
        if (!client) return [];
        const { data, error } = await client
            .from("perfil_insignias")
            .select("perfil_id")
            .eq("insignia_id", insigniaId);
        if (error) throw error;
        return (data || []).map((r) => r.perfil_id).filter(Boolean);
    }

    /** Substitui quem tem a insígnia pelos perfilIds; preserva ordem já existente em cada perfil. */
    async function definirQuemTem(insigniaId, perfilIds) {
        const client = cliente();
        if (!client || !insigniaId) throw new Error("Sessão inválida.");

        const ids = [];
        const vistos = new Set();
        for (const id of perfilIds || []) {
            if (!id || vistos.has(id)) continue;
            vistos.add(id);
            ids.push(id);
        }
        const adminId = window.Auth?.getPerfil?.()?.id || null;

        const { data: atuais } = await client
            .from("perfil_insignias")
            .select("perfil_id, ordem")
            .eq("insignia_id", insigniaId);
        const ordemAntiga = new Map((atuais || []).map((r) => [r.perfil_id, r.ordem]));

        const { error: delErr } = await client
            .from("perfil_insignias")
            .delete()
            .eq("insignia_id", insigniaId);
        if (delErr) throw delErr;

        if (!ids.length) return;

        const rows = [];
        for (const perfil_id of ids) {
            let ordem = ordemAntiga.has(perfil_id) ? ordemAntiga.get(perfil_id) : null;
            if (ordem == null) {
                const { data: maxRows } = await client
                    .from("perfil_insignias")
                    .select("ordem")
                    .eq("perfil_id", perfil_id)
                    .order("ordem", { ascending: false })
                    .limit(1);
                const max = maxRows?.[0]?.ordem;
                ordem = typeof max === "number" ? max + 1 : 0;
            }
            rows.push({
                perfil_id,
                insignia_id: insigniaId,
                concedida_por: adminId,
                ordem
            });
        }

        let { error: insErr } = await client.from("perfil_insignias").insert(rows);
        if (insErr && /ordem/i.test(insErr.message || "")) {
            const semOrdem = rows.map(({ ordem, ...rest }) => rest);
            ({ error: insErr } = await client.from("perfil_insignias").insert(semOrdem));
        }
        if (insErr) throw insErr;
    }

    /** Define a ordem das insígnias no perfil (como aparecem no front). */
    async function definirOrdemDoPerfil(perfilId, insigniaIdsOrdenados) {
        const client = cliente();
        if (!client || !perfilId) throw new Error("Sessão inválida.");
        const ids = (insigniaIdsOrdenados || []).filter(Boolean);
        for (let i = 0; i < ids.length; i += 1) {
            const { error } = await client
                .from("perfil_insignias")
                .update({ ordem: i })
                .eq("perfil_id", perfilId)
                .eq("insignia_id", ids[i]);
            if (error) {
                if (/ordem/i.test(error.message || "")) {
                    throw new Error("Coluna ordem em falta. Corre 013_insignias_ordem.sql no Supabase.");
                }
                throw error;
            }
        }
    }

    async function enviarIcone(file, slugHint) {
        const client = cliente();
        if (!client) throw new Error("Sessão inválida.");
        if (!file) throw new Error("Escolhe um ficheiro de ícone.");

        const tipo = String(file.type || "").toLowerCase();
        if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(tipo)) {
            throw new Error("Ícone inválido. Usa PNG, JPG, WebP, GIF ou SVG.");
        }
        if (file.size > 2 * 1024 * 1024) {
            throw new Error("Ícone demasiado grande (máx. 2 MB).");
        }

        const sessao = window.Auth?.getSession?.() || (await client.auth.getSession()).data?.session;
        const uid = sessao?.user?.id;
        if (!uid) throw new Error("Sessão inválida.");

        const ext = tipo.includes("svg")
            ? "svg"
            : tipo.includes("jpeg")
                ? "jpg"
                : tipo.includes("webp")
                    ? "webp"
                    : tipo.includes("gif")
                        ? "gif"
                        : "png";
        const base = slugificar(slugHint) || "insignia";
        const caminho = `${uid}/insignias/${base}-${Date.now()}.${ext}`;

        const { error } = await client.storage.from(BUCKET).upload(caminho, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type || `image/${ext}`
        });
        if (error) throw error;

        const { data } = client.storage.from(BUCKET).getPublicUrl(caminho);
        return data?.publicUrl || caminho;
    }

    async function removerIconeStorage(iconePath) {
        const caminho = caminhoStorageDeUrl(iconePath);
        if (!caminho) return;
        const client = cliente();
        if (!client) return;
        try {
            await client.storage.from(BUCKET).remove([caminho]);
        } catch (_) {
            /* ícone legado ou já removido */
        }
    }

    async function proximaOrdemCatalogo() {
        const lista = await listarCatalogo();
        const max = lista.reduce((acc, row) => Math.max(acc, Number(row.ordem) || 0), -1);
        return max + 1;
    }

    async function criarInsignia({ nome, descricao, icone_path, slug, ficheiro }) {
        const client = cliente();
        if (!client) throw new Error("Sessão inválida.");
        const nomeLimpo = String(nome || "").trim();
        if (!nomeLimpo) throw new Error("Indica um nome para a insígnia.");

        const slugFinal = slugificar(slug || nomeLimpo) || `insig-${Date.now()}`;
        let path = String(icone_path || "").trim();
        if (ficheiro) path = await enviarIcone(ficheiro, slugFinal);
        if (!path) path = "assets/insignias/trofeu.png";

        const payload = {
            slug: slugFinal,
            nome: nomeLimpo.slice(0, 80),
            descricao: String(descricao || "").trim().slice(0, 240) || null,
            icone_path: path
        };

        try {
            payload.ordem = await proximaOrdemCatalogo();
        } catch (_) {
            /* coluna pode não existir */
        }

        let { data, error } = await client
            .from("insignias")
            .insert(payload)
            .select("id, slug, nome, descricao, icone_path, ordem")
            .maybeSingle();

        if (error && /ordem/i.test(error.message || "")) {
            delete payload.ordem;
            ({ data, error } = await client
                .from("insignias")
                .insert(payload)
                .select("id, slug, nome, descricao, icone_path")
                .maybeSingle());
            if (data) data.ordem = 0;
        }

        if (error) {
            if (/duplicate|unique/i.test(error.message || "")) {
                throw new Error("Já existe uma insígnia com esse nome/slug. Escolhe outro nome.");
            }
            throw error;
        }
        return data;
    }

    async function atualizarInsignia(id, { nome, descricao, icone_path, ficheiro }) {
        const client = cliente();
        if (!client || !id) throw new Error("Sessão inválida.");

        const { data: atual, error: getErr } = await client
            .from("insignias")
            .select("id, nome, descricao, icone_path")
            .eq("id", id)
            .maybeSingle();
        if (getErr) throw getErr;
        if (!atual) throw new Error("Insígnia não encontrada.");

        const nomeLimpo = String((nome ?? atual.nome) || "").trim();
        if (!nomeLimpo) throw new Error("Indica um nome para a insígnia.");

        let path = icone_path != null ? String(icone_path).trim() : atual.icone_path;
        if (ficheiro) {
            path = await enviarIcone(ficheiro, nomeLimpo);
            if (atual.icone_path && atual.icone_path !== path) {
                await removerIconeStorage(atual.icone_path);
            }
        }

        const { data, error } = await client
            .from("insignias")
            .update({
                nome: nomeLimpo.slice(0, 80),
                descricao: String((descricao ?? atual.descricao) || "").trim().slice(0, 240) || null,
                icone_path: path || atual.icone_path
            })
            .eq("id", id)
            .select("id, slug, nome, descricao, icone_path, ordem")
            .maybeSingle();
        if (error && /ordem/i.test(error.message || "")) {
            const { data: d2, error: e2 } = await client
                .from("insignias")
                .update({
                    nome: nomeLimpo.slice(0, 80),
                    descricao: String((descricao ?? atual.descricao) || "").trim().slice(0, 240) || null,
                    icone_path: path || atual.icone_path
                })
                .eq("id", id)
                .select("id, slug, nome, descricao, icone_path")
                .maybeSingle();
            if (e2) throw e2;
            return d2;
        }
        if (error) throw error;
        return data;
    }

    async function excluirInsignia(id) {
        const client = cliente();
        if (!client || !id) throw new Error("Sessão inválida.");

        const { data: atual } = await client
            .from("insignias")
            .select("icone_path")
            .eq("id", id)
            .maybeSingle();

        const { error } = await client.from("insignias").delete().eq("id", id);
        if (error) throw error;

        if (atual?.icone_path) await removerIconeStorage(atual.icone_path);
    }

    async function listarMissoes(insigniaId = null) {
        const client = cliente();
        if (!client) return [];
        try {
            let q = client
                .from("missoes_insignia")
                .select("id, nome, descricao, insignia_id, ativo, ordem, created_at, insignias ( id, nome, icone_path )")
                .order("ordem", { ascending: true })
                .order("nome", { ascending: true });
            if (insigniaId) q = q.eq("insignia_id", insigniaId);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (erro) {
            console.warn("Missões: indisponíveis —", erro.message || erro);
            return [];
        }
    }

    async function criarMissao({ nome, descricao, insignia_id, ativo = true }) {
        const client = cliente();
        if (!client) throw new Error("Sessão inválida.");
        const nomeLimpo = String(nome || "").trim();
        if (!nomeLimpo) throw new Error("Indica um nome para a missão.");
        if (!insignia_id) throw new Error("Escolhe a insígnia da missão.");

        const existentes = await listarMissoes(insignia_id);
        const ordem = existentes.length;

        const { data, error } = await client
            .from("missoes_insignia")
            .insert({
                nome: nomeLimpo.slice(0, 120),
                descricao: String(descricao || "").trim().slice(0, 500) || null,
                insignia_id,
                ativo: ativo !== false,
                ordem
            })
            .select("id, nome, descricao, insignia_id, ativo, ordem, created_at")
            .maybeSingle();
        if (error) {
            if (/missoes_insignia|schema cache|does not exist/i.test(error.message || "")) {
                throw new Error("Tabela de missões em falta. Corre 014_missoes_insignias.sql no Supabase.");
            }
            throw error;
        }
        return data;
    }

    async function atualizarMissao(id, { nome, descricao, insignia_id, ativo }) {
        const client = cliente();
        if (!client || !id) throw new Error("Sessão inválida.");

        const patch = {};
        if (nome != null) {
            const nomeLimpo = String(nome).trim();
            if (!nomeLimpo) throw new Error("Indica um nome para a missão.");
            patch.nome = nomeLimpo.slice(0, 120);
        }
        if (descricao !== undefined) {
            patch.descricao = String(descricao || "").trim().slice(0, 500) || null;
        }
        if (insignia_id) patch.insignia_id = insignia_id;
        if (ativo !== undefined) patch.ativo = !!ativo;

        const { data, error } = await client
            .from("missoes_insignia")
            .update(patch)
            .eq("id", id)
            .select("id, nome, descricao, insignia_id, ativo, ordem, created_at")
            .maybeSingle();
        if (error) throw error;
        return data;
    }

    async function excluirMissao(id) {
        const client = cliente();
        if (!client || !id) throw new Error("Sessão inválida.");
        const { error } = await client.from("missoes_insignia").delete().eq("id", id);
        if (error) throw error;
    }

    window.Insignias = {
        listarCatalogo,
        listarDoPerfil,
        idsDoPerfil,
        idsComInsignia,
        definirQuemTem,
        definirOrdemDoPerfil,
        criarInsignia,
        atualizarInsignia,
        excluirInsignia,
        listarMissoes,
        criarMissao,
        atualizarMissao,
        excluirMissao,
        urlIcone
    };
})();
