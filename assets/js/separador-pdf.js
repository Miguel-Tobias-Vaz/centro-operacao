const botaoTema = document.getElementById("tema");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileChip = document.getElementById("file-chip");
const fileNameEl = document.getElementById("file-name");
const btnClear = document.getElementById("btn-clear");
const btnProcessar = document.getElementById("btn-processar");
const faixaPaginas = document.getElementById("pdf-faixa-paginas");
const listaDocumentos = document.getElementById("pdf-lista-documentos");
const contadorEl = document.getElementById("pdf-contador");
const carregandoEl = document.getElementById("pdf-carregando");
const editorSubtitulo = document.getElementById("editor-subtitulo");
const btnSelecionarPaginas = document.getElementById("btn-selecionar-paginas");
const btnExcluirSelecionadas = document.getElementById("btn-excluir-selecionadas");

const CORES_DOCUMENTO = [
    "doc-cor-1", "doc-cor-2", "doc-cor-3", "doc-cor-4",
    "doc-cor-5", "doc-cor-6", "doc-cor-7", "doc-cor-8"
];

let selectedFile = null;
let pdfBytes = null;
let paginasOrdem = [];
let divisoesEntre = new Set();
let nomesDocumentos = [];
let stemBase = "Documento";
let downloadUrl = null;
let arrastandoPagina = null;
let arrastarIniciado = false;
let modoSelecao = false;
let paginasSelecionadas = new Set();

function revogarDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }
}

function limparEstado() {
    selectedFile = null;
    pdfBytes = null;
    paginasOrdem = [];
    divisoesEntre = new Set();
    nomesDocumentos = [];
    stemBase = "Documento";
    modoSelecao = false;
    paginasSelecionadas = new Set();
    resetarLazyPreview();
    liberarPdfJs();
    faixaPaginas.replaceChildren();
    listaDocumentos.replaceChildren();
    fileChip.hidden = true;
    dropzone.classList.remove("com-arquivo");
    atualizarContador();
}

function obterGrupos() {
    return calcularGruposDocumentos(paginasOrdem, divisoesEntre);
}

function indiceGrupoDaPagina(pos) {
    const grupos = obterGrupos();
    let acumulado = 0;
    for (let i = 0; i < grupos.length; i += 1) {
        acumulado += grupos[i].length;
        if (pos < acumulado) return i;
    }
    return Math.max(0, grupos.length - 1);
}

function documentosParaExportar() {
    const grupos = obterGrupos();
    sincronizarNomesDocumentos(nomesDocumentos, grupos, stemBase);

    return grupos.map((paginas, i) => ({
        nome: nomesDocumentos[i],
        paginas: paginas.map((p) => ({
            indexOriginal: p.indexOriginal,
            rotacao: p.rotacao || 0
        }))
    }));
}

function atualizarContador() {
    const grupos = obterGrupos();
    const totalPaginas = paginasOrdem.length;
    const totalDocs = grupos.length;

    if (contadorEl) {
        contadorEl.textContent = totalPaginas
            ? `${totalDocs} documento(s) · ${totalPaginas} página(s)`
            : "Nenhuma página";
    }

    if (btnProcessar) {
        btnProcessar.disabled = totalDocs === 0 || totalPaginas === 0;
    }
}

function atualizarRodapePagina(rodape, item) {
    const rot = item.rotacao ? ` · ${item.rotacao}°` : "";
    rodape.innerHTML = `<span class="pdf-pagina-num">Pág. ${item.indexOriginal + 1}${rot}</span>`;
}

function paginaEstaSelecionada(item) {
    return paginasSelecionadas.has(item.indexOriginal);
}

function alternarSelecaoPagina(item) {
    if (paginasSelecionadas.has(item.indexOriginal)) {
        paginasSelecionadas.delete(item.indexOriginal);
    } else {
        paginasSelecionadas.add(item.indexOriginal);
    }
    atualizarUiSelecao();
}

