/**
 * Página de perfil (MVP estilo Steam → trabalho).
 */
(() => {
    const BUCKET_PERFIS = "perfis-midia";
    const CAMPOS_PERFIL =
        "id, email, nome, role, ativo, created_at, bio, cargo, avatar_url, fundo_url, cor_destaque, tema_perfil, barra_esq_url, barra_dir_url, barra_esq_cor, barra_dir_cor, meio_cor, anotacoes, avatar_pos, fundo_pos, barra_esq_pos, barra_dir_pos";
    const CAMPOS_PERFIL_FALLBACK = "id, email, nome, role, created_at";
    const CAMPOS_PERFIL_SEM_POS =
        "id, email, nome, role, ativo, created_at, bio, cargo, avatar_url, fundo_url, cor_destaque, tema_perfil, barra_esq_url, barra_dir_url, barra_esq_cor, barra_dir_cor, meio_cor, anotacoes";
    const CAMPOS_PERFIL_SEM_BARRAS =
        "id, email, nome, role, ativo, created_at, bio, cargo, avatar_url, fundo_url, cor_destaque, tema_perfil, anotacoes";
    const CAMPOS_PERFIL_SEM_ANOTACOES =
        "id, email, nome, role, ativo, created_at, bio, cargo, avatar_url, fundo_url, cor_destaque, tema_perfil, barra_esq_url, barra_dir_url, barra_esq_cor, barra_dir_cor, meio_cor";

    let supabaseClient = null;
    let perfilVisitado = null;
    let avatarPendente = null;
    let avatarPreviaObjectUrl = null;
    let fundoPendente = null;
    let removerAvatar = false;
    let removerFundo = false;
    let avatarPosEdit = "50% 50%";
    let fundoPosEdit = "50% 50%";
    let panAvatar = null;
    let panFundo = null;

    function configValida() {
        return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY
            && !String(window.SUPABASE_URL).includes("SEU_PROJETO"));
    }

    function mostrarLoading(ativo) {
        const el = document.getElementById("loading");
        if (el) el.hidden = !ativo;
    }

    function mostrarAviso(texto) {
        const shell = document.getElementById("perfil-shell");
        const aviso = document.getElementById("perfil-aviso");
        if (shell) shell.hidden = true;
        if (aviso) {
            aviso.hidden = false;
            aviso.textContent = texto;
        }
    }

    function escapar(texto) {
        const div = document.createElement("div");
        div.textContent = texto ?? "";
        return div.innerHTML;
    }

    function inicialDe(nome) {
        return (String(nome || "?").trim().charAt(0) || "?").toUpperCase();
    }

    function normalizarHex(cor) {
        const raw = String(cor || "").trim();
        if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase();
        if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
            const [, a, b, c] = raw;
            return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
        }
        return "#2b8cff";
    }

    function urlPublica(caminho) {
        if (!caminho || !supabaseClient) return "";
        if (/^https?:\/\//i.test(caminho)) return caminho;
        const { data } = supabaseClient.storage.from(BUCKET_PERFIS).getPublicUrl(caminho);
        return data?.publicUrl || "";
    }

    function idDaUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get("id") || params.get("u") || null;
    }

    function ehDono() {
        const eu = window.Auth?.getPerfil?.()?.id || window.Auth?.getSession?.()?.user?.id;
        return !!(eu && perfilVisitado?.id && eu === perfilVisitado.id);
    }

    function rotuloRole(role) {
        if (role === "admin") return "Administrador";
        if (role === "editor") return "Editor";
        return role || "Utilizador";
    }

    function formatarDesde(iso) {
        try {
            return new Date(iso).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "long",
                year: "numeric"
            });
        } catch {
            return "—";
        }
    }

    function posicaoDe(valor) {
        return window.ImagemPosicao?.normalizar?.(valor) || "50% 50%";
    }

    function caminhoPareceGif(caminho) {
        return /\.gif(\?|#|$)/i.test(String(caminho || ""));
    }

    function garantirWallpaper(el, url, ehGif, pos) {
        if (!el) return null;
        let img = el.querySelector("img.perfil-fundo-gif, img.perfil-fundo-img");
        if (!img) {
            img = document.createElement("img");
            img.alt = "";
            el.prepend(img);
        }
        img.className = ehGif ? "perfil-fundo-gif is-gif" : "perfil-fundo-img";
        img.classList.toggle("is-gif", !!ehGif);
        if (img.getAttribute("src") !== url) img.src = url;
        window.ImagemPosicao?.aplicarImg?.(img, posicaoDe(pos));
        return img;
    }

    function limparWallpaper(el) {
        el?.querySelectorAll("img.perfil-fundo-gif, img.perfil-fundo-img").forEach((n) => n.remove());
    }

    function defaultsDoTema(tema) {
        const claro = tema === "claro";
        return {
            meio: claro ? "#eef2f7" : "#131722"
        };
    }

    function ehCorDefaultTema(hex) {
        const n = normalizarHex(hex);
        return n === "#eef2f7" || n === "#131722" || n === "#d5dde8" || n === "#0b0e13" || n === "#10141c";
    }

    function aplicarTemaVisual(perfil) {
        const cor = normalizarHex(perfil?.cor_destaque);
        const tema = perfil?.tema_perfil === "claro" ? "claro" : "escuro";
        const defs = defaultsDoTema(tema);
        const meio = normalizarHex(perfil?.meio_cor || defs.meio);

        document.body.style.setProperty("--perfil-destaque", cor);
        document.documentElement.style.setProperty("--perfil-destaque", cor);
        document.body.style.setProperty("--perfil-meio-cor", meio);
        document.body.classList.toggle("perfil-tema-claro", tema === "claro");

        const fundo = document.getElementById("perfil-fundo");
        let temWallpaper = false;
        if (fundo) {
            const url = urlPublica(perfil?.fundo_url);
            if (url) {
                temWallpaper = true;
                const ehGif = caminhoPareceGif(perfil?.fundo_url) || caminhoPareceGif(url);
                fundo.classList.add("tem-imagem");
                fundo.classList.toggle("tem-gif", ehGif);
                fundo.style.backgroundImage = "none";
                fundo.style.removeProperty("--perfil-fundo-img");
                garantirWallpaper(fundo, url, ehGif, perfil?.fundo_pos);
            } else {
                fundo.classList.remove("tem-imagem", "tem-gif");
                limparWallpaper(fundo);
                fundo.style.removeProperty("--perfil-fundo-img");
                fundo.style.backgroundImage = "";
                fundo.style.backgroundPosition = "";
            }
        }
        document.body.classList.toggle("tem-wallpaper", temWallpaper);
    }

    function sincronizarValorCor(inputId, valorId) {
        const input = document.getElementById(inputId);
        const rotulo = document.getElementById(valorId);
        if (!input || !rotulo) return;
        rotulo.textContent = normalizarHex(input.value);
    }

    function ligarCamposCor() {
        const pares = [
            ["perfil-edit-cor", "perfil-edit-cor-valor"],
            ["perfil-edit-meio-cor", "perfil-edit-meio-cor-valor"]
        ];
        pares.forEach(([inputId, valorId]) => {
            const input = document.getElementById(inputId);
            if (!input) return;
            const atualizar = () => {
                sincronizarValorCor(inputId, valorId);
                preverTemaNoModal();
            };
            input.addEventListener("input", atualizar);
            sincronizarValorCor(inputId, valorId);
        });
    }

    function preverTemaNoModal() {
        if (!perfilVisitado || !ehDono()) return;
        const tema = document.getElementById("perfil-edit-tema")?.value === "claro" ? "claro" : "escuro";
        const defs = defaultsDoTema(tema);
        const meioInput = document.getElementById("perfil-edit-meio-cor");

        if (meioInput && ehCorDefaultTema(meioInput.value)) meioInput.value = defs.meio;

        aplicarTemaVisual({
            ...perfilVisitado,
            tema_perfil: tema,
            cor_destaque: document.getElementById("perfil-edit-cor")?.value || perfilVisitado.cor_destaque,
            meio_cor: meioInput?.value || defs.meio,
            fundo_url: removerFundo ? null : perfilVisitado.fundo_url
        });

        sincronizarValorCor("perfil-edit-cor", "perfil-edit-cor-valor");
        sincronizarValorCor("perfil-edit-meio-cor", "perfil-edit-meio-cor-valor");
    }

    function preencherAvatarPerfil(perfil) {
        const wrap = document.getElementById("perfil-avatar-wrap");
        if (!wrap) return;
        const url = urlPublica(perfil?.avatar_url);
        const nome = perfil?.nome || perfil?.email || "?";

        wrap.replaceChildren();
        if (url) {
            const img = document.createElement("img");
            img.src = url;
            img.alt = "";
            if (caminhoPareceGif(perfil?.avatar_url) || caminhoPareceGif(url)) {
                img.classList.add("is-gif");
            } else {
                img.loading = "lazy";
            }
            window.ImagemPosicao?.aplicarImg?.(img, posicaoDe(perfil?.avatar_pos));
            wrap.appendChild(img);
        } else {
            const span = document.createElement("span");
            span.className = "perfil-avatar-inicial";
            span.id = "perfil-avatar-inicial";
            span.textContent = inicialDe(nome);
            wrap.appendChild(span);
        }
    }

    function renderizarCabecalho(perfil) {
        document.getElementById("perfil-nome").textContent = perfil.nome || perfil.email || "Utilizador";
        document.getElementById("perfil-cargo").textContent = perfil.cargo || "";
        document.getElementById("perfil-bio").textContent = perfil.bio || "";
        document.getElementById("perfil-role-badge").textContent = rotuloRole(perfil.role);
        document.getElementById("perfil-email").textContent = perfil.email || "—";
        document.getElementById("perfil-desde").textContent = formatarDesde(perfil.created_at);

        const status = document.getElementById("perfil-status");
        const ativo = perfil.ativo !== false;
        status.textContent = ativo ? "Conta ativa" : "Acesso desligado";
        status.classList.toggle("is-ativo", ativo);
        status.classList.toggle("is-inativo", !ativo);

        const btnEditar = document.getElementById("btn-editar-perfil");
        if (btnEditar) btnEditar.hidden = !ehDono();

        document.title = `${perfil.nome || "Perfil"} — Central OPTO`;
        preencherAvatarPerfil(perfil);
        aplicarTemaVisual(perfil);
        renderizarAnotacoes(perfil);
    }

    function ajustarAlturaAnotacoes() {
        const input = document.getElementById("perfil-anotacoes-input");
        if (!input || input.hidden) return;
        input.style.height = "auto";
        input.style.height = `${Math.max(96, input.scrollHeight)}px`;
    }

    function renderizarAnotacoes(perfil) {
        const leitura = document.getElementById("perfil-anotacoes-leitura");
        const edicao = document.getElementById("perfil-anotacoes-edicao");
        const input = document.getElementById("perfil-anotacoes-input");
        const sub = document.getElementById("perfil-anotacoes-sub");
        const status = document.getElementById("perfil-anotacoes-status");
        const texto = String(perfil?.anotacoes || "").trim();

        if (status) {
            status.textContent = "";
            status.classList.remove("is-ok", "is-erro");
        }

        if (ehDono()) {
            if (leitura) leitura.hidden = true;
            if (edicao) edicao.hidden = false;
            if (input) input.value = perfil?.anotacoes || "";
            if (sub) sub.textContent = "Visível para quem visita o teu perfil";
            requestAnimationFrame(() => ajustarAlturaAnotacoes());
            return;
        }

        if (edicao) edicao.hidden = true;
        if (leitura) {
            leitura.hidden = false;
            if (texto) {
                leitura.textContent = texto;
                leitura.classList.remove("is-vazio");
            } else {
                leitura.textContent = "Sem anotações neste perfil.";
                leitura.classList.add("is-vazio");
            }
        }
        if (sub) sub.textContent = texto ? "Notas do perfil" : "Nada publicado";
    }

    async function guardarAnotacoes() {
        if (!ehDono() || !perfilVisitado) return;

        const input = document.getElementById("perfil-anotacoes-input");
        const status = document.getElementById("perfil-anotacoes-status");
        const btn = document.getElementById("btn-guardar-anotacoes");
        const valor = String(input?.value || "").slice(0, 2000);

        if (btn) btn.disabled = true;
        if (status) {
            status.textContent = "A guardar…";
            status.classList.remove("is-ok", "is-erro");
        }

        try {
            const { data, error } = await supabaseClient
                .from("profiles")
                .update({ anotacoes: valor || null })
                .eq("id", perfilVisitado.id)
                .select("anotacoes")
                .maybeSingle();

            if (error) throw error;

            perfilVisitado.anotacoes = data?.anotacoes ?? valor;
            if (status) {
                status.textContent = "Guardado";
                status.classList.add("is-ok");
            }
            window.LogsAtividade?.registrar("Editar anotações", perfilVisitado.nome || "", "usuario");
        } catch (erro) {
            console.error(erro);
            if (status) {
                status.textContent = erro.message?.includes("anotacoes")
                    ? "Corre a migration 007 no Supabase"
                    : (erro.message || "Erro ao guardar");
                status.classList.add("is-erro");
            }
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    const LIMITE_ATIVIDADE_PERFIL = 12;

    function contagensAtividade(entradas) {
        let modulos = 0;
        let publicacoes = 0;
        entradas.forEach((e) => {
            if (e.entidade === "modulo") modulos += 1;
            if (e.entidade === "publicacao") publicacoes += 1;
        });
        return { total: entradas.length, modulos, publicacoes };
    }

    function renderizarAtividade(entradas) {
        const lista = document.getElementById("perfil-atividade-lista");
        const sub = document.getElementById("perfil-atividade-sub");
        if (!lista) return;

        const visiveis = entradas.slice(0, LIMITE_ATIVIDADE_PERFIL);
        lista.replaceChildren();
        const contagens = contagensAtividade(visiveis);
        document.getElementById("metrica-total").textContent = String(contagens.total);
        document.getElementById("metrica-modulos").textContent = String(contagens.modulos);
        document.getElementById("metrica-publicacoes").textContent = String(contagens.publicacoes);

        if (sub) {
            sub.textContent = contagens.total === 0
                ? "Sem ações recentes"
                : contagens.total === 1
                    ? "Última ação"
                    : `Últimas ${contagens.total} ações`;
        }

        if (!visiveis.length) {
            const vazio = document.createElement("p");
            vazio.className = "lista-vazia";
            vazio.textContent = "Ainda sem atividade registada neste perfil.";
            lista.appendChild(vazio);
            return;
        }

        visiveis.forEach((item) => {
            const row = document.createElement("article");
            row.className = "perfil-atividade-item";
            row.innerHTML = `
                <span class="perfil-atividade-dot" aria-hidden="true"></span>
                <div>
                    <p class="perfil-atividade-acao">${escapar(item.acao || "Ação")}</p>
                    ${item.detalhe ? `<p class="perfil-atividade-detalhe">${escapar(item.detalhe)}</p>` : ""}
                </div>
                <time class="perfil-atividade-data">${escapar(window.LogsAtividade?.formatarData?.(item.criado_em) || item.criado_em || "")}</time>
            `;
            lista.appendChild(row);
        });
    }

    async function carregarAtividade(usuarioId) {
        if (!usuarioId || !window.LogsAtividade?.listar) {
            renderizarAtividade([]);
            return;
        }
        const entradas = await window.LogsAtividade.listar(LIMITE_ATIVIDADE_PERFIL, { usuario_id: usuarioId });
        renderizarAtividade(entradas);
    }

    async function carregarPerfil(id) {
        const tentativas = [
            CAMPOS_PERFIL,
            CAMPOS_PERFIL_SEM_POS,
            CAMPOS_PERFIL_SEM_ANOTACOES,
            CAMPOS_PERFIL_SEM_BARRAS,
            CAMPOS_PERFIL_FALLBACK
        ];

        let data = null;
        let error = null;

        for (const campos of tentativas) {
            ({ data, error } = await supabaseClient
                .from("profiles")
                .select(campos)
                .eq("id", id)
                .maybeSingle());

            if (!error) return data;

            const msg = error.message || "";
            const code = error.code || "";
            const colunaEmFalta = code === "42703" || code === "PGRST204" || /column|schema cache/i.test(msg);
            if (!colunaEmFalta) break;
        }

        if (error) throw error;
        return data;
    }

    async function abrirPagina() {
        const sessao = window.Auth?.getSession?.();
        if (!sessao?.user) {
            mostrarAviso("Entre na sua conta para ver perfis da equipa.");
            window.Auth?.abrirModalLogin?.();
            return;
        }

        const alvoId = idDaUrl() || sessao.user.id;
        mostrarLoading(true);

        try {
            const perfil = await carregarPerfil(alvoId);
            if (!perfil) {
                mostrarAviso("Perfil não encontrado.");
                return;
            }

            perfilVisitado = perfil;
            if (perfil.ativo == null) perfilVisitado.ativo = true;

            document.getElementById("perfil-aviso").hidden = true;
            document.getElementById("perfil-shell").hidden = false;
            renderizarCabecalho(perfilVisitado);
            await carregarAtividade(perfilVisitado.id);
        } catch (erro) {
            console.error(erro);
            mostrarAviso(`Não foi possível carregar o perfil: ${erro.message || erro}`);
        } finally {
            mostrarLoading(false);
        }
    }

    function limparAvatarPreviaObjectUrl() {
        if (avatarPreviaObjectUrl) {
            URL.revokeObjectURL(avatarPreviaObjectUrl);
            avatarPreviaObjectUrl = null;
        }
    }

    function limparObjectUrl(ref) {
        if (ref.url) {
            URL.revokeObjectURL(ref.url);
            ref.url = null;
        }
    }

    const fundoPreviaRef = { url: null };

    function garantirPanAvatar() {
        const wrap = document.getElementById("perfil-avatar-previa");
        if (!wrap || !window.ImagemPosicao) return;
        if (!panAvatar) {
            panAvatar = window.ImagemPosicao.ligarPan(wrap, {
                modo: "img",
                posicao: avatarPosEdit,
                onChange: (p) => {
                    avatarPosEdit = p;
                }
            });
        } else {
            panAvatar.setPos(avatarPosEdit);
            panAvatar.refresh();
        }
        const dica = document.getElementById("perfil-avatar-pos-dica");
        if (dica) dica.hidden = !wrap.querySelector("img");
    }

    function atualizarPreviaBg(idPrevia, idDica, src, pos, panRef, onChange) {
        const el = document.getElementById(idPrevia);
        const dica = document.getElementById(idDica);
        if (!el) return null;

        if (!src) {
            el.hidden = true;
            el.style.backgroundImage = "";
            el.classList.remove("img-pos-arrastavel", "is-arrastando");
            if (dica) dica.hidden = true;
            panRef?.destroy?.();
            return null;
        }

        el.hidden = false;
        el.style.backgroundImage = `url("${src}")`;
        if (dica) dica.hidden = false;

        if (panRef) {
            panRef.setPos(pos);
            panRef.refresh();
            return panRef;
        }
        if (!window.ImagemPosicao) return null;
        return window.ImagemPosicao.ligarPan(el, {
            modo: "bg",
            posicao: pos,
            onChange
        });
    }

    function atualizarAvatarPrevia({ url = "", file = null, limpar = false } = {}) {
        const wrap = document.getElementById("perfil-avatar-previa");
        if (!wrap) return;

        limparAvatarPreviaObjectUrl();
        wrap.replaceChildren();

        if (limpar) {
            const span = document.createElement("span");
            span.className = "perfil-avatar-previa-inicial";
            span.id = "perfil-avatar-previa-inicial";
            span.textContent = inicialDe(perfilVisitado?.nome || perfilVisitado?.email || "?");
            wrap.appendChild(span);
            wrap.classList.remove("img-pos-arrastavel", "is-arrastando");
            const dica = document.getElementById("perfil-avatar-pos-dica");
            if (dica) dica.hidden = true;
            return;
        }

        let src = "";
        if (file) {
            avatarPreviaObjectUrl = URL.createObjectURL(file);
            src = avatarPreviaObjectUrl;
        } else if (url) {
            src = url;
        }

        if (src) {
            const img = document.createElement("img");
            img.src = src;
            img.alt = "Prévia do avatar";
            if (caminhoPareceGif(src) || window.ImagemOtimizar?.ehGif?.(file) || caminhoPareceGif(file?.name)) {
                img.classList.add("is-gif");
            }
            window.ImagemPosicao?.aplicarImg?.(img, posicaoDe(avatarPosEdit));
            wrap.appendChild(img);
            garantirPanAvatar();
            return;
        }

        const span = document.createElement("span");
        span.className = "perfil-avatar-previa-inicial";
        span.id = "perfil-avatar-previa-inicial";
        span.textContent = inicialDe(perfilVisitado?.nome || perfilVisitado?.email || "?");
        wrap.appendChild(span);
        wrap.classList.remove("img-pos-arrastavel", "is-arrastando");
        const dica = document.getElementById("perfil-avatar-pos-dica");
        if (dica) dica.hidden = true;
    }

    function atualizarPreviaFundo({ url = "", file = null, limpar = false } = {}) {
        limparObjectUrl(fundoPreviaRef);
        let src = "";
        if (!limpar) {
            if (file) {
                fundoPreviaRef.url = URL.createObjectURL(file);
                src = fundoPreviaRef.url;
            } else if (url) {
                src = url;
            }
        }
        panFundo = atualizarPreviaBg(
            "perfil-fundo-previa",
            "perfil-fundo-pos-dica",
            src,
            fundoPosEdit,
            panFundo,
            (p) => {
                fundoPosEdit = p;
            }
        );
    }

    function esconderFormsModal() {
        document.querySelectorAll("#modal .modal-form").forEach((el) => {
            el.hidden = true;
        });
    }

    function abrirModalEditar() {
        if (!ehDono() || !perfilVisitado) return;

        esconderFormsModal();
        const form = document.getElementById("form-editar-perfil");
        const titulo = document.getElementById("modal-titulo");
        const overlay = document.getElementById("modal-overlay");
        const erro = document.getElementById("perfil-edit-erro");

        if (titulo) titulo.textContent = "Editar perfil";
        if (form) form.hidden = false;
        if (erro) {
            erro.hidden = true;
            erro.textContent = "";
        }

        document.getElementById("perfil-edit-nome").value = perfilVisitado.nome || "";
        document.getElementById("perfil-edit-cargo").value = perfilVisitado.cargo || "";
        document.getElementById("perfil-edit-bio").value = perfilVisitado.bio || "";
        document.getElementById("perfil-edit-cor").value = normalizarHex(perfilVisitado.cor_destaque);
        document.getElementById("perfil-edit-tema").value = perfilVisitado.tema_perfil === "claro" ? "claro" : "escuro";
        document.getElementById("perfil-edit-meio-cor").value = normalizarHex(
            perfilVisitado.meio_cor || defaultsDoTema(perfilVisitado.tema_perfil === "claro" ? "claro" : "escuro").meio
        );
        sincronizarValorCor("perfil-edit-cor", "perfil-edit-cor-valor");
        sincronizarValorCor("perfil-edit-meio-cor", "perfil-edit-meio-cor-valor");
        document.getElementById("perfil-edit-avatar").value = "";
        document.getElementById("perfil-edit-fundo").value = "";

        avatarPendente = null;
        fundoPendente = null;
        removerAvatar = false;
        removerFundo = false;
        avatarPosEdit = posicaoDe(perfilVisitado.avatar_pos);
        fundoPosEdit = posicaoDe(perfilVisitado.fundo_pos);

        document.getElementById("perfil-avatar-nome").textContent = perfilVisitado.avatar_url
            ? "Avatar atual definido"
            : "Nenhum avatar";
        document.getElementById("perfil-fundo-nome").textContent = perfilVisitado.fundo_url
            ? "Fundo atual definido"
            : "Nenhum fundo";
        document.getElementById("btn-remover-avatar").hidden = !perfilVisitado.avatar_url;
        document.getElementById("btn-remover-fundo").hidden = !perfilVisitado.fundo_url;

        atualizarAvatarPrevia({
            url: urlPublica(perfilVisitado.avatar_url),
            limpar: !perfilVisitado.avatar_url
        });
        atualizarPreviaFundo({
            url: urlPublica(perfilVisitado.fundo_url),
            limpar: !perfilVisitado.fundo_url
        });

        if (overlay) {
            overlay.hidden = false;
            document.body.style.overflow = "hidden";
        }
        document.getElementById("perfil-edit-nome")?.focus();
    }

    function fecharModalEditar() {
        const form = document.getElementById("form-editar-perfil");
        if (form) form.hidden = true;
        limparAvatarPreviaObjectUrl();
        limparObjectUrl(fundoPreviaRef);
        const overlay = document.getElementById("modal-overlay");
        const loginVisivel = document.getElementById("form-login") && !document.getElementById("form-login").hidden;
        if (overlay && !loginVisivel) {
            overlay.hidden = true;
            document.body.style.overflow = "";
        }
    }

    async function otimizarMidiaPerfil(file, tipo) {
        if (!file || !window.ImagemOtimizar?.otimizar) return file;
        const mapa = {
            avatar: window.ImagemOtimizar.PRESETS.avatar,
            fundo: window.ImagemOtimizar.PRESETS.fundo
        };
        const preset = mapa[tipo] || window.ImagemOtimizar.PRESETS.avatar;
        const resultado = await window.ImagemOtimizar.otimizar(file, preset);
        return resultado.file;
    }

    async function enviarMidia(file, tipo) {
        const userId = window.Auth?.getSession?.()?.user?.id;
        if (!userId || !file) return null;

        const ficheiro = file;
        const mime = window.ImagemOtimizar?.mimeDe?.(ficheiro) || ficheiro.type || "image/webp";
        const extFromName = (ficheiro.name.split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
        const extFromType = mime === "image/webp"
            ? "webp"
            : mime === "image/gif"
                ? "gif"
                : mime === "image/png"
                    ? "png"
                    : "jpg";
        const ext = extFromName || extFromType;
        const caminho = `${userId}/${tipo}-${Date.now()}.${ext}`;

        const { error } = await supabaseClient.storage
            .from(BUCKET_PERFIS)
            .upload(caminho, ficheiro, {
                upsert: true,
                contentType: mime,
                cacheControl: "3600"
            });

        if (error) throw error;
        return caminho;
    }

    async function removerMidiaStorage(caminho) {
        if (!caminho || /^https?:\/\//i.test(caminho)) return;
        try {
            await supabaseClient.storage.from(BUCKET_PERFIS).remove([caminho]);
        } catch (erro) {
            console.warn("Falha ao remover mídia antiga:", erro);
        }
    }

    async function atualizarPerfilComFallback(payload) {
        const avisos = [];
        const tentativas = [
            { payload, select: CAMPOS_PERFIL },
            {
                payload: (({ avatar_pos, fundo_pos, barra_esq_pos, barra_dir_pos, ...rest }) => rest)(payload),
                select: CAMPOS_PERFIL_SEM_POS,
                aviso: "Enquadramento das fotos pede a migration 008 no Supabase."
            },
            {
                payload: (({ anotacoes, ...rest }) => rest)(
                    (({ avatar_pos, fundo_pos, barra_esq_pos, barra_dir_pos, ...rest }) => rest)(payload)
                ),
                select: CAMPOS_PERFIL_SEM_ANOTACOES
            },
            {
                payload: {
                    nome: payload.nome,
                    cargo: payload.cargo,
                    bio: payload.bio,
                    cor_destaque: payload.cor_destaque,
                    tema_perfil: payload.tema_perfil,
                    avatar_url: payload.avatar_url,
                    fundo_url: payload.fundo_url,
                    meio_cor: payload.meio_cor,
                    barra_esq_url: payload.barra_esq_url,
                    barra_dir_url: payload.barra_dir_url
                },
                select: CAMPOS_PERFIL_SEM_POS,
                soCoresBarras: true
            },
            {
                payload: {
                    nome: payload.nome,
                    cargo: payload.cargo,
                    bio: payload.bio,
                    cor_destaque: payload.cor_destaque,
                    tema_perfil: payload.tema_perfil,
                    avatar_url: payload.avatar_url,
                    fundo_url: payload.fundo_url,
                    meio_cor: payload.meio_cor
                },
                select: CAMPOS_PERFIL_SEM_BARRAS,
                aviso: "Campos de painel pedem a migration 006 no Supabase."
            }
        ];

        let data = null;
        let error = null;
        let coresGuardadas = false;

        for (const tentativa of tentativas) {
            ({ data, error } = await supabaseClient
                .from("profiles")
                .update(tentativa.payload)
                .eq("id", perfilVisitado.id)
                .select(tentativa.select)
                .maybeSingle());

            if (!error) {
                if (tentativa.aviso) avisos.push(tentativa.aviso);
                coresGuardadas = !!(tentativa.payload.meio_cor);
                // Garante cores mesmo se o select não as devolveu
                if (coresGuardadas && data) {
                    data = {
                        ...data,
                        meio_cor: tentativa.payload.meio_cor ?? data.meio_cor,
                        barra_esq_url: tentativa.payload.barra_esq_url ?? data.barra_esq_url,
                        barra_dir_url: tentativa.payload.barra_dir_url ?? data.barra_dir_url
                    };
                }
                return { data, error: null, avisos, coresGuardadas };
            }

            const msg = error.message || "";
            const code = error.code || "";
            const colunaEmFalta = code === "42703" || code === "PGRST204" || /column|schema cache/i.test(msg);
            if (!colunaEmFalta) break;
        }

        return { data, error, avisos, coresGuardadas: false };
    }

    async function guardarPerfil(e) {
        e.preventDefault();
        if (!ehDono()) return;

        const erroEl = document.getElementById("perfil-edit-erro");
        const nome = document.getElementById("perfil-edit-nome").value.trim();
        const cargo = document.getElementById("perfil-edit-cargo").value.trim();
        const bio = document.getElementById("perfil-edit-bio").value.trim();
        const cor = normalizarHex(document.getElementById("perfil-edit-cor").value);
        const tema = document.getElementById("perfil-edit-tema").value === "claro" ? "claro" : "escuro";
        const meioCor = normalizarHex(document.getElementById("perfil-edit-meio-cor").value);

        if (!nome) {
            if (erroEl) {
                erroEl.hidden = false;
                erroEl.textContent = "Indique um nome.";
            }
            return;
        }

        mostrarLoading(true);
        if (erroEl) erroEl.hidden = true;

        try {
            let avatarUrl = perfilVisitado.avatar_url || null;
            let fundoUrl = perfilVisitado.fundo_url || null;
            const barraEsqUrlAntiga = perfilVisitado.barra_esq_url || null;
            const barraDirUrlAntiga = perfilVisitado.barra_dir_url || null;

            if (removerAvatar && avatarUrl) {
                await removerMidiaStorage(avatarUrl);
                avatarUrl = null;
            }
            if (removerFundo && fundoUrl) {
                await removerMidiaStorage(fundoUrl);
                fundoUrl = null;
            }
            // Imagens das barras laterais deixaram de ser suportadas — limpar se existirem
            if (barraEsqUrlAntiga) await removerMidiaStorage(barraEsqUrlAntiga);
            if (barraDirUrlAntiga) await removerMidiaStorage(barraDirUrlAntiga);

            if (avatarPendente) {
                if (avatarUrl) await removerMidiaStorage(avatarUrl);
                avatarUrl = await enviarMidia(avatarPendente, "avatar");
            }
            if (fundoPendente) {
                if (fundoUrl) await removerMidiaStorage(fundoUrl);
                fundoUrl = await enviarMidia(fundoPendente, "fundo");
            }

            const payload = {
                nome,
                cargo: cargo || null,
                bio: bio || null,
                cor_destaque: cor,
                tema_perfil: tema,
                avatar_url: avatarUrl,
                fundo_url: fundoUrl,
                meio_cor: meioCor,
                /* Colunas legadas: limpar imagens das barras (wallpaper único) */
                barra_esq_url: null,
                barra_dir_url: null,
                avatar_pos: avatarUrl ? posicaoDe(panAvatar?.getPos?.() || avatarPosEdit) : "50% 50%",
                fundo_pos: fundoUrl ? posicaoDe(panFundo?.getPos?.() || fundoPosEdit) : "50% 50%"
            };

            const { data, error, avisos, coresGuardadas } = await atualizarPerfilComFallback(payload);
            if (error) throw error;

            perfilVisitado = {
                ...perfilVisitado,
                ...(data || {}),
                ...payload,
                meio_cor: meioCor,
                tema_perfil: tema,
                cor_destaque: cor
            };

            renderizarCabecalho(perfilVisitado);

            if (avisos.length && erroEl) {
                erroEl.hidden = false;
                erroEl.textContent = `Perfil guardado. ${avisos.join(" ")}`;
                setTimeout(() => fecharModalEditar(), 2400);
            } else {
                fecharModalEditar();
            }

            if (!coresGuardadas && erroEl) {
                erroEl.hidden = false;
                erroEl.textContent = "Perfil guardado, mas a cor do painel não foi gravada. Corre a migration 006 no Supabase.";
            }

            window.LogsAtividade?.registrar("Editar perfil", nome, "usuario");
            await window.Auth?.recarregarPerfil?.();
            window.dispatchEvent(new CustomEvent("auth:changed", {
                detail: { perfil: true, skipPerfilReload: true }
            }));
        } catch (erro) {
            console.error(erro);
            if (erroEl) {
                erroEl.hidden = false;
                erroEl.textContent = erro.message || "Erro ao guardar perfil.";
            }
        } finally {
            mostrarLoading(false);
        }
    }

    function ligarEventos() {
        document.getElementById("btn-editar-perfil")?.addEventListener("click", abrirModalEditar);
        document.getElementById("perfil-edit-cancelar")?.addEventListener("click", fecharModalEditar);
        document.getElementById("form-editar-perfil")?.addEventListener("submit", guardarPerfil);
        document.getElementById("btn-guardar-anotacoes")?.addEventListener("click", guardarAnotacoes);
        document.getElementById("perfil-anotacoes-input")?.addEventListener("input", ajustarAlturaAnotacoes);

        document.getElementById("perfil-edit-avatar")?.addEventListener("change", async (e) => {
            const bruto = e.target.files?.[0] || null;
            removerAvatar = false;
            if (!bruto) {
                avatarPendente = null;
                avatarPosEdit = posicaoDe(perfilVisitado?.avatar_pos);
                atualizarAvatarPrevia({
                    url: urlPublica(perfilVisitado?.avatar_url),
                    limpar: !perfilVisitado?.avatar_url
                });
                return;
            }
            try {
                avatarPendente = await otimizarMidiaPerfil(bruto, "avatar");
            } catch (erro) {
                e.target.value = "";
                avatarPendente = null;
                alert(erro.message || "Não foi possível otimizar o avatar.");
                return;
            }
            document.getElementById("perfil-avatar-nome").textContent = `${avatarPendente.name} · ${(avatarPendente.size / 1024).toFixed(0)} KB`;
            document.getElementById("btn-remover-avatar").hidden = false;
            avatarPosEdit = "50% 50%";
            atualizarAvatarPrevia({ file: avatarPendente });
        });

        document.getElementById("perfil-edit-fundo")?.addEventListener("change", async (e) => {
            const bruto = e.target.files?.[0] || null;
            removerFundo = false;
            if (!bruto) {
                fundoPendente = null;
                fundoPosEdit = posicaoDe(perfilVisitado?.fundo_pos);
                atualizarPreviaFundo({
                    url: urlPublica(perfilVisitado?.fundo_url),
                    limpar: !perfilVisitado?.fundo_url
                });
                return;
            }
            try {
                fundoPendente = await otimizarMidiaPerfil(bruto, "fundo");
            } catch (erro) {
                e.target.value = "";
                fundoPendente = null;
                alert(erro.message || "Não foi possível otimizar o fundo.");
                return;
            }
            document.getElementById("perfil-fundo-nome").textContent = `${fundoPendente.name} · ${(fundoPendente.size / 1024).toFixed(0)} KB`;
            document.getElementById("btn-remover-fundo").hidden = false;
            fundoPosEdit = "50% 50%";
            atualizarPreviaFundo({ file: fundoPendente });
        });

        document.getElementById("btn-remover-avatar")?.addEventListener("click", () => {
            avatarPendente = null;
            removerAvatar = true;
            avatarPosEdit = "50% 50%";
            document.getElementById("perfil-edit-avatar").value = "";
            document.getElementById("perfil-avatar-nome").textContent = "Avatar será removido";
            document.getElementById("btn-remover-avatar").hidden = true;
            atualizarAvatarPrevia({ limpar: true });
        });

        document.getElementById("btn-remover-fundo")?.addEventListener("click", () => {
            fundoPendente = null;
            removerFundo = true;
            fundoPosEdit = "50% 50%";
            document.getElementById("perfil-edit-fundo").value = "";
            document.getElementById("perfil-fundo-nome").textContent = "Fundo será removido";
            document.getElementById("btn-remover-fundo").hidden = true;
            atualizarPreviaFundo({ limpar: true });
        });

        document.querySelectorAll("[data-acao='cancelar']").forEach((btn) => {
            btn.addEventListener("click", () => {
                window.Auth?.fecharOverlayModal?.();
                fecharModalEditar();
            });
        });

        document.getElementById("tema")?.addEventListener("click", () => {
            const botao = document.getElementById("tema");
            const proximoClaro = !document.body.classList.contains("tema-claro");
            if (typeof aplicarTemaFerramenta === "function") {
                aplicarTemaFerramenta(proximoClaro, botao);
            } else {
                document.body.classList.toggle("tema-claro", proximoClaro);
                if (botao) {
                    botao.textContent = proximoClaro ? "☾" : "◐";
                    botao.title = proximoClaro ? "Tema escuro" : "Tema claro";
                }
                localStorage.setItem("tema", proximoClaro ? "claro" : "escuro");
            }
            // Na página de perfil, o toggle muda também o aspeto do perfil
            if (perfilVisitado) {
                const tema = proximoClaro ? "claro" : "escuro";
                const defs = defaultsDoTema(tema);
                const meio = ehCorDefaultTema(perfilVisitado.meio_cor)
                    ? defs.meio
                    : (perfilVisitado.meio_cor || defs.meio);
                perfilVisitado = {
                    ...perfilVisitado,
                    tema_perfil: tema,
                    meio_cor: meio
                };
                aplicarTemaVisual(perfilVisitado);
                const sel = document.getElementById("perfil-edit-tema");
                if (sel && !document.getElementById("form-editar-perfil")?.hidden) {
                    sel.value = tema;
                    const meioInput = document.getElementById("perfil-edit-meio-cor");
                    if (meioInput && ehCorDefaultTema(meioInput.value)) meioInput.value = defs.meio;
                    sincronizarValorCor("perfil-edit-meio-cor", "perfil-edit-meio-cor-valor");
                }
            }
            // Garante ícone ◐/☾ como no hub (nunca "Claro"/"Escuro")
            if (botao) {
                botao.textContent = proximoClaro ? "☾" : "◐";
                botao.title = proximoClaro ? "Tema escuro" : "Tema claro";
            }
        });

        document.getElementById("perfil-edit-tema")?.addEventListener("change", preverTemaNoModal);
        ligarCamposCor();
    }

    async function iniciar() {
        if (!configValida()) {
            const erro = document.getElementById("erro-config");
            if (erro) erro.hidden = false;
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

        window.addEventListener("auth:changed", (e) => {
            if (e.detail?.skipPerfilReload) return;
            abrirPagina();
        });

        await abrirPagina();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
