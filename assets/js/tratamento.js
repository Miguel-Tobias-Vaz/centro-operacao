const botaoTema = document.getElementById("tema");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileChip = document.getElementById("file-chip");
const fileNameEl = document.getElementById("file-name");
const btnProcessar = document.getElementById("btn-processar");
const btnClear = document.getElementById("btn-clear");

let selectedFile = null;
let downloadUrl = null;

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

    if (!ehArquivoTratamento(file.name)) {
        alert(`Envie um arquivo compactado (${rotuloArquivosEntrada()}).`);
        return;
    }

    selectedFile = file;
    fileNameEl.textContent = file.name;
    fileChip.hidden = false;
    dropzone.classList.add("com-arquivo");
    btnProcessar.disabled = false;
}

iniciarDropzone(dropzone, fileInput, setFile);

btnClear.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.value = "";
    setFile(null);
});

async function processar() {
    if (!selectedFile) return;

    btnProcessar.disabled = true;
    const logEl = document.getElementById("log-mini");
    logEl.textContent = "Lendo arquivo…\n";
    mostrarPassoFerramenta("step-processing");

    try {
        const resultado = await processarArquivoTratamento(selectedFile);
        logEl.textContent += `${resultado.totalDocumentos} documento(s) encontrado(s).\n`;
        logEl.textContent += `${resultado.totalRenomeados} nome(s) ajustado(s).\n`;
        mostrarSucesso(resultado);
    } catch (e) {
        mostrarErro(e.message || "Falha ao processar o arquivo.");
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
            "Nenhum documento encontrado no arquivo enviado.";
        document.getElementById("rename-wrap").hidden = true;
    } else {
        const extra = totalRenomeados > 0
            ? `${totalRenomeados} nome(s) ajustado(s). `
            : "Nomes já estavam padronizados. ";
        document.getElementById("result-sub").textContent =
            extra + `${totalDocumentos} documento(s) no arquivo para download.`;
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
    const extEntrada = extensaoArquivoEntrada(selectedFile.name) || ".zip";
    const base = selectedFile.name.slice(0, selectedFile.name.length - extEntrada.length);
    dl.download = `${base}_tratado${extEntrada}`;
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
    setFile(null);
    document.getElementById("btn-download").hidden = true;
    document.getElementById("stat-card").hidden = true;
    document.getElementById("rename-wrap").hidden = true;
    mostrarPassoFerramenta("step-upload");
}

btnProcessar.addEventListener("click", processar);
document.getElementById("btn-novo").addEventListener("click", resetar);
document.getElementById("btn-error-back").addEventListener("click", resetar);

iniciarTemaFerramenta(botaoTema);
