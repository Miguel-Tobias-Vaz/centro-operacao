let supabaseClient = null;
let modulos = [];
let moduloAtivoId = null;
let termoBuscaGlobal = "";
let termoBuscaItem = "";
let editandoModuloId = null;
let editandoPublicacaoId = null;

const listaModulos = document.getElementById("lista-modulos");
const gridModulos = document.getElementById("grid-modulos");
const painelModulo = document.getElementById("painel-modulo");
const painelExplorar = document.getElementById("painel-explorar");
const sidebar = document.getElementById("sidebar");
const moduloTitulo = document.getElementById("modulo-titulo");
const listaPublicacoes = document.getElementById("lista-publicacoes");
const buscaGlobal = document.getElementById("busca-global");
const buscaItem = document.getElementById("busca-item");
const botaoTema = document.getElementById("tema");
const loading = document.getElementById("loading");
const erroConfig = document.getElementById("erro-config");

const modalOverlay = document.getElementById("modal-overlay");
const modalEl = document.getElementById("modal");
const modalTitulo = document.getElementById("modal-titulo");
const modalFechar = document.getElementById("modal-fechar");
const formModulo = document.getElementById("form-modulo");
const formPublicacao = document.getElementById("form-publicacao");
const inputModuloNome = document.getElementById("modulo-nome");
const inputPublicacaoTitulo = document.getElementById("publicacao-titulo-input");
const btnExcluirModulo = document.getElementById("excluir-modulo");
const btnExcluirPublicacao = document.getElementById("excluir-publicacao");

const toolbarEditor = [
    [{ header: [1, 2, 3, false] }],
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ list: "ordered" }, { list: "bullet" }],
    [{ align: [] }],
    ["link"],
    ["clean"]
];

let editorConteudo = null;

function iniciarEditor() {
    if (editorConteudo) return;

    editorConteudo = new Quill("#editor-conteudo", {
        theme: "snow",
        modules: { toolbar: toolbarEditor },
        placeholder: "Escreva o conteúdo, formate o texto e insira links..."
    });
}

function conteudoEhHtml(texto) {
    return /<[a-z][\s\S]*>/i.test(texto);
}

function textoPuro(conteudo) {
    if (!conteudo) return "";
    if (!conteudoEhHtml(conteudo)) return conteudo;
    const div = document.createElement("div");
    div.innerHTML = conteudo;
    return div.textContent || "";
}

function renderizarConteudo(conteudo) {
    if (!conteudo) return "";
    if (conteudoEhHtml(conteudo)) {
        return DOMPurify.sanitize(conteudo, {
            ADD_ATTR: ["target", "rel"],
            ALLOWED_ATTR: ["href", "target", "rel", "class", "style", "src", "alt"]
        });
    }
    return escaparHtml(conteudo).replace(/\n/g, "<br>");
}

function carregarConteudoNoEditor(conteudo) {
    if (!editorConteudo) iniciarEditor();
    editorConteudo.setText("");
    if (!conteudo) return;

    if (conteudoEhHtml(conteudo)) {
        const delta = editorConteudo.clipboard.convert(conteudo);
        editorConteudo.setContents(delta);
    } else {
        editorConteudo.setText(conteudo);
    }
}

function obterConteudoDoEditor() {
    if (!editorConteudo) return "";
    return editorConteudo.root.innerHTML;
}

function editorEstaVazio() {
    return !editorConteudo || editorConteudo.getText().trim() === "";
}

function configValida() {
    return (
        window.SUPABASE_URL &&
        window.SUPABASE_ANON_KEY &&
        !window.SUPABASE_URL.includes("SEU_PROJETO") &&
        window.SUPABASE_ANON_KEY !== "sua-chave-anon-aqui"
    );
}

function mostrarLoading(ativo) {
    loading.hidden = !ativo;
}

function mostrarErroConfig() {
    erroConfig.hidden = false;
    document.querySelector(".app-layout").style.display = "none";
}

function escaparHtml(texto) {
    const div = document.createElement("div");
    div.textContent = texto;
    return div.innerHTML;
}

function formatarConteudo(texto) {
    return renderizarConteudo(texto);
}

function obterModulo(id) {
    return modulos.find((m) => m.id === id);
}

