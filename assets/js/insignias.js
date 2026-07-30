/**
 * Insígnias de perfil — catálogo + atribuições (admin).
 */
(() => {
    const BUCKET = "perfis-midia";
    const FALLBACK = [
        {
            id: null,
            slug: "trofeu",
            nome: "Troféu",
            descricao: "Reconhecimento especial da equipa.",
            icone_path: "assets/insignias/trofeu.png"
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
            const { data, error } = await client
                .from("insignias")
                .select("id, slug, nome, descricao, icone_path")
                .order("nome");
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
            const { data, error } = await client
                .from("perfil_insignias")
                .select("insignia_id, insignias ( id, slug, nome, descricao, icone_path )")
                .eq("perfil_id", perfilId);
            if (error) throw error;
            return (data || [])
                .map((row) => row.insignias)
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

    async function definirDoPerfil(perfilId, insigniaIds) {
        const client = cliente();
        if (!client || !perfilId) throw new Error("Sessão inválida.");

        const ids = [...new Set((insigniaIds || []).filter(Boolean))];
        const adminId = window.Auth?.getPerfil?.()?.id || null;

        const { error: delErr } = await client
            .from("perfil_insignias")
            .delete()
            .eq("perfil_id", perfilId);
        if (delErr) throw delErr;

        if (!ids.length) return;

        const rows = ids.map((insignia_id) => ({
            perfil_id: perfilId,
            insignia_id,
            concedida_por: adminId
        }));

        const { error: insErr } = await client.from("perfil_insignias").insert(rows);
        if (insErr) throw insErr;
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

    async function criarInsignia({ nome, descricao, icone_path, slug, ficheiro }) {
        const client = cliente();
        if (!client) throw new Error("Sessão inválida.");
        const nomeLimpo = String(nome || "").trim();
        if (!nomeLimpo) throw new Error("Indica um nome para a insígnia.");

        const slugFinal = slugificar(slug || nomeLimpo) || `insig-${Date.now()}`;
        let path = String(icone_path || "").trim();
        if (ficheiro) {
            path = await enviarIcone(ficheiro, slugFinal);
        }
        if (!path) path = "assets/insignias/trofeu.png";

        const { data, error } = await client
            .from("insignias")
            .insert({
                slug: slugFinal,
                nome: nomeLimpo.slice(0, 80),
                descricao: String(descricao || "").trim().slice(0, 240) || null,
                icone_path: path
            })
            .select("id, slug, nome, descricao, icone_path")
            .maybeSingle();
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
            .select("id, slug, nome, descricao, icone_path")
            .maybeSingle();
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

    window.Insignias = {
        listarCatalogo,
        listarDoPerfil,
        idsDoPerfil,
        definirDoPerfil,
        criarInsignia,
        atualizarInsignia,
        excluirInsignia,
        enviarIcone,
        urlIcone
    };
})();
