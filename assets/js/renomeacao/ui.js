/**
 * UI da página de renomeação (tratamento.html).
 * Depende de: JSZip, renomeacao/dados.js, renomeacao/motor.js
 */

const EXT_ZIP = new Set([".zip", ".ram"]);

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const folderInput = document.getElementById("folder-input");
const btnSelecionarPasta = document.getElementById("btn-selecionar-pasta");
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
const avisoDicionarioEl = document.getElementById("aviso-dicionario");

/** @type {{ nome: string, rel: string, blob: Blob, origem: string, excluido?: boolean }[]} */
let fila = [];
let downloadUrl = null;
/** @type {string[]} */
let downloadUrlsIndividuais = [];

const ICONE_DOWNLOAD =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

const ICONE_LIXEIRA =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

const ICONE_RESTAURAR =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.59"/></svg>';

function formatBytes(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
    return (n / (1024 * 1024)).toFixed(1) + " MB";
}

function mostrarErro(msg) {
    erroEl.hidden = !msg;
    erroEl.textContent = msg || "";
}

function mostrarAvisoDicionario(mostrar) {
    if (!avisoDicionarioEl) return;
    if (mostrar) {
        avisoDicionarioEl.hidden = false;
        avisoDicionarioEl.textContent =
            "Acentos limitados ao léxico local (dicionário indisponível). Nomes ainda são normalizados.";
    } else {
        avisoDicionarioEl.hidden = true;
        avisoDicionarioEl.textContent = "";
    }
}

function revogarDownloadsIndividuais() {
    for (const url of downloadUrlsIndividuais) {
        URL.revokeObjectURL(url);
    }
    downloadUrlsIndividuais = [];
}

function revogarDownload() {
    if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
        downloadUrl = null;
    }
    revogarDownloadsIndividuais();
    if (btnDownload) {
        btnDownload.hidden = true;
        btnDownload.removeAttribute("href");
    }
}

function basenameCaminho(caminho) {
    const norm = String(caminho || "").replace(/\\/g, "/");
    return norm.split("/").pop() || norm;
}

function itensAtivos() {
    return fila.filter((item) => !item.excluido);
}

function alternarExclusao(indice) {
    const item = fila[indice];
    if (!item) return;
    item.excluido = !item.excluido;
    limparResultado();
    renderLista();
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
    const ativos = itensAtivos().length;
    const excluidos = fila.length - ativos;
    btnRenomear.disabled = ativos === 0;
    metaLista.textContent =
        ativos +
        (ativos === 1 ? " arquivo" : " arquivos") +
        (excluidos ? " · " + excluidos + " excluído" + (excluidos === 1 ? "" : "s") : "");

    fila.forEach((item, indice) => {
        const li = document.createElement("li");
        if (item.excluido) li.classList.add("excluido");

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

        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "renomear-lista-acao" + (item.excluido ? " restaurar" : "");
        btn.title = item.excluido ? "Restaurar arquivo" : "Excluir do lote";
        btn.setAttribute("aria-label", btn.title);
        btn.innerHTML = item.excluido ? ICONE_RESTAURAR : ICONE_LIXEIRA;
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            alternarExclusao(indice);
        });

        li.append(nome, tag, btn);
        listaEl.appendChild(li);
    });
}

function limparResultado() {
    resultado.hidden = true;
    tabelaCorpo.replaceChildren();
    revogarDownload();
    esconderProgresso();
    mostrarErro("");
    mostrarAvisoDicionario(false);
}

function limparTudo() {
    fila = [];
    fileInput.value = "";
    if (folderInput) folderInput.value = "";
    renderLista();
    limparResultado();
}

/**
 * Lê todos os filhos de um DirectoryEntry (readEntries devolve lotes).
 * @param {FileSystemDirectoryEntry} dirEntry
 * @returns {Promise<FileSystemEntry[]>}
 */
function lerFilhosDiretorio(dirEntry) {
    const reader = dirEntry.createReader();
    return new Promise((resolve, reject) => {
        const todos = [];
        const lerLote = () => {
            reader.readEntries(
                (lote) => {
                    if (!lote.length) {
                        resolve(todos);
                        return;
                    }
                    todos.push(...lote);
                    lerLote();
                },
                reject
            );
        };
        lerLote();
    });
}

/**
 * Percorre arquivo/pasta do DataTransfer e devolve { file, rel }.
 * @param {FileSystemEntry} entry
 * @param {string} prefixo
 * @returns {Promise<{ file: File, rel: string }[]>}
 */
async function coletarDeEntry(entry, prefixo = "") {
    if (!entry) return [];

    if (entry.isFile) {
        const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
        const rel = (prefixo + file.name).replace(/\\/g, "/");
        return [{ file, rel }];
    }

    if (entry.isDirectory) {
        const filhos = await lerFilhosDiretorio(entry);
        const base = prefixo + entry.name + "/";
        const saida = [];
        for (const filho of filhos) {
            saida.push(...(await coletarDeEntry(filho, base)));
        }
        return saida;
    }

    return [];
}

/**
 * Coleta arquivos de um drop (pastas inclusive). Fallback para FileList.
 * Importante: webkitGetAsEntry() e a cópia de .files devem ser síncronos
 * antes de qualquer await — no Chrome/Edge a lista do DataTransfer
 * invalida após o handler do drop fazer yield (só o 1º arquivo entrava).
 * @param {DataTransfer} dataTransfer
 * @returns {Promise<{ file: File, rel: string }[]>}
 */
