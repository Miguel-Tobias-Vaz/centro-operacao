/**
 * Autenticação e gestão de usuários (Supabase Auth + profiles).
 */
const Auth = (() => {
    let client = null;
    let session = null;
    let perfil = null;
    let uiPronta = false;
    let menuAberto = false;

    function getSession() {
        return session;
    }

    function getPerfil() {
        return perfil;
    }

    function podeEditar() {
        return !!perfil && ["admin", "editor"].includes(perfil.role);
    }

    function ehAdmin() {
        return perfil?.role === "admin";
    }

    function emitirMudanca() {
        window.dispatchEvent(new CustomEvent("auth:changed"));
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

    function fecharMenuUsuario() {
        menuAberto = false;
        const menu = document.getElementById("menu-usuario");
        const btn = document.getElementById("btn-menu-usuario");
        if (menu) menu.hidden = true;
        if (btn) btn.setAttribute("aria-expanded", "false");
    }

    function alternarMenuUsuario() {
        const menu = document.getElementById("menu-usuario");
        const btn = document.getElementById("btn-menu-usuario");
        if (!menu || !btn) return;

        menuAberto = !menuAberto;
        menu.hidden = !menuAberto;
        btn.setAttribute("aria-expanded", menuAberto ? "true" : "false");
    }

    async function carregarPerfil() {
        if (!session?.user?.id || !client) {
            perfil = null;
            return;
        }

        const { data, error } = await client
            .from("profiles")
            .select("id, email, nome, role, created_at")
            .eq("id", session.user.id)
            .maybeSingle();

        if (error) {
            console.warn("Erro ao carregar perfil:", error);
            perfil = null;
            return;
        }

        perfil = data;
    }

    function atualizarHeader() {
        const logado = !!session?.user;
        const nome = obterNomeExibicao();

        document.body.classList.toggle("usuario-logado", logado);
        document.body.classList.toggle("usuario-admin", logado && ehAdmin());
        document.body.classList.toggle("modo-edicao", podeEditar());

        const btnE = document.getElementById("btn-entrar");
        const area = document.getElementById("auth-logado");
        const inicial = document.getElementById("auth-usuario-inicial");
        const nomeEl = document.getElementById("auth-usuario-nome");
        const emailEl = document.getElementById("auth-usuario-email");
        const linkAdmin = document.getElementById("link-admin");
        const btnMenu = document.getElementById("btn-menu-usuario");

        if (btnE) btnE.hidden = logado;
        if (area) area.hidden = !logado;
        if (inicial) inicial.textContent = obterInicial(nome);
        if (nomeEl) nomeEl.textContent = perfil?.nome || nome;
        if (emailEl) emailEl.textContent = session?.user?.email || "";
        if (linkAdmin) linkAdmin.hidden = !ehAdmin();
        if (btnMenu) btnMenu.title = `${nome} — ${session?.user?.email || ""}`;

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

        fecharOverlayModal();
        document.getElementById("form-login")?.reset();
    }

    async function fazerLogout() {
        if (!client) return;
        fecharMenuUsuario();
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
        const { data, error } = await client
            .from("profiles")
            .select("id, email, nome, role, created_at")
            .order("created_at", { ascending: true });

        if (error) throw error;
        return data || [];
    }

    async function renderizarListaUsuarios(containerId = "lista-usuarios") {
        const lista = document.getElementById(containerId);
        if (!lista) return;

        lista.replaceChildren();

        try {
            const usuarios = await listarUsuarios();

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

                const avatar = document.createElement("div");
                avatar.className = "modulo-avatar modulo-avatar-sm";
                avatar.innerHTML = `<span class="modulo-avatar-inicial">${escapar(obterInicial(usuario.nome || usuario.email))}</span>`;

                const info = document.createElement("div");
                info.className = "usuario-item-info";
                info.innerHTML = `
                    <strong class="usuario-item-nome">${escapar(usuario.nome || usuario.email)}</strong>
                    <span class="usuario-item-email">${escapar(usuario.email)}</span>
                `;

                const select = document.createElement("select");
                select.className = "modal-select usuario-item-role";
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
                    } catch (erro) {
                        select.value = anterior;
                        alert(`Erro ao atualizar permissão: ${erro.message}`);
                    }
                });

                item.append(avatar, info, select);
                lista.appendChild(item);
            });
        } catch (erro) {
            const msg = document.createElement("p");
            msg.className = "login-erro";
            msg.textContent = `Erro ao carregar usuários: ${erro.message}`;
            lista.appendChild(msg);
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

            if (menuAberto && !alvo.closest(".menu-usuario-wrap")) {
                fecharMenuUsuario();
            }
        });

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
    }

    async function iniciar(supabaseClient) {
        client = supabaseClient;

        const { data, error } = await client.auth.getSession();
        if (error) console.warn("Erro ao obter sessão:", error);

        session = data?.session ?? null;
        await carregarPerfil();
        atualizarUIModo();

        client.auth.onAuthStateChange(async (_evento, novaSessao) => {
            session = novaSessao;
            await carregarPerfil();
            atualizarUIModo();
            emitirMudanca();
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
        getPerfil,
        podeEditar,
        ehAdmin,
        exigirEdicao,
        exigirAdmin,
        abrirModalLogin,
        fecharModalAuth,
        fecharOverlayModal,
        atualizarUIModo,
        renderizarListaUsuarios
    };
})();

window.Auth = Auth;