function definirModoSelecao(ativo) {
    const eraSelecao = modoSelecao;
    modoSelecao = ativo;
    if (!ativo) paginasSelecionadas.clear();
    faixaPaginas.classList.toggle("modo-selecao", modoSelecao);
    if (btnSelecionarPaginas) {
        btnSelecionarPaginas.textContent = modoSelecao ? "Cancelar seleção" : "Selecionar páginas";
        btnSelecionarPaginas.classList.toggle("ativo", modoSelecao);
    }

    if (eraSelecao && !ativo && paginasOrdem.length) {
        renderizarInterfaceCompleta();
        return;
    }

    atualizarUiSelecao();
}

function atualizarUiSelecao() {
    const total = paginasSelecionadas.size;

    if (btnExcluirSelecionadas) {
        btnExcluirSelecionadas.hidden = !modoSelecao || total === 0;
        btnExcluirSelecionadas.textContent = total === 1
            ? "Excluir 1 página"
            : `Excluir ${total} páginas`;
    }

    faixaPaginas.querySelectorAll(".pdf-pagina-card").forEach((card) => {
        const item = card._item;
        const selecionada = item && paginaEstaSelecionada(item);
        card.classList.toggle("selecionada", !!selecionada);
        card.classList.toggle("nao-selecionada", modoSelecao && !selecionada);

        const input = card.querySelector(".pdf-pagina-selecao input");
        if (input) input.checked = !!selecionada;
    });
}

function excluirPaginasSelecionadas() {
    if (!paginasSelecionadas.size) return;

    const posicoes = [];
    paginasOrdem.forEach((item, pos) => {
        if (paginasSelecionadas.has(item.indexOriginal)) posicoes.push(pos);
    });

    const removidas = removerPaginasPorPosicoes(paginasOrdem, divisoesEntre, posicoes);
    removidas.forEach((item) => invalidarPreviewPagina(item.indexOriginal));

    paginasSelecionadas.clear();
    definirModoSelecao(false);

    if (paginasOrdem.length === 0) {
        alert("Todas as páginas foram removidas. Envie outro PDF.");
        resetar();
        return;
    }

    renderizarInterfaceCompleta();
}

function criarCardPagina(item, pos) {
    const grupoIdx = indiceGrupoDaPagina(pos);
    const card = document.createElement("article");
    card.className = `pdf-pagina-card pdf-pagina-faixa ${CORES_DOCUMENTO[grupoIdx % CORES_DOCUMENTO.length]} aguardando-preview`;
    card.dataset.pos = String(pos);
    card.dataset.orig = String(item.indexOriginal);

    const topo = document.createElement("div");
    topo.className = "pdf-pagina-topo";

    const selecao = document.createElement("label");
    selecao.className = "pdf-pagina-selecao";
    selecao.title = "Selecionar para excluir";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = paginaEstaSelecionada(item);
    checkbox.setAttribute("aria-label", `Selecionar página ${item.indexOriginal + 1}`);
    checkbox.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
        if (checkbox.checked) paginasSelecionadas.add(item.indexOriginal);
        else paginasSelecionadas.delete(item.indexOriginal);
        atualizarUiSelecao();
    });
    selecao.appendChild(checkbox);

    const arrastar = document.createElement("div");
    arrastar.className = "pdf-pagina-arrastar";
    arrastar.setAttribute("role", "button");
    arrastar.setAttribute("tabindex", "0");
    arrastar.setAttribute("aria-label", "Arrastar para reordenar");
    arrastar.title = "Arrastar para reordenar";
    arrastar.innerHTML = '<span class="icone-arrastar" aria-hidden="true"></span>';

    const badge = document.createElement("span");
    badge.className = "pdf-pagina-doc-badge";
    badge.textContent = `Doc ${grupoIdx + 1}`;

    topo.append(selecao, arrastar, badge);

    const preview = document.createElement("div");
    preview.className = "pdf-pagina-preview-wrap";

    const placeholder = criarPlaceholderPreview();
    const canvas = document.createElement("canvas");
    canvas.className = "pdf-pagina-preview";
    canvas.hidden = true;
    canvas.setAttribute("aria-label", `Preview da página ${item.indexOriginal + 1}`);

    preview.append(placeholder, canvas);
    if (!modoSelecao) {
        ligarPreviewAoVisualizador(preview, item.indexOriginal);
    } else {
        preview.classList.add("pdf-preview-selecao");
        preview.title = "Clique para selecionar";
    }

    card.addEventListener("click", (e) => {
        if (!modoSelecao) return;
        if (e.target.closest(".pdf-pagina-btn-girar, .pdf-pagina-arrastar, .pdf-pagina-selecao")) return;
        alternarSelecaoPagina(item);
    });

    const acoes = document.createElement("div");
    acoes.className = "pdf-pagina-acoes";

    const btnGirar = document.createElement("button");
    btnGirar.type = "button";
    btnGirar.className = "pdf-pagina-btn pdf-pagina-btn-girar";
    btnGirar.title = "Girar 90°";
    btnGirar.setAttribute("aria-label", "Girar página 90 graus");
    btnGirar.textContent = "↻";

    btnGirar.addEventListener("click", (e) => {
        e.stopPropagation();
        girarPagina(item);
        invalidarPreviewPagina(item.indexOriginal);
        atualizarRodapePagina(rodape, item);
        if (card._lazyCanvas) atualizarItemLazyCard(card, item);
        renderizarListaDocumentos();
    });

    acoes.append(btnGirar);

    const rodape = document.createElement("div");
    rodape.className = "pdf-pagina-rodape";
    atualizarRodapePagina(rodape, item);

    card.append(topo, preview, acoes, rodape);
    card._canvas = canvas;
    card._lazyCanvas = canvas;
    card._lazyPlaceholder = placeholder;
    card._lazyLargura = 120;
    card._lazyItem = item;
    card._item = item;

    return card;
}