async function coletarDoDataTransfer(dataTransfer) {
    const filesFallback =
        dataTransfer && dataTransfer.files ? [...dataTransfer.files] : [];

    const items = dataTransfer && dataTransfer.items ? [...dataTransfer.items] : [];
    const entries = [];
    for (const item of items) {
        if (item.kind !== "file" || typeof item.webkitGetAsEntry !== "function") continue;
        const entry = item.webkitGetAsEntry();
        if (entry) entries.push(entry);
    }

    if (entries.length) {
        const coletados = [];
        for (const entry of entries) {
            coletados.push(...(await coletarDeEntry(entry)));
        }
        if (coletados.length) return coletados;
    }

    return filesFallback.map((file) => ({
        file,
        rel: (file.webkitRelativePath || file.name).replace(/\\/g, "/")
    }));
}

async function lerArquivoComoItem(file, origem = "", relForcado = "") {
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
                origem: origem || file.name + (pasta ? " → " + pasta : ""),
                excluido: false
            });
        }
        return itens;
    }

    if (!EXTENSOES_PERMITIDAS.has(ext)) return [];
    if (ehArquivoLixoNome(file.name)) return [];

    const rel = String(relForcado || file.webkitRelativePath || file.name).replace(/\\/g, "/");
    if (ignorarCaminho(rel)) return [];

    const pasta = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    return [
        {
            nome: file.name,
            rel,
            blob: file,
            origem: origem || (pasta ? pasta : ""),
            excluido: false
        }
    ];
}

/**
 * @param {ArrayLike<File>|{ file: File, rel?: string }[]} entrada
 */
async function adicionarArquivos(entrada) {
    mostrarErro("");
    limparResultado();

    const lista = [...entrada].map((item) => {
        if (item && item.file instanceof Blob) {
            return { file: item.file, rel: item.rel || "" };
        }
        return { file: item, rel: "" };
    });
    if (!lista.length) return;

    setProgresso(0, lista.length, "Lendo arquivos…");
    btnRenomear.disabled = true;

    try {
        let lidos = 0;
        for (const { file, rel } of lista) {
            const itens = await lerArquivoComoItem(file, "", rel);
            if (itens.length) fila.push(...itens);
            lidos += 1;
            setProgresso(lidos, lista.length, "Lendo: " + (rel || file.name));
        }
        if (!fila.length) {
            mostrarErro(
                "Nenhum documento válido encontrado. Use PDF, Office, imagens, uma pasta ou um ZIP com esses arquivos."
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
    const ativos = itensAtivos();
    if (!ativos.length) return;
    mostrarErro("");
    limparResultado();
    btnRenomear.disabled = true;

    try {
        setProgresso(0, 1, "Carregando dicionário de acentos…");
        await garantirDicionarioAcentos();
        mostrarAvisoDicionario(!dicionarioAcentosDisponivel());

        const tokens = [];
        for (const item of ativos) {
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

        for (let i = 0; i < ativos.length; i += 1) {
            const item = ativos[i];
            const original = item.rel || item.nome;
            setProgresso(i + 1, ativos.length, "Renomeando: " + original);

            const novoNome = normalizarNomeArquivo(item.nome);
            const pasta = original.includes("/")
                ? original.slice(0, original.lastIndexOf("/") + 1)
                : "";
            const caminho = nomeUnico(pasta + novoNome, usados);
            const bytes = await item.blob.arrayBuffer();
            saida.file(caminho, bytes);

            const mudou = caminho !== original;
            if (mudou) alterados += 1;
            linhas.push({
                original,
                novo: caminho,
                mudou,
                blob: item.blob
            });

            await new Promise((r) => setTimeout(r, 0));
        }

        setProgresso(ativos.length, ativos.length, "Gerando ZIP…");
        const blob = await saida.generateAsync({
            type: "blob",
            compression: "DEFLATE",
            compressionOptions: { level: 6 }
        });

        revogarDownload();
        downloadUrl = URL.createObjectURL(blob);
        btnDownload.href = downloadUrl;
        btnDownload.download = "arquivos_renomeados.zip";
        btnDownload.hidden = false;

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

            const tdDl = document.createElement("td");
            tdDl.className = "acao-dl";
            const urlItem = URL.createObjectURL(row.blob);
            downloadUrlsIndividuais.push(urlItem);
            const link = document.createElement("a");
            link.className = "renomear-dl-item";
            link.href = urlItem;
            link.download = basenameCaminho(row.novo);
            link.title = "Baixar " + basenameCaminho(row.novo);
            link.setAttribute("aria-label", "Baixar " + basenameCaminho(row.novo));
            link.innerHTML = ICONE_DOWNLOAD;
            tdDl.appendChild(link);

            tr.append(td1, tdSeta, td2, tdDl);
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
        btnRenomear.disabled = !itensAtivos().length;
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
folderInput?.addEventListener("change", () => {
    if (folderInput.files && folderInput.files.length) {
        const lista = [...folderInput.files].map((file) => ({
            file,
            rel: (file.webkitRelativePath || file.name).replace(/\\/g, "/")
        }));
        adicionarArquivos(lista);
    }
});
btnSelecionarPasta?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    folderInput?.click();
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
dropzone.addEventListener("drop", async (e) => {
    try {
        const coletados = await coletarDoDataTransfer(e.dataTransfer);
        if (coletados.length) await adicionarArquivos(coletados);
    } catch (err) {
        mostrarErro(err.message || "Falha ao ler a pasta arrastada.");
    }
});

btnRenomear.addEventListener("click", renomear);
btnLimpar.addEventListener("click", limparTudo);

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
        if (!silencioso && !dicionarioAcentosDisponivel()) {
            mostrarErroTexto(
                "Acentos limitados ao léxico local (dicionário indisponível)."
            );
        }
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
