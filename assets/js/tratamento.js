const botaoTema = document.getElementById("tema");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const fileChip = document.getElementById("file-chip");
const fileNameEl = document.getElementById("file-name");
const btnProcessar = document.getElementById("btn-processar");
const btnClear = document.getElementById("btn-clear");
const chkManterExtras = document.getElementById("manter-extras");

let selectedFile = null;
let downloadUrl = null;
let csvUrl = null;

if (fileInput && typeof acceptArquivosEntrada === "function") {
    fileInput.accept = acceptArquivosEntrada();
}

function revogarDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }
    if (csvUrl) {
        URL.revokeObjectURL(csvUrl);
        csvUrl = null;
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
        alert(`Envie um pacote ou documento (${rotuloArquivosEntrada()}).`);
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
        const manterExtras = chkManterExtras ? chkManterExtras.checked : true;
        const resultado = await processarArquivoTratamento(selectedFile, { manterExtras });

        if (resultado.modo === "arquivo") {
            logEl.textContent += "Documento avulso processado.\n";
        } else {
            logEl.textContent += `${resultado.totalDocumentos} documento(s) normalizado(s).\n`;
            if (resultado.totalPreservados) {
                logEl.textContent += `${resultado.totalPreservados} outro(s) arquivo(s) preservado(s).\n`;
            }
        }
        logEl.textContent += `${resultado.totalRenomeados} nome(s)/caminho(s) ajustado(s).\n`;
        mostrarSucesso(resultado);
    } catch (e) {
        console.error(e);
        mostrarErro(e.message || "Falha ao processar o arquivo.");
    } finally {
        btnProcessar.disabled = false;
    }
}

function baseNomeEntrada() {
    const nome = selectedFile?.name || "arquivo";
    const extCompactado = extensaoArquivoEntrada(nome);
    if (extCompactado) return nome.slice(0, nome.length - extCompactado.length);

    const ext = nome.lastIndexOf(".");
    return ext >= 0 ? nome.slice(0, ext) : nome;
}

function mostrarSucesso(resultado) {
    const {
        documentos,
        totalRenomeados,
        totalDocumentos,
        totalPreservados = 0,
        blob,
        csvBlob,
        modo,
        nomeDownload
    } = resultado;

    document.getElementById("stat-renamed").textContent = totalDocumentos;
    document.getElementById("stat-card").hidden = false;

    const lista = document.getElementById("rename-list");
    lista.replaceChildren();

    const btnCsv = document.getElementById("btn-download-csv");

    if (documentos.length === 0 && !totalPreservados) {
        document.getElementById("result-sub").textContent =
            "Nenhum arquivo encontrado no envio.";
        document.getElementById("rename-wrap").hidden = true;
    } else {
        const partes = [];
        if (totalRenomeados > 0) {
            partes.push(`${totalRenomeados} nome(s)/caminho(s) ajustado(s)`);
        } else {
            partes.push("Nomes já estavam padronizados");
        }
        if (modo === "arquivo") {
            partes.push("1 documento para download");
        } else {
            partes.push(`${totalDocumentos} documento(s) normalizado(s)`);
            if (totalPreservados) {
                partes.push(`${totalPreservados} outro(s) preservado(s)`);
            }
        }
        document.getElementById("result-sub").textContent = `${partes.join(". ")}.`;
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

    if (modo === "arquivo") {
        dl.download = nomeDownload || "documento";
        dl.textContent = "Baixar documento";
    } else {
        dl.download = `${baseNomeEntrada()}_tratado.zip`;
        dl.textContent = "Baixar ZIP tratado";
    }
    dl.hidden = false;

    if (btnCsv && csvBlob) {
        csvUrl = URL.createObjectURL(csvBlob);
        btnCsv.href = csvUrl;
        btnCsv.download = `${baseNomeEntrada()}_relatorio.csv`;
        btnCsv.hidden = false;
    }

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
    const btnCsv = document.getElementById("btn-download-csv");
    if (btnCsv) btnCsv.hidden = true;
    document.getElementById("stat-card").hidden = true;
    document.getElementById("rename-wrap").hidden = true;
    mostrarPassoFerramenta("step-upload");
}

btnProcessar.addEventListener("click", processar);
document.getElementById("btn-novo").addEventListener("click", resetar);
document.getElementById("btn-error-back").addEventListener("click", resetar);

iniciarTemaFerramenta(botaoTema);
