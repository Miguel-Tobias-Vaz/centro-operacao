const visualizadorEl = document.getElementById("pdf-visualizador");
const visTitulo = document.getElementById("pdf-vis-titulo");
const visZoomLabel = document.getElementById("pdf-vis-zoom");
const visArea = document.getElementById("pdf-vis-area");
const visCanvas = document.getElementById("pdf-vis-canvas");
const btnVisFechar = document.getElementById("pdf-vis-fechar");
const btnVisAnterior = document.getElementById("pdf-vis-anterior");
const btnVisProximo = document.getElementById("pdf-vis-proximo");
const btnVisZoomIn = document.getElementById("pdf-vis-zoom-in");
const btnVisZoomOut = document.getElementById("pdf-vis-zoom-out");
const btnVisAjustar = document.getElementById("pdf-vis-ajustar");

const ZOOM_MIN = 0.35;
const ZOOM_MAX = 3;
const ZOOM_PASSO = 0.2;

let obterOrdemPaginas = () => [];
let obterRotacaoPaginaVis = () => 0;
let paginaAtual = null;
let escalaAtual = 1;
let renderizando = false;
let visualizadorIniciado = false;

function configurarNavegacaoVisualizador(fn) {
    obterOrdemPaginas = fn;
}

function configurarRotacaoVisualizador(fn) {
    obterRotacaoPaginaVis = fn;
}

function indiceNaNavegacao(indexOriginal) {
    return obterOrdemPaginas().indexOf(indexOriginal);
}

function atualizarBotoesNavegacao() {
    const ordem = obterOrdemPaginas();
    const idx = indiceNaNavegacao(paginaAtual);

    if (btnVisAnterior) btnVisAnterior.disabled = idx <= 0;
    if (btnVisProximo) btnVisProximo.disabled = idx < 0 || idx >= ordem.length - 1;
}

async function calcularEscalaAjustada() {
    if (paginaAtual === null) return 1;

    const rotacao = obterRotacaoPaginaVis(paginaAtual);
    const larguraPagina = await obterLarguraPagina(paginaAtual, rotacao);
    const larguraArea = Math.max(visArea.clientWidth - 32, 200);
    const alturaArea = Math.max(visArea.clientHeight - 32, 200);

    const escalaLargura = larguraArea / larguraPagina;
    const pagina = await pdfJsDoc.getPage(paginaAtual + 1);
    const alturaPagina = pagina.getViewport({ scale: 1, rotation: rotacao }).height;
    const escalaAltura = alturaArea / alturaPagina;

    return Math.min(escalaLargura, escalaAltura, 1.5);
}

async function renderizarVisualizador() {
    if (paginaAtual === null || renderizando) return;

    renderizando = true;
    visArea.classList.add("carregando");

    try {
        const rotacao = obterRotacaoPaginaVis(paginaAtual);
        await renderizarPaginaEmEscala(paginaAtual, visCanvas, escalaAtual, rotacao);

        const rotLabel = rotacao ? ` · ${rotacao}°` : "";
        if (visTitulo) {
            visTitulo.textContent = `Página ${paginaAtual + 1}${rotLabel}`;
        }

        if (visZoomLabel) {
            visZoomLabel.textContent = `${Math.round(escalaAtual * 100)}%`;
        }

        atualizarBotoesNavegacao();
    } catch (e) {
        console.error(e);
    } finally {
        visArea.classList.remove("carregando");
        renderizando = false;
    }
}

function fecharVisualizador() {
    if (!visualizadorEl) return;
    visualizadorEl.hidden = true;
    document.body.style.overflow = "";
    paginaAtual = null;
}

async function abrirVisualizadorPdf(indexOriginal) {
    if (!visualizadorEl || indexOriginal === null || indexOriginal === undefined) return;
    if (!pdfJsDoc) return;

    paginaAtual = indexOriginal;
    visualizadorEl.hidden = false;
    document.body.style.overflow = "hidden";

    escalaAtual = await calcularEscalaAjustada();
    await renderizarVisualizador();

    visArea.scrollTop = 0;
    visArea.scrollLeft = 0;
}

async function navegarVisualizador(delta) {
    const ordem = obterOrdemPaginas();
    const idx = indiceNaNavegacao(paginaAtual);
    const proximo = idx + delta;

    if (proximo < 0 || proximo >= ordem.length) return;

    paginaAtual = ordem[proximo];
    escalaAtual = await calcularEscalaAjustada();
    await renderizarVisualizador();
    visArea.scrollTop = 0;
    visArea.scrollLeft = 0;
}

async function alterarZoom(delta) {
    escalaAtual = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, escalaAtual + delta));
    await renderizarVisualizador();
}

async function ajustarZoom() {
    escalaAtual = await calcularEscalaAjustada();
    await renderizarVisualizador();
    visArea.scrollTop = 0;
    visArea.scrollLeft = 0;
}

function iniciarVisualizadorPdf() {
    if (visualizadorIniciado) return;
    visualizadorIniciado = true;

    btnVisFechar?.addEventListener("click", fecharVisualizador);
    visualizadorEl?.querySelector(".pdf-visualizador-backdrop")?.addEventListener("click", fecharVisualizador);

    btnVisAnterior?.addEventListener("click", () => navegarVisualizador(-1));
    btnVisProximo?.addEventListener("click", () => navegarVisualizador(1));
    btnVisZoomIn?.addEventListener("click", () => alterarZoom(ZOOM_PASSO));
    btnVisZoomOut?.addEventListener("click", () => alterarZoom(-ZOOM_PASSO));
    btnVisAjustar?.addEventListener("click", ajustarZoom);

    visArea?.addEventListener("wheel", (e) => {
        if (visualizadorEl.hidden) return;
        e.preventDefault();
        alterarZoom(e.deltaY < 0 ? ZOOM_PASSO : -ZOOM_PASSO);
    }, { passive: false });

    document.addEventListener("keydown", (e) => {
        if (visualizadorEl.hidden) return;

        if (e.key === "Escape") fecharVisualizador();
        else if (e.key === "ArrowLeft") navegarVisualizador(-1);
        else if (e.key === "ArrowRight") navegarVisualizador(1);
        else if (e.key === "+" || e.key === "=") alterarZoom(ZOOM_PASSO);
        else if (e.key === "-") alterarZoom(-ZOOM_PASSO);
        else if (e.key === "0") ajustarZoom();
    });
}

function ligarPreviewAoVisualizador(elemento, indexOriginal) {
    if (!elemento) return;

    elemento.classList.add("pdf-preview-clicavel");
    elemento.setAttribute("role", "button");
    elemento.setAttribute("tabindex", "0");
    elemento.setAttribute("aria-label", `Ampliar página ${indexOriginal + 1}`);
    elemento.title = "Clique para ampliar";

    const abrir = (e) => {
        if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return;
        e.preventDefault();
        e.stopPropagation();
        abrirVisualizadorPdf(indexOriginal);
    };

    elemento.addEventListener("click", abrir);
    elemento.addEventListener("keydown", abrir);
}