function filtrarModulos() {
    if (!termoBuscaGlobal.trim()) return modulos;

    const termo = termoBuscaGlobal.toLowerCase();
    return modulos.filter((modulo) => {
        const nomeCombina = modulo.nome.toLowerCase().includes(termo);
        const publicacaoCombina = modulo.publicacoes.some(
            (p) =>
                p.titulo.toLowerCase().includes(termo) ||
                textoPuro(p.conteudo).toLowerCase().includes(termo)
        );
        return nomeCombina || publicacaoCombina;
    });
}

function filtrarPublicacoes(modulo) {
    if (!termoBuscaItem.trim()) return modulo.publicacoes;

    const termo = termoBuscaItem.toLowerCase();
    return modulo.publicacoes.filter(
        (p) =>
            p.titulo.toLowerCase().includes(termo) ||
            textoPuro(p.conteudo).toLowerCase().includes(termo)
    );
}

function tratarErro(erro, acao) {
    console.error(erro);
    alert(`Erro ao ${acao}: ${erro.message}`);
}

async function carregarDados() {
    const { data, error } = await supabaseClient
        .from("modulos")
        .select(`
            id,
            nome,
            ordem,
            created_at,
            publicacoes (
                id,
                titulo,
                conteudo,
                created_at
            )
        `)
        .order("ordem", { ascending: true })
        .order("created_at", { foreignTable: "publicacoes", ascending: false });

    if (error) throw error;

    modulos = (data || []).map((modulo) => ({
        id: modulo.id,
        nome: modulo.nome,
        ordem: modulo.ordem ?? 0,
        publicacoes: modulo.publicacoes || []
    }));

    if (moduloAtivoId && !obterModulo(moduloAtivoId)) {
        voltarParaExplorar();
    }
}

function esconderFormulariosModal() {
    formModulo.hidden = true;
    formPublicacao.hidden = true;
}

function abrirModal() {
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
}

function fecharModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = "";
    esconderFormulariosModal();
    modalEl.classList.remove("modal-grande");
    editandoModuloId = null;
    editandoPublicacaoId = null;
}

function abrirModalModulo(id = null) {
    editandoModuloId = id;
    esconderFormulariosModal();
    formModulo.hidden = false;

    if (id) {
        const modulo = obterModulo(id);
        modalTitulo.textContent = "Editar Módulo";
        inputModuloNome.value = modulo.nome;
        btnExcluirModulo.hidden = false;
    } else {
        modalTitulo.textContent = "Novo Módulo";
        inputModuloNome.value = "";
        btnExcluirModulo.hidden = true;
    }

    abrirModal();
    inputModuloNome.focus();
}

function abrirModalPublicacao(id = null) {
    if (!id && !moduloAtivoId) {
        alert("Selecione um módulo antes de criar uma publicação.");
        return;
    }

    editandoPublicacaoId = id;
    esconderFormulariosModal();
    formPublicacao.hidden = false;
    modalEl.classList.add("modal-grande");
    abrirModal();
    iniciarEditor();

    if (id) {
        const modulo = obterModulo(moduloAtivoId);
        const publicacao = modulo.publicacoes.find((p) => p.id === id);
        modalTitulo.textContent = "Editar Publicação";
        inputPublicacaoTitulo.value = publicacao.titulo;
        carregarConteudoNoEditor(publicacao.conteudo);
        btnExcluirPublicacao.hidden = false;
    } else {
        modalTitulo.textContent = "Nova Publicação";
        inputPublicacaoTitulo.value = "";
        carregarConteudoNoEditor("");
        btnExcluirPublicacao.hidden = true;
    }

    inputPublicacaoTitulo.focus();
}

function criarCardModuloSidebar(modulo) {
    const card = document.createElement("article");
    card.className = "card-modulo";
    if (modulo.id === moduloAtivoId) card.classList.add("ativo");

    card.innerHTML = `
        <div class="card-modulo-topo">
            <h3 class="card-modulo-nome">${escaparHtml(modulo.nome)}</h3>
        </div>
        <p class="card-modulo-qtd">${modulo.publicacoes.length} publicação(ões)</p>
        <button type="button" class="btn btn-primario btn-sm btn-selecionar" data-id="${modulo.id}">
            Selecionar
        </button>
    `;

    card.querySelector(".btn-selecionar").addEventListener("click", () => {
        selecionarModulo(modulo.id);
    });

    return card;
}

