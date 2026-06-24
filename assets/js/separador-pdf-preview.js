const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

let pdfJsDoc = null;

function configurarPdfJs() {
    if (typeof pdfjsLib === "undefined") {
        throw new Error("Biblioteca de visualização de PDF não carregada.");
    }
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
}

async function carregarPdfJs(bytes) {
    configurarPdfJs();
    liberarPdfJs();
    const tarefa = pdfjsLib.getDocument({ data: bytes.slice(0) });
    pdfJsDoc = await tarefa.promise;
    return pdfJsDoc;
}

async function renderizarMiniaturaPagina(indexOriginal, canvas, larguraMax = 150, rotacao = 0) {
    if (!pdfJsDoc || !canvas) return;

    const pagina = await pdfJsDoc.getPage(indexOriginal + 1);
    const viewportBase = pagina.getViewport({ scale: 1, rotation: rotacao });
    const escala = larguraMax / viewportBase.width;
    const viewport = pagina.getViewport({ scale: escala, rotation: rotacao });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d");
    await pagina.render({ canvasContext: ctx, viewport }).promise;
}

async function renderizarPaginaEmEscala(indexOriginal, canvas, escala, rotacao = 0) {
    if (!pdfJsDoc) return { width: 0, height: 0 };

    const pagina = await pdfJsDoc.getPage(indexOriginal + 1);
    const viewport = pagina.getViewport({ scale: escala, rotation: rotacao });

    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext("2d");
    await pagina.render({ canvasContext: ctx, viewport }).promise;

    return { width: canvas.width, height: canvas.height };
}

async function obterLarguraPagina(indexOriginal, rotacao = 0) {
    if (!pdfJsDoc) return 0;
    const pagina = await pdfJsDoc.getPage(indexOriginal + 1);
    return pagina.getViewport({ scale: 1, rotation: rotacao }).width;
}

function liberarPdfJs() {
    if (pdfJsDoc) {
        pdfJsDoc.destroy();
        pdfJsDoc = null;
    }
}

async function clonarCanvasPagina(indexOriginal, rotacao, classe = "pdf-doc-miniatura") {
    const canvas = document.createElement("canvas");
    canvas.className = classe;
    await renderizarMiniaturaPagina(indexOriginal, canvas, 56, rotacao);
    return canvas;
}
