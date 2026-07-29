/**
 * Contorna o bug do Chromium que congela GIFs animados com
 * filter / transform / backdrop-filter / overflow+radius nos ancestrais.
 * Desenha os frames num <canvas> por cima do <img class="is-gif">.
 */
(() => {
    const ativos = new WeakMap();
    const falhas = new WeakSet();
    let geracao = 0;

    function parseObjectPosition(valor) {
        const partes = String(valor || "50% 50%").trim().split(/\s+/);
        const pct = (v, fallback) => {
            if (v === "left" || v === "top") return 0;
            if (v === "right" || v === "bottom") return 100;
            if (v === "center") return 50;
            const n = Number.parseFloat(v);
            return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
        };
        return { x: pct(partes[0], 50), y: pct(partes[1] || partes[0], 50) };
    }

    function drawCover(ctx, bmp, w, h, pos) {
        const br = bmp.width / Math.max(bmp.height, 1);
        const cr = w / Math.max(h, 1);
        let dw;
        let dh;
        if (br > cr) {
            dh = h;
            dw = h * br;
        } else {
            dw = w;
            dh = w / br;
        }
        const dx = (w - dw) * (pos.x / 100);
        const dy = (h - dh) * (pos.y / 100);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(bmp, dx, dy, dw, dh);
    }

    function garantirHost(img) {
        const parent = img.parentElement;
        if (!parent) return null;
        if (getComputedStyle(parent).position === "static") {
            parent.style.position = "relative";
        }
        return parent;
    }

    function syncTamanho(img, canvas) {
        const w = Math.max(1, Math.round(img.clientWidth || img.naturalWidth || 1));
        const h = Math.max(1, Math.round(img.clientHeight || img.naturalHeight || 1));
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        return { w, h };
    }

    async function decodificar(url) {
        if (typeof ImageDecoder === "undefined") {
            throw new Error("ImageDecoder indisponível");
        }
        const res = await fetch(url, { mode: "cors", credentials: "omit", cache: "force-cache" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.arrayBuffer();
        const decoder = new ImageDecoder({ data, type: "image/gif" });
        await decoder.tracks.ready;
        await decoder.completed.catch(() => {});
        const track = decoder.tracks.selectedTrack;
        const total = track?.frameCount || 0;
        if (!total) throw new Error("GIF sem frames");

        const frames = [];
        for (let i = 0; i < total; i++) {
            const result = await decoder.decode({ frameIndex: i });
            const delayMicro = result.image.duration != null && result.image.duration > 0
                ? Number(result.image.duration)
                : 100000;
            const bitmap = await createImageBitmap(result.image);
            result.image.close();
            frames.push({
                bitmap,
                delayMs: Math.max(30, Math.round(delayMicro / 1000))
            });
        }
        try {
            decoder.close();
        } catch {
            /* ignore */
        }
        return frames;
    }

    function parar(img, { manterFalha = false } = {}) {
        const estado = ativos.get(img);
        if (!estado) {
            img?.classList?.remove("gif-vivo-fonte");
            img?.nextElementSibling?.classList?.contains?.("gif-vivo-canvas") &&
                img.nextElementSibling.remove();
            return;
        }
        estado.parar = true;
        if (estado.raf) cancelAnimationFrame(estado.raf);
        if (estado.timer) clearTimeout(estado.timer);
        try {
            estado.ro?.disconnect();
        } catch {
            /* ignore */
        }
        estado.frames?.forEach((f) => {
            try {
                f.bitmap.close();
            } catch {
                /* ignore */
            }
        });
        estado.canvas?.remove();
        img.classList.remove("gif-vivo-fonte");
        ativos.delete(img);
        if (!manterFalha) falhas.delete(img);
    }

    async function ativar(img) {
        if (!img || img.tagName !== "IMG") return;
        if (!img.classList.contains("is-gif")) {
            parar(img);
            return;
        }

        const url = img.currentSrc || img.src;
        if (!url) return;

        const prev = ativos.get(img);
        if (prev && prev.url === url && !prev.parar) return;
        if (falhas.has(img) && prev?.url === url) return;

        const token = ++geracao;
        parar(img);
        if (!garantirHost(img)) return;

        const canvas = document.createElement("canvas");
        canvas.className = "gif-vivo-canvas";
        canvas.setAttribute("aria-hidden", "true");
        img.insertAdjacentElement("afterend", canvas);
        img.classList.add("gif-vivo-fonte");

        const estado = {
            url,
            canvas,
            frames: null,
            parar: false,
            raf: 0,
            timer: 0,
            indice: 0,
            token
        };
        ativos.set(img, estado);

        try {
            const frames = await decodificar(url);
            if (estado.parar || ativos.get(img) !== estado) {
                frames.forEach((f) => f.bitmap.close());
                return;
            }
            estado.frames = frames;
            falhas.delete(img);

            const ctx = canvas.getContext("2d", { alpha: true });
            const pintar = () => {
                if (estado.parar || !estado.frames?.length) return;
                const { w, h } = syncTamanho(img, canvas);
                const pos = parseObjectPosition(getComputedStyle(img).objectPosition);
                const frame = estado.frames[estado.indice % estado.frames.length];
                drawCover(ctx, frame.bitmap, w, h, pos);
                estado.indice += 1;
                estado.timer = window.setTimeout(() => {
                    estado.raf = requestAnimationFrame(pintar);
                }, frame.delayMs);
            };
            pintar();

            if (typeof ResizeObserver !== "undefined") {
                estado.ro = new ResizeObserver(() => {
                    if (!estado.parar) syncTamanho(img, canvas);
                });
                estado.ro.observe(img.parentElement || img);
            }
        } catch (erro) {
            console.warn("GifVivo: a tentar iframe —", erro.message || erro);
            canvas.remove();
            // Iframe = documento isolado; anima mesmo com CSS “congelador” no pai
            const iframe = document.createElement("iframe");
            iframe.className = "gif-vivo-canvas gif-vivo-iframe";
            iframe.setAttribute("aria-hidden", "true");
            iframe.setAttribute("tabindex", "-1");
            iframe.loading = "eager";
            iframe.src = url;
            img.insertAdjacentElement("afterend", iframe);
            img.classList.add("gif-vivo-fonte");
            estado.canvas = iframe;
            estado.frames = [];
            ativos.set(img, estado);
            falhas.delete(img);
        }
    }

    function enfileirar(img) {
        if (!img || img.tagName !== "IMG") return;
        if (!img.classList.contains("is-gif")) {
            parar(img);
            return;
        }
        // Evita reentrada por mutações da própria classe gif-vivo-fonte
        const url = img.currentSrc || img.src;
        const prev = ativos.get(img);
        if (prev && prev.url === url && !prev.parar) return;

        requestAnimationFrame(() => ativar(img));
    }

    function varrer(raiz = document) {
        if (!raiz?.querySelectorAll) return;
        if (raiz.matches?.("img.is-gif")) enfileirar(raiz);
        raiz.querySelectorAll?.("img.is-gif").forEach(enfileirar);
    }

    function observar() {
        const mo = new MutationObserver((muts) => {
            for (const m of muts) {
                if (m.type === "attributes" && m.target?.tagName === "IMG") {
                    if (m.attributeName === "src") {
                        falhas.delete(m.target);
                        enfileirar(m.target);
                    } else if (m.attributeName === "class") {
                        const img = m.target;
                        const tinha = (m.oldValue || "").split(/\s+/).includes("is-gif");
                        const tem = img.classList.contains("is-gif");
                        if (tinha !== tem || (tem && !ativos.has(img) && !falhas.has(img))) {
                            enfileirar(img);
                        }
                    }
                    continue;
                }
                m.addedNodes?.forEach((n) => {
                    if (n.nodeType !== 1) return;
                    if (n.classList?.contains("gif-vivo-canvas")) return;
                    varrer(n);
                });
            }
        });
        mo.observe(document.documentElement, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeOldValue: true,
            attributeFilter: ["src", "class"]
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            varrer();
            observar();
        });
    } else {
        varrer();
        observar();
    }

    window.GifVivo = { ativar, parar, varrer };
})();
