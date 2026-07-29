/**
 * Reposicionamento de imagens (object-position / background-position).
 * Arrastar a prévia para escolher o enquadramento.
 */
(() => {
    const DEFAULT = "50% 50%";

    function clamp(n, min, max) {
        return Math.min(max, Math.max(min, n));
    }

    function parsePct(valor) {
        const n = Number.parseFloat(String(valor).replace("%", "").trim());
        return Number.isFinite(n) ? clamp(n, 0, 100) : 50;
    }

    function normalizar(pos) {
        if (!pos || typeof pos !== "string") return DEFAULT;
        const partes = pos.trim().split(/\s+/);
        if (partes.length < 2) return DEFAULT;
        return `${parsePct(partes[0])}% ${parsePct(partes[1])}%`;
    }

    function parse(pos) {
        const n = normalizar(pos);
        const [x, y] = n.split(/\s+/);
        return { x: parsePct(x), y: parsePct(y) };
    }

    function format(x, y) {
        return `${clamp(Math.round(x * 10) / 10, 0, 100)}% ${clamp(Math.round(y * 10) / 10, 0, 100)}%`;
    }

    function aplicarImg(el, pos) {
        if (!el) return;
        el.style.objectPosition = normalizar(pos);
    }

    function aplicarBg(el, pos) {
        if (!el) return;
        el.style.backgroundPosition = normalizar(pos);
    }

    /**
     * Liga arrastar para reposicionar.
     * @param {HTMLElement} container
     * @param {{ modo?: 'img'|'bg', posicao?: string, onChange?: (pos: string) => void }} opts
     */
    function ligarPan(container, opts = {}) {
        if (!container) return null;

        const modo = opts.modo === "bg" ? "bg" : "img";
        let pos = normalizar(opts.posicao);
        let pointerId = null;
        let startX = 0;
        let startY = 0;
        let startPos = { x: 50, y: 50 };
        let moved = false;

        function alvo() {
            if (modo === "bg") return container;
            return container.querySelector("img");
        }

        function aplicar() {
            const el = alvo();
            if (!el) {
                container.classList.remove("img-pos-arrastavel");
                return;
            }
            if (modo === "bg") aplicarBg(el, pos);
            else aplicarImg(el, pos);
            container.classList.add("img-pos-arrastavel");
            container.dataset.imgPos = pos;
            opts.onChange?.(pos);
        }

        function onPointerDown(e) {
            if (e.button != null && e.button !== 0) return;
            if (!alvo()) return;
            pointerId = e.pointerId;
            moved = false;
            startX = e.clientX;
            startY = e.clientY;
            startPos = parse(pos);
            container.classList.add("is-arrastando");
            try {
                container.setPointerCapture(pointerId);
            } catch {
                /* ignore */
            }
            e.preventDefault();
        }

        function onPointerMove(e) {
            if (pointerId == null || e.pointerId !== pointerId) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
            const rect = container.getBoundingClientRect();
            const w = Math.max(rect.width, 1);
            const h = Math.max(rect.height, 1);
            // Arrastar a foto: puxar para a direita mostra mais a esquerda
            const nx = startPos.x - (dx / w) * 100;
            const ny = startPos.y - (dy / h) * 100;
            pos = format(nx, ny);
            aplicar();
        }

        function onPointerUp(e) {
            if (pointerId == null || e.pointerId !== pointerId) return;
            pointerId = null;
            container.classList.remove("is-arrastando");
            try {
                container.releasePointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
            if (moved) {
                container.dataset.arrastou = "1";
                // limpa no próximo tick para bloquear click de “trocar ficheiro”
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        container.dataset.arrastou = "0";
                    }, 0);
                });
            }
        }

        container.addEventListener("pointerdown", onPointerDown);
        container.addEventListener("pointermove", onPointerMove);
        container.addEventListener("pointerup", onPointerUp);
        container.addEventListener("pointercancel", onPointerUp);

        aplicar();

        return {
            getPos: () => pos,
            setPos(nova) {
                pos = normalizar(nova);
                aplicar();
            },
            refresh() {
                aplicar();
            },
            destroy() {
                container.removeEventListener("pointerdown", onPointerDown);
                container.removeEventListener("pointermove", onPointerMove);
                container.removeEventListener("pointerup", onPointerUp);
                container.removeEventListener("pointercancel", onPointerUp);
                container.classList.remove("img-pos-arrastavel", "is-arrastando");
            }
        };
    }

    window.ImagemPosicao = {
        DEFAULT,
        normalizar,
        parse,
        format,
        aplicarImg,
        aplicarBg,
        ligarPan
    };
})();
