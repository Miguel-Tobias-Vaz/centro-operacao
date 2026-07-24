/**
 * Log de atividades da Central OPTO.
 * Persiste em localStorage e, se existir, na tabela Supabase `logs_atividade`.
 */
const LogsAtividade = (() => {
    const STORAGE_KEY = "centro_logs_atividade";
    const LIMITE_LOCAL = 400;
    let client = null;
    let supabaseDisponivel = null;

    const META_ACAO = {
        Login: { cor: "azul", icone: "log-in" },
        Logout: { cor: "cinza", icone: "log-out" },
        "Criar módulo": { cor: "verde", icone: "package-plus" },
        "Editar módulo": { cor: "azul", icone: "package" },
        "Excluir módulo": { cor: "vermelho", icone: "trash-2" },
        "Upload imagem módulo": { cor: "roxo", icone: "image-up" },
        "Criar publicação": { cor: "verde", icone: "file-plus" },
        "Editar publicação": { cor: "azul", icone: "file-pen" },
        "Excluir publicação": { cor: "vermelho", icone: "trash-2" },
        "Upload arquivo": { cor: "laranja", icone: "upload" },
        "Remover arquivo": { cor: "laranja", icone: "file-x" },
        "Criar categoria": { cor: "verde", icone: "folder-plus" },
        "Editar categoria": { cor: "azul", icone: "folder" },
        "Excluir categoria": { cor: "vermelho", icone: "trash-2" },
        "Reordenar categorias": { cor: "cinza", icone: "arrow-up-down" },
        "Criar usuário": { cor: "verde", icone: "user-plus" },
        "Excluir usuário": { cor: "vermelho", icone: "user-x" },
        "Alterar permissão": { cor: "roxo", icone: "shield" },
        "Ativar usuário": { cor: "verde", icone: "user-check" },
        "Desativar usuário": { cor: "laranja", icone: "user-minus" },
        "Redefinir senha": { cor: "laranja", icone: "key-round" }
    };

    function iniciar(supabaseClient) {
        client = supabaseClient || null;
        supabaseDisponivel = null;
    }

    function lerLocal() {
        try {
            const bruto = localStorage.getItem(STORAGE_KEY);
            const lista = bruto ? JSON.parse(bruto) : [];
            return Array.isArray(lista) ? lista : [];
        } catch {
            return [];
        }
    }

    function gravarLocal(lista) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lista.slice(0, LIMITE_LOCAL)));
        } catch (erro) {
            console.warn("Não foi possível gravar log local:", erro);
        }
    }

    function autorAtual() {
        const perfil = window.Auth?.getPerfil?.();
        const sessao = window.Auth?.getSession?.();
        return {
            usuario_id: perfil?.id || sessao?.user?.id || null,
            usuario_nome: perfil?.nome || sessao?.user?.email || "Sistema",
            usuario_email: perfil?.email || sessao?.user?.email || null
        };
    }

    function criarEntrada(acao, detalhe = "", entidade = null) {
        const autor = autorAtual();
        return {
            id: crypto.randomUUID?.() || `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            criado_em: new Date().toISOString(),
            acao: String(acao || "acao").slice(0, 80),
            detalhe: String(detalhe || "").slice(0, 500),
            entidade: entidade ? String(entidade).slice(0, 80) : null,
            usuario_id: autor.usuario_id,
            usuario_nome: autor.usuario_nome,
            usuario_email: autor.usuario_email
        };
    }

    async function detectarTabela() {
        if (!client) return false;
        if (supabaseDisponivel !== null) return supabaseDisponivel;

        const { error } = await client.from("logs_atividade").select("id").limit(1);
        supabaseDisponivel = !error;
        if (error) {
            console.info("Tabela logs_atividade indisponível; usando log local.", error.message);
        }
        return supabaseDisponivel;
    }

    async function registrar(acao, detalhe = "", entidade = null) {
        const entrada = criarEntrada(acao, detalhe, entidade);

        const locais = lerLocal();
        locais.unshift(entrada);
        gravarLocal(locais);

        try {
            if (await detectarTabela()) {
                const { error } = await client.from("logs_atividade").insert({
                    id: entrada.id,
                    criado_em: entrada.criado_em,
                    acao: entrada.acao,
                    detalhe: entrada.detalhe,
                    entidade: entrada.entidade,
                    usuario_id: entrada.usuario_id,
                    usuario_nome: entrada.usuario_nome,
                    usuario_email: entrada.usuario_email
                });
                if (error) throw error;
            }
        } catch (erro) {
            console.warn("Falha ao gravar log no Supabase:", erro);
        }

        window.dispatchEvent(new CustomEvent("logs:novo", { detail: entrada }));
        return entrada;
    }

    function aplicarFiltros(entradas, filtros = {}) {
        const q = String(filtros.q || "").trim().toLowerCase();
        const entidade = String(filtros.entidade || "").trim().toLowerCase();
        const usuario = String(filtros.usuario || "").trim().toLowerCase();
        const de = filtros.de ? new Date(filtros.de) : null;
        const ate = filtros.ate ? new Date(filtros.ate) : null;

        if (de && !Number.isNaN(de.getTime())) de.setHours(0, 0, 0, 0);
        if (ate && !Number.isNaN(ate.getTime())) ate.setHours(23, 59, 59, 999);

        return entradas.filter((item) => {
            if (entidade && String(item.entidade || "").toLowerCase() !== entidade) return false;

            if (usuario) {
                const nome = String(item.usuario_nome || "").toLowerCase();
                const email = String(item.usuario_email || "").toLowerCase();
                if (!nome.includes(usuario) && !email.includes(usuario)) return false;
            }

            if (de || ate) {
                const t = new Date(item.criado_em).getTime();
                if (Number.isNaN(t)) return false;
                if (de && t < de.getTime()) return false;
                if (ate && t > ate.getTime()) return false;
            }

            if (q) {
                const blob = `${item.acao || ""} ${item.detalhe || ""} ${item.entidade || ""} ${item.usuario_nome || ""} ${item.usuario_email || ""}`.toLowerCase();
                if (!blob.includes(q)) return false;
            }

            return true;
        });
    }

    async function listar(limite = 200, filtros = {}) {
        const locais = lerLocal();
        let remotos = [];

        try {
            if (await detectarTabela()) {
                const { data, error } = await client
                    .from("logs_atividade")
                    .select("*")
                    .order("criado_em", { ascending: false })
                    .limit(Math.max(limite, 300));

                if (error) throw error;
                remotos = data || [];
            }
        } catch (erro) {
            console.warn("Falha ao ler logs do Supabase:", erro);
        }

        const mapa = new Map();
        [...remotos, ...locais].forEach((item) => {
            if (item?.id) mapa.set(item.id, item);
        });

        const unidos = [...mapa.values()].sort((a, b) =>
            String(b.criado_em).localeCompare(String(a.criado_em))
        );

        return aplicarFiltros(unidos, filtros).slice(0, limite);
    }

    function estatisticas(entradas) {
        const agora = Date.now();
        const dia = 24 * 60 * 60 * 1000;
        const ultimas24h = entradas.filter((e) => agora - new Date(e.criado_em).getTime() <= dia);
        const porEntidade = {};
        const porUsuario = {};

        entradas.forEach((e) => {
            const ent = e.entidade || "outro";
            porEntidade[ent] = (porEntidade[ent] || 0) + 1;
            const chave = e.usuario_email || e.usuario_nome || "Sistema";
            porUsuario[chave] = (porUsuario[chave] || 0) + 1;
        });

        const topUsuarios = Object.entries(porUsuario)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([nome, total]) => ({ nome, total }));

        return {
            total: entradas.length,
            ultimas24h: ultimas24h.length,
            porEntidade,
            topUsuarios,
            recentes: entradas.slice(0, 8)
        };
    }

    function formatarData(iso) {
        try {
            return new Date(iso).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        } catch {
            return iso || "—";
        }
    }

    function formatarRelativo(iso) {
        try {
            const diff = Date.now() - new Date(iso).getTime();
            if (Number.isNaN(diff) || diff < 0) return formatarData(iso);
            const min = Math.floor(diff / 60000);
            if (min < 1) return "agora";
            if (min < 60) return `${min} min`;
            const h = Math.floor(min / 60);
            if (h < 24) return `${h} h`;
            const d = Math.floor(h / 24);
            if (d < 7) return `${d} d`;
            return formatarData(iso);
        } catch {
            return formatarData(iso);
        }
    }

    function escapar(texto) {
        return String(texto ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    function metaAcao(acao) {
        return META_ACAO[acao] || { cor: "cinza", icone: "activity" };
    }

    function montarItemHtml(item, { relativo = false } = {}) {
        const meta = metaAcao(item.acao);
        const quando = relativo ? formatarRelativo(item.criado_em) : formatarData(item.criado_em);
        return `
            <article class="log-item log-item--${meta.cor}" data-entidade="${escapar(item.entidade || "")}">
                <div class="log-item-icone" aria-hidden="true">
                    <i data-lucide="${meta.icone}"></i>
                </div>
                <div class="log-item-corpo">
                    <div class="log-item-topo">
                        <span class="log-acao">${escapar(item.acao)}</span>
                        <time class="log-data" datetime="${escapar(item.criado_em)}" title="${escapar(formatarData(item.criado_em))}">${escapar(quando)}</time>
                    </div>
                    <p class="log-detalhe">${escapar(item.detalhe || "—")}</p>
                    <p class="log-autor">
                        ${escapar(item.usuario_nome || "Sistema")}
                        ${item.usuario_email ? ` · ${escapar(item.usuario_email)}` : ""}
                        ${item.entidade ? ` · <span class="log-entidade">${escapar(item.entidade)}</span>` : ""}
                    </p>
                </div>
            </article>
        `;
    }

    async function renderizar(containerId = "lista-logs", opcoes = {}) {
        const lista = document.getElementById(containerId);
        if (!lista) return [];

        lista.innerHTML = `<p class="lista-vazia">Carregando log…</p>`;

        try {
            const entradas = await listar(opcoes.limite || 150, opcoes.filtros || {});

            if (!entradas.length) {
                lista.innerHTML = `<p class="lista-vazia">Nenhuma atividade encontrada com estes filtros.</p>`;
                return [];
            }

            lista.innerHTML = entradas
                .map((item) => montarItemHtml(item, { relativo: !!opcoes.relativo }))
                .join("");

            if (window.lucide?.createIcons) window.lucide.createIcons();
            return entradas;
        } catch (erro) {
            console.error(erro);
            lista.innerHTML = `<p class="lista-vazia">Não foi possível carregar o log.</p>`;
            return [];
        }
    }

    function listarUsuariosUnicos(entradas) {
        const set = new Map();
        entradas.forEach((e) => {
            const email = e.usuario_email || "";
            const nome = e.usuario_nome || "Sistema";
            const chave = email || nome;
            if (!set.has(chave)) set.set(chave, { nome, email });
        });
        return [...set.values()].sort((a, b) => a.nome.localeCompare(b.nome, "pt"));
    }

    return {
        iniciar,
        registrar,
        listar,
        estatisticas,
        renderizar,
        formatarData,
        formatarRelativo,
        metaAcao,
        montarItemHtml,
        listarUsuariosUnicos,
        detectarTabela
    };
})();

window.LogsAtividade = LogsAtividade;
