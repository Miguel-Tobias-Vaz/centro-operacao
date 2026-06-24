let supabaseClient = null;
let modulos = [];
let categoriasModuloLista = [];
let moduloAtivoId = null;
let termoBuscaGlobal = "";
let termoBuscaItem = "";
let editandoModuloId = null;
let editandoCategoriaId = null;
let editandoPublicacaoId = null;

const listaModulos = document.getElementById("lista-modulos");
const categoriasModulos = document.getElementById("categorias-modulos");
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
const formCategoria = document.getElementById("form-categoria");
const formPublicacao = document.getElementById("form-publicacao");
const inputModuloNome = document.getElementById("modulo-nome");
const inputModuloCategoria = document.getElementById("modulo-categoria");
const inputCategoriaTitulo = document.getElementById("categoria-titulo");
const inputCategoriaDescricao = document.getElementById("categoria-descricao");
const btnExcluirCategoria = document.getElementById("excluir-categoria");
const btnSalvarCategoria = document.getElementById("btn-salvar-categoria");
const inputImagemModulo = document.getElementById("modulo-imagem-input");
const btnPreviewImagemModulo = document.getElementById("modulo-imagem-preview");
const imgPreviewModulo = document.getElementById("modulo-imagem-img");
const placeholderImagemModulo = document.getElementById("modulo-imagem-placeholder");
const btnRemoverImagemModulo = document.getElementById("btn-remover-imagem-modulo");
const moduloAvatarHeader = document.getElementById("modulo-avatar-header");
const inputPublicacaoTitulo = document.getElementById("publicacao-titulo-input");
const btnExcluirModulo = document.getElementById("excluir-modulo");
const btnExcluirPublicacao = document.getElementById("excluir-publicacao");
const inputArquivoPublicacao = document.getElementById("publicacao-arquivo-input");
const zonaUploadArquivo = document.getElementById("zona-upload-arquivo");
const zonaUploadTexto = document.getElementById("zona-upload-texto");
const infoArquivoPublicacao = document.getElementById("arquivo-publicacao-info");
const nomeArquivoPublicacao = document.getElementById("arquivo-publicacao-nome");
const btnRemoverArquivo = document.getElementById("btn-remover-arquivo");

const BUCKET_ARQUIVOS = "publicacoes-arquivos";
const BUCKET_MODULOS_IMAGENS = "modulos-imagens";

const CATEGORIAS_PADRAO = [
    {
        id: "site",
        titulo: "Site",
        descricao: "Módulos e conteúdos voltados ao site público.",
        ordem: 1
    },
    {
        id: "interno",
        titulo: "Interno",
        descricao: "Ferramentas e referências de uso interno da equipe.",
        ordem: 2
    },
    {
        id: "portal",
        titulo: "Portal",
        descricao: "Conteúdos e acessos do portal institucional.",
        ordem: 3
    }
];

function criarSlugCategoria(titulo) {
    const slug = titulo
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 48);

    return slug || "categoria";
}

function obterIdCategoriaPadrao() {
    return categoriasModuloLista[0]?.id || CATEGORIAS_PADRAO[0].id;
}

function normalizarCategoria(categoria) {
    const id = (categoria || obterIdCategoriaPadrao()).toLowerCase();
    if (categoriasModuloLista.some((c) => c.id === id)) return id;
    return obterIdCategoriaPadrao();
}

function obterCategoriaModulo(modulo) {
    const id = normalizarCategoria(modulo?.categoria);
    return categoriasModuloLista.find((c) => c.id === id) || {
        id,
        titulo: id,
        descricao: ""
    };
}

function preencherSelectCategorias(selecionada = null) {
    if (!inputModuloCategoria) return;

    const valorAtual = selecionada || inputModuloCategoria.value || obterIdCategoriaPadrao();
    inputModuloCategoria.replaceChildren();

    categoriasModuloLista.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat.id;
        opt.textContent = cat.titulo;
        inputModuloCategoria.appendChild(opt);
    });

    if (categoriasModuloLista.some((c) => c.id === valorAtual)) {
        inputModuloCategoria.value = valorAtual;
    } else if (categoriasModuloLista.length) {
        inputModuloCategoria.value = categoriasModuloLista[0].id;
    }
}

async function carregarCategorias() {
    const { data, error } = await supabaseClient
        .from("categorias_modulo")
        .select("id, titulo, descricao, ordem")
        .order("ordem", { ascending: true });

    if (error) {
        if (error.code === "42P01" || error.message?.includes("categorias_modulo")) {
            categoriasModuloLista = [...CATEGORIAS_PADRAO];
            preencherSelectCategorias();
            return;
        }
        throw error;
    }

    categoriasModuloLista = (data || []).length ? data : [...CATEGORIAS_PADRAO];
    preencherSelectCategorias();
}

function obterCategoriasParaExibir() {
    const lista = [...categoriasModuloLista];
    const ids = new Set(lista.map((c) => c.id));

    modulos.forEach((modulo) => {
        const id = modulo.categoria;
        if (id && !ids.has(id)) {
            ids.add(id);
            lista.push({
                id,
                titulo: id,
                descricao: "",
                ordem: 9999
            });
        }
    });

    return lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
}

