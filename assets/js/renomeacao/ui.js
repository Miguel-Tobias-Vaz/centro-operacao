/**
 * UI da página de renomeação (tratamento.html).
 * Depende de: JSZip, renomeacao/dados.js, renomeacao/motor.js
 */

const EXT_ZIP = new Set([".zip", ".ram"]);

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const painelLista = document.getElementById("painel-lista");
const listaEl = document.getElementById("lista-arquivos");
const metaLista = document.getElementById("meta-lista");
const btnRenomear = document.getElementById("btn-renomear");
const btnLimpar = document.getElementById("btn-limpar");
const progresso = document.getElementById("progresso");
const barraFill = document.getElementById("barra-fill");
const progressoTexto = document.getElementById("progresso-texto");
const erroEl = document.getElementById("erro");
const resultado = document.getElementById("resultado");
const tabelaCorpo = document.getElementById("tabela-corpo");
const resumo = document.getElementById("resumo");
const metaResultado = document.getElementById("meta-resultado");
const btnDownload = document.getElementById("btn-download");
const btnNovo = document.getElementById("btn-novo");

/** @type {{ nome: string, rel: string, blob: Blob, origem: string }[]} */
let fila = [];
let downloadUrl = null;

function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function mostrarErro(msg) {
    erroEl.hidden = !msg;
    erroEl.textContent = msg || "";
}

function revogarDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }
}

function setProgresso(atual, total, texto) {
    progresso.hidden = false;
    const pct = total ? Math.round((atual / total) * 100) : 0;
    barraFill.style.width = pct + "%";
    progressoTexto.textContent = texto || atual + " / " + total;
}

function esconderProgresso() {
    progresso.hidden = true;
    barraFill.style.width = "0%";
}

function renderLista() {
    listaEl.replaceChildren();
    if (!fila.length) {
        painelLista.hidden = true;
        btnRenomear.disabled = true;
        return;
    }
    painelLista.hidden = false;
    btnRenomear.disabled = false;
    metaLista.textContent = fila.length + (fila.length === 1 ? " arquivo" : " arquivos");

    for (const item of fila) {
        const li = document.createElement("li");
        const nome = document.createElement("span");
        nome.className = "nome";
        const rotulo = item.rel || item.nome;
        nome.textContent = item.origem && item.rel && item.rel.includes("/")
            ? item.origem.split(" → ")[0] + " → " + item.rel
            : rotulo;
        nome.title = nome.textContent;
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = formatBytes(item.blob.size);
        li.append(nome, tag);
        listaEl.appendChild(li);
    }
}

function limparResultado() {
    resultado.hidden = true;
    tabelaCorpo.replaceChildren();
    revogarDownload();
    esconderProgresso();
    mostrarErro("");
}

function limparTudo() {
    fila = [];
    fileInput.value = "";
    renderLista();
    limparResultado();
}

async function lerArquivoComoItem(file, origem = "") {
    const ext = extensaoArquivo(file.name);
    if (EXT_ZIP.has(ext)) {
        const zip = await JSZip.loadAsync(file);
        const itens = [];
        const entradas = [];
        zip.forEach((relativePath, entry) => {
            if (entry.dir) return;
            const rel = relativePath.replace(/\\/g, "/");
            if (ignorarCaminho(rel)) return;
            const nome = rel.split("/").pop() || rel;
            const e = extensaoArquivo(nome);
            if (!EXTENSOES_PERMITIDAS.has(e)) return;
            entradas.push({ rel, entry, nome });
        });
        entradas.sort((a, b) => a.rel.localeCompare(b.rel, "pt-BR"));
        for (const { rel, entry, nome } of entradas) {
            const data = await entry.async("blob");
            const pasta = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
            itens.push({
                nome,
                rel,
                blob: data,
                origem: origem || file.name + (pasta ? " → " + pasta : "")
            });
        }
        return itens;
    }

    if (!EXTENSOES_PERMITIDAS.has(ext)) return [];
    if (ehArquivoLixoNome(file.name)) return [];
    return [{ nome: file.name, rel: file.name, blob: file, origem }];
}

