let supabaseClient = null;
let modulos = [];
let categoriasModuloLista = [];
let moduloAtivoId = null;
let termoBuscaTopo = "";
let termoBuscaModulos = "";
let termoBuscaItem = "";
let editandoModuloId = null;
let editandoCategoriaId = null;
let editandoPublicacaoId = null;
let ordemCategoriasTemp = [];

const CACHE_DADOS_PREFIXO = "centro-op-dados:";
const CACHE_DADOS_TTL_MS = 30 * 60 * 1000;

const categoriasModulos = document.getElementById("categorias-modulos");
const painelModulo = document.getElementById("painel-modulo");
const painelExplorar = document.getElementById("painel-explorar");
const moduloTitulo = document.getElementById("modulo-titulo");
const listaPublicacoes = document.getElementById("lista-publicacoes");
const buscaTopo = document.getElementById("busca-topo");
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
const painelOrdenarCategorias = document.getElementById("painel-ordenar-categorias");
const listaOrdenarCategorias = document.getElementById("lista-ordenar-categorias");
const btnSalvarOrdemCategorias = document.getElementById("salvar-ordem-categorias");
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
        descricao: "",
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
const TAMANHO_MAX_IMAGEM_MODULO = 3 * 1024 * 1024;
const TAMANHO_MAX_GIF_MODULO = 8 * 1024 * 1024;

let imagemModuloPendente = null;
let imagemModuloPreviewUrl = null;
let imagemModuloAtual = null;
let imagemModuloPosEdit = "50% 50%";
let imagemModuloPosAtual = "50% 50%";
let panImagemModulo = null;
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
    if (!caminho) return "";
    if (/^https?:\/\//i.test(caminho)) return caminho;
    const { data } = supabaseClient.storage.from(BUCKET_ARQUIVOS).getPublicUrl(caminho);
    return data.publicUrl;
}