function criarCardModuloGrid(modulo) {
    const card = document.createElement("article");
    card.className = "card-modulo-grid";
    card.dataset.id = modulo.id;

    const arrastar = termoBuscaGlobal.trim()
        ? ""
        : `
        <div class="modulo-arrastar" role="button" tabindex="0" aria-label="Arrastar para reordenar" title="Arrastar para reordenar">
            <span class="icone-arrastar" aria-hidden="true"></span>
        </div>
    `;

    card.innerHTML = `
        <div class="card-modulo-grid-cabecalho">
            ${arrastar}
            <h3 class="card-modulo-nome">${escaparHtml(modulo.nome)}</h3>
        </div>
        <p class="card-modulo-qtd">${modulo.publicacoes.length} publicação(ões)</p>
        <button type="button" class="btn btn-primario btn-selecionar" data-id="${modulo.id}">
            Selecionar
        </button>
    `;

    card.querySelector(".btn-selecionar").addEventListener("click", () => {
        selecionarModulo(modulo.id);
    });

    return card;
}

function criarCardPublicacao(publicacao) {
    const card = document.createElement("article");
    card.className = "card-publicacao";

    card.innerHTML = `
        <h3 class="publicacao-titulo">${escaparHtml(publicacao.titulo)}</h3>
        <div class="publicacao-conteudo">${formatarConteudo(publicacao.conteudo)}</div>
        <div class="publicacao-acoes">
            <div class="publicacao-acoes-esquerda">
                <button type="button" class="btn-ver-mais" aria-expanded="false">Ver mais ▾</button>
                <button type="button" class="btn-editar">Editar</button>
            </div>
            <button type="button" class="btn-copiar" aria-label="Copiar conteúdo" title="Copiar">📋</button>
        </div>
    `;

    const conteudo = card.querySelector(".publicacao-conteudo");
    const btnVerMais = card.querySelector(".btn-ver-mais");
    const btnEditar = card.querySelector(".btn-editar");
    const btnCopiar = card.querySelector(".btn-copiar");

    btnVerMais.addEventListener("click", () => {
        const expandido = conteudo.classList.toggle("expandido");
        btnVerMais.setAttribute("aria-expanded", expandido);
        btnVerMais.textContent = expandido ? "Ver menos ▴" : "Ver mais ▾";
    });

    requestAnimationFrame(() => {
        const precisaExpandir = conteudo.scrollHeight > conteudo.clientHeight + 2;
        btnVerMais.hidden = !precisaExpandir;
    });

    btnEditar.addEventListener("click", () => {
        abrirModalPublicacao(publicacao.id);
    });

    btnCopiar.addEventListener("click", async () => {
        await navigator.clipboard.writeText(textoPuro(publicacao.conteudo));
        btnCopiar.textContent = "✓";
        setTimeout(() => { btnCopiar.textContent = "📋"; }, 1500);
    });

    return card;
}

function renderizarModulos() {
    const modulosFiltrados = filtrarModulos();
    listaModulos.replaceChildren();
    gridModulos.replaceChildren();

    modulosFiltrados.forEach((modulo) => {
        listaModulos.appendChild(criarCardModuloSidebar(modulo));
        gridModulos.appendChild(criarCardModuloGrid(modulo));
    });

    if (modulosFiltrados.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "lista-vazia";
        vazio.textContent = modulos.length === 0
            ? 'Nenhum módulo criado. Clique em "Novo Módulo +".'
            : "Nenhum módulo encontrado.";
        listaModulos.appendChild(vazio);
        gridModulos.appendChild(vazio.cloneNode(true));
    }
}

function renderizarPublicacoes() {
    const modulo = obterModulo(moduloAtivoId);
    if (!modulo) return;

    moduloTitulo.textContent = modulo.nome;
    listaPublicacoes.replaceChildren();

    const publicacoes = filtrarPublicacoes(modulo);

    if (publicacoes.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "lista-vazia";
        vazio.textContent = modulo.publicacoes.length === 0
            ? 'Nenhuma publicação neste módulo. Clique em "Criar Publicação".'
            : "Nenhuma publicação encontrada neste módulo.";
        listaPublicacoes.appendChild(vazio);
        return;
    }

    publicacoes.forEach((pub) => {
        listaPublicacoes.appendChild(criarCardPublicacao(pub));
    });
}

function selecionarModulo(id) {
    if (!obterModulo(id)) return;

    moduloAtivoId = id;
    termoBuscaItem = "";
    buscaItem.value = "";
    sidebar.hidden = false;
    painelExplorar.hidden = true;
    painelModulo.hidden = false;
    renderizarModulos();
    renderizarPublicacoes();
}