async function adicionarArquivos(fileList) {
    mostrarErro("");
    limparResultado();
    const files = [...fileList];
    if (!files.length) return;

    setProgresso(0, files.length, "Lendo arquivos…");
    btnRenomear.disabled = true;

    try {
        let lidos = 0;
        for (const file of files) {
            const itens = await lerArquivoComoItem(file);
            if (itens.length) fila.push(...itens);
            lidos += 1;
            setProgresso(lidos, files.length, "Lendo: " + file.name);
        }
        if (!fila.length) {
            mostrarErro(
                "Nenhum documento válido encontrado. Use PDF, Office, imagens ou um ZIP com esses arquivos."
            );
        }
    } catch (e) {
        mostrarErro(e.message || "Falha ao ler os arquivos.");
    } finally {
        esconderProgresso();
        renderLista();
    }
}

async function renomear() {
    if (!fila.length) return;
    mostrarErro("");
    limparResultado();
    btnRenomear.disabled = true;

    try {
        setProgresso(0, 1, "Carregando dicionário de acentos…");
        await garantirDicionarioAcentos();

        const tokens = [];
        for (const item of fila) {
            const stem = item.nome.includes(".")
                ? item.nome.slice(0, item.nome.lastIndexOf("."))
                : item.nome;
            tokens.push(...tokensDoStem(stem));
        }
        preaquecerCorrecoes(tokens);

        const usados = new Set();
        const saida = new JSZip();
        const linhas = [];
        let alterados = 0;

        for (let i = 0; i < fila.length; i += 1) {
            const item = fila[i];
            const original = item.rel || item.nome;
            setProgresso(i + 1, fila.length, "Renomeando: " + original);

            const novoNome = normalizarNomeArquivo(item.nome);
            const pasta = original.includes("/")
                ? original.slice(0, original.lastIndexOf("/") + 1)
                : "";
            const caminho = nomeUnico(pasta + novoNome, usados);
            const bytes = await item.blob.arrayBuffer();
            saida.file(caminho, bytes);

            const mudou = caminho !== original;
            if (mudou) alterados += 1;
            linhas.push({ original, novo: caminho, mudou });

            await new Promise((r) => setTimeout(r, 0));
        }

        setProgresso(fila.length, fila.length, "Gerando ZIP…");
        const blob = await saida.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });

        revogarDownload();
        downloadUrl = URL.createObjectURL(blob);
        btnDownload.href = downloadUrl;
        btnDownload.download = "arquivos_renomeados.zip";

        tabelaCorpo.replaceChildren();
        for (const row of linhas) {
            const tr = document.createElement("tr");
            tr.className = row.mudou ? "alterado" : "igual";
            const td1 = document.createElement("td");
            td1.textContent = row.original;
            const tdSeta = document.createElement("td");
            tdSeta.className = "seta";
            tdSeta.textContent = "→";
            const td2 = document.createElement("td");
            td2.className = "novo";
            td2.textContent = row.novo;
            tr.append(td1, tdSeta, td2);
            tabelaCorpo.appendChild(tr);
        }

        resumo.textContent = alterados
            ? alterados + " nome(s) ajustado(s) de " + linhas.length + " arquivo(s)."
            : "Nomes já estavam padronizados (" + linhas.length + " arquivo(s)).";
        metaResultado.textContent = linhas.length + " arquivo(s)";
        resultado.hidden = false;
    } catch (e) {
        mostrarErro(e.message || "Falha ao renomear.");
    } finally {
        esconderProgresso();
        btnRenomear.disabled = !fila.length;
    }
}

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        fileInput.click();
    }
});
fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files.length) adicionarArquivos(fileInput.files);
});

["dragenter", "dragover"].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add("arrasto");
    });
});
["dragleave", "drop"].forEach((ev) => {
    dropzone.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove("arrasto");
    });
});
dropzone.addEventListener("drop", (e) => {
    const files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length) adicionarArquivos(files);
});

btnRenomear.addEventListener("click", renomear);
btnLimpar.addEventListener("click", limparTudo);
btnNovo.addEventListener("click", limparTudo);

/* —— Modo texto livre —— */