const TAMANHO_MAX_ARQUIVO = 10 * 1024 * 1024;
const TAMANHO_MAX_IMAGEM_MODULO = 2 * 1024 * 1024;

let imagemModuloPendente = null;
let imagemModuloPreviewUrl = null;
let imagemModuloAtual = null;
let removerImagemModulo = false;
let moduloFormSessao = 0;
let imagemModuloSessaoId = null;

let arquivoPublicacaoPendente = null;
let removerArquivoPublicacao = false;
let arquivoPublicacaoAtual = null;
let publicacaoFormSessao = 0;
let arquivoSessaoId = null;

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

function formatarTamanhoArquivo(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function limparEstadoArquivoPublicacao() {
    arquivoPublicacaoPendente = null;
    removerArquivoPublicacao = false;
    arquivoPublicacaoAtual = null;
    arquivoSessaoId = null;
    if (inputArquivoPublicacao) inputArquivoPublicacao.value = "";
    if (infoArquivoPublicacao) infoArquivoPublicacao.hidden = true;
    if (zonaUploadArquivo) zonaUploadArquivo.classList.remove("com-arquivo", "sobre-arrasto-arquivo");
    atualizarUIArquivoPublicacao();
}

function resetarFormularioPublicacao() {
    if (inputPublicacaoTitulo) inputPublicacaoTitulo.value = "";
    carregarConteudoNoEditor("");
    limparEstadoArquivoPublicacao();
}

function atualizarUIArquivoPublicacao() {
    const temPendente = !!arquivoPublicacaoPendente;
    const temAtual = !!arquivoPublicacaoAtual && !removerArquivoPublicacao;

    if (temPendente) {
        zonaUploadTexto.textContent = arquivoPublicacaoPendente.name;
        nomeArquivoPublicacao.textContent = `${arquivoPublicacaoPendente.name} (${formatarTamanhoArquivo(arquivoPublicacaoPendente.size)})`;
        infoArquivoPublicacao.hidden = false;
        zonaUploadArquivo.classList.add("com-arquivo");
    } else if (temAtual) {
        zonaUploadTexto.textContent = "Clique para substituir o arquivo";
        nomeArquivoPublicacao.textContent = arquivoPublicacaoAtual.nome;
        infoArquivoPublicacao.hidden = false;
        zonaUploadArquivo.classList.add("com-arquivo");
    } else {
        zonaUploadTexto.textContent = "Clique ou arraste um arquivo aqui";
        infoArquivoPublicacao.hidden = true;
        zonaUploadArquivo.classList.remove("com-arquivo");
    }
}

function selecionarArquivoPublicacao(file) {
    if (!file) return;

    if (file.size > TAMANHO_MAX_ARQUIVO) {
        alert("O arquivo deve ter no máximo 10 MB.");
        return;
    }

    arquivoPublicacaoPendente = file;
    arquivoSessaoId = publicacaoFormSessao;
    removerArquivoPublicacao = false;
    atualizarUIArquivoPublicacao();
}

function obterUrlPublicaArquivo(caminho) {
    const { data } = supabaseClient.storage.from(BUCKET_ARQUIVOS).getPublicUrl(caminho);
    return data.publicUrl;
}

function obterUrlPublicaImagemModulo(caminho) {
    if (!caminho) return "";
    const { data } = supabaseClient.storage.from(BUCKET_MODULOS_IMAGENS).getPublicUrl(caminho);
    return data.publicUrl;
}

function moduloTemImagem(modulo) {
    return !!modulo?.imagem_url;
}

function inicialModulo(nome) {
    return (nome?.trim()?.charAt(0) || "?").toUpperCase();
}

function htmlAvatarModulo(modulo, tamanho = "") {
    const classe = tamanho ? `modulo-avatar ${tamanho}` : "modulo-avatar";
    if (moduloTemImagem(modulo)) {
        return `<div class="${classe}"><img src="${obterUrlPublicaImagemModulo(modulo.imagem_url)}" alt="" class="modulo-avatar-img"></div>`;
    }
    return `<div class="${classe}"><span class="modulo-avatar-inicial">${escaparHtml(inicialModulo(modulo.nome))}</span></div>`;
}

function preencherAvatarElemento(el, modulo) {
    if (!el) return;

    if (moduloTemImagem(modulo)) {
        el.innerHTML = `<img src="${obterUrlPublicaImagemModulo(modulo.imagem_url)}" alt="" class="modulo-avatar-img">`;
    } else {
        el.innerHTML = `<span class="modulo-avatar-inicial">${escaparHtml(inicialModulo(modulo.nome))}</span>`;
    }
}

function revogarPreviewImagemModulo() {
    if (imagemModuloPreviewUrl) {
        URL.revokeObjectURL(imagemModuloPreviewUrl);
        imagemModuloPreviewUrl = null;
    }
}

function limparEstadoImagemModulo() {
    imagemModuloPendente = null;
    imagemModuloAtual = null;
    removerImagemModulo = false;
    imagemModuloSessaoId = null;
    revogarPreviewImagemModulo();
    if (inputImagemModulo) inputImagemModulo.value = "";
    atualizarPreviewImagemModulo(null);
    if (btnRemoverImagemModulo) btnRemoverImagemModulo.hidden = true;
}

function resetarFormularioModulo() {
    if (inputModuloNome) inputModuloNome.value = "";
    limparEstadoImagemModulo();
}

function atualizarPreviewImagemModulo(src) {
    if (!imgPreviewModulo || !placeholderImagemModulo) return;

    if (src) {
        imgPreviewModulo.src = src;
        imgPreviewModulo.hidden = false;
        placeholderImagemModulo.hidden = true;
        if (btnRemoverImagemModulo) btnRemoverImagemModulo.hidden = false;
    } else {
        imgPreviewModulo.removeAttribute("src");
        imgPreviewModulo.hidden = true;
        placeholderImagemModulo.hidden = false;
    }
}

function selecionarImagemModulo(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Selecione um arquivo de imagem (PNG, JPG, etc.).");
        return;
    }

    if (file.size > TAMANHO_MAX_IMAGEM_MODULO) {
        alert("A imagem deve ter no máximo 2 MB.");
        return;
    }

    revogarPreviewImagemModulo();
    imagemModuloPendente = file;
    imagemModuloSessaoId = moduloFormSessao;
    removerImagemModulo = false;
    imagemModuloPreviewUrl = URL.createObjectURL(file);
    atualizarPreviewImagemModulo(imagemModuloPreviewUrl);
}

