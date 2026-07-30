/**
 * Autenticação e gestão de usuários (Supabase Auth + profiles).
 */
const Auth = (() => {
    let client = null;
    let session = null;
    let perfil = null;
    let uiPronta = false;
    let menuAberto = false;
    let listaUsuariosRenderId = 0;
    let colunaAtivoDisponivel = null;
    let ultimoUserIdNotificado = null;

    const CAMPOS_PERFIL_BASE_SEM_POS = "id, email, nome, role, created_at, bio, cargo, avatar_url, fundo_url, cor_destaque, tema_perfil, barra_esq_url, barra_dir_url, barra_esq_cor, barra_dir_cor, meio_cor, anotacoes";
    const CAMPOS_PERFIL_BASE = `${CAMPOS_PERFIL_BASE_SEM_POS}, avatar_pos, fundo_pos, barra_esq_pos, barra_dir_pos`;
    const CAMPOS_PERFIL_COM_ATIVO = `${CAMPOS_PERFIL_BASE}, ativo`;
    const CAMPOS_PERFIL_COM_ATIVO_SEM_POS = `${CAMPOS_PERFIL_BASE_SEM_POS}, ativo`;
    const CAMPOS_PERFIL_LEGACY = "id, email, nome, role, created_at";
    const CAMPOS_PERFIL_LEGACY_ATIVO = `${CAMPOS_PERFIL_LEGACY}, ativo`;
    let colunasPersonalizacaoDisponiveis = null;
    let colunasPosicaoDisponiveis = null;

    function erroColunaAtivoAusente(error) {
        const msg = error?.message || "";
        const code = error?.code || "";
        return (
            code === "42703" ||
            code === "PGRST204" ||
            /profiles\.ativo/i.test(msg) ||
            /column.*ativo/i.test(msg) ||
            /could not find.*ativo/i.test(msg)
        );
    }

    function normalizarAtivo(registro) {
        if (!registro) return registro;
        if (registro.ativo == null) registro.ativo = true;
        return registro;
    }

    async function detectarColunaAtivo() {
        if (!client) return colunaAtivoDisponivel ?? false;
        if (colunaAtivoDisponivel === true) return true;

        const { error } = await client.from("profiles").select("ativo").limit(1);
        if (!error) {
            colunaAtivoDisponivel = true;
            return true;
        }

        if (erroColunaAtivoAusente(error)) {
            colunaAtivoDisponivel = false;
            return false;
        }

        console.warn("Não foi possível verificar coluna ativo:", error);
        return false;
    }

    function camposPerfilSelect() {
        if (colunasPersonalizacaoDisponiveis === false) {
            return colunaAtivoDisponivel ? CAMPOS_PERFIL_LEGACY_ATIVO : CAMPOS_PERFIL_LEGACY;
        }
        if (colunasPosicaoDisponiveis === false) {
            return colunaAtivoDisponivel ? CAMPOS_PERFIL_COM_ATIVO_SEM_POS : CAMPOS_PERFIL_BASE_SEM_POS;
        }
        return colunaAtivoDisponivel ? CAMPOS_PERFIL_COM_ATIVO : CAMPOS_PERFIL_BASE;
    }

    function erroColunasPosicao(error) {
        const msg = error?.message || "";
        return /avatar_pos|fundo_pos|barra_esq_pos|barra_dir_pos/i.test(msg);
    }

    function erroColunasPersonalizacao(error) {
        const msg = error?.message || "";
        const code = error?.code || "";
        if (erroColunasPosicao(error)) return false;
        return (
            code === "42703" ||
            code === "PGRST204" ||
            /bio|cargo|avatar_url|fundo_url|cor_destaque|tema_perfil|barra_esq|barra_dir|meio_cor|anotacoes/i.test(msg)
        );
    }

    async function selecionarPerfilPorId(userId) {
        let { data, error } = await client
            .from("profiles")
            .select(camposPerfilSelect())
            .eq("id", userId)
            .maybeSingle();

        if (error && erroColunasPosicao(error) && colunasPosicaoDisponiveis !== false) {
            colunasPosicaoDisponiveis = false;
            ({ data, error } = await client
                .from("profiles")
                .select(camposPerfilSelect())
                .eq("id", userId)
                .maybeSingle());
        } else if (!error && colunasPosicaoDisponiveis == null) {
            colunasPosicaoDisponiveis = true;
        }

        if (error && erroColunasPersonalizacao(error) && colunasPersonalizacaoDisponiveis !== false) {
            colunasPersonalizacaoDisponiveis = false;
            ({ data, error } = await client
                .from("profiles")
                .select(camposPerfilSelect())
                .eq("id", userId)
                .maybeSingle());
        } else if (!error && colunasPersonalizacaoDisponiveis == null) {
            colunasPersonalizacaoDisponiveis = true;
        }

        if (error) throw error;
        return data;
    }

    function getSession() {
        return session;
    }

    function getClient() {
        return client;
    }

    function getPerfil() {
        return perfil;
    }

    function podeEditar() {
        return !!perfil && perfil.ativo !== false && ["admin", "editor"].includes(perfil.role);
    }

    function ehAdmin() {
        return perfil?.role === "admin" && perfil?.ativo !== false;
    }

    async function validarContaAtiva() {
        if (!session?.user || !perfil || perfil.ativo !== false) return true;

        await client.auth.signOut();
        session = null;
        perfil = null;
        atualizarUIModo();

        const erroEl = document.getElementById("login-erro");
        if (erroEl) {
            erroEl.textContent = "Conta desativada. Peça a um administrador para reativar o acesso.";
            erroEl.hidden = false;
        }

        abrirModalLogin();
        return false;
    }

    function emitirMudanca(detalhe = {}) {
        window.dispatchEvent(new CustomEvent("auth:changed", { detail: detalhe }));
    }

    function obterNomeExibicao() {
        if (perfil?.nome?.trim()) return perfil.nome.trim();
        const email = session?.user?.email || "";
        if (email.includes("@")) return email.split("@")[0];
        return email || "Usuário";
    }

    function obterInicial(nome) {
        return (nome?.trim()?.charAt(0) || "?").toUpperCase();
    }

    function esconderPainelsModal() {
        document.querySelectorAll("#modal .modal-form, #modal > form").forEach((el) => {
            el.hidden = true;
        });
    }

    let menuUsuarioParent = null;

    function fecharMenuUsuario() {
        menuAberto = false;
        const menu = document.getElementById("menu-usuario");
        const btn = document.getElementById("btn-menu-usuario");
        if (menu) {
            menu.hidden = true;
            menu.classList.remove("menu-usuario-fix");
            menu.style.top = "";
            menu.style.right = "";
            menu.style.left = "";
            menu.style.bottom = "";
            menu.style.width = "";
            // Devolve o menu ao lugar original (fora do body)
            if (menuUsuarioParent && menu.parentElement === document.body) {
                menuUsuarioParent.appendChild(menu);
            }
        }
        if (btn) btn.setAttribute("aria-expanded", "false");
    }

    function posicionarMenuUsuario() {
        const menu = document.getElementById("menu-usuario");
        const btn = document.getElementById("btn-menu-usuario");
        if (!menu || !btn || menu.hidden) return;

        // Sai do header (backdrop-filter corta position:fixed)
        if (menu.parentElement !== document.body) {
            menuUsuarioParent = menu.parentElement;
            document.body.appendChild(menu);
        }

        const rect = btn.getBoundingClientRect();
        const larguraMenu = Math.min(260, window.innerWidth - 16);
        let left = rect.right - larguraMenu;
        left = Math.max(8, Math.min(left, window.innerWidth - larguraMenu - 8));
        let top = rect.bottom + 8;
        const alturaEstimada = menu.offsetHeight || 160;
        if (top + alturaEstimada > window.innerHeight - 8) {
            top = Math.max(8, rect.top - alturaEstimada - 8);
        }

        menu.classList.add("menu-usuario-fix");
        menu.style.top = `${Math.round(top)}px`;
        menu.style.left = `${Math.round(left)}px`;
        menu.style.right = "auto";
        menu.style.bottom = "auto";
        menu.style.width = `${larguraMenu}px`;
    }

    function alternarMenuUsuario() {
        const menu = document.getElementById("menu-usuario");
        const btn = document.getElementById("btn-menu-usuario");
        if (!menu || !btn) return;

        if (menuAberto) {
            fecharMenuUsuario();
            return;
        }

        menuAberto = true;
        menu.hidden = false;
        btn.setAttribute("aria-expanded", "true");

        const linkAdmin = document.getElementById("link-admin");
        if (linkAdmin) linkAdmin.hidden = !ehAdmin();

        posicionarMenuUsuario();
        requestAnimationFrame(() => posicionarMenuUsuario());
    }

    async function carregarPerfil() {
        if (!session?.user?.id || !client) {
            perfil = null;
            return;
        }

        await detectarColunaAtivo();

        try {
            const data = await selecionarPerfilPorId(session.user.id);
            perfil = normalizarAtivo(data);
            await garantirAdminInicial();
        } catch (error) {
            console.warn("Erro ao carregar perfil:", error);
            perfil = null;
        }
    }

    /**
     * No projeto novo, se ainda não existe nenhum admin,
     * promove o usuário logado (primeiro a entrar).
     */
    async function garantirAdminInicial() {
        if (!client || !session?.user?.id) return;
        if (perfil?.role === "admin" && perfil?.ativo !== false) return;

        try {
            const { data, error } = await client.rpc("promover_primeiro_admin");
            if (error) {
                // Função ainda não migrada: tenta promover via UPDATE direto
                if (/promover_primeiro_admin|Could not find the function/i.test(error.message || "")) {
                    await tentarPromoverAdminLocal();
                    return;
                }
                console.warn("promover_primeiro_admin:", error.message);
                return;
            }

            if (data === true) {
                await recarregarPerfilSemBootstrap();
            }
        } catch (erro) {
            console.warn("Não foi possível garantir admin inicial:", erro);
        }
    }

    async function tentarPromoverAdminLocal() {
        const { count, error: erroCount } = await client
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "admin");

        if (erroCount) {
            console.warn("Não foi possível verificar admins:", erroCount);
            return;
        }

        if ((count ?? 0) > 0) return;

        const { error } = await client
            .from("profiles")
            .update({ role: "admin" })
            .eq("id", session.user.id);

        if (error) {
            console.warn(
                "Sem permissão para virar admin automaticamente. " +
                "Execute supabase/migration_promover_admin.sql no Supabase " +
                "ou rode: UPDATE profiles SET role = 'admin' WHERE email = 'seu@email';"
            , error);
            return;
        }

        await recarregarPerfilSemBootstrap();
    }

    async function recarregarPerfilSemBootstrap() {
        if (!session?.user?.id || !client) return;
        try {
            const data = await selecionarPerfilPorId(session.user.id);
            if (data) {
                perfil = normalizarAtivo(data);
                atualizarUIModo();
            }
        } catch (error) {
            console.warn("Erro ao recarregar perfil:", error);
        }
    }

    function urlAvatarPublica(caminho) {
        if (!caminho || !client) return "";
        if (/^https?:\/\//i.test(caminho)) return caminho;
        const { data } = client.storage.from("perfis-midia").getPublicUrl(caminho);
        return data?.publicUrl || "";
    }

    function atualizarAvatarHeader(nome) {
        const wrap = document.getElementById("auth-usuario-avatar");
        const inicial = document.getElementById("auth-usuario-inicial");
        const url = urlAvatarPublica(perfil?.avatar_url);

        if (!wrap) {
            if (inicial) inicial.textContent = obterInicial(nome);
            return;
        }

        const imgExistente = wrap.querySelector("img.auth-avatar-img");
        const pos = window.ImagemPosicao?.normalizar?.(perfil?.avatar_pos) || "50% 50%";
        const ehGif = /\.gif(\?|#|$)/i.test(String(perfil?.avatar_url || url || ""));
        if (url) {
            if (inicial) inicial.hidden = true;
            if (imgExistente) {
                imgExistente.src = url;
                imgExistente.classList.toggle("is-gif", ehGif);
                window.ImagemPosicao?.aplicarImg?.(imgExistente, pos);
            } else {
                const img = document.createElement("img");
                img.className = ehGif ? "auth-avatar-img is-gif" : "auth-avatar-img";
                img.alt = "";
                img.src = url;
                window.ImagemPosicao?.aplicarImg?.(img, pos);
                wrap.appendChild(img);
            }
        } else {
            imgExistente?.remove();
            if (inicial) {
                inicial.hidden = false;
                inicial.textContent = obterInicial(nome);
            }
        }
    }

    function atualizarHeader() {
        const logado = !!session?.user;
        const nome = obterNomeExibicao();

        document.body.classList.toggle("usuario-logado", logado);
        document.body.classList.toggle("usuario-admin", logado && ehAdmin());
        document.body.classList.toggle("modo-edicao", podeEditar());

        const btnE = document.getElementById("btn-entrar");
        const area = document.getElementById("auth-logado");
        const nomeEl = document.getElementById("auth-usuario-nome");
        const emailEl = document.getElementById("auth-usuario-email");
        const linkAdmin = document.getElementById("link-admin");
        const btnMenu = document.getElementById("btn-menu-usuario");
        const linkMeuPerfil = document.getElementById("link-meu-perfil");

        if (btnE) btnE.hidden = logado;
        if (area) area.hidden = !logado;
        atualizarAvatarHeader(nome);
        if (nomeEl) nomeEl.textContent = perfil?.nome || nome;
        if (emailEl) emailEl.textContent = session?.user?.email || "";
        if (linkAdmin) linkAdmin.hidden = !ehAdmin();
        if (linkMeuPerfil) {
            linkMeuPerfil.hidden = !logado;
            if (session?.user?.id) linkMeuPerfil.href = `perfil.html?id=${session.user.id}`;
        }
        if (btnMenu) btnMenu.title = `${nome} — ${session?.user?.email || ""}`;

        const painelInicio = document.getElementById("painel-inicio");
        const appLayout = document.getElementById("app-layout");

        if (painelInicio) painelInicio.hidden = logado;
        if (appLayout) appLayout.hidden = !logado;

        const novoWrap = document.getElementById("hub-novo-wrap");
        if (novoWrap) novoWrap.hidden = !logado || !podeEditar();

        if (!logado) fecharMenuUsuario();
    }

    function atualizarUIModo() {
        atualizarHeader();
    }

    function abrirOverlayModal() {
        const overlay = document.getElementById("modal-overlay");
        if (overlay) overlay.hidden = false;
        document.body.style.overflow = "hidden";
    }

    function fecharOverlayModal() {
        const overlay = document.getElementById("modal-overlay");
        if (overlay) overlay.hidden = true;
        document.body.style.overflow = "";
        fecharModalAuth();
    }

    function abrirModalLogin() {
        const modalTitulo = document.getElementById("modal-titulo");
        const form = document.getElementById("form-login");
        const email = document.getElementById("login-email");
        const erro = document.getElementById("login-erro");

        esconderPainelsModal();
        if (modalTitulo) modalTitulo.textContent = "Entrar";
        if (form) form.hidden = false;
        if (erro) {
            erro.hidden = true;
            erro.textContent = "";
        }

        abrirOverlayModal();
        email?.focus();
    }

    function fecharModalAuth() {
        const form = document.getElementById("form-login");
        if (form) form.hidden = true;
    }

    function mensagemErroLogin(error) {
        const msg = (error?.message || "").toLowerCase();

        if (msg.includes("email not confirmed")) {
            return "Sua conta ainda não está ativa. Tente novamente em alguns instantes ou peça ajuda a um administrador.";
        }

        if (msg.includes("invalid login credentials") || msg.includes("invalid credentials")) {
            return "E-mail ou senha incorretos. Verifique os dados e tente de novo.";
        }

        return "Não foi possível entrar. Tente novamente.";
    }

    async function recuperarSenha() {
        if (!client) {
            alert("Aguarde o carregamento do sistema e tente novamente.");
            return;
        }

        const email = document.getElementById("login-email")?.value?.trim().toLowerCase();
        const erroEl = document.getElementById("login-erro");

        if (!email) {
            alert("Informe seu e-mail no campo acima.");
            return;
        }

        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + window.location.pathname
        });

        if (error) {
            if (erroEl) {
                erroEl.textContent = error.message;
                erroEl.hidden = false;
            }
            return;
        }

        alert(`Enviamos um link de redefinição de senha para ${email}.`);
    }

    async function fazerLogin(e) {
        if (e) e.preventDefault();

        if (!client) {
            alert("Aguarde o carregamento do sistema e tente novamente.");
            return;
        }

        const email = document.getElementById("login-email")?.value?.trim().toLowerCase();
        const senha = document.getElementById("login-senha")?.value;
        const erroEl = document.getElementById("login-erro");

        if (!email || !senha) return;

        if (erroEl) {
            erroEl.hidden = true;
            erroEl.textContent = "";
        }

        const { error } = await client.auth.signInWithPassword({ email, password: senha });

        if (error) {
            console.error("Erro de login:", error);
            if (erroEl) {
                erroEl.textContent = mensagemErroLogin(error);
                erroEl.hidden = false;
            }
            return;
        }

        await carregarPerfil();
        if (!(await validarContaAtiva())) return;

        fecharOverlayModal();
        document.getElementById("form-login")?.reset();
        window.LogsAtividade?.registrar("Login", email, "auth");
    }

    async function fazerLogout() {
        if (!client) return;
        const email = perfil?.email || session?.user?.email || "";
        fecharMenuUsuario();
        await window.LogsAtividade?.registrar("Logout", email, "auth");
        await client.auth.signOut();
        fecharOverlayModal();

        if (window.location.pathname.endsWith("admin.html")) {
            window.location.href = "index.html";
        }
    }

    function exigirEdicao() {
        if (podeEditar()) return true;
        alert("Faça login para editar o conteúdo.");
        abrirModalLogin();
        return false;
    }

    function exigirAdmin() {
        if (!session?.user) {
            alert("Faça login para acessar esta área.");
            abrirModalLogin();
            return false;
        }
        if (ehAdmin()) return true;
        alert("Apenas administradores podem gerenciar usuários.");
        return false;
    }

    async function listarUsuarios() {
        await detectarColunaAtivo();

        let { data, error } = await client
            .from("profiles")
            .select(camposPerfilSelect())
            .order("created_at", { ascending: true });

        if (error && erroColunasPosicao(error) && colunasPosicaoDisponiveis !== false) {
            colunasPosicaoDisponiveis = false;
            ({ data, error } = await client
                .from("profiles")
                .select(camposPerfilSelect())
                .order("created_at", { ascending: true }));
        } else if (!error && colunasPosicaoDisponiveis == null) {
            colunasPosicaoDisponiveis = true;
        }

        if (error && erroColunasPersonalizacao(error) && colunasPersonalizacaoDisponiveis !== false) {
            colunasPersonalizacaoDisponiveis = false;
            ({ data, error } = await client
                .from("profiles")
                .select(camposPerfilSelect())
                .order("created_at", { ascending: true }));
        } else if (!error && colunasPersonalizacaoDisponiveis == null) {
            colunasPersonalizacaoDisponiveis = true;
        }

        if (error) throw error;
        return (data || []).map((usuario) => normalizarAtivo({ ...usuario }));
    }

    async function redefinirSenhaUsuario(email) {
        if (!confirm(`Enviar link de redefinição de senha para ${email}?`)) return;

        const { error } = await client.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/index.html`
        });

        if (error) throw error;
        alert(`Link de redefinição enviado para ${email}.`);
        window.LogsAtividade?.registrar("Redefinir senha", email, "usuario");
    }

    async function alternarAcessoUsuario(usuario, ativo) {
        if (!(await detectarColunaAtivo())) {
            throw new Error("Não foi possível alterar o acesso.");
        }

        if (usuario.id === perfil?.id && !ativo) {
            throw new Error("Você não pode desativar sua própria conta.");
        }

        const { error } = await client
            .from("profiles")
            .update({ ativo })
            .eq("id", usuario.id);

        if (error) throw error;
        usuario.ativo = ativo;
        window.LogsAtividade?.registrar(
            ativo ? "Ativar usuário" : "Desativar usuário",
            usuario.nome || usuario.email,
            "usuario"
        );
    }

    async function excluirUsuario(usuario) {
        if (!(await detectarColunaAtivo())) {
            throw new Error("Não foi possível excluir este usuário.");
        }

        if (usuario.id === perfil?.id) {
            throw new Error("Você não pode excluir sua própria conta.");
        }

        const nome = usuario.nome || usuario.email;
        if (!confirm(`Excluir permanentemente "${nome}"?\n\nEsta ação não pode ser desfeita.`)) {
            return;
        }

        const { error } = await client.rpc("admin_excluir_usuario", { target_id: usuario.id });
        if (error) throw error;
        window.LogsAtividade?.registrar("Excluir usuário", nome, "usuario");
    }

    function deduplicarUsuarios(usuarios) {
        const mapa = new Map();
        usuarios.forEach((usuario) => {
            if (usuario?.id) mapa.set(usuario.id, usuario);
        });
        return [...mapa.values()];
    }

    async function renderizarListaUsuarios(containerId = "lista-usuarios") {
        const lista = document.getElementById(containerId);
        if (!lista) return;

        const renderId = ++listaUsuariosRenderId;
        lista.replaceChildren();

        try {
            const suportaAtivo = await detectarColunaAtivo();
            const usuarios = deduplicarUsuarios(await listarUsuarios());

            if (renderId !== listaUsuariosRenderId) return;

            if (!usuarios.length) {
                const vazio = document.createElement("p");
                vazio.className = "lista-vazia";
                vazio.textContent = "Nenhum usuário cadastrado.";
                lista.appendChild(vazio);
                return;
            }

            usuarios.forEach((usuario) => {
                const item = document.createElement("div");
                item.className = "usuario-item";
                if (suportaAtivo && usuario.ativo === false) {
                    item.classList.add("usuario-item-inativo");
                }

                const avatar = document.createElement("div");
                avatar.className = "modulo-avatar modulo-avatar-sm";
                avatar.innerHTML = `<span class="modulo-avatar-inicial">${escapar(obterInicial(usuario.nome || usuario.email))}</span>`;

                const info = document.createElement("div");
                info.className = "usuario-item-info";
                const status = !suportaAtivo
                    ? ""
                    : usuario.ativo === false
                        ? '<span class="usuario-status usuario-status-off">Acesso desligado</span>'
                        : '<span class="usuario-status usuario-status-on">Acesso ligado</span>';
                info.innerHTML = `
                    <strong class="usuario-item-nome">${escapar(usuario.nome || usuario.email)}</strong>
                    <span class="usuario-item-email">${escapar(usuario.email)}</span>
                    ${status}
                `;

                const acoes = document.createElement("div");
                acoes.className = "usuario-item-acoes";

                const select = document.createElement("select");
                select.className = "modal-select usuario-item-role";
                select.title = "Permissão";
                select.innerHTML = `
                    <option value="editor">Editor</option>
                    <option value="admin">Administrador</option>
                `;
                select.value = usuario.role;
                select.disabled = usuario.id === perfil?.id;

                select.addEventListener("change", async () => {
                    const novoRole = select.value;
                    const anterior = usuario.role;

                    try {
                        const { error } = await client
                            .from("profiles")
                            .update({ role: novoRole })
                            .eq("id", usuario.id);

                        if (error) throw error;
                        usuario.role = novoRole;
                        window.LogsAtividade?.registrar(
                            "Alterar permissão",
                            `${usuario.nome || usuario.email}: ${anterior} → ${novoRole}`,
                            "usuario"
                        );
                    } catch (erro) {
                        select.value = anterior;
                        alert(`Erro ao atualizar permissão: ${erro.message}`);
                    }
                });

                const toggleLabel = suportaAtivo ? document.createElement("label") : null;
                if (toggleLabel) {
                    toggleLabel.className = "usuario-toggle";
                    toggleLabel.title = "Ligar ou desligar acesso ao sistema";

                    const toggle = document.createElement("input");
                    toggle.type = "checkbox";
                    toggle.checked = usuario.ativo !== false;
                    toggle.disabled = usuario.id === perfil?.id;

                    const toggleTexto = document.createElement("span");
                    toggleTexto.textContent = "Acesso";

                    toggle.addEventListener("change", async () => {
                        const novoAtivo = toggle.checked;
                        const anterior = usuario.ativo !== false;

                        try {
                            await alternarAcessoUsuario(usuario, novoAtivo);
                            await renderizarListaUsuarios(containerId);
                        } catch (erro) {
                            toggle.checked = anterior;
                            alert(erro.message);
                        }
                    });

                    toggleLabel.append(toggle, toggleTexto);
                }

                const btnPerfil = document.createElement("a");
                btnPerfil.href = `perfil.html?id=${encodeURIComponent(usuario.id)}`;
                btnPerfil.className = "btn btn-outline btn-sm usuario-btn-acao";
                btnPerfil.textContent = "Ver perfil";

                const btnInsignias = document.createElement("button");
                btnInsignias.type = "button";
                btnInsignias.className = "btn btn-outline btn-sm usuario-btn-acao";
                btnInsignias.textContent = "Insígnias";
                btnInsignias.addEventListener("click", () => {
                    abrirModalInsigniasUsuario(usuario).catch((erro) => {
                        alert(erro.message || "Não foi possível abrir as insígnias.");
                    });
                });

                const btnSenha = document.createElement("button");
                btnSenha.type = "button";
                btnSenha.className = "btn btn-outline btn-sm usuario-btn-acao";
                btnSenha.textContent = "Redefinir senha";
                btnSenha.addEventListener("click", async () => {
                    try {
                        await redefinirSenhaUsuario(usuario.email);
                    } catch (erro) {
                        alert(`Erro ao redefinir senha: ${erro.message}`);
                    }
                });

                const btnExcluir = document.createElement("button");
                btnExcluir.type = "button";
                btnExcluir.className = "btn btn-outline btn-sm usuario-btn-excluir";
                btnExcluir.textContent = "Excluir";
                btnExcluir.disabled = usuario.id === perfil?.id || !suportaAtivo;
                btnExcluir.addEventListener("click", async () => {
                    try {
                        await excluirUsuario(usuario);
                        await renderizarListaUsuarios(containerId);
                    } catch (erro) {
                        alert(`Erro ao excluir: ${erro.message}`);
                    }
                });

                acoes.append(select);
                if (toggleLabel) acoes.append(toggleLabel);
                acoes.append(btnPerfil, btnInsignias, btnSenha, btnExcluir);
                item.append(avatar, info, acoes);
                lista.appendChild(item);
            });
        } catch (erro) {
            const msg = document.createElement("p");
            msg.className = "login-erro";
            msg.textContent = `Erro ao carregar usuários: ${erro.message}`;
            lista.appendChild(msg);
        }
    }

    let insigniasModalUsuario = null;
    let insigniasIdsSelecionados = new Set();

    function mostrarErroInsignias(msg) {
        const erroEl = document.getElementById("modal-insignias-erro");
        if (!erroEl) return;
        if (!msg) {
            erroEl.hidden = true;
            erroEl.textContent = "";
            return;
        }
        erroEl.textContent = msg;
        erroEl.hidden = false;
    }

    function mostrarErroFormInsignia(msg) {
        const erroEl = document.getElementById("insignia-edit-erro");
        if (!erroEl) return;
        if (!msg) {
            erroEl.hidden = true;
            erroEl.textContent = "";
            return;
        }
        erroEl.textContent = msg;
        erroEl.hidden = false;
    }

    function fecharFormInsigniaCatalogo() {
        const form = document.getElementById("form-insignia-catalogo");
        if (form) {
            form.hidden = true;
            form.reset();
        }
        const idEl = document.getElementById("insignia-edit-id");
        if (idEl) idEl.value = "";
        const wrap = document.getElementById("insignia-edit-previa-wrap");
        const img = document.getElementById("insignia-edit-previa");
        if (wrap) wrap.hidden = true;
        if (img) img.removeAttribute("src");
        mostrarErroFormInsignia("");
        const ajuda = document.getElementById("insignia-edit-icone-ajuda");
        if (ajuda) ajuda.textContent = "Obrigatório ao criar. Ao editar, deixa vazio para manter o atual.";
    }

    function abrirFormInsigniaCatalogo(insignia = null) {
        const form = document.getElementById("form-insignia-catalogo");
        if (!form) return;
        form.hidden = false;
        mostrarErroFormInsignia("");

        const idEl = document.getElementById("insignia-edit-id");
        const nomeEl = document.getElementById("insignia-edit-nome");
        const descEl = document.getElementById("insignia-edit-desc");
        const ficheiroEl = document.getElementById("insignia-edit-icone");
        const wrap = document.getElementById("insignia-edit-previa-wrap");
        const img = document.getElementById("insignia-edit-previa");
        const ajuda = document.getElementById("insignia-edit-icone-ajuda");
        const btn = document.getElementById("insignia-edit-guardar");

        if (idEl) idEl.value = insignia?.id || "";
        if (nomeEl) nomeEl.value = insignia?.nome || "";
        if (descEl) descEl.value = insignia?.descricao || "";
        if (ficheiroEl) ficheiroEl.value = "";

        if (insignia?.icone_path && img && wrap) {
            img.src = window.Insignias.urlIcone(insignia.icone_path);
            wrap.hidden = false;
        } else if (wrap) {
            wrap.hidden = true;
        }

        if (ajuda) {
            ajuda.textContent = insignia
                ? "Deixa vazio para manter o ícone atual."
                : "Obrigatório ao criar (PNG pixel art recomendado).";
        }
        if (btn) btn.textContent = insignia ? "Atualizar insígnia" : "Criar insígnia";
        nomeEl?.focus();
    }

    function fecharModalInsigniasUsuario() {
        const overlay = document.getElementById("modal-insignias-overlay");
        if (overlay) overlay.hidden = true;
        insigniasModalUsuario = null;
        insigniasIdsSelecionados = new Set();
        fecharFormInsigniaCatalogo();
        mostrarErroInsignias("");
    }

    function sincronizarSelecaoDaLista() {
        const listaEl = document.getElementById("modal-insignias-lista");
        if (!listaEl) return;
        insigniasIdsSelecionados = new Set(
            [...listaEl.querySelectorAll("input[type=checkbox]:checked")]
                .map((el) => el.value)
                .filter(Boolean)
        );
    }

    async function renderizarListaInsigniasModal() {
        const listaEl = document.getElementById("modal-insignias-lista");
        if (!listaEl || !insigniasModalUsuario) return;

        listaEl.replaceChildren();
        const carregando = document.createElement("p");
        carregando.className = "lista-vazia";
        carregando.textContent = "A carregar…";
        listaEl.appendChild(carregando);

        const catalogo = await window.Insignias.listarCatalogo();
        listaEl.replaceChildren();

        const comId = (catalogo || []).filter((ins) => ins.id);
        if (!comId.length) {
            const vazio = document.createElement("p");
            vazio.className = "lista-vazia";
            vazio.textContent = "Nenhuma insígnia ainda. Cria a primeira com «Nova insígnia».";
            listaEl.appendChild(vazio);
            return;
        }

        comId.forEach((ins) => {
            const row = document.createElement("div");
            row.className = "insignia-admin-item";

            const label = document.createElement("label");
            label.className = "insignia-admin-check";

            const check = document.createElement("input");
            check.type = "checkbox";
            check.value = ins.id;
            check.checked = insigniasIdsSelecionados.has(ins.id);
            check.addEventListener("change", sincronizarSelecaoDaLista);

            const img = document.createElement("img");
            img.src = window.Insignias.urlIcone(ins.icone_path);
            img.alt = "";
            img.className = "insignia-admin-icon";

            const texto = document.createElement("span");
            texto.className = "insignia-admin-nome";
            texto.textContent = ins.nome || ins.slug || "Insígnia";

            label.append(check, img, texto);

            const acoes = document.createElement("div");
            acoes.className = "insignia-admin-item-acoes";

            const btnEditar = document.createElement("button");
            btnEditar.type = "button";
            btnEditar.className = "btn btn-outline btn-sm";
            btnEditar.textContent = "Editar";
            btnEditar.addEventListener("click", () => abrirFormInsigniaCatalogo(ins));

            const btnExcluir = document.createElement("button");
            btnExcluir.type = "button";
            btnExcluir.className = "btn btn-outline btn-sm usuario-btn-excluir";
            btnExcluir.textContent = "Excluir";
            btnExcluir.addEventListener("click", () => {
                excluirInsigniaCatalogo(ins).catch(() => {});
            });

            acoes.append(btnEditar, btnExcluir);
            row.append(label, acoes);
            listaEl.appendChild(row);
        });
    }

    async function abrirModalInsigniasUsuario(usuario) {
        if (!exigirAdmin()) return;
        if (!window.Insignias) {
            throw new Error("Módulo de insígnias não carregado. Atualiza a página.");
        }

        const overlay = document.getElementById("modal-insignias-overlay");
        const listaEl = document.getElementById("modal-insignias-lista");
        const titulo = document.getElementById("modal-insignias-titulo");
        const sub = document.getElementById("modal-insignias-sub");
        if (!overlay || !listaEl) {
            throw new Error("Modal de insígnias não encontrado nesta página.");
        }

        insigniasModalUsuario = usuario;
        fecharFormInsigniaCatalogo();
        mostrarErroInsignias("");
        if (titulo) titulo.textContent = "Insígnias";
        if (sub) {
            sub.textContent = `Atribui, cria, edita ou exclui insígnias · ${usuario.nome || usuario.email}`;
        }

        overlay.hidden = false;
        insigniasIdsSelecionados = await window.Insignias.idsDoPerfil(usuario.id);
        await renderizarListaInsigniasModal();
    }

    async function guardarFormInsigniaCatalogo(e) {
        e?.preventDefault?.();
        if (!exigirAdmin() || !window.Insignias) return;

        const id = document.getElementById("insignia-edit-id")?.value || "";
        const nome = document.getElementById("insignia-edit-nome")?.value?.trim() || "";
        const descricao = document.getElementById("insignia-edit-desc")?.value?.trim() || "";
        const ficheiro = document.getElementById("insignia-edit-icone")?.files?.[0] || null;
        const btn = document.getElementById("insignia-edit-guardar");

        mostrarErroFormInsignia("");
        if (!nome) {
            mostrarErroFormInsignia("Indica um nome.");
            return;
        }
        if (!id && !ficheiro) {
            mostrarErroFormInsignia("Escolhe um ícone para a nova insígnia.");
            return;
        }

        if (btn) btn.disabled = true;
        try {
            if (id) {
                await window.Insignias.atualizarInsignia(id, { nome, descricao, ficheiro });
                window.LogsAtividade?.registrar("Editar insígnia", nome, "usuario");
            } else {
                const criada = await window.Insignias.criarInsignia({ nome, descricao, ficheiro });
                if (criada?.id) insigniasIdsSelecionados.add(criada.id);
                window.LogsAtividade?.registrar("Criar insígnia", nome, "usuario");
            }
            fecharFormInsigniaCatalogo();
            await renderizarListaInsigniasModal();
        } catch (erro) {
            mostrarErroFormInsignia(erro.message || "Erro ao guardar a insígnia.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function excluirInsigniaCatalogo(ins) {
        if (!exigirAdmin() || !window.Insignias || !ins?.id) return;
        const ok = window.confirm(
            `Excluir a insígnia «${ins.nome || "sem nome"}»?\nSerá removida de todos os perfis.`
        );
        if (!ok) return;

        mostrarErroInsignias("");
        try {
            await window.Insignias.excluirInsignia(ins.id);
            insigniasIdsSelecionados.delete(ins.id);
            window.LogsAtividade?.registrar("Excluir insígnia", ins.nome || ins.id, "usuario");
            if (document.getElementById("insignia-edit-id")?.value === ins.id) {
                fecharFormInsigniaCatalogo();
            }
            await renderizarListaInsigniasModal();
        } catch (erro) {
            mostrarErroInsignias(erro.message || "Erro ao excluir.");
        }
    }

    async function guardarInsigniasUsuario() {
        if (!exigirAdmin() || !insigniasModalUsuario || !window.Insignias) return;

        sincronizarSelecaoDaLista();
        const ids = [...insigniasIdsSelecionados];
        const btn = document.getElementById("modal-insignias-guardar");

        if (btn) btn.disabled = true;
        mostrarErroInsignias("");

        try {
            await window.Insignias.definirDoPerfil(insigniasModalUsuario.id, ids);
            window.LogsAtividade?.registrar(
                "Atribuir insígnias",
                `${insigniasModalUsuario.nome || insigniasModalUsuario.email}: ${ids.length} selecionada(s)`,
                "usuario"
            );
            fecharModalInsigniasUsuario();
        } catch (erro) {
            mostrarErroInsignias(erro.message || "Erro ao guardar atribuições.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function criarUsuarioViaSignup({ email, password, nome, role }) {
        const res = await fetch(`${window.SUPABASE_URL}/auth/v1/signup`, {
            method: "POST",
            headers: {
                apikey: window.SUPABASE_ANON_KEY,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email,
                password,
                data: { nome, role }
            })
        });

        const body = await res.json().catch(() => ({}));

        if (!res.ok) {
            throw new Error(body.msg || body.error_description || body.message || "Não foi possível criar o usuário.");
        }

        if (body.user?.id) {
            await client
                .from("profiles")
                .update({ nome, role })
                .eq("id", body.user.id);
        }

        return body;
    }

    async function salvarNovoUsuario(e) {
        e.preventDefault();
        if (!exigirAdmin()) return;

        const nome = document.getElementById("novo-usuario-nome")?.value?.trim();
        const email = document.getElementById("novo-usuario-email")?.value?.trim().toLowerCase();
        const senha = document.getElementById("novo-usuario-senha")?.value;
        const role = document.getElementById("novo-usuario-role")?.value || "editor";
        const erroEl = document.getElementById("novo-usuario-erro");

        if (!nome || !email || !senha) return;

        if (erroEl) {
            erroEl.hidden = true;
            erroEl.textContent = "";
        }

        try {
            await criarUsuarioViaSignup({ email, password: senha, nome, role });
            document.getElementById("form-novo-usuario")?.reset();
            await renderizarListaUsuarios();
            window.LogsAtividade?.registrar(
                "Criar usuário",
                `${nome} (${email}) · ${role}`,
                "usuario"
            );
            alert(`Usuário ${nome} criado. Já pode entrar com o e-mail e a senha definidos.`);
        } catch (erro) {
            if (erroEl) {
                erroEl.textContent = erro.message;
                erroEl.hidden = false;
            }
        }
    }

    function escapar(texto) {
        const div = document.createElement("div");
        div.textContent = texto || "";
        return div.innerHTML;
    }

    function iniciarEventosUI() {
        if (uiPronta) return;
        uiPronta = true;

        document.addEventListener("click", (e) => {
            const alvo = e.target;

            if (alvo.closest("#btn-entrar")) {
                e.preventDefault();
                abrirModalLogin();
                return;
            }

            if (alvo.closest("#btn-entrar-inicio")) {
                e.preventDefault();
                abrirModalLogin();
                return;
            }

            if (alvo.closest("#btn-menu-usuario")) {
                e.preventDefault();
                e.stopPropagation();
                alternarMenuUsuario();
                return;
            }

            if (alvo.closest("#btn-sair")) {
                e.preventDefault();
                fazerLogout();
                return;
            }

            if (menuAberto && !alvo.closest(".menu-usuario-wrap") && !alvo.closest("#menu-usuario")) {
                fecharMenuUsuario();
            }
        });

        window.addEventListener("resize", () => {
            if (menuAberto) posicionarMenuUsuario();
        }, { passive: true });

        window.addEventListener("scroll", () => {
            if (menuAberto) posicionarMenuUsuario();
        }, { passive: true, capture: true });

        document.getElementById("form-login")?.addEventListener("submit", fazerLogin);
        document.getElementById("btn-recuperar-senha")?.addEventListener("click", recuperarSenha);
        document.getElementById("form-novo-usuario")?.addEventListener("submit", salvarNovoUsuario);

        document.getElementById("modal-fechar")?.addEventListener("click", fecharOverlayModal);
        document.getElementById("modal-overlay")?.addEventListener("click", (e) => {
            if (e.target?.id === "modal-overlay") fecharOverlayModal();
        });
        document.querySelectorAll("[data-acao='cancelar']").forEach((btn) => {
            btn.addEventListener("click", fecharOverlayModal);
        });

        document.getElementById("modal-insignias-fechar")?.addEventListener("click", fecharModalInsigniasUsuario);
        document.getElementById("modal-insignias-cancelar")?.addEventListener("click", fecharModalInsigniasUsuario);
        document.getElementById("modal-insignias-guardar")?.addEventListener("click", () => {
            guardarInsigniasUsuario().catch(() => {});
        });
        document.getElementById("modal-insignias-overlay")?.addEventListener("click", (e) => {
            if (e.target?.id === "modal-insignias-overlay") fecharModalInsigniasUsuario();
        });
        document.getElementById("modal-insignias-nova")?.addEventListener("click", () => {
            abrirFormInsigniaCatalogo(null);
        });
        document.getElementById("insignia-edit-cancelar")?.addEventListener("click", fecharFormInsigniaCatalogo);
        document.getElementById("form-insignia-catalogo")?.addEventListener("submit", (e) => {
            guardarFormInsigniaCatalogo(e).catch(() => {});
        });
        document.getElementById("insignia-edit-icone")?.addEventListener("change", (e) => {
            const file = e.target.files?.[0];
            const wrap = document.getElementById("insignia-edit-previa-wrap");
            const img = document.getElementById("insignia-edit-previa");
            if (!file || !img || !wrap) return;
            img.src = URL.createObjectURL(file);
            wrap.hidden = false;
        });
    }

    async function iniciar(supabaseClient) {
        client = supabaseClient;

        const { data, error } = await client.auth.getSession();
        if (error) console.warn("Erro ao obter sessão:", error);

        session = data?.session ?? null;
        atualizarUIModo();

        await carregarPerfil();
        await validarContaAtiva();
        atualizarUIModo();

        client.auth.onAuthStateChange(async (_evento, novaSessao) => {
            const novoUserId = novaSessao?.user?.id ?? null;
            session = novaSessao;
            atualizarUIModo();
            await carregarPerfil();
            await validarContaAtiva();
            atualizarUIModo();

            if (_evento === "INITIAL_SESSION") {
                ultimoUserIdNotificado = novoUserId;
                return;
            }

            if (novoUserId !== ultimoUserIdNotificado) {
                ultimoUserIdNotificado = novoUserId;
                emitirMudanca({ evento: _evento });
            }
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciarEventosUI);
    } else {
        iniciarEventosUI();
    }

    return {
        iniciar,
        getSession,
        getClient,
        getPerfil,
        podeEditar,
        ehAdmin,
        exigirEdicao,
        exigirAdmin,
        abrirModalLogin,
        fecharModalAuth,
        fecharOverlayModal,
        atualizarUIModo,
        listarUsuarios,
        renderizarListaUsuarios,
        recarregarPerfil: recarregarPerfilSemBootstrap
    };
})();

window.Auth = Auth;