function voltarParaExplorar() {
    moduloAtivoId = null;
    sidebar.hidden = true;
    painelModulo.hidden = true;
    painelExplorar.hidden = false;
    renderizarModulos();
}

async function reordenarModulo(idOrigem, idDestino) {
    const lista = [...modulos];
    const fromIdx = lista.findIndex((m) => m.id === idOrigem);
    const toIdx = lista.findIndex((m) => m.id === idDestino);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const [item] = lista.splice(fromIdx, 1);
    lista.splice(toIdx, 0, item);

    mostrarLoading(true);

    try {
        await Promise.all(
            lista.map((modulo, i) => {
                const novaOrdem = i + 1;
                if (modulo.ordem === novaOrdem) return Promise.resolve();
                return supabaseClient
                    .from("modulos")
                    .update({ ordem: novaOrdem })
                    .eq("id", modulo.id)
                    .then(({ error }) => {
                        if (error) throw error;
                    });
            })
        );

        await carregarDados();
        renderizarModulos();
        if (moduloAtivoId) renderizarPublicacoes();
    } catch (erro) {
        tratarErro(erro, "reordenar módulo");
    } finally {
        mostrarLoading(false);
    }
}

let arrastarGridIniciado = false;
let arrastandoModulo = null;

function finalizarArrastar(alvoCard) {
    if (!arrastandoModulo) return;

    const { card, id } = arrastandoModulo;
    card.classList.remove("arrastando");
    gridModulos.querySelectorAll(".card-modulo-grid").forEach((c) => {
        c.classList.remove("sobre-arrasto");
    });

    if (alvoCard && alvoCard !== card) {
        reordenarModulo(id, alvoCard.dataset.id);
    }

    arrastandoModulo = null;
}

function iniciarArrastarGrid() {
    if (arrastarGridIniciado) return;
    arrastarGridIniciado = true;

    gridModulos.addEventListener("pointerdown", (e) => {
        if (termoBuscaGlobal.trim()) return;

        const handle = e.target.closest(".modulo-arrastar");
        if (!handle) return;

        const card = handle.closest(".card-modulo-grid");
        if (!card) return;

        e.preventDefault();
        handle.setPointerCapture(e.pointerId);

        arrastandoModulo = {
            id: card.dataset.id,
            card,
            pointerId: e.pointerId
        };
        card.classList.add("arrastando");
    });

    gridModulos.addEventListener("pointermove", (e) => {
        if (!arrastandoModulo || e.pointerId !== arrastandoModulo.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".card-modulo-grid");
        gridModulos.querySelectorAll(".card-modulo-grid").forEach((c) => {
            c.classList.toggle("sobre-arrasto", alvo === c && c !== arrastandoModulo.card);
        });
    });

    gridModulos.addEventListener("pointerup", (e) => {
        if (!arrastandoModulo || e.pointerId !== arrastandoModulo.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".card-modulo-grid");
        finalizarArrastar(alvo);
    });

    gridModulos.addEventListener("pointercancel", (e) => {
        if (!arrastandoModulo || e.pointerId !== arrastandoModulo.pointerId) return;
        finalizarArrastar(null);
    });

    gridModulos.addEventListener("lostpointercapture", () => {
        if (arrastandoModulo) finalizarArrastar(null);
    });
}

async function salvarModulo(e) {
    e.preventDefault();

    const nome = inputModuloNome.value.trim();
    if (!nome) return;

    mostrarLoading(true);

    try {
        if (editandoModuloId) {
            const { error } = await supabaseClient
                .from("modulos")
                .update({ nome })
                .eq("id", editandoModuloId);

            if (error) throw error;
        } else {
            const maxOrdem = modulos.reduce((max, m) => Math.max(max, m.ordem || 0), 0);
            const { data, error } = await supabaseClient
                .from("modulos")
                .insert({ nome, ordem: maxOrdem + 1 })
                .select("id")
                .single();

            if (error) throw error;
            moduloAtivoId = data.id;
        }

        await carregarDados();
        fecharModal();

        if (moduloAtivoId) {
            painelExplorar.hidden = true;
            painelModulo.hidden = false;
            sidebar.hidden = false;
        }

        renderizarModulos();
        if (moduloAtivoId) renderizarPublicacoes();
    } catch (erro) {
        tratarErro(erro, "salvar módulo");
    } finally {
        mostrarLoading(false);
    }
}