async function enviarImagemModulo(moduloId, file) {
    const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : ".jpg";
    const caminho = `${moduloId}/${Date.now()}${ext}`;

    const { error } = await supabaseClient.storage
        .from(BUCKET_MODULOS_IMAGENS)
        .upload(caminho, file, { upsert: true, cacheControl: "3600", contentType: file.type });

    if (error) throw error;
    return caminho;
}

async function excluirImagemModuloStorage(caminho) {
    if (!caminho) return;
    const { error } = await supabaseClient.storage.from(BUCKET_MODULOS_IMAGENS).remove([caminho]);
    if (error) console.warn("Não foi possível excluir imagem do módulo:", error);
}

let uploadImagemModuloIniciado = false;

function iniciarUploadImagemModulo() {
    if (uploadImagemModuloIniciado) return;
    uploadImagemModuloIniciado = true;

    btnPreviewImagemModulo?.addEventListener("click", () => inputImagemModulo?.click());

    inputImagemModulo?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) selecionarImagemModulo(file);
    });

    btnRemoverImagemModulo?.addEventListener("click", () => {
        imagemModuloPendente = null;
        imagemModuloSessaoId = null;
        if (inputImagemModulo) inputImagemModulo.value = "";
        revogarPreviewImagemModulo();
        if (imagemModuloAtual) removerImagemModulo = true;
        atualizarPreviewImagemModulo(null);
        if (btnRemoverImagemModulo) btnRemoverImagemModulo.hidden = !imagemModuloAtual;
    });
}

async function enviarArquivoPublicacao(publicacaoId, file) {
    const nomeSeguro = file.name.replace(/[^\w.\-()+\s]/g, "_");
    const caminho = `${publicacaoId}/${Date.now()}_${nomeSeguro}`;

    const { error } = await supabaseClient.storage
        .from(BUCKET_ARQUIVOS)
        .upload(caminho, file, { upsert: true, cacheControl: "3600" });

    if (error) throw error;
    return { caminho, nome: file.name };
}

async function excluirArquivoStorage(caminho) {
    if (!caminho) return;
    const { error } = await supabaseClient.storage.from(BUCKET_ARQUIVOS).remove([caminho]);
    if (error) console.warn("Não foi possível excluir arquivo:", error);
}

function publicacaoTemArquivo(publicacao) {
    return !!(publicacao.arquivo_url && publicacao.arquivo_nome);
}

let uploadArquivoIniciado = false;

function iniciarUploadArquivo() {
    if (uploadArquivoIniciado) return;
    uploadArquivoIniciado = true;
    zonaUploadArquivo?.addEventListener("click", () => inputArquivoPublicacao?.click());

    zonaUploadArquivo?.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputArquivoPublicacao?.click();
        }
    });

    inputArquivoPublicacao?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) selecionarArquivoPublicacao(file);
    });

    zonaUploadArquivo?.addEventListener("dragover", (e) => {
        e.preventDefault();
        zonaUploadArquivo.classList.add("sobre-arrasto-arquivo");
    });

    zonaUploadArquivo?.addEventListener("dragleave", () => {
        zonaUploadArquivo.classList.remove("sobre-arrasto-arquivo");
    });

    zonaUploadArquivo?.addEventListener("drop", (e) => {
        e.preventDefault();
        zonaUploadArquivo.classList.remove("sobre-arrasto-arquivo");
        const file = e.dataTransfer.files?.[0];
        if (file) selecionarArquivoPublicacao(file);
    });

    btnRemoverArquivo?.addEventListener("click", () => {
        arquivoPublicacaoPendente = null;
        if (inputArquivoPublicacao) inputArquivoPublicacao.value = "";
        if (arquivoPublicacaoAtual) removerArquivoPublicacao = true;
        atualizarUIArquivoPublicacao();
    });
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
                textoPuro(p.conteudo).toLowerCase().includes(termo) ||
                (p.arquivo_nome || "").toLowerCase().includes(termo)
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
            textoPuro(p.conteudo).toLowerCase().includes(termo) ||
            (p.arquivo_nome || "").toLowerCase().includes(termo)
    );
}

