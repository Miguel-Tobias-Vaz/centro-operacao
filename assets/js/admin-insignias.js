/**
 * Painel admin — Insígnias (catálogo, atribuir, missões).
 */
(() => {
    let catalogoCache = [];
    let usuariosCache = [];
    let insigniaSelecionadaId = null;
    let missaoEditId = null;
    let ordemPerfilUserId = null;
    let ordemPerfilIds = [];

    function $(id) {
        return document.getElementById(id);
    }

    function mostrarErro(elId, msg) {
        const el = $(elId);
        if (!el) return;
        if (!msg) {
            el.hidden = true;
            el.textContent = "";
            return;
        }
        el.textContent = msg;
        el.hidden = false;
    }

    function definirPrevia(src) {
        const drop = $("insig-painel-drop");
        const img = $("insig-painel-previa");
        const placeholder = $("insig-painel-placeholder");
        if (!img) return;
        if (src) {
            img.src = src;
            img.hidden = false;
            if (placeholder) placeholder.hidden = true;
            drop?.classList.add("has-img");
        } else {
            img.removeAttribute("src");
            img.hidden = true;
            if (placeholder) placeholder.hidden = false;
            drop?.classList.remove("has-img");
        }
    }

    function fecharEditorCatalogo() {
        const form = $("form-insig-catalogo");
        if (form) {
            form.hidden = true;
            form.reset();
        }
        if ($("insig-edit-id")) $("insig-edit-id").value = "";
        definirPrevia("");
        mostrarErro("insig-edit-erro", "");
    }

    function abrirEditorCatalogo(ins = null) {
        const form = $("form-insig-catalogo");
        if (!form) return;
        form.hidden = false;
        mostrarErro("insig-edit-erro", "");
        $("insig-edit-id").value = ins?.id || "";
        $("insig-edit-nome").value = ins?.nome || "";
        $("insig-edit-desc").value = ins?.descricao || "";
        $("insig-edit-icone").value = "";
        $("insig-edit-titulo").textContent = ins ? "Editar insígnia" : "Nova insígnia";
        $("insig-edit-guardar").textContent = ins ? "Atualizar" : "Criar";
        if (ins?.icone_path) definirPrevia(window.Insignias.urlIcone(ins.icone_path));
        else definirPrevia("");
        form.scrollIntoView({ behavior: "smooth", block: "nearest" });
        $("insig-edit-nome")?.focus();
    }

    async function carregarCatalogo() {
        catalogoCache = await window.Insignias.listarCatalogo();
        renderizarCatalogo();
        preencherSelectMissoes();
        if (insigniaSelecionadaId && !catalogoCache.some((i) => i.id === insigniaSelecionadaId)) {
            insigniaSelecionadaId = null;
        }
        if (!insigniaSelecionadaId && catalogoCache[0]?.id) {
            insigniaSelecionadaId = catalogoCache[0].id;
        }
        renderizarPickerAtribuir();
        await carregarAtribuicao();
        await carregarMissoes();
    }

    function renderizarCatalogo() {
        const lista = $("insig-catalogo-lista");
        if (!lista) return;
        lista.replaceChildren();

        const comId = catalogoCache.filter((i) => i.id);
        if (!comId.length) {
            const p = document.createElement("p");
            p.className = "lista-vazia";
            p.textContent = "Ainda sem insígnias. Cria a primeira.";
            lista.appendChild(p);
            return;
        }

        comId.forEach((ins) => {
            const row = document.createElement("div");
            row.className = "insig-row";
            if (ins.id === insigniaSelecionadaId) row.classList.add("is-selected");

            const main = document.createElement("button");
            main.type = "button";
            main.className = "insig-row-main";
            main.addEventListener("click", () => selecionarInsignia(ins.id));

            const img = document.createElement("img");
            img.src = window.Insignias.urlIcone(ins.icone_path);
            img.alt = "";
            img.className = "insignia-admin-icon";

            const nome = document.createElement("span");
            nome.className = "insig-row-nome";
            nome.textContent = ins.nome || ins.slug || "Insígnia";

            main.append(img, nome);

            const acoes = document.createElement("div");
            acoes.className = "insignia-admin-item-acoes";

            const editar = document.createElement("button");
            editar.type = "button";
            editar.className = "insignia-admin-btn-icon";
            editar.textContent = "✎";
            editar.title = "Editar";
            editar.addEventListener("click", (e) => {
                e.stopPropagation();
                abrirEditorCatalogo(ins);
            });

            const excluir = document.createElement("button");
            excluir.type = "button";
            excluir.className = "insignia-admin-btn-icon is-danger";
            excluir.textContent = "✕";
            excluir.title = "Excluir";
            excluir.addEventListener("click", (e) => {
                e.stopPropagation();
                excluirDoCatalogo(ins);
            });

            acoes.append(editar, excluir);
            row.append(main, acoes);
            lista.appendChild(row);
        });
    }

    async function excluirDoCatalogo(ins) {
        if (!ins?.id) return;
        if (!confirm(`Excluir «${ins.nome}»?\nSai de todos os perfis e missões ligadas.`)) return;
        try {
            await window.Insignias.excluirInsignia(ins.id);
            fecharEditorCatalogo();
            await carregarCatalogo();
        } catch (erro) {
            alert(erro.message || "Erro ao excluir.");
        }
    }

    async function guardarCatalogo(e) {
        e?.preventDefault?.();
        const id = $("insig-edit-id")?.value || "";
        const nome = $("insig-edit-nome")?.value?.trim() || "";
        const descricao = $("insig-edit-desc")?.value?.trim() || "";
        const ficheiro = $("insig-edit-icone")?.files?.[0] || null;
        const btn = $("insig-edit-guardar");

        mostrarErro("insig-edit-erro", "");
        if (!nome) {
            mostrarErro("insig-edit-erro", "Indica um nome.");
            return;
        }
        if (!id && !ficheiro) {
            mostrarErro("insig-edit-erro", "Clica no quadrado e escolhe um ícone.");
            return;
        }

        if (btn) btn.disabled = true;
        try {
            if (id) {
                await window.Insignias.atualizarInsignia(id, { nome, descricao, ficheiro });
            } else {
                const criada = await window.Insignias.criarInsignia({ nome, descricao, ficheiro });
                if (criada?.id) insigniaSelecionadaId = criada.id;
            }
            fecharEditorCatalogo();
            await carregarCatalogo();
        } catch (erro) {
            mostrarErro("insig-edit-erro", erro.message || "Erro ao guardar.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function selecionarInsignia(id) {
        insigniaSelecionadaId = id;
        renderizarCatalogo();
        renderizarPickerAtribuir();
        carregarAtribuicao();
        carregarMissoes();
        fecharEditorMissao();
    }

    function renderizarPickerAtribuir() {
        const sel = $("insig-atribuir-select");
        if (!sel) return;
        const valor = insigniaSelecionadaId || "";
        sel.replaceChildren();
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "Escolhe uma insígnia…";
        sel.appendChild(opt0);
        catalogoCache.filter((i) => i.id).forEach((ins) => {
            const opt = document.createElement("option");
            opt.value = ins.id;
            opt.textContent = ins.nome || ins.slug;
            sel.appendChild(opt);
        });
        sel.value = valor;
        atualizarResumoAtribuir();
    }

    function atualizarResumoAtribuir() {
        const el = $("insig-atribuir-resumo");
        const ins = catalogoCache.find((i) => i.id === insigniaSelecionadaId);
        if (!el) return;
        if (!ins) {
            el.textContent = "Seleciona uma insígnia para marcar quem a tem.";
            return;
        }
        el.innerHTML = "";
        const img = document.createElement("img");
        img.src = window.Insignias.urlIcone(ins.icone_path);
        img.alt = "";
        img.className = "insignia-admin-icon";
        const span = document.createElement("span");
        span.textContent = `Quem tem «${ins.nome}»`;
        el.append(img, span);
    }

    async function carregarUsuarios() {
        usuariosCache = (await window.Auth?.listarUsuarios?.()) || [];
        usuariosCache = usuariosCache
            .filter((u) => u && u.ativo !== false)
            .sort((a, b) => String(a.nome || a.email).localeCompare(String(b.nome || b.email), "pt"));
        preencherSelectOrdemUser();
    }

    function preencherSelectOrdemUser() {
        const sel = $("insig-ordem-user");
        if (!sel) return;
        const valor = ordemPerfilUserId || sel.value || "";
        sel.replaceChildren();
        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = "Escolhe uma pessoa…";
        sel.appendChild(opt0);
        usuariosCache.forEach((u) => {
            const opt = document.createElement("option");
            opt.value = u.id;
            opt.textContent = u.nome || u.email || u.id;
            sel.appendChild(opt);
        });
        if (valor && usuariosCache.some((u) => u.id === valor)) {
            sel.value = valor;
            ordemPerfilUserId = valor;
        }
    }

    async function carregarOrdemPerfil() {
        const lista = $("insig-ordem-lista");
        if (!lista) return;
        lista.replaceChildren();
        mostrarErro("insig-ordem-erro", "");
        ordemPerfilIds = [];

        if (!ordemPerfilUserId) {
            const p = document.createElement("p");
            p.className = "lista-vazia";
            p.textContent = "Escolhe uma pessoa para ordenar as insígnias do perfil.";
            lista.appendChild(p);
            return;
        }

        const badges = await window.Insignias.listarDoPerfil(ordemPerfilUserId);
        ordemPerfilIds = badges.map((b) => b.id).filter(Boolean);

        if (!ordemPerfilIds.length) {
            const p = document.createElement("p");
            p.className = "lista-vazia";
            p.textContent = "Esta pessoa ainda não tem insígnias. Atribui alguma no bloco Atribuir.";
            lista.appendChild(p);
            return;
        }

        renderizarOrdemPerfil(badges);
    }

    function renderizarOrdemPerfil(badges) {
        const lista = $("insig-ordem-lista");
        if (!lista) return;
        lista.replaceChildren();

        const porId = new Map((badges || []).map((b) => [b.id, b]));
        // Se só temos IDs, resolve do catálogo
        const itens = ordemPerfilIds.map((id) => porId.get(id) || catalogoCache.find((c) => c.id === id)).filter(Boolean);

        itens.forEach((ins, index) => {
            const row = document.createElement("div");
            row.className = "insig-row";

            const ordem = document.createElement("div");
            ordem.className = "insig-ordem";

            const up = document.createElement("button");
            up.type = "button";
            up.className = "insignia-admin-btn-icon";
            up.textContent = "↑";
            up.title = "Subir no perfil";
            up.disabled = index === 0;
            up.addEventListener("click", () => moverOrdemPerfil(ins.id, -1));

            const down = document.createElement("button");
            down.type = "button";
            down.className = "insignia-admin-btn-icon";
            down.textContent = "↓";
            down.title = "Descer no perfil";
            down.disabled = index === itens.length - 1;
            down.addEventListener("click", () => moverOrdemPerfil(ins.id, 1));

            ordem.append(up, down);

            const main = document.createElement("div");
            main.className = "insig-row-main";

            const img = document.createElement("img");
            img.src = window.Insignias.urlIcone(ins.icone_path);
            img.alt = "";
            img.className = "insignia-admin-icon";

            const nome = document.createElement("span");
            nome.className = "insig-row-nome";
            nome.textContent = ins.nome || ins.slug || "Insígnia";

            main.append(img, nome);
            row.append(ordem, main);
            lista.appendChild(row);
        });
    }

    async function moverOrdemPerfil(id, dir) {
        const idx = ordemPerfilIds.indexOf(id);
        const alvo = idx + dir;
        if (idx < 0 || alvo < 0 || alvo >= ordemPerfilIds.length) return;
        [ordemPerfilIds[idx], ordemPerfilIds[alvo]] = [ordemPerfilIds[alvo], ordemPerfilIds[idx]];

        const badges = ordemPerfilIds
            .map((bid) => catalogoCache.find((c) => c.id === bid))
            .filter(Boolean);
        renderizarOrdemPerfil(badges);

        mostrarErro("insig-ordem-erro", "");
        try {
            await window.Insignias.definirOrdemDoPerfil(ordemPerfilUserId, ordemPerfilIds);
            const ok = $("insig-ordem-ok");
            if (ok) {
                ok.textContent = "Ordem guardada no perfil.";
                ok.hidden = false;
                setTimeout(() => {
                    ok.hidden = true;
                    ok.textContent = "";
                }, 1800);
            }
        } catch (erro) {
            mostrarErro("insig-ordem-erro", erro.message || "Erro ao guardar ordem.");
            await carregarOrdemPerfil();
        }
    }

    async function carregarAtribuicao() {
        const lista = $("insig-atribuir-lista");
        if (!lista) return;
        lista.replaceChildren();
        mostrarErro("insig-atribuir-erro", "");

        if (!insigniaSelecionadaId) {
            const p = document.createElement("p");
            p.className = "lista-vazia";
            p.textContent = "Escolhe uma insígnia acima.";
            lista.appendChild(p);
            return;
        }

        if (!usuariosCache.length) await carregarUsuarios();

        let idsCom = [];
        try {
            idsCom = await window.Insignias.idsComInsignia(insigniaSelecionadaId);
        } catch (erro) {
            mostrarErro("insig-atribuir-erro", erro.message || "Erro ao carregar atribuições.");
            return;
        }
        const set = new Set(idsCom);

        if (!usuariosCache.length) {
            const p = document.createElement("p");
            p.className = "lista-vazia";
            p.textContent = "Sem utilizadores ativos.";
            lista.appendChild(p);
            return;
        }

        const busca = ($("insig-atribuir-busca")?.value || "").trim().toLowerCase();
        let visiveis = 0;

        usuariosCache.forEach((u) => {
            const blob = `${u.nome || ""} ${u.email || ""}`.toLowerCase();
            const match = !busca || blob.includes(busca);

            const label = document.createElement("label");
            label.className = "insig-user-check";
            label.hidden = !match;
            if (match) visiveis += 1;

            const check = document.createElement("input");
            check.type = "checkbox";
            check.value = u.id;
            check.checked = set.has(u.id);
            check.dataset.perfilId = u.id;

            const texto = document.createElement("span");
            texto.className = "insig-user-nome";
            texto.textContent = u.nome || u.email || u.id;

            const email = document.createElement("span");
            email.className = "insig-user-email";
            email.textContent = u.email || "";

            label.append(check, texto, email);
            lista.appendChild(label);
        });

        if (!visiveis) {
            const p = document.createElement("p");
            p.className = "lista-vazia";
            p.dataset.vazioBusca = "1";
            p.textContent = "Nenhum utilizador corresponde à pesquisa.";
            lista.appendChild(p);
        }
    }

    async function guardarAtribuicao() {
        if (!insigniaSelecionadaId) {
            mostrarErro("insig-atribuir-erro", "Escolhe uma insígnia.");
            return;
        }
        const lista = $("insig-atribuir-lista");
        const ids = [...(lista?.querySelectorAll("input[type=checkbox]:checked") || [])]
            .map((el) => el.value)
            .filter(Boolean);
        const btn = $("insig-atribuir-guardar");
        if (btn) btn.disabled = true;
        mostrarErro("insig-atribuir-erro", "");
        try {
            await window.Insignias.definirQuemTem(insigniaSelecionadaId, ids);
            const ok = $("insig-atribuir-ok");
            if (ok) {
                ok.textContent = `Guardado — ${ids.length} pessoa(s).`;
                ok.hidden = false;
                setTimeout(() => {
                    ok.hidden = true;
                    ok.textContent = "";
                }, 2500);
            }
        } catch (erro) {
            mostrarErro("insig-atribuir-erro", erro.message || "Erro ao guardar.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function preencherSelectMissoes() {
        const sel = $("missao-edit-insignia");
        if (!sel) return;
        const valor = sel.value;
        sel.replaceChildren();
        catalogoCache.filter((i) => i.id).forEach((ins) => {
            const opt = document.createElement("option");
            opt.value = ins.id;
            opt.textContent = ins.nome || ins.slug;
            sel.appendChild(opt);
        });
        if (insigniaSelecionadaId) sel.value = insigniaSelecionadaId;
        else if (valor) sel.value = valor;
    }

    function fecharEditorMissao() {
        const form = $("form-missao");
        if (form) {
            form.hidden = true;
            form.reset();
        }
        missaoEditId = null;
        mostrarErro("missao-edit-erro", "");
        preencherSelectMissoes();
    }

    function abrirEditorMissao(missao = null) {
        const form = $("form-missao");
        if (!form) return;
        form.hidden = false;
        missaoEditId = missao?.id || null;
        $("missao-edit-titulo").textContent = missao ? "Editar missão" : "Nova missão";
        $("missao-edit-guardar").textContent = missao ? "Atualizar" : "Criar";
        $("missao-edit-nome").value = missao?.nome || "";
        $("missao-edit-desc").value = missao?.descricao || "";
        $("missao-edit-ativo").checked = missao ? missao.ativo !== false : true;
        preencherSelectMissoes();
        if (missao?.insignia_id) $("missao-edit-insignia").value = missao.insignia_id;
        else if (insigniaSelecionadaId) $("missao-edit-insignia").value = insigniaSelecionadaId;
        mostrarErro("missao-edit-erro", "");
        $("missao-edit-nome")?.focus();
    }

    async function carregarMissoes() {
        const lista = $("insig-missoes-lista");
        if (!lista) return;
        lista.replaceChildren();

        const filtro = $("insig-missoes-filtro")?.value || "selecionada";
        const insigniaFiltro = filtro === "todas" ? null : (insigniaSelecionadaId || null);

        let missoes = [];
        try {
            missoes = await window.Insignias.listarMissoes(insigniaFiltro);
        } catch (erro) {
            const p = document.createElement("p");
            p.className = "login-erro";
            p.textContent = erro.message || "Erro ao carregar missões.";
            lista.appendChild(p);
            return;
        }

        if (!missoes.length) {
            const p = document.createElement("p");
            p.className = "lista-vazia";
            p.textContent = insigniaFiltro
                ? "Sem missões para esta insígnia."
                : "Sem missões ainda.";
            lista.appendChild(p);
            return;
        }

        missoes.forEach((m) => {
            const row = document.createElement("div");
            row.className = "insig-missao-row";
            if (m.ativo === false) row.classList.add("is-inativa");

            const corpo = document.createElement("div");
            corpo.className = "insig-missao-corpo";

            const titulo = document.createElement("strong");
            titulo.textContent = m.nome;

            const meta = document.createElement("span");
            meta.className = "insig-missao-meta";
            const nomeIns = m.insignias?.nome || catalogoCache.find((i) => i.id === m.insignia_id)?.nome || "—";
            meta.textContent = `${nomeIns}${m.ativo === false ? " · inativa" : ""}`;

            const desc = document.createElement("p");
            desc.className = "insig-missao-desc";
            desc.textContent = m.descricao || "Sem descrição.";

            corpo.append(titulo, meta, desc);

            const acoes = document.createElement("div");
            acoes.className = "insignia-admin-item-acoes";

            const editar = document.createElement("button");
            editar.type = "button";
            editar.className = "insignia-admin-btn-icon";
            editar.textContent = "✎";
            editar.title = "Editar";
            editar.addEventListener("click", () => abrirEditorMissao(m));

            const excluir = document.createElement("button");
            excluir.type = "button";
            excluir.className = "insignia-admin-btn-icon is-danger";
            excluir.textContent = "✕";
            excluir.title = "Excluir";
            excluir.addEventListener("click", async () => {
                if (!confirm(`Excluir missão «${m.nome}»?`)) return;
                try {
                    await window.Insignias.excluirMissao(m.id);
                    await carregarMissoes();
                } catch (erro) {
                    alert(erro.message || "Erro ao excluir.");
                }
            });

            acoes.append(editar, excluir);
            row.append(corpo, acoes);
            lista.appendChild(row);
        });
    }

    async function guardarMissao(e) {
        e?.preventDefault?.();
        const nome = $("missao-edit-nome")?.value?.trim() || "";
        const descricao = $("missao-edit-desc")?.value?.trim() || "";
        const insignia_id = $("missao-edit-insignia")?.value || "";
        const ativo = $("missao-edit-ativo")?.checked !== false;
        const btn = $("missao-edit-guardar");

        mostrarErro("missao-edit-erro", "");
        if (!nome) {
            mostrarErro("missao-edit-erro", "Indica um nome.");
            return;
        }
        if (!insignia_id) {
            mostrarErro("missao-edit-erro", "Escolhe a insígnia.");
            return;
        }

        if (btn) btn.disabled = true;
        try {
            if (missaoEditId) {
                await window.Insignias.atualizarMissao(missaoEditId, { nome, descricao, insignia_id, ativo });
            } else {
                await window.Insignias.criarMissao({ nome, descricao, insignia_id, ativo });
            }
            fecharEditorMissao();
            await carregarMissoes();
        } catch (erro) {
            mostrarErro("missao-edit-erro", erro.message || "Erro ao guardar missão.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    async function iniciarPainel() {
        if (!window.Insignias || !window.Auth?.ehAdmin?.()) return;
        await carregarUsuarios();
        await carregarCatalogo();
        await carregarOrdemPerfil();
    }

    function ligarEventos() {
        $("insig-btn-nova")?.addEventListener("click", () => abrirEditorCatalogo(null));
        $("insig-edit-cancelar")?.addEventListener("click", fecharEditorCatalogo);
        $("form-insig-catalogo")?.addEventListener("submit", (e) => {
            guardarCatalogo(e).catch(() => {});
        });
        $("insig-painel-drop")?.addEventListener("click", () => $("insig-edit-icone")?.click());
        $("insig-edit-icone")?.addEventListener("change", (e) => {
            const file = e.target.files?.[0];
            if (file) definirPrevia(URL.createObjectURL(file));
        });

        $("insig-atribuir-select")?.addEventListener("change", (e) => {
            selecionarInsignia(e.target.value || null);
        });
        $("insig-atribuir-busca")?.addEventListener("input", () => {
            const lista = $("insig-atribuir-lista");
            if (!lista) return;
            const busca = ($("insig-atribuir-busca")?.value || "").trim().toLowerCase();
            let visiveis = 0;
            lista.querySelectorAll(".insig-user-check").forEach((label) => {
                const texto = label.textContent.toLowerCase();
                const match = !busca || texto.includes(busca);
                label.hidden = !match;
                if (match) visiveis += 1;
            });
            let vazio = lista.querySelector('[data-vazio-busca="1"]');
            if (!visiveis) {
                if (!vazio) {
                    vazio = document.createElement("p");
                    vazio.className = "lista-vazia";
                    vazio.dataset.vazioBusca = "1";
                    vazio.textContent = "Nenhum utilizador corresponde à pesquisa.";
                    lista.appendChild(vazio);
                }
                vazio.hidden = false;
            } else if (vazio) {
                vazio.hidden = true;
            }
        });
        $("insig-atribuir-guardar")?.addEventListener("click", () => {
            guardarAtribuicao().catch(() => {});
        });

        $("insig-ordem-user")?.addEventListener("change", (e) => {
            ordemPerfilUserId = e.target.value || null;
            carregarOrdemPerfil().catch(() => {});
        });

        $("insig-btn-nova-missao")?.addEventListener("click", () => abrirEditorMissao(null));
        $("missao-edit-cancelar")?.addEventListener("click", fecharEditorMissao);
        $("form-missao")?.addEventListener("submit", (e) => {
            guardarMissao(e).catch(() => {});
        });
        $("insig-missoes-filtro")?.addEventListener("change", () => {
            carregarMissoes().catch(() => {});
        });
    }

    window.AdminInsignias = { iniciarPainel };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", ligarEventos);
    } else {
        ligarEventos();
    }
})();