function criarBotaoDivisor(pos) {
    const esq = paginasOrdem[pos];
    const dir = paginasOrdem[pos + 1];
    const key = chaveDivisao(esq.indexOriginal, dir.indexOriginal);
    const ativo = divisoesEntre.has(key);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `pdf-divisor${ativo ? " ativo" : ""}`;
    btn.title = ativo ? "Unir documentos (remover divisão)" : "Dividir documento aqui";
    btn.setAttribute("aria-label", ativo ? "Remover divisão entre páginas" : "Dividir documento entre estas páginas");
    btn.innerHTML = '<span aria-hidden="true">✂</span>';

    btn.addEventListener("click", () => {
        if (ativo) divisoesEntre.delete(key);
        else divisoesEntre.add(key);
        renderizarInterfaceCompleta();
    });

    return btn;
}

function montarFaixaPaginas() {
    resetarLazyPreview();
    faixaPaginas.replaceChildren();

    paginasOrdem.forEach((item, pos) => {
        faixaPaginas.appendChild(criarCardPagina(item, pos));
        if (pos < paginasOrdem.length - 1) {
            faixaPaginas.appendChild(criarBotaoDivisor(pos));
        }
    });

    observarMiniaturasAposMontagem(faixaPaginas);
    atualizarUiSelecao();
}

async function renderizarListaDocumentos() {
    const grupos = obterGrupos();
    sincronizarNomesDocumentos(nomesDocumentos, grupos, stemBase);
    listaDocumentos.replaceChildren();

    for (let i = 0; i < grupos.length; i += 1) {
        const paginas = grupos[i];
        const card = document.createElement("article");
        card.className = `pdf-documento-card ${CORES_DOCUMENTO[i % CORES_DOCUMENTO.length]}`;

        const cabecalho = document.createElement("div");
        cabecalho.className = "pdf-documento-cabecalho";
        cabecalho.innerHTML = `
            <span class="pdf-documento-num">Documento ${i + 1}</span>
            <span class="pdf-documento-qtd">${paginas.length} página(s)</span>
        `;

        const label = document.createElement("label");
        label.className = "pdf-documento-label";
        label.textContent = "Nome do arquivo";
        label.setAttribute("for", `doc-nome-${i}`);

        const input = document.createElement("input");
        input.type = "text";
        input.id = `doc-nome-${i}`;
        input.className = "pdf-documento-nome";
        input.value = nomesDocumentos[i];
        input.placeholder = "Ex: Ata de Registro de Preço";
        input.addEventListener("input", () => {
            nomesDocumentos[i] = input.value;
        });

        const miniaturas = document.createElement("div");
        miniaturas.className = "pdf-documento-miniaturas";

        for (const pagina of paginas) {
            const wrap = document.createElement("div");
            wrap.className = "pdf-doc-mini-wrap pdf-preview-clicavel";
            wrap.title = "Clique para ampliar";

            try {
                const mini = await clonarCanvasPagina(
                    pagina.indexOriginal,
                    pagina.rotacao || 0
                );
                wrap.appendChild(mini);
            } catch (e) {
                wrap.textContent = `p.${pagina.indexOriginal + 1}`;
            }

            const legenda = document.createElement("span");
            const rot = pagina.rotacao ? ` · ${pagina.rotacao}°` : "";
            legenda.textContent = `p.${pagina.indexOriginal + 1}${rot}`;
            wrap.appendChild(legenda);
            ligarPreviewAoVisualizador(wrap, pagina.indexOriginal);
            miniaturas.appendChild(wrap);
        }

        card.append(cabecalho, label, input, miniaturas);
        listaDocumentos.appendChild(card);
    }
}