const painelArquivos = document.getElementById("painel-arquivos");
const painelTexto = document.getElementById("painel-texto");
const btnModoArquivos = document.getElementById("modo-arquivos");
const btnModoTexto = document.getElementById("modo-texto");
const textoEntrada = document.getElementById("texto-entrada");
const textoSaida = document.getElementById("texto-saida");
const textoResultadoWrap = document.getElementById("texto-resultado-wrap");
const btnNormalizarTexto = document.getElementById("btn-normalizar-texto");
const btnLimparTexto = document.getElementById("btn-limpar-texto");
const btnCopiarTexto = document.getElementById("btn-copiar-texto");
const erroTextoEl = document.getElementById("erro-texto");

function alternarModoRenomear(modo) {
    const ehArquivos = modo === "arquivos";
    painelArquivos?.classList.toggle("ativo", ehArquivos);
    painelTexto?.classList.toggle("ativo", !ehArquivos);
    btnModoArquivos?.classList.toggle("ativo", ehArquivos);
    btnModoTexto?.classList.toggle("ativo", !ehArquivos);
}

function mostrarErroTexto(msg) {
    if (!erroTextoEl) return;
    erroTextoEl.hidden = !msg;
    erroTextoEl.textContent = msg || "";
}

function limparModoTexto() {
    if (textoEntrada) textoEntrada.value = "";
    if (textoSaida) textoSaida.textContent = "";
    if (textoResultadoWrap) textoResultadoWrap.hidden = true;
    if (btnCopiarTexto) btnCopiarTexto.hidden = true;
    mostrarErroTexto("");
}

async function normalizarTextoUi(opcoes = {}) {
    const silencioso = !!opcoes.silencioso;
    const bruto = textoEntrada?.value || "";
    if (!bruto.trim()) {
        if (!silencioso) mostrarErroTexto("Cole um texto para normalizar.");
        if (textoResultadoWrap) textoResultadoWrap.hidden = true;
        if (btnCopiarTexto) btnCopiarTexto.hidden = true;
        return;
    }

    mostrarErroTexto("");
    if (btnNormalizarTexto && !silencioso) btnNormalizarTexto.disabled = true;

    try {
        await garantirDicionarioAcentos();
        preaquecerCorrecoes(tokensDoTexto(bruto));

        const corrigido = normalizarTextoLivre(bruto);
        if (textoSaida) textoSaida.textContent = corrigido;
        if (textoResultadoWrap) textoResultadoWrap.hidden = false;
        if (btnCopiarTexto) btnCopiarTexto.hidden = false;
    } catch (e) {
        mostrarErroTexto(e.message || "Falha ao normalizar o texto.");
    } finally {
        if (btnNormalizarTexto) btnNormalizarTexto.disabled = false;
    }
}

async function copiarTextoResultado() {
    const texto = textoSaida?.textContent || "";
    if (!texto) return;
    try {
        await navigator.clipboard.writeText(texto);
        const rotulo = btnCopiarTexto.textContent;
        btnCopiarTexto.textContent = "Copiado!";
        setTimeout(() => {
            if (btnCopiarTexto) btnCopiarTexto.textContent = rotulo || "Copiar resultado";
        }, 1500);
    } catch (_) {
        mostrarErroTexto("Não foi possível copiar. Selecione o texto e use Ctrl+C.");
    }
}

btnModoArquivos?.addEventListener("click", () => alternarModoRenomear("arquivos"));
btnModoTexto?.addEventListener("click", () => alternarModoRenomear("texto"));
btnNormalizarTexto?.addEventListener("click", () => normalizarTextoUi());
btnLimparTexto?.addEventListener("click", limparModoTexto);
btnCopiarTexto?.addEventListener("click", copiarTextoResultado);

textoEntrada?.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        normalizarTextoUi();
    }
});

textoEntrada?.addEventListener("paste", () => {
    setTimeout(() => {
        if (textoEntrada.value.trim()) normalizarTextoUi({ silencioso: true });
    }, 0);
});

let debounceTexto = null;
textoEntrada?.addEventListener("input", () => {
    clearTimeout(debounceTexto);
    debounceTexto = setTimeout(() => {
        if (textoEntrada.value.trim()) normalizarTextoUi({ silencioso: true });
    }, 450);
});

renderLista();
