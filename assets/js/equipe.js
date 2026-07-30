/**
 * Página Equipe — lista de perfis com pesquisa.
 */
(() => {
    const BUCKET_PERFIS = "perfis-midia";

    let supabaseClient = null;
    let membros = [];
    let termo = "";

    function configValida() {
        return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY
            && !String(window.SUPABASE_URL).includes("SEU_PROJETO"));
    }

    function mostrarLoading(ativo) {
        const el = document.getElementById("loading");
        if (el) el.hidden = !ativo;
    }

    function inicialDe(nome) {
        const t = String(nome || "?").trim();
        return (t[0] || "?").toUpperCase();
    }

    function urlAvatar(caminho) {
        if (!caminho || !supabaseClient) return "";
        if (/^https?:\/\//i.test(caminho)) return caminho;
        const { data } = supabaseClient.storage.from(BUCKET_PERFIS).getPublicUrl(caminho);
        return data?.publicUrl || "";
    }

    function rotuloRole(role) {
        if (role === "admin") return "Admin";
        if (role === "editor") return "Editor";
        return role || "Membro";
    }

    function normalizarBusca(texto) {
        return String(texto || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    function filtrar(lista) {
        const q = normalizarBusca(termo);
        if (!q) return lista;
        return lista.filter((m) => {
            const blob = normalizarBusca([m.nome, m.cargo, m.email, m.role].filter(Boolean).join(" "));
            return blob.includes(q);
        });
    }

    function atualizarContagem(visiveis, total) {
        const el = document.getElementById("equipe-contagem");
        if (!el) return;
        if (!total) {
            el.textContent = "";
            return;
        }
        if (termo.trim()) {
            el.textContent = `${visiveis} de ${total}`;
            return;
        }
        el.textContent = total === 1 ? "1 membro" : `${total} membros`;
    }

    function montarAvatar(pessoa) {
        const wrap = document.createElement("div");
        wrap.className = "equipe-card-avatar";
        const url = urlAvatar(pessoa.avatar_url);
        if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = "";
            img.decoding = "async";
            img.loading = "lazy";
            img.onerror = () => {
                img.remove();
                const span = document.createElement("span");
                span.className = "equipe-card-inicial";
                span.textContent = inicialDe(pessoa.nome || pessoa.email);
                wrap.appendChild(span);
            };
            wrap.appendChild(img);
        } else {
            const span = document.createElement("span");
            span.className = "equipe-card-inicial";
            span.textContent = inicialDe(pessoa.nome || pessoa.email);
            wrap.appendChild(span);
        }
        return wrap;
    }

    function renderizar() {
        const listaEl = document.getElementById("equipe-lista");
        const vazioEl = document.getElementById("equipe-vazio");
        if (!listaEl) return;

        const euId = window.Auth?.getPerfil?.()?.id || window.Auth?.getSession?.()?.user?.id || null;
        const visiveis = filtrar(membros);
        listaEl.replaceChildren();

        atualizarContagem(visiveis.length, membros.length);

        if (!visiveis.length) {
            if (vazioEl) {
                vazioEl.hidden = false;
                vazioEl.textContent = termo.trim()
                    ? "Nenhum membro corresponde à pesquisa."
                    : "Ainda não há membros ativos.";
            }
            return;
        }

        if (vazioEl) vazioEl.hidden = true;

        visiveis.forEach((pessoa) => {
            const card = document.createElement("a");
            card.href = `perfil.html?id=${encodeURIComponent(pessoa.id)}`;
            card.className = "equipe-card";
            card.setAttribute("role", "listitem");
            if (euId && pessoa.id === euId) card.classList.add("is-eu");

            const texto = document.createElement("div");
            texto.className = "equipe-card-texto";

            const nome = document.createElement("span");
            nome.className = "equipe-card-nome";
            nome.textContent = pessoa.nome || pessoa.email || "Utilizador";

            const cargo = document.createElement("span");
            cargo.className = "equipe-card-cargo";
            cargo.textContent = pessoa.cargo || "Sem cargo definido";

            const meta = document.createElement("div");
            meta.className = "equipe-card-meta";

            const badge = document.createElement("span");
            badge.className = "equipe-card-badge";
            badge.textContent = rotuloRole(pessoa.role);
            meta.appendChild(badge);

            if (euId && pessoa.id === euId) {
                const eu = document.createElement("span");
                eu.className = "equipe-card-eu";
                eu.textContent = "Tu";
                meta.appendChild(eu);
            }

            texto.append(nome, cargo, meta);
            card.append(montarAvatar(pessoa), texto);
            listaEl.appendChild(card);
        });
    }

    function mostrarAviso(texto) {
        const aviso = document.getElementById("equipe-aviso");
        const lista = document.getElementById("equipe-lista");
        const vazio = document.getElementById("equipe-vazio");
        if (lista) lista.replaceChildren();
        if (vazio) vazio.hidden = true;
        if (aviso) {
            aviso.hidden = !texto;
            aviso.textContent = texto || "";
        }
        atualizarContagem(0, 0);
    }

    async function carregarEquipe() {
        const sessao = window.Auth?.getSession?.();
        if (!sessao?.user) {
            mostrarAviso("Entra na tua conta para ver a equipe.");
            window.Auth?.abrirModalLogin?.();
            return;
        }

        mostrarAviso("");
        mostrarLoading(true);

        try {
            const todos = await window.Auth.listarUsuarios();
            membros = (todos || [])
                .filter((u) => u && u.ativo !== false)
                .sort((a, b) => {
                    const na = String(a.nome || a.email || "").toLocaleLowerCase("pt");
                    const nb = String(b.nome || b.email || "").toLocaleLowerCase("pt");
                    return na.localeCompare(nb, "pt");
                });

            const sub = document.getElementById("equipe-sub");
            if (sub) sub.textContent = "Perfis da Central OPTO — clica para visitar";
            renderizar();
        } catch (erro) {
            console.error(erro);
            mostrarAviso(`Não foi possível carregar a equipe: ${erro.message || erro}`);
        } finally {
            mostrarLoading(false);
        }
    }

    function ligarEventos() {
        const buscas = [
            document.getElementById("equipe-busca"),
            document.getElementById("equipe-busca-painel")
        ].filter(Boolean);

        const aplicarTermo = (origem) => {
            termo = origem.value || "";
            buscas.forEach((el) => {
                if (el !== origem && el.value !== termo) el.value = termo;
            });
            renderizar();
        };

        buscas.forEach((el) => {
            el.addEventListener("input", () => aplicarTermo(el));
        });

        document.addEventListener("keydown", (e) => {
            if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
            const alvo = buscas.find((el) => el.offsetParent !== null) || buscas[0];
            if (!alvo) return;
            e.preventDefault();
            alvo.focus();
            alvo.select();
        });
    }

    async function iniciar() {
        if (!configValida()) {
            document.getElementById("erro-config")?.removeAttribute("hidden");
            return;
        }

        if (typeof aplicarTemaFerramenta === "function") {
            const botaoTema = document.getElementById("tema");
            aplicarTemaFerramenta(localStorage.getItem("tema") === "claro", botaoTema);
            if (botaoTema) {
                const claro = document.body.classList.contains("tema-claro");
                botaoTema.textContent = claro ? "☾" : "◐";
                botaoTema.title = claro ? "Tema escuro" : "Tema claro";
            }
        }
        if (typeof carregarCorDestaqueSalva === "function") {
            carregarCorDestaqueSalva();
        }

        supabaseClient = window.supabase.createClient(
            window.SUPABASE_URL,
            window.SUPABASE_ANON_KEY
        );

        window.LogsAtividade?.iniciar(supabaseClient);
        ligarEventos();

        try {
            await window.Auth.iniciar(supabaseClient);
        } catch (erro) {
            console.error("Erro ao iniciar autenticação:", erro);
        }

        window.addEventListener("auth:changed", () => {
            carregarEquipe();
        });

        await carregarEquipe();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