function renderizarInterface() {
    montarFaixaPaginas();
    renderizarListaDocumentos();
    atualizarContador();
}

function renderizarInterfaceCompleta() {
    renderizarInterface();
    configurarNavegacaoVisualizador(() => indicesAtivos(paginasOrdem));
}

function reordenarPagina(dePos, paraPos) {
    if (!reordenarPaginaNaLista(paginasOrdem, dePos, paraPos)) return;
    limparDivisoesOrfas(paginasOrdem, divisoesEntre);
    renderizarInterfaceCompleta();
}

function iniciarArrastarPaginas() {
    if (arrastarIniciado) return;
    arrastarIniciado = true;

    faixaPaginas.addEventListener("pointerdown", (e) => {
        if (modoSelecao) return;
        if (e.target.closest(".pdf-pagina-btn")) return;

        const handle = e.target.closest(".pdf-pagina-arrastar");
        if (!handle) return;

        const card = handle.closest(".pdf-pagina-card");
        if (!card) return;

        e.preventDefault();
        handle.setPointerCapture(e.pointerId);

        arrastandoPagina = {
            card,
            dePos: Number(card.dataset.pos),
            pointerId: e.pointerId
        };
        card.classList.add("arrastando");
    });

    faixaPaginas.addEventListener("pointermove", (e) => {
        if (!arrastandoPagina || e.pointerId !== arrastandoPagina.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".pdf-pagina-card");
        faixaPaginas.querySelectorAll(".pdf-pagina-card").forEach((c) => {
            c.classList.toggle("sobre-arrasto", alvo === c && c !== arrastandoPagina.card);
        });
    });

    const finalizar = (e) => {
        if (!arrastandoPagina || e.pointerId !== arrastandoPagina.pointerId) return;

        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".pdf-pagina-card");
        const { card, dePos } = arrastandoPagina;

        card.classList.remove("arrastando");
        faixaPaginas.querySelectorAll(".pdf-pagina-card").forEach((c) => {
            c.classList.remove("sobre-arrasto");
        });

        if (alvo && alvo !== card) {
            const cards = [...faixaPaginas.querySelectorAll(".pdf-pagina-card")];
            const paraPos = cards.indexOf(alvo);
            if (paraPos >= 0) reordenarPagina(dePos, paraPos);
        }

        arrastandoPagina = null;
    };

    faixaPaginas.addEventListener("pointerup", finalizar);
    faixaPaginas.addEventListener("pointercancel", finalizar);
}

async function abrirEditor(file, bytes, totalPaginas) {
    selectedFile = file;
    pdfBytes = bytes;
    paginasOrdem = criarEstadoPaginas(totalPaginas);
    divisoesEntre = new Set();
    nomesDocumentos = [];
    stemBase = stemArquivoPdf(file.name);

    fileNameEl.textContent = file.name;
    fileChip.hidden = false;
    dropzone.classList.add("com-arquivo");

    editorSubtitulo.textContent = `${file.name} · ${totalPaginas} página(s)`;
    mostrarPassoFerramenta("step-editor");
    carregandoEl.hidden = false;

    try {
        await carregarPdfJs(bytes);
        renderizarInterfaceCompleta();
    } catch (e) {
        alert(e.message || "Não foi possível gerar os previews.");
    } finally {
        carregandoEl.hidden = true;
    }
}