function tratarErro(erro, acao) {
    console.error(erro);
    alert(`Erro ao ${acao}: ${erro.message}`);
}

async function carregarDados() {
    await carregarCategorias();

    const { data, error } = await supabaseClient
        .from("modulos")
        .select(`
            id,
            nome,
            ordem,
            categoria,
            imagem_url,
            created_at,
            publicacoes (
                id,
                titulo,
                conteudo,
                ordem,
                arquivo_url,
                arquivo_nome,
                created_at
            )
        `)
        .order("ordem", { ascending: true })
        .order("created_at", { foreignTable: "publicacoes", ascending: true });

    if (error) throw error;

    modulos = (data || []).map((modulo) => ({
        id: modulo.id,
        nome: modulo.nome,
        ordem: modulo.ordem ?? 0,
        categoria: normalizarCategoria(modulo.categoria),
        imagem_url: modulo.imagem_url || null,
        publicacoes: (modulo.publicacoes || []).sort(
            (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
        )
    }));

    if (moduloAtivoId && !obterModulo(moduloAtivoId)) {
        voltarParaExplorar();
    }
}

function esconderFormulariosModal() {
    formModulo.hidden = true;
    formCategoria.hidden = true;
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
    editandoCategoriaId = null;
    editandoPublicacaoId = null;
    resetarFormularioModulo();
    resetarFormularioPublicacao();
}

function abrirModalModulo(id = null) {
    editandoModuloId = id;
    moduloFormSessao += 1;
    esconderFormulariosModal();
    formModulo.hidden = false;
    resetarFormularioModulo();
    preencherSelectCategorias();

    if (id) {
        const modulo = obterModulo(id);
        modalTitulo.textContent = "Editar Módulo";
        inputModuloNome.value = modulo.nome;
        if (inputModuloCategoria) {
            inputModuloCategoria.value = normalizarCategoria(modulo.categoria);
        }
        btnExcluirModulo.hidden = false;

        if (modulo.imagem_url) {
            imagemModuloAtual = modulo.imagem_url;
            atualizarPreviewImagemModulo(obterUrlPublicaImagemModulo(modulo.imagem_url));
        }
    } else {
        modalTitulo.textContent = "Novo Módulo";
        if (inputModuloCategoria) {
            inputModuloCategoria.value = obterIdCategoriaPadrao();
        }
        btnExcluirModulo.hidden = true;
    }

    abrirModal();
    inputModuloNome.focus();
}

function abrirModalCategoria(id = null) {
    editandoCategoriaId = id;
    esconderFormulariosModal();
    formCategoria.hidden = false;

    if (id) {
        const cat = categoriasModuloLista.find((c) => c.id === id);
        if (!cat) return;

        modalTitulo.textContent = "Editar Categoria";
        inputCategoriaTitulo.value = cat.titulo;
        inputCategoriaDescricao.value = cat.descricao || "";
        if (btnExcluirCategoria) btnExcluirCategoria.hidden = false;
        if (btnSalvarCategoria) btnSalvarCategoria.textContent = "Salvar";
    } else {
        modalTitulo.textContent = "Nova Categoria";
        inputCategoriaTitulo.value = "";
        inputCategoriaDescricao.value = "";
        if (btnExcluirCategoria) btnExcluirCategoria.hidden = true;
        if (btnSalvarCategoria) btnSalvarCategoria.textContent = "Criar categoria";
    }

    abrirModal();
    inputCategoriaTitulo.focus();
}

async function salvarCategoria(e) {
    e.preventDefault();

    const titulo = inputCategoriaTitulo.value.trim();
    if (!titulo) return;

    const descricao = inputCategoriaDescricao.value.trim()
        || `Módulos da categoria ${titulo}.`;

    mostrarLoading(true);

    try {
        if (editandoCategoriaId) {
            const { error } = await supabaseClient
                .from("categorias_modulo")
                .update({ titulo, descricao })
                .eq("id", editandoCategoriaId);

            if (error) throw error;
        } else {
            const id = criarSlugCategoria(titulo);

            if (categoriasModuloLista.some((c) => c.id === id)) {
                alert("Já existe uma categoria com esse nome. Escolha outro título.");
                return;
            }

            const maxOrdem = categoriasModuloLista.reduce(
                (max, c) => Math.max(max, c.ordem || 0),
                0
            );

            const { error } = await supabaseClient
                .from("categorias_modulo")
                .insert({ id, titulo, descricao, ordem: maxOrdem + 1 });

            if (error) throw error;
        }

        await carregarDados();
        fecharModal();
        renderizarModulos();
    } catch (erro) {
        tratarErro(erro, editandoCategoriaId ? "atualizar categoria" : "criar categoria");
    } finally {
        mostrarLoading(false);
    }
}

async function excluirCategoria() {
    if (!editandoCategoriaId) return;

    const cat = categoriasModuloLista.find((c) => c.id === editandoCategoriaId);
    const qtdModulos = modulos.filter(
        (m) => normalizarCategoria(m.categoria) === editandoCategoriaId
    ).length;

    if (qtdModulos > 0) {
        alert(
            `Não é possível excluir "${cat?.titulo || editandoCategoriaId}".\n\n` +
            `${qtdModulos} módulo(s) ainda usam esta categoria. Mova ou exclua os módulos antes.`
        );
        return;
    }

    const nome = cat?.titulo || editandoCategoriaId;
    if (!confirm(`Excluir a categoria "${nome}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    mostrarLoading(true);

    try {
        const { error } = await supabaseClient
            .from("categorias_modulo")
            .delete()
            .eq("id", editandoCategoriaId);

        if (error) throw error;

        await carregarDados();
        fecharModal();
        renderizarModulos();
    } catch (erro) {
        tratarErro(erro, "excluir categoria");
    } finally {
        mostrarLoading(false);
    }
}

function abrirModalPublicacao(id = null) {
    if (!id && !moduloAtivoId) {
        alert("Selecione um módulo antes de criar uma publicação.");
        return;
    }

    publicacaoFormSessao += 1;
    editandoPublicacaoId = id;
    esconderFormulariosModal();
    formPublicacao.hidden = false;
    modalEl.classList.add("modal-grande");
    abrirModal();
    iniciarEditor();
    resetarFormularioPublicacao();

    if (id) {
        const modulo = obterModulo(moduloAtivoId);
        const publicacao = modulo.publicacoes.find((p) => p.id === id);
        modalTitulo.textContent = "Editar Publicação";
        inputPublicacaoTitulo.value = publicacao.titulo;
        carregarConteudoNoEditor(publicacao.conteudo);
        if (publicacaoTemArquivo(publicacao)) {
            arquivoPublicacaoAtual = {
                url: publicacao.arquivo_url,
                nome: publicacao.arquivo_nome
            };
        }
        btnExcluirPublicacao.hidden = false;
        atualizarUIArquivoPublicacao();
    } else {
        modalTitulo.textContent = "Nova Publicação";
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
            ${htmlAvatarModulo(modulo, "modulo-avatar-sm")}
            <div class="card-modulo-info">
                <h3 class="card-modulo-nome">${escaparHtml(modulo.nome)}</h3>
                <p class="card-modulo-qtd">${modulo.publicacoes.length} publicação(ões)</p>
            </div>
        </div>
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
        <div class="modulo-arrastar item-arrastar" role="button" tabindex="0" aria-label="Arrastar para reordenar" title="Arrastar para reordenar">
            <span class="icone-arrastar" aria-hidden="true"></span>
        </div>
    `;

    card.innerHTML = `
        <div class="card-modulo-grid-topo">
            ${arrastar}
            ${htmlAvatarModulo(modulo, "modulo-avatar-md")}
        </div>
        <h3 class="card-modulo-nome">${escaparHtml(modulo.nome)}</h3>
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
    card.dataset.id = publicacao.id;

    const arrastar = termoBuscaItem.trim()
        ? ""
        : `
        <div class="item-arrastar" role="button" tabindex="0" aria-label="Arrastar para reordenar" title="Arrastar para reordenar">
            <span class="icone-arrastar" aria-hidden="true"></span>
        </div>
    `;

    const temArquivo = publicacaoTemArquivo(publicacao);
    const blocoArquivo = temArquivo
        ? `
        <div class="publicacao-arquivo">
            <a
                href="${obterUrlPublicaArquivo(publicacao.arquivo_url)}"
                class="btn btn-outline btn-sm btn-download"
                download="${escaparHtml(publicacao.arquivo_nome)}"
                target="_blank"
                rel="noopener noreferrer"
            >⬇ Baixar ${escaparHtml(publicacao.arquivo_nome)}</a>
        </div>
    `
        : "";

    card.innerHTML = `
        <div class="card-publicacao-cabecalho">
            ${arrastar}
            <h3 class="publicacao-titulo">${escaparHtml(publicacao.titulo)}</h3>
        </div>
        <div class="publicacao-conteudo">${formatarConteudo(publicacao.conteudo)}</div>
        ${blocoArquivo}
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
        const conteudoVazio = !textoPuro(publicacao.conteudo).trim();
        btnVerMais.hidden = !precisaExpandir || conteudoVazio;
        if (conteudoVazio) conteudo.hidden = true;
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

function categoriaEhEditavel(categoria) {
    return categoriasModuloLista.some((c) => c.id === categoria.id);
}

function criarSecaoCategoria(categoria, modulosDaCategoria) {
    const secao = document.createElement("section");
    secao.className = "categoria-modulos painel-explorar";
    secao.dataset.categoria = categoria.id;

    const cabecalho = document.createElement("header");
    cabecalho.className = "explorar-header";

    const topo = document.createElement("div");
    topo.className = "explorar-header-topo";
    topo.innerHTML = `
        <div class="explorar-header-texto">
            <p class="explorar-rotulo">Explorar</p>
            <h2 class="explorar-titulo">${escaparHtml(categoria.titulo)}</h2>
            <p class="explorar-descricao">${escaparHtml(categoria.descricao)}</p>
        </div>
    `;

    if (categoriaEhEditavel(categoria)) {
        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn btn-outline btn-sm explorar-btn-editar";
        btnEditar.textContent = "Editar categoria";
        btnEditar.addEventListener("click", () => abrirModalCategoria(categoria.id));
        topo.appendChild(btnEditar);
    }

    cabecalho.appendChild(topo);

    const grid = document.createElement("div");
    grid.className = "grid-modulos";
    grid.dataset.categoria = categoria.id;

    if (modulosDaCategoria.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "lista-vazia categoria-vazia";
        vazio.textContent = "Nenhum módulo nesta categoria.";
        grid.appendChild(vazio);
    } else {
        modulosDaCategoria.forEach((modulo) => {
            grid.appendChild(criarCardModuloGrid(modulo));
        });
    }

    secao.append(cabecalho, grid);
    return secao;
}

function renderizarModulos() {
    const modulosFiltrados = filtrarModulos();
    listaModulos.replaceChildren();
    if (categoriasModulos) categoriasModulos.replaceChildren();

    if (modulosFiltrados.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "lista-vazia";
        vazio.textContent = modulos.length === 0
            ? 'Nenhum módulo criado. Clique em "Novo Módulo +".'
            : "Nenhum módulo encontrado.";
        listaModulos.appendChild(vazio);
        if (categoriasModulos) categoriasModulos.appendChild(vazio.cloneNode(true));
        return;
    }

    obterCategoriasParaExibir().forEach((categoria) => {
        const daCategoria = modulosFiltrados
            .filter((m) => normalizarCategoria(m.categoria) === categoria.id)
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        const mostrarSecao = daCategoria.length > 0 || !termoBuscaGlobal.trim();
        if (categoriasModulos && mostrarSecao) {
            categoriasModulos.appendChild(criarSecaoCategoria(categoria, daCategoria));
        }

        if (daCategoria.length > 0) {
            const grupo = document.createElement("div");
            grupo.className = "sidebar-grupo-categoria";

            const tituloGrupo = document.createElement("h3");
            tituloGrupo.className = "sidebar-categoria-titulo";
            tituloGrupo.textContent = categoria.titulo;

            const lista = document.createElement("div");
            lista.className = "lista-modulos-interna";
            daCategoria.forEach((modulo) => {
                lista.appendChild(criarCardModuloSidebar(modulo));
            });

            grupo.append(tituloGrupo, lista);
            listaModulos.appendChild(grupo);
        }
    });
}

function renderizarPublicacoes() {
    const modulo = obterModulo(moduloAtivoId);
    if (!modulo) return;

    moduloTitulo.textContent = modulo.nome;

    if (moduloAvatarHeader) {
        preencherAvatarElemento(moduloAvatarHeader, modulo);
        moduloAvatarHeader.hidden = false;
        moduloAvatarHeader.removeAttribute("aria-hidden");
    }

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
    termoBuscaItem = "";
    if (buscaItem) buscaItem.value = "";
    sidebar.hidden = true;
    painelModulo.hidden = true;
    painelExplorar.hidden = false;
    renderizarModulos();
}

function irParaHome() {
    termoBuscaGlobal = "";
    if (buscaGlobal) buscaGlobal.value = "";
    voltarParaExplorar();
}

async function reordenarModulo(idOrigem, idDestino) {
    const origem = obterModulo(idOrigem);
    const destino = obterModulo(idDestino);
    if (!origem || !destino) return;

    const categoriaId = normalizarCategoria(origem.categoria);
    if (categoriaId !== normalizarCategoria(destino.categoria)) return;

    const lista = modulos
        .filter((m) => normalizarCategoria(m.categoria) === categoriaId)
        .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

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
    categoriasModulos?.querySelectorAll(".card-modulo-grid").forEach((c) => {
        c.classList.remove("sobre-arrasto");
    });

    if (alvoCard && alvoCard !== card) {
        const origem = obterModulo(id);
        const destino = obterModulo(alvoCard.dataset.id);
        if (
            origem &&
            destino &&
            normalizarCategoria(origem.categoria) === normalizarCategoria(destino.categoria)
        ) {
            reordenarModulo(id, alvoCard.dataset.id);
        }
    }

    arrastandoModulo = null;
}

function iniciarArrastarGrid() {
    if (arrastarGridIniciado || !categoriasModulos) return;
    arrastarGridIniciado = true;

    categoriasModulos.addEventListener("pointerdown", (e) => {
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

    categoriasModulos.addEventListener("pointermove", (e) => {
        if (!arrastandoModulo || e.pointerId !== arrastandoModulo.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".card-modulo-grid");
        categoriasModulos.querySelectorAll(".card-modulo-grid").forEach((c) => {
            c.classList.toggle("sobre-arrasto", alvo === c && c !== arrastandoModulo.card);
        });
    });

    categoriasModulos.addEventListener("pointerup", (e) => {
        if (!arrastandoModulo || e.pointerId !== arrastandoModulo.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".card-modulo-grid");
        finalizarArrastar(alvo);
    });

    categoriasModulos.addEventListener("pointercancel", (e) => {
        if (!arrastandoModulo || e.pointerId !== arrastandoModulo.pointerId) return;
        finalizarArrastar(null);
    });

    categoriasModulos.addEventListener("lostpointercapture", () => {
        if (arrastandoModulo) finalizarArrastar(null);
    });
}

async function reordenarPublicacao(idOrigem, idDestino) {
    const modulo = obterModulo(moduloAtivoId);
    if (!modulo) return;

    const lista = [...modulo.publicacoes];
    const fromIdx = lista.findIndex((p) => p.id === idOrigem);
    const toIdx = lista.findIndex((p) => p.id === idDestino);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

    const [item] = lista.splice(fromIdx, 1);
    lista.splice(toIdx, 0, item);

    mostrarLoading(true);

    try {
        await Promise.all(
            lista.map((pub, i) => {
                const novaOrdem = i + 1;
                if (pub.ordem === novaOrdem) return Promise.resolve();
                return supabaseClient
                    .from("publicacoes")
                    .update({ ordem: novaOrdem })
                    .eq("id", pub.id)
                    .then(({ error }) => {
                        if (error) throw error;
                    });
            })
        );

        await carregarDados();
        renderizarModulos();
        renderizarPublicacoes();
    } catch (erro) {
        tratarErro(erro, "reordenar publicação");
    } finally {
        mostrarLoading(false);
    }
}

let arrastarPublicacoesIniciado = false;
let arrastandoPublicacao = null;

function finalizarArrastarPublicacao(alvoCard) {
    if (!arrastandoPublicacao) return;

    const { card, id } = arrastandoPublicacao;
    card.classList.remove("arrastando");
    listaPublicacoes.querySelectorAll(".card-publicacao").forEach((c) => {
        c.classList.remove("sobre-arrasto");
    });

    if (alvoCard && alvoCard !== card) {
        reordenarPublicacao(id, alvoCard.dataset.id);
    }

    arrastandoPublicacao = null;
}

function iniciarArrastarPublicacoes() {
    if (arrastarPublicacoesIniciado) return;
    arrastarPublicacoesIniciado = true;

    listaPublicacoes.addEventListener("pointerdown", (e) => {
        if (termoBuscaItem.trim()) return;

        const handle = e.target.closest(".item-arrastar");
        if (!handle) return;

        const card = handle.closest(".card-publicacao");
        if (!card) return;

        e.preventDefault();
        handle.setPointerCapture(e.pointerId);

        arrastandoPublicacao = {
            id: card.dataset.id,
            card,
            pointerId: e.pointerId
        };
        card.classList.add("arrastando");
    });

    listaPublicacoes.addEventListener("pointermove", (e) => {
        if (!arrastandoPublicacao || e.pointerId !== arrastandoPublicacao.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".card-publicacao");
        listaPublicacoes.querySelectorAll(".card-publicacao").forEach((c) => {
            c.classList.toggle("sobre-arrasto", alvo === c && c !== arrastandoPublicacao.card);
        });
    });

    listaPublicacoes.addEventListener("pointerup", (e) => {
        if (!arrastandoPublicacao || e.pointerId !== arrastandoPublicacao.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".card-publicacao");
        finalizarArrastarPublicacao(alvo);
    });

    listaPublicacoes.addEventListener("pointercancel", (e) => {
        if (!arrastandoPublicacao || e.pointerId !== arrastandoPublicacao.pointerId) return;
        finalizarArrastarPublicacao(null);
    });

    listaPublicacoes.addEventListener("lostpointercapture", () => {
        if (arrastandoPublicacao) finalizarArrastarPublicacao(null);
    });
}

async function salvarModulo(e) {
    e.preventDefault();

    const nome = inputModuloNome.value.trim();
    if (!nome) return;

    const categoria = normalizarCategoria(inputModuloCategoria?.value);

    const imagemPendente =
        imagemModuloPendente && imagemModuloSessaoId === moduloFormSessao
            ? imagemModuloPendente
            : null;
    const imagemAtual = imagemModuloAtual || null;
    const removerImagem = removerImagemModulo;

    mostrarLoading(true);

    try {
        let moduloId = editandoModuloId;

        if (editandoModuloId) {
            const { error } = await supabaseClient
                .from("modulos")
                .update({ nome, categoria })
                .eq("id", editandoModuloId);

            if (error) throw error;
        } else {
            const maxOrdem = modulos
                .filter((m) => normalizarCategoria(m.categoria) === categoria)
                .reduce((max, m) => Math.max(max, m.ordem || 0), 0);
            const { data, error } = await supabaseClient
                .from("modulos")
                .insert({ nome, categoria, ordem: maxOrdem + 1 })
                .select("id")
                .single();

            if (error) throw error;
            moduloId = data.id;
            moduloAtivoId = data.id;
        }

        let imagemUrl = imagemAtual && !removerImagem ? imagemAtual : null;
        const mudouImagem = removerImagem || !!imagemPendente;

        if (removerImagem && imagemAtual) {
            await excluirImagemModuloStorage(imagemAtual);
            imagemUrl = null;
        }

        if (imagemPendente) {
            if (imagemAtual) await excluirImagemModuloStorage(imagemAtual);
            imagemUrl = await enviarImagemModulo(moduloId, imagemPendente);
        }

        if (mudouImagem) {
            const { error: erroImagem } = await supabaseClient
                .from("modulos")
                .update({ imagem_url: imagemUrl })
                .eq("id", moduloId);

            if (erroImagem) throw erroImagem;
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
        const modulo = obterModulo(editandoModuloId);
        if (modulo?.imagem_url) {
            await excluirImagemModuloStorage(modulo.imagem_url);
        }

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
    const temConteudo = !editorEstaVazio();
    const arquivoPendente =
        arquivoPublicacaoPendente && arquivoSessaoId === publicacaoFormSessao
            ? arquivoPublicacaoPendente
            : null;
    const arquivoAtual = arquivoPublicacaoAtual ? { ...arquivoPublicacaoAtual } : null;
    const removerArquivo = removerArquivoPublicacao;
    const temArquivoNovo = !!arquivoPendente;
    const temArquivoExistente = !!arquivoAtual && !removerArquivo;

    if (!titulo || !moduloAtivoId) return;

    if (!temConteudo && !temArquivoNovo && !temArquivoExistente) {
        alert("Adicione conteúdo na publicação ou anexe um arquivo.");
        return;
    }

    mostrarLoading(true);

    try {
        let publicacaoId = editandoPublicacaoId;

        if (publicacaoId) {
            const { error } = await supabaseClient
                .from("publicacoes")
                .update({ titulo, conteudo })
                .eq("id", publicacaoId);

            if (error) throw error;
        } else {
            const modulo = obterModulo(moduloAtivoId);
            const maxOrdem = (modulo?.publicacoes || []).reduce(
                (max, p) => Math.max(max, p.ordem || 0),
                0
            );
            const { data, error } = await supabaseClient
                .from("publicacoes")
                .insert({
                    modulo_id: moduloAtivoId,
                    titulo,
                    conteudo,
                    ordem: maxOrdem + 1
                })
                .select("id")
                .single();

            if (error) throw error;
            publicacaoId = data.id;
        }

        let arquivoUrl = temArquivoExistente ? arquivoAtual.url : null;
        let arquivoNome = temArquivoExistente ? arquivoAtual.nome : null;
        let mudouArquivo = removerArquivo || temArquivoNovo;

        if (removerArquivo && arquivoAtual?.url) {
            await excluirArquivoStorage(arquivoAtual.url);
            arquivoUrl = null;
            arquivoNome = null;
        }

        if (arquivoPendente) {
            if (arquivoAtual?.url) {
                await excluirArquivoStorage(arquivoAtual.url);
            }
            const enviado = await enviarArquivoPublicacao(publicacaoId, arquivoPendente);
            arquivoUrl = enviado.caminho;
            arquivoNome = enviado.nome;
            mudouArquivo = true;
        }

        if (mudouArquivo || editandoPublicacaoId) {
            const { error: erroArquivo } = await supabaseClient
                .from("publicacoes")
                .update({ arquivo_url: arquivoUrl, arquivo_nome: arquivoNome })
                .eq("id", publicacaoId);

            if (erroArquivo) throw erroArquivo;
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

    const modulo = obterModulo(moduloAtivoId);
    const publicacao = modulo?.publicacoes.find((p) => p.id === editandoPublicacaoId);

    mostrarLoading(true);

    try {
        if (publicacao?.arquivo_url) {
            await excluirArquivoStorage(publicacao.arquivo_url);
        }

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
    carregarCorDestaqueSalva();
}

document.getElementById("criar-modulo").addEventListener("click", () => abrirModalModulo());
document.getElementById("criar-categoria").addEventListener("click", () => abrirModalCategoria());
document.getElementById("logo-home")?.addEventListener("click", irParaHome);
document.getElementById("voltar-modulos").addEventListener("click", voltarParaExplorar);
document.getElementById("criar-publicacao").addEventListener("click", () => abrirModalPublicacao());
document.getElementById("editar-modulo").addEventListener("click", () => {
    if (moduloAtivoId) abrirModalModulo(moduloAtivoId);
});

formModulo.addEventListener("submit", salvarModulo);
formCategoria.addEventListener("submit", salvarCategoria);
btnExcluirCategoria?.addEventListener("click", excluirCategoria);
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
    iniciarSeletorCorDestaque();

    if (!configValida()) {
        mostrarErroConfig();
        return;
    }

    supabaseClient = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );

    iniciarArrastarGrid();
    iniciarArrastarPublicacoes();
    iniciarUploadArquivo();
    iniciarUploadImagemModulo();

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
