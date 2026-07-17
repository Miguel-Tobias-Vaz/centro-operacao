/**
 * Log de atividades da Central OPTO.
 * Persiste em localStorage e, se existir, na tabela Supabase `logs_atividade`.
 */
const LogsAtividade = (() => {
    const STORAGE_KEY = "centro_logs_atividade";
    const LIMITE_LOCAL = 300;
    let client = null;
    let supabaseDisponivel = null;

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

        return entrada;
    }

    async function listar(limite = 100) {
        const locais = lerLocal();
        let remotos = [];

        try {
            if (await detectarTabela()) {
                const { data, error } = await client
                    .from("logs_atividade")
                    .select("*")
                    .order("criado_em", { ascending: false })
                    .limit(limite);

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

        return [...mapa.values()]
            .sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)))
            .slice(0, limite);
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

    function escapar(texto) {
        return String(texto ?? "")
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;");
    }

    async function renderizar(containerId = "lista-logs") {
        const lista = document.getElementById(containerId);
        if (!lista) return;

        lista.innerHTML = `<p class="lista-vazia">Carregando log…</p>`;

        try {
            const entradas = await listar(150);

            if (!entradas.length) {
                lista.innerHTML = `<p class="lista-vazia">Nenhuma atividade registrada ainda.</p>`;
                return;
            }

            lista.replaceChildren();
            entradas.forEach((item) => {
                const el = document.createElement("article");
                el.className = "log-item";
                el.innerHTML = `
                    <div class="log-item-topo">
                        <span class="log-acao">${escapar(item.acao)}</span>
                        <time class="log-data" datetime="${escapar(item.criado_em)}">${escapar(formatarData(item.criado_em))}</time>
                    </div>
                    <p class="log-detalhe">${escapar(item.detalhe || "—")}</p>
                    <p class="log-autor">${escapar(item.usuario_nome || "Sistema")}${item.usuario_email ? ` · ${escapar(item.usuario_email)}` : ""}</p>
                `;
                lista.appendChild(el);
            });
        } catch (erro) {
            console.error(erro);
            lista.innerHTML = `<p class="lista-vazia">Não foi possível carregar o log.</p>`;
        }
    }

    return { iniciar, registrar, listar, renderizar };
})();

window.LogsAtividade = LogsAtividade;
