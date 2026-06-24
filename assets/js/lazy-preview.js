const LAZY_ROOT_MARGIN = "280px 0px";
const LAZY_LIMITE_RENDER = 24;

let lazyObserver = null;
let lazyFila = [];
let lazyRenderizando = false;
let lazyCache = new Map();
let lazyCardsAtivos = new Map();

function obterChavePreview(indexOriginal, rotacao) {
    return `${indexOriginal}:${rotacao || 0}`;
}

function criarPlaceholderPreview() {
    const el = document.createElement("div");
    el.className = "pdf-preview-placeholder";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = '<span class="pdf-preview-placeholder-icone">📄</span>';
    return el;
}

function liberarCanvasPreview(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 0;
    canvas.height = 0;
    canvas.hidden = true;
}

async function processarFilaLazy() {
    if (lazyRenderizando) return;
    lazyRenderizando = true;

    while (lazyFila.length > 0) {
        const tarefa = lazyFila.shift();
        if (!tarefa) continue;

        const { card, item, canvas, placeholder, largura } = tarefa;
        if (!card.isConnected) continue;

        const chave = obterChavePreview(item.indexOriginal, item.rotacao);

        try {
            await renderizarMiniaturaPagina(
                item.indexOriginal,
                canvas,
                largura,
                item.rotacao
            );
            lazyCache.set(chave, true);
            canvas.hidden = false;
            if (placeholder) placeholder.hidden = true;
            card.classList.remove("aguardando-preview");
        } catch (e) {
            console.warn("Lazy preview página", item.indexOriginal + 1, e);
        }

        if (lazyFila.length > 0) {
            await new Promise((r) => setTimeout(r, 0));
        }
    }

    lazyRenderizando = false;
}

function enfileirarPreviewLazy(card, item, canvas, placeholder, largura = 120) {
    lazyFila = lazyFila.filter((t) => t.card !== card);
    lazyFila.push({ card, item, canvas, placeholder, largura });

    if (lazyFila.length > LAZY_LIMITE_RENDER) {
        lazyFila = lazyFila.slice(-LAZY_LIMITE_RENDER);
    }

    processarFilaLazy();
}

function desregistrarCardLazy(card) {
    lazyObserver?.unobserve(card);
    lazyCardsAtivos.delete(card);
    lazyFila = lazyFila.filter((t) => t.card !== card);
}

function registrarCardLazy(card, item, canvas, placeholder, largura = 120) {
    if (!lazyObserver) iniciarLazyPreview();

    card._lazyItem = item;
    card._lazyCanvas = canvas;
    card._lazyPlaceholder = placeholder;
    card._lazyLargura = largura;
    lazyCardsAtivos.set(card, { item, canvas, placeholder, largura });
    lazyObserver.observe(card);
}

function iniciarLazyPreview() {
    if (lazyObserver) return;

    lazyObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const card = entry.target;
                const meta = lazyCardsAtivos.get(card);
                if (!meta) return;

                const { item, canvas, placeholder, largura } = meta;
                const chave = obterChavePreview(item.indexOriginal, item.rotacao);

                if (entry.isIntersecting) {
                    if (lazyCache.has(chave) && canvas.width > 0) {
                        canvas.hidden = false;
                        if (placeholder) placeholder.hidden = true;
                        card.classList.remove("aguardando-preview");
                        return;
                    }

                    card.classList.add("aguardando-preview");
                    enfileirarPreviewLazy(card, item, canvas, placeholder, largura);
                } else if (entry.intersectionRatio === 0) {
                    liberarCanvasPreview(canvas);
                    canvas.hidden = true;
                    if (placeholder) placeholder.hidden = false;
                    card.classList.add("aguardando-preview");
                    lazyCache.delete(chave);
                }
            });
        },
        { root: null, rootMargin: LAZY_ROOT_MARGIN, threshold: [0, 0.05, 0.2] }
    );
}

function invalidarPreviewPagina(indexOriginal) {
    [0, 90, 180, 270].forEach((r) => {
        lazyCache.delete(obterChavePreview(indexOriginal, r));
    });
}

function resetarLazyPreview() {
    lazyFila = [];
    lazyCache.clear();
    lazyCardsAtivos.forEach((_, card) => desregistrarCardLazy(card));
    lazyCardsAtivos.clear();
    if (lazyObserver) {
        lazyObserver.disconnect();
        lazyObserver = null;
    }
}

function atualizarItemLazyCard(card, item) {
    invalidarPreviewPagina(item.indexOriginal);
    const canvas = card._lazyCanvas;
    const placeholder = card._lazyPlaceholder;
    const largura = card._lazyLargura || 120;

    liberarCanvasPreview(canvas);
    if (placeholder) placeholder.hidden = false;
    card.classList.add("aguardando-preview");

    card._lazyItem = item;
    lazyCardsAtivos.set(card, { item, canvas, placeholder, largura });

    if (lazyObserver) lazyObserver.unobserve(card);
    lazyObserver?.observe(card);
}

function observarMiniaturasAposMontagem(container) {
    container.querySelectorAll(".pdf-pagina-card").forEach((card) => {
        if (card._lazyCanvas && card._lazyItem) {
            registrarCardLazy(
                card,
                card._lazyItem,
                card._lazyCanvas,
                card._lazyPlaceholder,
                card._lazyLargura || 120
            );
        }
    });
}
