const botaoTema = document.getElementById("tema");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileChip = document.getElementById("file-chip");
const fileNameEl = document.getElementById("file-name");
const btnProcessar = document.getElementById("btn-processar");
const btnClear = document.getElementById("btn-clear");

let selectedFile = null;
let downloadUrl = null;

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

function aplicarCorDestaque(hex) {
    const claro = document.body.classList.contains("tema-claro");
    const hover = claro ? escurecerCor(hex, 0.1) : clarearCor(hex, 0.12);
    const texto = luminanciaCor(hex) > 0.55 ? "#0a0a0b" : "#faf9f7";

    document.documentElement.style.setProperty("--cor-destaque", hex);
    document.documentElement.style.setProperty("--cor-destaque-hover", hover);
    document.documentElement.style.setProperty("--cor-borda-foco", hex);
    document.documentElement.style.setProperty("--cor-destaque-texto", texto);
}

function aplicarTema(claro) {
    document.body.classList.toggle("tema-claro", claro);
    if (botaoTema) botaoTema.textContent = claro ? "Escuro" : "Claro";
    localStorage.setItem("tema", claro ? "claro" : "escuro");

    const corSalva = localStorage.getItem("corDestaque");
    if (corSalva) aplicarCorDestaque(corSalva);
}

function showStep(stepId) {
    document.querySelectorAll(".tratamento-step").forEach((s) => s.classList.remove("ativo"));
    document.getElementById(stepId).classList.add("ativo");
}

function revogarDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }
}

function setFile(file) {
    if (!file) {
        selectedFile = null;
        fileChip.hidden = true;
        dropzone.classList.remove("com-arquivo");
        btnProcessar.disabled = true;
        return;
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
        alert("Envie um arquivo .zip com os documentos.");
        return;
    }

    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileChip.hidden = false;
    dropzone.classList.add("com-arquivo");
    btnProcessar.disabled = false;
}

dropzone.addEventListener("click", (e) => {
    if (e.target === btnClear) return;
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
    if (f) setFile(f);
});

btnClear.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.value = "";
    setFile(null);
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
    if (f) setFile(f);
});

async function processar() {
    if (!selectedFile) return;

    btnProcessar.disabled = true;
    const logEl = document.getElementById("log-mini");
    logEl.textContent = "Lendo ZIP…\n";
    showStep("step-processing");

    try {
        const resultado = await processarZipTratamento(selectedFile);
        logEl.textContent += `${resultado.totalDocumentos} documento(s) encontrado(s).\n`;
        logEl.textContent += `${resultado.totalRenomeados} nome(s) ajustado(s).\n`;
        mostrarSucesso(resultado);
    } catch (e) {
        mostrarErro(e.message || "Falha ao processar o ZIP.");
    } finally {
        btnProcessar.disabled = false;
    }
}

function mostrarSucesso(resultado) {
    const { documentos, totalRenomeados, totalDocumentos, blob } = resultado;

    document.getElementById("stat-renamed").textContent = totalDocumentos;
    document.getElementById("stat-card").hidden = false;

    const lista = document.getElementById("rename-list");
    lista.replaceChildren();

    if (documentos.length === 0) {
        document.getElementById("result-sub").textContent =
            "Nenhum documento encontrado no ZIP enviado.";
        document.getElementById("rename-wrap").hidden = true;
    } else {
        const extra = totalRenomeados > 0
            ? `${totalRenomeados} nome(s) ajustado(s). `
            : "Nomes já estavam padronizados. ";
        document.getElementById("result-sub").textContent =
            extra + `${totalDocumentos} documento(s) no ZIP para download.`;
        document.getElementById("rename-wrap").hidden = false;

        const limite = 80;
        documentos.slice(0, limite).forEach((nome) => {
            const li = document.createElement("li");
            li.textContent = nome;
            lista.appendChild(li);
        });

        if (documentos.length > limite) {
            const li = document.createElement("li");
            li.className = "doc-list-extra";
            li.textContent = `… e mais ${documentos.length - limite} arquivo(s).`;
            lista.appendChild(li);
        }
    }

    revogarDownload();
    downloadUrl = URL.createObjectURL(blob);
    const dl = document.getElementById("btn-download");
    dl.href = downloadUrl;
    dl.download = selectedFile.name.replace(/\.zip$/i, "") + "_tratado.zip";
    dl.hidden = false;

    showStep("step-result");
}

function mostrarErro(msg) {
    document.getElementById("error-msg").textContent = msg;
    showStep("step-error");
}

function resetar() {
    revogarDownload();
    fileInput.value = "";
    setFile(null);
    document.getElementById("btn-download").hidden = true;
    document.getElementById("stat-card").hidden = true;
    document.getElementById("rename-wrap").hidden = true;
    showStep("step-upload");
}

btnProcessar.addEventListener("click", processar);
document.getElementById("btn-novo").addEventListener("click", resetar);
document.getElementById("btn-error-back").addEventListener("click", resetar);

botaoTema?.addEventListener("click", () => {
    aplicarTema(!document.body.classList.contains("tema-claro"));
});

aplicarTema(localStorage.getItem("tema") === "claro");
const corSalva = localStorage.getItem("corDestaque");
if (corSalva) aplicarCorDestaque(corSalva);