async function setFile(file) {
    if (!file) {
        limparEstado();
        return;
    }

    try {
        const info = await obterInfoPdf(file);
        await abrirEditor(file, info.bytes, info.totalPaginas);
    } catch (e) {
        alert(e.message || "Não foi possível ler o PDF.");
        fileInput.value = "";
        limparEstado();
        mostrarPassoFerramenta("step-upload");
    }
}

iniciarDropzone(dropzone, fileInput, setFile);

btnClear.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.value = "";
    limparEstado();
    mostrarPassoFerramenta("step-upload");
});

document.getElementById("btn-trocar-arquivo").addEventListener("click", () => {
    fileInput.value = "";
    limparEstado();
    mostrarPassoFerramenta("step-upload");
});

document.getElementById("btn-um-documento").addEventListener("click", () => {
    divisoesEntre.clear();
    renderizarInterfaceCompleta();
});

document.getElementById("btn-pagina-documento").addEventListener("click", () => {
    divisoesEntre = aplicarDivisaoEntreTodasPaginas(paginasOrdem);
    renderizarInterfaceCompleta();
});

btnSelecionarPaginas?.addEventListener("click", () => {
    definirModoSelecao(!modoSelecao);
});

btnExcluirSelecionadas?.addEventListener("click", excluirPaginasSelecionadas);

async function processar() {
    const documentos = documentosParaExportar();
    if (!selectedFile || !pdfBytes || documentos.length === 0) return;

    btnProcessar.disabled = true;
    const logEl = document.getElementById("log-mini");
    logEl.textContent = `Gerando ${documentos.length} documento(s)…\n`;
    mostrarPassoFerramenta("step-processing");

    try {
        const resultado = await exportarDocumentosAgrupados(
            pdfBytes,
            documentos,
            (atual, total) => {
                logEl.textContent = `Gerando documento ${atual} de ${total}…\n`;
            }
        );

        logEl.textContent += `${resultado.totalDocumentos} arquivo(s) criado(s).\n`;
        mostrarSucesso(resultado);
    } catch (e) {
        mostrarErro(e.message || "Falha ao separar o PDF.");
    } finally {
        btnProcessar.disabled = paginasOrdem.length === 0 || obterGrupos().length === 0;
    }
}

function mostrarSucesso(resultado) {
    const { arquivos, totalDocumentos: total, blob } = resultado;

    document.getElementById("stat-renamed").textContent = total;
    document.getElementById("stat-card").hidden = false;

    const lista = document.getElementById("rename-list");
    lista.replaceChildren();

    document.getElementById("result-sub").textContent =
        total === 1
            ? "1 documento exportado com o nome que você definiu."
            : `${total} documentos exportados com os nomes definidos, em um ZIP.`;
    document.getElementById("rename-wrap").hidden = false;

    arquivos.forEach((nome) => {
        const li = document.createElement("li");
        li.textContent = nome;
        lista.appendChild(li);
    });

    revogarDownload();
    downloadUrl = URL.createObjectURL(blob);
    const dl = document.getElementById("btn-download");
    dl.href = downloadUrl;
    dl.download = `${stemBase}_documentos.zip`;
    dl.hidden = false;

    mostrarPassoFerramenta("step-result");
}

function mostrarErro(msg) {
    document.getElementById("error-msg").textContent = msg;
    mostrarPassoFerramenta("step-error");
}

function resetar() {
    revogarDownload();
    fileInput.value = "";
    limparEstado();
    document.getElementById("btn-download").hidden = true;
    document.getElementById("stat-card").hidden = true;
    document.getElementById("rename-wrap").hidden = true;
    mostrarPassoFerramenta("step-upload");
}

btnProcessar.addEventListener("click", processar);
document.getElementById("btn-novo").addEventListener("click", resetar);
document.getElementById("btn-error-back").addEventListener("click", () => {
    mostrarPassoFerramenta(paginasOrdem.length ? "step-editor" : "step-upload");
});

iniciarArrastarPaginas();
configurarNavegacaoVisualizador(() => indicesAtivos(paginasOrdem));
configurarRotacaoVisualizador((indexOriginal) => obterRotacaoPagina(paginasOrdem, indexOriginal));
iniciarVisualizadorPdf();
iniciarAlternanciaModos();
iniciarModoMesclar();
iniciarModoWord();
iniciarTemaFerramenta(botaoTema);
