function hexParaRgb(hex) {
    const h = hex.replace("#", "");
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16)
    };
}

function rgbParaHex(r, g, b) {
    const canal = (v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
    return `#${canal(r)}${canal(g)}${canal(b)}`;
}

function clarearCor(hex, fator) {
    const { r, g, b } = hexParaRgb(hex);
    return rgbParaHex(
        r + (255 - r) * fator,
        g + (255 - g) * fator,
        b + (255 - b) * fator
    );
}

function escurecerCor(hex, fator) {
    const { r, g, b } = hexParaRgb(hex);
    return rgbParaHex(r * (1 - fator), g * (1 - fator), b * (1 - fator));
}

function luminanciaCor(hex) {
    const { r, g, b } = hexParaRgb(hex);
    const canal = (c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

const COR_DESTAQUE_PADRAO = "#2b8cff";

function obterCorDestaqueAtiva() {
    return localStorage.getItem("corDestaque") || COR_DESTAQUE_PADRAO;
}

function sincronizarSeletorCor(hex) {
    const input = document.getElementById("cor-destaque");
    const amostra = document.getElementById("cor-destaque-amostra");
    if (input) input.value = hex;
    if (amostra) amostra.style.backgroundColor = hex;
}

function aplicarCorDestaqueFerramenta(hex) {
    const claro = document.body.classList.contains("tema-claro");
    const hover = claro ? escurecerCor(hex, 0.1) : clarearCor(hex, 0.12);
    const texto = luminanciaCor(hex) > 0.55 ? "#0a0a0b" : "#faf9f7";

    document.documentElement.style.setProperty("--cor-destaque", hex);
    document.documentElement.style.setProperty("--cor-destaque-hover", hover);
    document.documentElement.style.setProperty("--cor-borda-foco", hex);
    document.documentElement.style.setProperty("--cor-destaque-texto", texto);
}

function restaurarCorDestaquePadrao() {
    localStorage.removeItem("corDestaque");
    aplicarCorDestaqueFerramenta(COR_DESTAQUE_PADRAO);
    sincronizarSeletorCor(COR_DESTAQUE_PADRAO);
}

function carregarCorDestaqueSalva() {
    const hex = obterCorDestaqueAtiva();
    aplicarCorDestaqueFerramenta(hex);
    sincronizarSeletorCor(hex);
}

function iniciarSeletorCorDestaque() {
    const input = document.getElementById("cor-destaque");
    const btnReset = document.getElementById("cor-destaque-reset");

    input?.addEventListener("input", (e) => {
        const hex = e.target.value;
        aplicarCorDestaqueFerramenta(hex);
        localStorage.setItem("corDestaque", hex);
        sincronizarSeletorCor(hex);
    });

    btnReset?.addEventListener("click", restaurarCorDestaquePadrao);

    carregarCorDestaqueSalva();
}

function atualizarRotuloBotaoTema(botaoTema, claro) {
    if (!botaoTema) return;
    const usarIcone = botaoTema.id === "tema"
        || botaoTema.classList.contains("hub-icon-btn")
        || botaoTema.classList.contains("btn-tema-icone");
    if (usarIcone) {
        botaoTema.textContent = claro ? "☾" : "◐";
        botaoTema.title = claro ? "Tema escuro" : "Tema claro";
        botaoTema.setAttribute("aria-label", claro ? "Mudar para tema escuro" : "Mudar para tema claro");
        return;
    }
    botaoTema.textContent = claro ? "Escuro" : "Claro";
}

function aplicarTemaFerramenta(claro, botaoTema) {
    document.body.classList.toggle("tema-claro", claro);
    atualizarRotuloBotaoTema(botaoTema, claro);
    localStorage.setItem("tema", claro ? "claro" : "escuro");
    carregarCorDestaqueSalva();
    window.dispatchEvent(new CustomEvent("tema:changed", { detail: { claro: !!claro } }));
}

function iniciarTemaFerramenta(botaoTema) {
    botaoTema?.addEventListener("click", () => {
        aplicarTemaFerramenta(!document.body.classList.contains("tema-claro"), botaoTema);
    });

    aplicarTemaFerramenta(localStorage.getItem("tema") === "claro", botaoTema);
    iniciarSeletorCorDestaque();
}

function mostrarPassoFerramenta(stepId, classePasso = "tratamento-step") {
    document.querySelectorAll(`.${classePasso}`).forEach((s) => s.classList.remove("ativo"));
    document.getElementById(stepId).classList.add("ativo");
}

function iniciarDropzone(dropzone, fileInput, aoSelecionar) {
    dropzone.addEventListener("click", (e) => {
        if (e.target.closest(".file-chip-limpar")) return;
        fileInput.click();
    });

    dropzone.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInput.click();
        }
    });

    fileInput.addEventListener("change", () => {
        const f = fileInput.files?.[0];
        if (f) aoSelecionar(f);
    });

    ["dragenter", "dragover"].forEach((ev) => {
        dropzone.addEventListener(ev, (e) => {
            e.preventDefault();
            dropzone.classList.add("sobre-arrasto");
        });
    });

    ["dragleave", "drop"].forEach((ev) => {
        dropzone.addEventListener(ev, (e) => {
            e.preventDefault();
            dropzone.classList.remove("sobre-arrasto");
        });
    });

    dropzone.addEventListener("drop", (e) => {
        const f = e.dataTransfer?.files?.[0];
        if (f) aoSelecionar(f);
    });
}