async function excluirModulo() {
    if (!editandoModuloId) return;
    if (!confirm("Excluir este módulo e todas as publicações dentro dele?")) return;

    mostrarLoading(true);

    try {
        const { error } = await supabaseClient
            .from("modulos")
            .delete()
            .eq("id", editandoModuloId);

        if (error) throw error;

        if (moduloAtivoId === editandoModuloId) {
            voltarParaExplorar();
        }

        await carregarDados();
        fecharModal();
        renderizarModulos();
    } catch (erro) {
        tratarErro(erro, "excluir módulo");
    } finally {
        mostrarLoading(false);
    }
}

async function salvarPublicacao(e) {
    e.preventDefault();

    const titulo = inputPublicacaoTitulo.value.trim();
    const conteudo = obterConteudoDoEditor();
    if (!titulo || editorEstaVazio() || !moduloAtivoId) return;

    mostrarLoading(true);

    try {
        if (editandoPublicacaoId) {
            const { error } = await supabaseClient
                .from("publicacoes")
                .update({ titulo, conteudo })
                .eq("id", editandoPublicacaoId);

            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from("publicacoes")
                .insert({
                    modulo_id: moduloAtivoId,
                    titulo,
                    conteudo
                });

            if (error) throw error;
        }

        await carregarDados();
        fecharModal();
        renderizarModulos();
        renderizarPublicacoes();
    } catch (erro) {
        tratarErro(erro, "salvar publicação");
    } finally {
        mostrarLoading(false);
    }
}

async function excluirPublicacao() {
    if (!editandoPublicacaoId || !moduloAtivoId) return;
    if (!confirm("Excluir esta publicação?")) return;

    mostrarLoading(true);

    try {
        const { error } = await supabaseClient
            .from("publicacoes")
            .delete()
            .eq("id", editandoPublicacaoId);

        if (error) throw error;

        await carregarDados();
        fecharModal();
        renderizarModulos();
        renderizarPublicacoes();
    } catch (erro) {
        tratarErro(erro, "excluir publicação");
    } finally {
        mostrarLoading(false);
    }
}

function aplicarTema(claro) {
    document.body.classList.toggle("tema-claro", claro);
    botaoTema.textContent = claro ? "Escuro" : "Claro";
    localStorage.setItem("tema", claro ? "claro" : "escuro");
}

document.getElementById("criar-modulo").addEventListener("click", () => abrirModalModulo());
document.getElementById("voltar-modulos").addEventListener("click", voltarParaExplorar);
document.getElementById("criar-publicacao").addEventListener("click", () => abrirModalPublicacao());
document.getElementById("editar-modulo").addEventListener("click", () => {
    if (moduloAtivoId) abrirModalModulo(moduloAtivoId);
});

formModulo.addEventListener("submit", salvarModulo);
formPublicacao.addEventListener("submit", salvarPublicacao);
btnExcluirModulo.addEventListener("click", excluirModulo);
btnExcluirPublicacao.addEventListener("click", excluirPublicacao);

modalFechar.addEventListener("click", fecharModal);
modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) fecharModal();
});

document.querySelectorAll("[data-acao='cancelar']").forEach((btn) => {
    btn.addEventListener("click", fecharModal);
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modalOverlay.hidden) fecharModal();
});

buscaGlobal.addEventListener("input", (e) => {
    termoBuscaGlobal = e.target.value;
    renderizarModulos();

    if (moduloAtivoId) {
        const aindaVisivel = filtrarModulos().some((m) => m.id === moduloAtivoId);
        if (!aindaVisivel) voltarParaExplorar();
        else renderizarPublicacoes();
    }
});

buscaItem.addEventListener("input", (e) => {
    termoBuscaItem = e.target.value;
    renderizarPublicacoes();
});

document.getElementById("busca-global-form").addEventListener("submit", (e) => e.preventDefault());
document.getElementById("busca-item-form").addEventListener("submit", (e) => e.preventDefault());

botaoTema.addEventListener("click", () => {
    aplicarTema(!document.body.classList.contains("tema-claro"));
});

async function iniciar() {
    const temaSalvo = localStorage.getItem("tema");
    aplicarTema(temaSalvo === "claro");

    if (!configValida()) {
        mostrarErroConfig();
        return;
    }

    supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );

    iniciarArrastarGrid();

    mostrarLoading(true);

    try {
        await carregarDados();
        renderizarModulos();
    } catch (erro) {
        tratarErro(erro, "carregar dados");
    } finally {
        mostrarLoading(false);
    }
}

iniciar();