function obterUrlPublicaImagemModulo(caminho) {
    if (!caminho) return "";
    if (/^https?:\/\//i.test(caminho)) return caminho;
    const { data } = supabaseClient.storage.from(BUCKET_MODULOS_IMAGENS).getPublicUrl(caminho);
    return data.publicUrl;
}

function moduloTemImagem(modulo) {
    return !!modulo?.imagem_url;
}

function inicialModulo(nome) {
    return (nome?.trim()?.charAt(0) || "?").toUpperCase();
}

function posicaoImagemDe(valor) {
    return window.ImagemPosicao?.normalizar?.(valor) || "50% 50%";
}

function caminhoPareceGif(caminho) {
    return /\.gif(\?|#|$)/i.test(String(caminho || ""));
}

function classeImgModulo(caminho, base = "modulo-avatar-img") {
    return caminhoPareceGif(caminho) ? `${base} is-gif` : base;
}

function htmlAvatarModulo(modulo, tamanho = "") {
    const classe = tamanho ? `modulo-avatar ${tamanho}` : "modulo-avatar";
    if (moduloTemImagem(modulo)) {
        const pos = posicaoImagemDe(modulo.imagem_pos);
        const cls = classeImgModulo(modulo.imagem_url);
        return `<div class="${classe}"><img src="${obterUrlPublicaImagemModulo(modulo.imagem_url)}" alt="" class="${cls}" style="object-position:${pos}"></div>`;
    }
    return `<div class="${classe}"><span class="modulo-avatar-inicial">${escaparHtml(inicialModulo(modulo.nome))}</span></div>`;
}

function preencherAvatarElemento(el, modulo) {
    if (!el) return;

    if (moduloTemImagem(modulo)) {
        const pos = posicaoImagemDe(modulo.imagem_pos);
        const cls = classeImgModulo(modulo.imagem_url);
        el.innerHTML = `<img src="${obterUrlPublicaImagemModulo(modulo.imagem_url)}" alt="" class="${cls}" style="object-position:${pos}">`;
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
    imagemModuloPosAtual = "50% 50%";
    imagemModuloPosEdit = "50% 50%";
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

function garantirPanImagemModulo() {
    const dica = document.getElementById("modulo-imagem-pos-dica");
    if (!btnPreviewImagemModulo || !window.ImagemPosicao) {
        if (dica) dica.hidden = true;
        return;
    }
    if (!imgPreviewModulo || imgPreviewModulo.hidden) {
        btnPreviewImagemModulo.classList.remove("img-pos-arrastavel", "is-arrastando");
        if (dica) dica.hidden = true;
        return;
    }
    // GIFs: não ligar pan (object-position + drag pode interferir na animação em alguns browsers)
    const ehGif = imgPreviewModulo.classList.contains("is-gif");
    window.ImagemPosicao.aplicarImg(imgPreviewModulo, imagemModuloPosEdit);
    if (ehGif) {
        btnPreviewImagemModulo.classList.remove("img-pos-arrastavel", "is-arrastando");
        if (dica) {
            dica.hidden = false;
            dica.textContent = "GIF animado · clique para trocar";
        }
        return;
    }
    if (!panImagemModulo) {
        panImagemModulo = window.ImagemPosicao.ligarPan(btnPreviewImagemModulo, {
            modo: "img",
            posicao: imagemModuloPosEdit,
            onChange: (p) => {
                imagemModuloPosEdit = p;
            }
        });
    } else {
        panImagemModulo.setPos(imagemModuloPosEdit);
        panImagemModulo.refresh();
    }
    if (dica) {
        dica.hidden = false;
        dica.textContent = "Arrasta para centralizar · clique para trocar";
    }
}

function atualizarPreviewImagemModulo(src) {
    if (!imgPreviewModulo || !placeholderImagemModulo) return;

    if (src) {
        imgPreviewModulo.src = src;
        imgPreviewModulo.hidden = false;
        placeholderImagemModulo.hidden = true;
        const pendenteGif = window.ImagemOtimizar?.ehGif?.(imagemModuloPendente)
            || caminhoPareceGif(imagemModuloPendente?.name)
            || caminhoPareceGif(imagemModuloAtual)
            || /\.gif/i.test(src);
        imgPreviewModulo.classList.toggle("is-gif", !!pendenteGif);
        if (btnRemoverImagemModulo) btnRemoverImagemModulo.hidden = false;
        garantirPanImagemModulo();
    } else {
        imgPreviewModulo.removeAttribute("src");
        imgPreviewModulo.style.objectPosition = "";
        imgPreviewModulo.classList.remove("is-gif");
        imgPreviewModulo.hidden = true;
        placeholderImagemModulo.hidden = false;
        btnPreviewImagemModulo?.classList.remove("img-pos-arrastavel", "is-arrastando");
        const dica = document.getElementById("modulo-imagem-pos-dica");
        if (dica) dica.hidden = true;
    }
}

async function selecionarImagemModulo(file) {
    if (!file) return;

    const mime = window.ImagemOtimizar?.mimeDe?.(file) || file.type || "";
    if (!mime.startsWith("image/")) {
        alert("Selecione um arquivo de imagem (PNG, JPG, WebP, GIF).");
        return;
    }

    const ehGif = mime === "image/gif" || window.ImagemOtimizar?.ehGif?.(file);
    const limite = ehGif ? TAMANHO_MAX_GIF_MODULO : TAMANHO_MAX_IMAGEM_MODULO;
    if (file.size > limite) {
        alert(ehGif
            ? "O GIF deve ter no máximo 8 MB."
            : "A imagem deve ter no máximo 3 MB.");
        return;
    }

    let ficheiroFinal = file;
    try {
        if (window.ImagemOtimizar?.otimizar) {
            const resultado = await window.ImagemOtimizar.otimizar(
                file,
                window.ImagemOtimizar.PRESETS.modulo
            );
            ficheiroFinal = resultado.file;
        }
    } catch (erro) {
        alert(erro.message || "Não foi possível otimizar a imagem.");
        return;
    }

    revogarPreviewImagemModulo();
    imagemModuloPendente = ficheiroFinal;
    imagemModuloSessaoId = moduloFormSessao;
    removerImagemModulo = false;
    imagemModuloPosEdit = "50% 50%";
    imagemModuloPreviewUrl = URL.createObjectURL(ficheiroFinal);
    atualizarPreviewImagemModulo(imagemModuloPreviewUrl);
}

async function enviarImagemModulo(moduloId, file) {
    const mime = window.ImagemOtimizar?.mimeDe?.(file) || file.type || "image/webp";
    const ehGif = mime === "image/gif" || window.ImagemOtimizar?.ehGif?.(file);
    const ext = ehGif
        ? ".gif"
        : file.name.includes(".")
            ? file.name.slice(file.name.lastIndexOf("."))
            : (mime === "image/webp" ? ".webp" : ".jpg");
    const caminho = `${moduloId}/${Date.now()}${ext}`;

    const { error } = await supabaseClient.storage
        .from(BUCKET_MODULOS_IMAGENS)
        .upload(caminho, file, {
            upsert: true,
            cacheControl: "3600",
            contentType: ehGif ? "image/gif" : mime
        });

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

    btnPreviewImagemModulo?.addEventListener("click", (e) => {
        if (btnPreviewImagemModulo.dataset.arrastou === "1") {
            e.preventDefault();
            return;
        }
        inputImagemModulo?.click();
    });

    inputImagemModulo?.addEventListener("change", (e) => {
        const file = e.target.files?.[0];
        if (file) selecionarImagemModulo(file);
    });

    btnRemoverImagemModulo?.addEventListener("click", () => {
        imagemModuloPendente = null;
        imagemModuloSessaoId = null;
        imagemModuloPosEdit = "50% 50%";
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
    if (loading) loading.hidden = !ativo;
}

function chaveCacheDados() {
    const id = window.Auth?.getSession()?.user?.id;
    return id ? `${CACHE_DADOS_PREFIXO}${id}` : null;
}

function lerCacheDados() {
    const chave = chaveCacheDados();
    if (!chave) return null;

    try {
        const bruto = sessionStorage.getItem(chave);
        if (!bruto) return null;

        const cache = JSON.parse(bruto);
        if (!cache || !Array.isArray(cache.modulos)) return null;
        if (Date.now() - (cache.ts || 0) > CACHE_DADOS_TTL_MS) return null;

        return cache;
    } catch {
        return null;
    }
}

function salvarCacheDados() {
    const chave = chaveCacheDados();
    if (!chave) return;

    try {
        sessionStorage.setItem(
            chave,
            JSON.stringify({
                modulos,
                categorias: categoriasModuloLista,
                ts: Date.now()
            })
        );
    } catch (erro) {
        console.warn("Não foi possível salvar cache local:", erro);
    }
}

function limparCacheDados() {
    try {
        Object.keys(sessionStorage)
            .filter((chave) => chave.startsWith(CACHE_DADOS_PREFIXO))
            .forEach((chave) => sessionStorage.removeItem(chave));
    } catch {
        /* ignore */
    }
}

function aplicarCacheDados(cache) {
    modulos = cache.modulos || [];
    categoriasModuloLista = Array.isArray(cache.categorias) && cache.categorias.length
        ? cache.categorias
        : [...CATEGORIAS_PADRAO];
    preencherSelectCategorias?.();
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

function rotuloPublicacoes(qtd) {
    const n = Number(qtd) || 0;
    if (n === 1) return "1 publicação";
    return `${n} publicações`;
}

function formatarConteudo(texto) {
    return renderizarConteudo(texto);
}

function obterModulo(id) {
    return modulos.find((m) => m.id === id);
}

function publicacaoCorrespondeTermo(publicacao, termo) {
    return (
        (publicacao.titulo || "").toLowerCase().includes(termo) ||
        textoPuro(publicacao.conteudo).toLowerCase().includes(termo) ||
        (publicacao.arquivo_nome || "").toLowerCase().includes(termo)
    );
}

function obterMatchBuscaTopo(modulo, termo) {
    if (!termo) return null;
    if ((modulo.nome || "").toLowerCase().includes(termo)) {
        return { tipo: "modulo" };
    }
    const publicacao = (modulo.publicacoes || []).find((p) => publicacaoCorrespondeTermo(p, termo));
    if (publicacao) {
        return { tipo: "conteudo", publicacao };
    }
    return null;
}

function haFiltroModulosAtivo() {
    return !!(termoBuscaTopo.trim() || termoBuscaModulos.trim());
}

function filtrarModulos() {
    const termoTopo = termoBuscaTopo.trim().toLowerCase();
    const termoNome = termoBuscaModulos.trim().toLowerCase();

    return modulos.filter((modulo) => {
        if (termoNome && !(modulo.nome || "").toLowerCase().includes(termoNome)) {
            return false;
        }
        if (termoTopo && !obterMatchBuscaTopo(modulo, termoTopo)) {
            return false;
        }
        return true;
    });
}

function filtrarPublicacoes(modulo) {
    if (!termoBuscaItem.trim()) return modulo.publicacoes;

    const termo = termoBuscaItem.toLowerCase();
    return modulo.publicacoes.filter((p) => publicacaoCorrespondeTermo(p, termo));
}

function tratarErro(erro, acao) {
    console.error(erro);
    const codigo = erro.code || erro.status;
    if (codigo === "42501" || codigo === 403 || erro.message?.includes("permission")) {
        alert(`Sem permissão para ${acao}. Faça login com uma conta de editor ou administrador.`);
        window.Auth?.abrirModalLogin();
        return;
    }
    alert(`Erro ao ${acao}: ${erro.message}`);
}

let carregarDadosPromise = null;

async function carregarDados() {
    if (carregarDadosPromise) return carregarDadosPromise;

    carregarDadosPromise = (async () => {
        await carregarCategorias();

        const { data, error } = await supabaseClient
            .from("modulos")
            .select(`
            id,
            nome,
            ordem,
            categoria,
            imagem_url,
            imagem_pos,
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

        let dadosModulos = data;
        let erroModulos = error;

        if (erroModulos && /imagem_pos|42703|PGRST204/i.test(erroModulos.message || "")) {
            const retry = await supabaseClient
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
            dadosModulos = retry.data;
            erroModulos = retry.error;
        }

        if (erroModulos) throw erroModulos;

        modulos = (dadosModulos || []).map((modulo) => ({
            id: modulo.id,
            nome: modulo.nome,
            ordem: modulo.ordem ?? 0,
            categoria: normalizarCategoria(modulo.categoria),
            imagem_url: modulo.imagem_url || null,
            imagem_pos: posicaoImagemDe(modulo.imagem_pos),
            publicacoes: (modulo.publicacoes || []).sort(
                (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
            )
        }));

        if (moduloAtivoId && !obterModulo(moduloAtivoId)) {
            voltarParaExplorar();
        }
    })();

    try {
        await carregarDadosPromise;
        salvarCacheDados();
    } finally {
        carregarDadosPromise = null;
    }
}

async function sincronizarDadosAoAbrir() {
    const cache = lerCacheDados();

    if (cache) {
        aplicarCacheDados(cache);
        renderizarModulos();
        if (moduloAtivoId) renderizarPublicacoes();

        try {
            await carregarDados();
            renderizarModulos();
            if (moduloAtivoId) renderizarPublicacoes();
        } catch (erro) {
            console.warn("Atualização em segundo plano falhou:", erro);
        }
        return;
    }

    mostrarLoading(true);
    try {
        await carregarDados();
        renderizarModulos();
        if (moduloAtivoId) renderizarPublicacoes();
    } finally {
        mostrarLoading(false);
    }
}

function esconderFormulariosModal() {
    formModulo.hidden = true;
    formCategoria.hidden = true;
    formPublicacao.hidden = true;
    if (painelOrdenarCategorias) painelOrdenarCategorias.hidden = true;
    window.Auth?.fecharModalAuth();
}

function abrirModal() {
    modalOverlay.hidden = false;
    document.body.style.overflow = "hidden";
}

function fecharModal() {
    modalOverlay.hidden = true;
    document.body.style.overflow = "";
    esconderFormulariosModal();
    window.Auth?.fecharOverlayModal();
    modalEl.classList.remove("modal-grande");
    editandoModuloId = null;
    editandoCategoriaId = null;
    editandoPublicacaoId = null;
    ordemCategoriasTemp = [];
    resetarFormularioModulo();
    resetarFormularioPublicacao();
}

function abrirModalModulo(id = null) {
    if (!window.Auth?.exigirEdicao()) return;

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
            imagemModuloPosAtual = posicaoImagemDe(modulo.imagem_pos);
            imagemModuloPosEdit = imagemModuloPosAtual;
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
    if (!window.Auth?.exigirEdicao()) return;

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

function abrirModalOrdenarCategorias() {
    if (!window.Auth?.exigirEdicao()) return;

    if (categoriasModuloLista.length < 2) {
        alert("É necessário ter pelo menos duas categorias para reorganizar a ordem.");
        return;
    }

    esconderFormulariosModal();
    if (painelOrdenarCategorias) painelOrdenarCategorias.hidden = false;

    modalTitulo.textContent = "Organizar categorias";
    ordemCategoriasTemp = [...categoriasModuloLista].sort(
        (a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)
    );
    renderizarListaOrdenacaoCategorias();
    abrirModal();
}

function renderizarListaOrdenacaoCategorias() {
    if (!listaOrdenarCategorias) return;

    listaOrdenarCategorias.replaceChildren();

    ordemCategoriasTemp.forEach((categoria, index) => {
        const item = document.createElement("li");
        item.className = "ordenar-categoria-item";

        const nome = document.createElement("span");
        nome.className = "ordenar-categoria-nome";
        nome.textContent = categoria.titulo;

        const acoes = document.createElement("div");
        acoes.className = "ordenar-categoria-acoes";

        const btnCima = document.createElement("button");
        btnCima.type = "button";
        btnCima.className = "btn btn-outline btn-sm btn-ordenar";
        btnCima.textContent = "↑";
        btnCima.title = "Subir";
        btnCima.disabled = index === 0;
        btnCima.addEventListener("click", () => moverCategoriaNaLista(index, -1));

        const btnBaixo = document.createElement("button");
        btnBaixo.type = "button";
        btnBaixo.className = "btn btn-outline btn-sm btn-ordenar";
        btnBaixo.textContent = "↓";
        btnBaixo.title = "Descer";
        btnBaixo.disabled = index === ordemCategoriasTemp.length - 1;
        btnBaixo.addEventListener("click", () => moverCategoriaNaLista(index, 1));

        acoes.append(btnCima, btnBaixo);
        item.append(nome, acoes);
        listaOrdenarCategorias.appendChild(item);
    });
}

function moverCategoriaNaLista(index, direcao) {
    const novoIndex = index + direcao;
    if (novoIndex < 0 || novoIndex >= ordemCategoriasTemp.length) return;

    const [item] = ordemCategoriasTemp.splice(index, 1);
    ordemCategoriasTemp.splice(novoIndex, 0, item);
    renderizarListaOrdenacaoCategorias();
}

async function salvarOrdemCategorias() {
    mostrarLoading(true);

    try {
        await Promise.all(
            ordemCategoriasTemp.map((categoria, index) => {
                const novaOrdem = index + 1;
                if (categoria.ordem === novaOrdem) return Promise.resolve();

                return supabaseClient
                    .from("categorias_modulo")
                    .update({ ordem: novaOrdem })
                    .eq("id", categoria.id)
                    .then(({ error }) => {
                        if (error) throw error;
                    });
            })
        );

        await carregarDados();
        fecharModal();
        renderizarModulos();
        window.LogsAtividade?.registrar("Reordenar categorias", "Ordem das categorias atualizada", "categoria");
    } catch (erro) {
        tratarErro(erro, "salvar ordem das categorias");
    } finally {
        mostrarLoading(false);
    }
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

        const acao = editandoCategoriaId ? "Editar categoria" : "Criar categoria";
        await carregarDados();
        fecharModal();
        renderizarModulos();
        window.LogsAtividade?.registrar(acao, titulo, "categoria");
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
        window.LogsAtividade?.registrar("Excluir categoria", nome, "categoria");
    } catch (erro) {
        tratarErro(erro, "excluir categoria");
    } finally {
        mostrarLoading(false);
    }
}

function abrirModalPublicacao(id = null) {
    if (!window.Auth?.exigirEdicao()) return;

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

function criarCardModuloGrid(modulo) {
    const card = document.createElement("article");
    card.className = "card-modulo-grid";
    card.dataset.id = modulo.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Abrir ${modulo.nome}`);

    const arrastar = haFiltroModulosAtivo() || !window.Auth?.podeEditar()
        ? ""
        : `
        <div class="modulo-arrastar item-arrastar" role="button" tabindex="0" aria-label="Arrastar para reordenar" title="Arrastar para reordenar">
            <span class="icone-arrastar" aria-hidden="true"></span>
        </div>
    `;

    const temImagem = moduloTemImagem(modulo);
    const posCapa = posicaoImagemDe(modulo.imagem_pos);
    const clsCapa = caminhoPareceGif(modulo.imagem_url) ? "card-modulo-capa is-gif" : "card-modulo-capa";
    const mediaHtml = temImagem
        ? `<img
                class="${clsCapa}"
                src="${obterUrlPublicaImagemModulo(modulo.imagem_url)}"
                alt=""
                ${caminhoPareceGif(modulo.imagem_url) ? "" : 'loading="lazy"'}
                style="object-position:${posCapa}"
            >`
        : `<div class="card-modulo-capa-fallback">${htmlAvatarModulo(modulo, "modulo-avatar-lg")}</div>`;

    if (temImagem) card.classList.add("tem-capa");
    if (caminhoPareceGif(modulo.imagem_url)) card.classList.add("tem-gif");

    const matchTopo = obterMatchBuscaTopo(modulo, termoBuscaTopo.trim().toLowerCase());
    const dicaConteudo = matchTopo?.tipo === "conteudo"
        ? `<p class="card-modulo-match">Conteúdo: ${escaparHtml(matchTopo.publicacao.titulo)}</p>`
        : "";

    card.innerHTML = `
        <div class="card-modulo-grid-topo">
            ${arrastar}
        </div>
        <div class="card-modulo-grid-media" aria-hidden="true">
            ${mediaHtml}
        </div>
        <div class="card-modulo-grid-corpo">
            <h3 class="card-modulo-nome">${escaparHtml(modulo.nome)}</h3>
            <p class="card-modulo-qtd">${rotuloPublicacoes(modulo.publicacoes.length)}</p>
            ${dicaConteudo}
            <div class="card-modulo-grid-rodape">
                <span class="card-modulo-abrir">Abrir →</span>
            </div>
        </div>
    `;

    const abrir = (e) => {
        if (e.target.closest(".modulo-arrastar")) return;
        const opts = matchTopo?.tipo === "conteudo" && termoBuscaTopo.trim()
            ? { termoPublicacao: termoBuscaTopo.trim() }
            : {};
        selecionarModulo(modulo.id, opts);
    };
    card.addEventListener("click", abrir);
    card.addEventListener("keydown", (e) => {
        if (e.target.closest(".modulo-arrastar")) return;
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            abrir(e);
        }
    });

    return card;
}

function criarCardPublicacao(publicacao) {
    const card = document.createElement("article");
    card.className = "card-publicacao";
    card.dataset.id = publicacao.id;

    const arrastar = termoBuscaItem.trim() || !window.Auth?.podeEditar()
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
    return window.Auth?.podeEditar() && categoriasModuloLista.some((c) => c.id === categoria.id);
}

function criarSecaoCategoria(categoria, modulosDaCategoria) {
    const secao = document.createElement("section");
    secao.className = "categoria-modulos painel-explorar";
    secao.dataset.categoria = categoria.id;

    const totalPubs = modulosDaCategoria.reduce(
        (acc, m) => acc + (m.publicacoes?.length || 0),
        0
    );

    const cabecalho = document.createElement("header");
    cabecalho.className = "explorar-header";

    const topo = document.createElement("div");
    topo.className = "explorar-header-topo";
    const descricao = String(categoria.descricao || "").trim();
    const mostrarDescricao =
        descricao &&
        !/^ferramentas e refer[eê]ncias de uso interno da equipe\.?$/i.test(descricao);

    topo.innerHTML = `
        <div class="explorar-header-texto">
            <h2 class="explorar-titulo">${escaparHtml(categoria.titulo)}</h2>
            ${mostrarDescricao ? `<p class="explorar-descricao">${escaparHtml(descricao)}</p>` : ""}
            <p class="explorar-meta">${rotuloPublicacoes(totalPubs)} · ${modulosDaCategoria.length} módulo${modulosDaCategoria.length === 1 ? "" : "s"}</p>
        </div>
    `;

    if (categoriaEhEditavel(categoria)) {
        const btnEditar = document.createElement("button");
        btnEditar.type = "button";
        btnEditar.className = "btn btn-outline btn-sm explorar-btn-editar";
        btnEditar.textContent = "Editar";
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
    if (categoriasModulos) categoriasModulos.replaceChildren();

    atualizarHubDashboard();

    if (!categoriasModulos) return;

    if (modulosFiltrados.length === 0) {
        const vazio = document.createElement("p");
        vazio.className = "lista-vazia";
        vazio.textContent = modulos.length === 0
            ? "Nenhum módulo criado. Use ＋ Novo módulo."
            : "Nenhum módulo ou conteúdo encontrado.";
        categoriasModulos.appendChild(vazio);
        return;
    }

    obterCategoriasParaExibir().forEach((categoria) => {
        const daCategoria = modulosFiltrados
            .filter((m) => normalizarCategoria(m.categoria) === categoria.id)
            .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

        const mostrarSecao = daCategoria.length > 0 || !haFiltroModulosAtivo();
        if (mostrarSecao) {
            categoriasModulos.appendChild(criarSecaoCategoria(categoria, daCategoria));
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
            ? 'Nenhuma publicação neste módulo. Clique em "＋ Nova publicação".'
            : "Nenhuma publicação encontrada neste módulo.";
        listaPublicacoes.appendChild(vazio);
        return;
    }

    publicacoes.forEach((pub) => {
        listaPublicacoes.appendChild(criarCardPublicacao(pub));
    });
}

function irAoTopoPagina() {
    const html = document.documentElement;
    const comportamento = html.style.scrollBehavior;
    html.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    html.scrollTop = 0;
    document.body.scrollTop = 0;
    html.style.scrollBehavior = comportamento;
}

function selecionarModulo(id, opcoes = {}) {
    if (!obterModulo(id)) return;

    moduloAtivoId = id;
    const termoPub = String(opcoes.termoPublicacao || "").trim();
    termoBuscaItem = termoPub;
    if (buscaItem) buscaItem.value = termoPub;
    painelExplorar.hidden = true;
    painelModulo.hidden = false;
    renderizarPublicacoes();
    irAoTopoPagina();
    requestAnimationFrame(() => irAoTopoPagina());
}

function voltarParaExplorar() {
    moduloAtivoId = null;
    termoBuscaItem = "";
    if (buscaItem) buscaItem.value = "";
    painelModulo.hidden = true;
    painelExplorar.hidden = false;
    renderizarModulos();
    irAoTopoPagina();
    requestAnimationFrame(() => irAoTopoPagina());
}

function irParaHome() {
    termoBuscaTopo = "";
    termoBuscaModulos = "";
    if (buscaTopo) buscaTopo.value = "";
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
        if (haFiltroModulosAtivo()) return;

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
        const posicaoFinal = imagemUrl
            ? posicaoImagemDe(panImagemModulo?.getPos?.() || imagemModuloPosEdit)
            : "50% 50%";
        const mudouImagem = removerImagem || !!imagemPendente;
        const mudouPosicao = !!imagemUrl && posicaoFinal !== posicaoImagemDe(imagemModuloPosAtual);

        if (removerImagem && imagemAtual) {
            await excluirImagemModuloStorage(imagemAtual);
            imagemUrl = null;
        }

        if (imagemPendente) {
            if (imagemAtual) await excluirImagemModuloStorage(imagemAtual);
            imagemUrl = await enviarImagemModulo(moduloId, imagemPendente);
        }

        if (mudouImagem || mudouPosicao) {
            const payloadImg = {
                imagem_url: imagemUrl,
                imagem_pos: imagemUrl ? posicaoFinal : "50% 50%"
            };
            let { error: erroImagem } = await supabaseClient
                .from("modulos")
                .update(payloadImg)
                .eq("id", moduloId);

            if (erroImagem && /imagem_pos|42703|PGRST204/i.test(erroImagem.message || "")) {
                ({ error: erroImagem } = await supabaseClient
                    .from("modulos")
                    .update({ imagem_url: imagemUrl })
                    .eq("id", moduloId));
            }

            if (erroImagem) throw erroImagem;
        }

        await carregarDados();
        fecharModal();

        if (moduloAtivoId) {
            painelExplorar.hidden = true;
            painelModulo.hidden = false;
        }

        const acaoModulo = editandoModuloId ? "Editar módulo" : "Criar módulo";
        renderizarModulos();
        if (moduloAtivoId) renderizarPublicacoes();
        window.LogsAtividade?.registrar(acaoModulo, `${nome} (${categoria})`, "modulo");
        if (imagemPendente) {
            window.LogsAtividade?.registrar(
                "Upload imagem módulo",
                `${nome} · ${imagemPendente.name || "imagem"}`,
                "modulo"
            );
        } else if (removerImagem && imagemAtual) {
            window.LogsAtividade?.registrar("Remover arquivo", `Imagem do módulo ${nome}`, "modulo");
        }
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
        const nomeModulo = modulo?.nome || editandoModuloId;
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
        window.LogsAtividade?.registrar("Excluir módulo", nomeModulo, "modulo");
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

        const acaoPub = editandoPublicacaoId ? "Editar publicação" : "Criar publicação";
        const moduloNome = obterModulo(moduloAtivoId)?.nome || "";
        await carregarDados();
        fecharModal();
        renderizarModulos();
        renderizarPublicacoes();
        window.LogsAtividade?.registrar(acaoPub, `${titulo}${moduloNome ? ` · ${moduloNome}` : ""}`, "publicacao");
        if (arquivoPendente) {
            window.LogsAtividade?.registrar(
                "Upload arquivo",
                `${titulo} · ${arquivoPendente.name || arquivoNome || "arquivo"}${moduloNome ? ` · ${moduloNome}` : ""}`,
                "publicacao"
            );
        } else if (removerArquivo && arquivoAtual?.url) {
            window.LogsAtividade?.registrar(
                "Remover arquivo",
                `${titulo}${moduloNome ? ` · ${moduloNome}` : ""}`,
                "publicacao"
            );
        }
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
    const tituloPub = publicacao?.titulo || editandoPublicacaoId;

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
        window.LogsAtividade?.registrar(
            "Excluir publicação",
            `${tituloPub}${modulo?.nome ? ` · ${modulo.nome}` : ""}`,
            "publicacao"
        );
    } catch (erro) {
        tratarErro(erro, "excluir publicação");
    } finally {
        mostrarLoading(false);
    }
}

function aplicarTema(claro) {
    document.body.classList.toggle("tema-claro", claro);
    if (botaoTema) {
        botaoTema.textContent = claro ? "☾" : "◐";
        botaoTema.title = claro ? "Tema escuro" : "Tema claro";
    }
    localStorage.setItem("tema", claro ? "claro" : "escuro");
    carregarCorDestaqueSalva();
}

function primeiroNome() {
    const nome = window.Auth?.getPerfil?.()?.nome || "";
    return nome.trim().split(/\s+/)[0] || "equipe";
}

function textoSaudacao() {
    const h = new Date().getHours();
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
}

function atualizarHubDashboard() {
    const saudacao = document.getElementById("hub-saudacao");
    if (saudacao) {
        saudacao.textContent = `${textoSaudacao()}, ${primeiroNome()}.`;
    }

    const novoWrap = document.getElementById("hub-novo-wrap");
    if (novoWrap) {
        const pode = !!window.Auth?.podeEditar?.();
        novoWrap.hidden = !window.Auth?.getSession?.() || !pode;
    }

    const heroAcoes = document.getElementById("hub-hero-acoes");
    if (heroAcoes) heroAcoes.hidden = !window.Auth?.podeEditar?.();
}

let menuNovoParent = null;

function fecharMenuNovo() {
    const menu = document.getElementById("menu-novo");
    const btn = document.getElementById("btn-menu-novo");
    if (menu) {
        menu.hidden = true;
        menu.classList.remove("hub-menu-novo-portal");
        menu.style.top = "";
        menu.style.left = "";
        menu.style.right = "";
        menu.style.bottom = "";
        menu.style.width = "";
        if (menuNovoParent && menu.parentElement === document.body) {
            menuNovoParent.appendChild(menu);
        }
    }
    if (btn) btn.setAttribute("aria-expanded", "false");
}

function posicionarMenuNovo() {
    const menu = document.getElementById("menu-novo");
    const btn = document.getElementById("btn-menu-novo");
    if (!menu || !btn || menu.hidden) return;

    // Sai do header (backdrop-filter cria stacking context e corta/sobrepor o menu)
    if (menu.parentElement !== document.body) {
        menuNovoParent = menu.parentElement;
        document.body.appendChild(menu);
    }

    const rect = btn.getBoundingClientRect();
    const larguraMenu = Math.min(260, window.innerWidth - 16);
    let left = rect.right - larguraMenu;
    left = Math.max(8, Math.min(left, window.innerWidth - larguraMenu - 8));
    let top = rect.bottom + 8;
    const alturaEstimada = menu.offsetHeight || 220;
    if (top + alturaEstimada > window.innerHeight - 8) {
        top = Math.max(8, rect.top - alturaEstimada - 8);
    }

    menu.classList.add("hub-menu-novo-portal");
    menu.style.top = `${Math.round(top)}px`;
    menu.style.left = `${Math.round(left)}px`;
    menu.style.right = "auto";
    menu.style.bottom = "auto";
    menu.style.width = `${larguraMenu}px`;
}

function dispararAcaoHub(acao) {
    fecharMenuNovo();
    if (acao === "modulo") abrirModalModulo();
    else if (acao === "categoria") abrirModalCategoria();
    else if (acao === "ordenar") abrirModalOrdenarCategorias();
}

function focarBuscaTopo() {
    if (moduloAtivoId) voltarParaExplorar();
    const input = document.getElementById("busca-topo") || document.getElementById("busca-global");
    if (!input) return;
    input.focus({ preventScroll: true });
}

function aplicarBuscaExplorar() {
    if (moduloAtivoId) voltarParaExplorar();
    else renderizarModulos();
}

document.getElementById("criar-modulo").addEventListener("click", () => {
    fecharMenuNovo();
    abrirModalModulo();
});
document.getElementById("criar-categoria").addEventListener("click", () => {
    fecharMenuNovo();
    abrirModalCategoria();
});
document.getElementById("ordenar-categorias")?.addEventListener("click", () => {
    fecharMenuNovo();
    abrirModalOrdenarCategorias();
});
document.getElementById("logo-home")?.addEventListener("click", irParaHome);
document.getElementById("voltar-modulos").addEventListener("click", voltarParaExplorar);
document.getElementById("criar-publicacao").addEventListener("click", () => {
    fecharMenuNovo();
    abrirModalPublicacao();
});
document.getElementById("editar-modulo").addEventListener("click", () => {
    if (moduloAtivoId) abrirModalModulo(moduloAtivoId);
});

document.getElementById("btn-menu-novo")?.addEventListener("click", (e) => {
    e.stopPropagation();
    const menu = document.getElementById("menu-novo");
    const btn = document.getElementById("btn-menu-novo");
    if (!menu) return;
    if (!menu.hidden) {
        fecharMenuNovo();
        return;
    }
    menu.hidden = false;
    btn?.setAttribute("aria-expanded", "true");
    posicionarMenuNovo();
    requestAnimationFrame(() => posicionarMenuNovo());
});

document.addEventListener("click", (e) => {
    if (e.target.closest("#hub-novo-wrap") || e.target.closest("#menu-novo")) return;
    fecharMenuNovo();
});

window.addEventListener("resize", () => {
    const menu = document.getElementById("menu-novo");
    if (menu && !menu.hidden) posicionarMenuNovo();
});

window.addEventListener("scroll", () => {
    const menu = document.getElementById("menu-novo");
    if (menu && !menu.hidden) posicionarMenuNovo();
}, true);

document.querySelectorAll("[data-acao-hub]").forEach((el) => {
    el.addEventListener("click", () => dispararAcaoHub(el.getAttribute("data-acao-hub")));
});

formModulo.addEventListener("submit", salvarModulo);
formCategoria.addEventListener("submit", salvarCategoria);
btnExcluirCategoria?.addEventListener("click", excluirCategoria);
btnSalvarOrdemCategorias?.addEventListener("click", salvarOrdemCategorias);
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
    const meta = e.metaKey || e.ctrlKey;
    if (meta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        focarBuscaTopo();
        return;
    }
    if (e.key === "Escape") {
        fecharMenuNovo();
        if (buscaTopo && document.activeElement === buscaTopo && buscaTopo.value) {
            buscaTopo.value = "";
            termoBuscaTopo = "";
            renderizarModulos();
        }
        if (buscaGlobal && document.activeElement === buscaGlobal && buscaGlobal.value) {
            buscaGlobal.value = "";
            termoBuscaModulos = "";
            renderizarModulos();
        }
        if (!modalOverlay.hidden) fecharModal();
    }
});

buscaTopo?.addEventListener("input", (e) => {
    termoBuscaTopo = e.target.value;
    aplicarBuscaExplorar();
});

buscaGlobal?.addEventListener("input", (e) => {
    termoBuscaModulos = e.target.value;
    aplicarBuscaExplorar();
});

buscaItem.addEventListener("input", (e) => {
    termoBuscaItem = e.target.value;
    renderizarPublicacoes();
});

document.getElementById("busca-item-form").addEventListener("submit", (e) => e.preventDefault());
buscaTopo?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
});
buscaGlobal?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") e.preventDefault();
});

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

    window.LogsAtividade?.iniciar(supabaseClient);

    try {
        await window.Auth.iniciar(supabaseClient);
    } catch (erro) {
        console.error("Erro ao iniciar autenticação:", erro);
    }

    window.addEventListener("auth:changed", async () => {
        if (!window.Auth.getSession()) {
            limparCacheDados();
            moduloAtivoId = null;
            termoBuscaTopo = "";
            termoBuscaModulos = "";
            termoBuscaItem = "";
            modulos = [];
            if (buscaTopo) buscaTopo.value = "";
            if (buscaGlobal) buscaGlobal.value = "";
            if (buscaItem) buscaItem.value = "";
            if (painelModulo) painelModulo.hidden = true;
            if (painelExplorar) painelExplorar.hidden = false;
            mostrarLoading(false);
            return;
        }

        await sincronizarDadosAoAbrir();
    });

    iniciarArrastarGrid();
    iniciarArrastarPublicacoes();
    iniciarUploadArquivo();
    iniciarUploadImagemModulo();

    if (window.Auth.getSession()) {
        await sincronizarDadosAoAbrir();
    }
}

iniciar();
