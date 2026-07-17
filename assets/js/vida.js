/**
 * Camada de vida visual (v1.1) — microinterações sem redesenho.
 * Respeita prefers-reduced-motion.
 */
(() => {
    const reduzirMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const touch = window.matchMedia("(hover: none), (pointer: coarse)").matches;

    function garantirAmbiente() {
        if (document.querySelector(".vida-ambiente")) return;

        const ambiente = document.createElement("div");
        ambiente.className = "vida-ambiente";
        ambiente.setAttribute("aria-hidden", "true");
        ambiente.innerHTML = `
            <div class="vida-gradiente"></div>
            <div class="vida-ruido"></div>
            <div class="vida-orb vida-orb-a" data-parallax="0.18"></div>
            <div class="vida-orb vida-orb-b" data-parallax="0.12"></div>
            <div class="vida-orb vida-orb-c" data-parallax="0.22"></div>
            <div class="vida-cursor" id="vida-cursor"></div>
        `;
        document.body.prepend(ambiente);
    }

    function prepararRevelacao() {
        const seletores = [
            ".inicio-card",
            ".card-modulo-grid",
            ".categoria-bloco",
            ".publicacao-item",
            ".admin-card",
            ".panel-tratamento",
            ".examples-panel",
            ".stat-card"
        ];

        document.querySelectorAll(seletores.join(",")).forEach((el) => {
            if (!el.classList.contains("revelar")) {
                el.classList.add("revelar");
            }
        });
    }

    /** Registra elementos .revelar no IntersectionObserver (ou revela na hora se reduced-motion). */
    let observarElementoRevelar = (el) => {
        if (!el || el.classList.contains("revelar-visivel")) return;
        if (reduzirMotion) {
            el.classList.add("revelar-visivel");
            return;
        }
        // Fallback até o observer real ser criado em iniciarScrollReveal
        el.classList.add("revelar-visivel");
    };

    function iniciarScrollReveal() {
        if (reduzirMotion) {
            document.querySelectorAll(".revelar").forEach((el) => el.classList.add("revelar-visivel"));
            observarElementoRevelar = (el) => {
                if (el && !el.classList.contains("revelar-visivel")) {
                    el.classList.add("revelar-visivel");
                }
            };
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add("revelar-visivel");
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: "0px 0px -6% 0px" }
        );

        observarElementoRevelar = (el) => {
            if (!el || el.classList.contains("revelar-visivel") || el.dataset.vidaObservado) return;
            el.dataset.vidaObservado = "1";
            observer.observe(el);
        };

        document.querySelectorAll(".revelar").forEach((el) => observarElementoRevelar(el));

        const mo = new MutationObserver(() => {
            document.querySelectorAll(".revelar:not(.revelar-visivel)").forEach((el) => {
                observarElementoRevelar(el);
            });
        });

        // childList + class: cards dinâmicos recebem .revelar depois de anexados ao DOM
        mo.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"]
        });
    }

    function iniciarCursorEParallax() {
        if (reduzirMotion || touch) return;

        const cursor = document.getElementById("vida-cursor");
        let mx = window.innerWidth / 2;
        let my = window.innerHeight / 2;
        let cx = mx;
        let cy = my;
        let ativo = false;

        document.addEventListener(
            "pointermove",
            (e) => {
                mx = e.clientX;
                my = e.clientY;
                ativo = true;
                document.documentElement.style.setProperty("--mx", `${mx}px`);
                document.documentElement.style.setProperty("--my", `${my}px`);
            },
            { passive: true }
        );

        document.addEventListener(
            "pointerleave",
            () => {
                ativo = false;
            },
            { passive: true }
        );

        const orbs = [...document.querySelectorAll("[data-parallax]")];
        const card = document.querySelector(".inicio-card");

        function tick() {
            cx += (mx - cx) * 0.08;
            cy += (my - cy) * 0.08;

            if (cursor) {
                cursor.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`;
                cursor.style.opacity = ativo ? "1" : "0";
            }

            const nx = (cx / window.innerWidth - 0.5) * 2;
            const ny = (cy / window.innerHeight - 0.5) * 2;

            orbs.forEach((orb) => {
                const f = Number(orb.dataset.parallax) || 0.1;
                orb.style.transform = `translate3d(${nx * f * 28}px, ${ny * f * 20}px, 0)`;
            });

            if (card && !card.closest("[hidden]")) {
                card.style.setProperty("--tilt-x", `${(-ny * 1.2).toFixed(2)}deg`);
                card.style.setProperty("--tilt-y", `${(nx * 1.4).toFixed(2)}deg`);
            }

            requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    function marcarCardsDinamicos() {
        const grid = document.getElementById("categorias-modulos") || document.getElementById("grid-modulos");
        if (!grid) return;

        const marcar = () => {
            grid.querySelectorAll(".card-modulo-grid, .card-modulo").forEach((el) => {
                if (!el.classList.contains("revelar")) {
                    el.classList.add("revelar");
                }
                // Garante observação mesmo se o MO de class não disparar a tempo
                observarElementoRevelar(el);
            });
        };

        marcar();
        new MutationObserver(marcar).observe(grid, { childList: true, subtree: true });
    }

    function iniciar() {
        document.documentElement.classList.add("vida-ativa");
        if (reduzirMotion) document.documentElement.classList.add("vida-reduzida");

        garantirAmbiente();
        prepararRevelacao();
        iniciarScrollReveal();
        iniciarCursorEParallax();
        marcarCardsDinamicos();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", iniciar);
    } else {
        iniciar();
    }
})();
