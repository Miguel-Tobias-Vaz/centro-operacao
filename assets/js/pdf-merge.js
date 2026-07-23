let mergeArquivos = [];
let mergeDownloadUrl = null;
let mergeArrastarIniciado = false;
let mergeArrastando = null;

const mergeDropzone = () => document.getElementById("merge-dropzone");
const mergeFileInput = () => document.getElementById("merge-file-input");
const mergeLista = () => document.getElementById("merge-lista-arquivos");
const mergeContador = () => document.getElementById("merge-contador");
const mergeNomeSaida = () => document.getElementById("merge-nome-saida");
const btnMergeProcessar = () => document.getElementById("btn-merge-processar");

function revogarMergeDownload() {
    if (mergeDownloadUrl) {
        URL.revokeObjectURL(mergeDownloadUrl);
        mergeDownloadUrl = null;
    }
}

function limparEstadoMerge() {
    mergeArquivos = [];
    revogarMergeDownload();
    if (mergeLista()) mergeLista().replaceChildren();
    atualizarContadorMerge();
    const input = mergeFileInput();
    if (input) input.value = "";
}

function atualizarContadorMerge() {
    const totalPaginas = mergeArquivos.reduce((s, a) => s + a.totalPaginas, 0);
    const el = mergeContador();
    if (el) {
        el.textContent = mergeArquivos.length
            ? `${mergeArquivos.length} arquivo(s) · ${totalPaginas} página(s) no total`
            : "Nenhum arquivo";
    }
    if (btnMergeProcessar()) {
        btnMergeProcessar().disabled = mergeArquivos.length < 1;
    }
}

async function adicionarArquivosMerge(fileList) {
    const novos = [...fileList].filter(
        (f) => f.name.toLowerCase().endsWith(".pdf") || f.type === "application/pdf"
    );

    if (!novos.length) {
        alert("Selecione arquivos PDF.");
        return;
    }

    for (const file of novos) {
        try {
            const info = await obterInfoPdf(file);
            mergeArquivos.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                file,
                nome: file.name,
                bytes: info.bytes,
                totalPaginas: info.totalPaginas
            });
        } catch (e) {
            alert(`${file.name}: ${e.message}`);
        }
    }

    renderizarListaMerge();
    mostrarPassoFerramenta("step-merge-editor", "merge-step");
}

function removerArquivoMerge(id) {
    mergeArquivos = mergeArquivos.filter((a) => a.id !== id);
    renderizarListaMerge();
}

function reordenarMerge(deId, paraId) {
    const de = mergeArquivos.findIndex((a) => a.id === deId);
    const para = mergeArquivos.findIndex((a) => a.id === paraId);
    if (de < 0 || para < 0 || de === para) return;

    const [item] = mergeArquivos.splice(de, 1);
    mergeArquivos.splice(para, 0, item);
    renderizarListaMerge();
}

function renderizarListaMerge() {
    const lista = mergeLista();
    if (!lista) return;

    if (mergeArquivos.length === 0) {
        lista.replaceChildren();
        atualizarContadorMerge();
        mostrarPassoFerramenta("step-merge-upload", "merge-step");
        return;
    }

    lista.replaceChildren();
    atualizarContadorMerge();

    mergeArquivos.forEach((arq, idx) => {
        const item = document.createElement("article");
        item.className = "merge-arquivo-item";
        item.dataset.id = arq.id;

        item.innerHTML = `
            <div class="merge-arquivo-arrastar" role="button" tabindex="0" aria-label="Arrastar para reordenar" title="Arrastar">
                <span class="icone-arrastar" aria-hidden="true"></span>
            </div>
            <div class="merge-arquivo-info">
                <span class="merge-arquivo-nome">${escaparHtmlMerge(arq.nome)}</span>
                <span class="merge-arquivo-meta">${arq.totalPaginas} página(s) · posição ${idx + 1}</span>
            </div>
            <button type="button" class="btn btn-outline btn-sm merge-btn-remover" title="Remover">🗑</button>
        `;

        item.querySelector(".merge-btn-remover").addEventListener("click", () => {
            if (confirm(`Remover "${arq.nome}" da lista?`)) {
                removerArquivoMerge(arq.id);
            }
        });

        lista.appendChild(item);
    });
}

function escaparHtmlMerge(texto) {
    const d = document.createElement("div");
    d.textContent = texto;
    return d.innerHTML;
}

async function mesclarPdfsLista(arquivos, onProgress) {
    const merged = await PDFLib.PDFDocument.create();
    let paginasAcumuladas = 0;
    const totalPaginas = arquivos.reduce((s, a) => s + a.totalPaginas, 0);

    for (let i = 0; i < arquivos.length; i += 1) {
        const pdf = await PDFLib.PDFDocument.load(arquivos[i].bytes, { ignoreEncryption: true });
        const indices = pdf.getPageIndices();
        const copiadas = await merged.copyPages(pdf, indices);
        copiadas.forEach((p) => merged.addPage(p));

        paginasAcumuladas += indices.length;
        if (onProgress) onProgress(paginasAcumuladas, totalPaginas, arquivos[i].nome);
    }

    const bytes = await merged.save();
    return { bytes, totalPaginas };
}

async function processarMerge() {
    if (mergeArquivos.length === 0) return;

    const logEl = document.getElementById("merge-log");
    const btn = btnMergeProcessar();
    if (btn) btn.disabled = true;

    mostrarPassoFerramenta("step-merge-processing", "merge-step");
    if (logEl) logEl.textContent = "Mesclando PDFs…\n";

    try {
        const { bytes, totalPaginas } = await mesclarPdfsLista(
            mergeArquivos,
            (atual, total, nome) => {
                if (logEl) logEl.textContent = `Incluindo ${nome}… (${atual}/${total} páginas)\n`;
            }
        );

        revogarMergeDownload();
        const blob = new Blob([bytes], { type: "application/pdf" });
        mergeDownloadUrl = URL.createObjectURL(blob);

        const nomeBase = sanitizarNomeDocumento(mergeNomeSaida()?.value || "documento_mesclado");
        const dl = document.getElementById("btn-merge-download");
        if (dl) {
            dl.href = mergeDownloadUrl;
            dl.download = `${nomeBase}.pdf`;
            dl.hidden = false;
        }

        const sub = document.getElementById("merge-result-sub");
        if (sub) {
            sub.textContent =
                `${mergeArquivos.length} PDF(s) unidos em um arquivo com ${totalPaginas} página(s).`;
        }

        const stat = document.getElementById("merge-stat-paginas");
        if (stat) stat.textContent = String(totalPaginas);

        const listaResultado = document.getElementById("merge-result-lista");
        if (listaResultado) {
            listaResultado.replaceChildren();
            mergeArquivos.forEach((a) => {
                const li = document.createElement("li");
                li.textContent = a.nome;
                listaResultado.appendChild(li);
            });
        }

        mostrarPassoFerramenta("step-merge-result", "merge-step");
    } catch (e) {
        document.getElementById("merge-error-msg").textContent = e.message || "Falha ao mesclar.";
        mostrarPassoFerramenta("step-merge-error", "merge-step");
    } finally {
        if (btn) btn.disabled = mergeArquivos.length === 0;
    }
}

function iniciarArrastarMerge() {
    if (mergeArrastarIniciado) return;
    mergeArrastarIniciado = true;

    const lista = mergeLista();
    if (!lista) return;

    lista.addEventListener("pointerdown", (e) => {
        const handle = e.target.closest(".merge-arquivo-arrastar");
        if (!handle) return;

        const item = handle.closest(".merge-arquivo-item");
        if (!item) return;

        e.preventDefault();
        handle.setPointerCapture(e.pointerId);
        mergeArrastando = { id: item.dataset.id, item, pointerId: e.pointerId };
        item.classList.add("arrastando");
    });

    lista.addEventListener("pointermove", (e) => {
        if (!mergeArrastando || e.pointerId !== mergeArrastando.pointerId) return;
        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".merge-arquivo-item");
        lista.querySelectorAll(".merge-arquivo-item").forEach((el) => {
            el.classList.toggle("sobre-arrasto", alvo === el && el !== mergeArrastando.item);
        });
    });

    const finalizar = (e) => {
        if (!mergeArrastando || e.pointerId !== mergeArrastando.pointerId) return;
        const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest(".merge-arquivo-item");
        const { item, id } = mergeArrastando;

        item.classList.remove("arrastando");
        lista.querySelectorAll(".merge-arquivo-item").forEach((el) => {
            el.classList.remove("sobre-arrasto");
        });

        if (alvo && alvo !== item) reordenarMerge(id, alvo.dataset.id);
        mergeArrastando = null;
    };

    lista.addEventListener("pointerup", finalizar);
    lista.addEventListener("pointercancel", finalizar);
}

function iniciarDropzoneMerge() {
    const dropzone = mergeDropzone();
    const input = mergeFileInput();
    if (!dropzone || !input) return;

    dropzone.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
        if (input.files?.length) adicionarArquivosMerge(input.files);
        input.value = "";
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
        if (e.dataTransfer?.files?.length) {
            adicionarArquivosMerge(e.dataTransfer.files);
        }
    });
}

function iniciarModoMesclar() {
    iniciarDropzoneMerge();
    iniciarArrastarMerge();

    document.getElementById("btn-merge-processar")?.addEventListener("click", processarMerge);
    document.getElementById("btn-merge-novo")?.addEventListener("click", () => {
        limparEstadoMerge();
        mostrarPassoFerramenta("step-merge-upload", "merge-step");
    });
    document.getElementById("btn-merge-trocar")?.addEventListener("click", () => {
        limparEstadoMerge();
        mostrarPassoFerramenta("step-merge-upload", "merge-step");
    });
    document.getElementById("btn-merge-error-back")?.addEventListener("click", () => {
        mostrarPassoFerramenta(
            mergeArquivos.length ? "step-merge-editor" : "step-merge-upload",
            "merge-step"
        );
    });
    document.getElementById("btn-merge-limpar")?.addEventListener("click", () => {
        if (!mergeArquivos.length || confirm("Limpar todos os arquivos da lista?")) {
            limparEstadoMerge();
            mostrarPassoFerramenta("step-merge-upload", "merge-step");
        }
    });
}

function alternarModoPdf(modo) {
    const separar = document.getElementById("painel-separar");
    const mesclar = document.getElementById("painel-mesclar");
    const word = document.getElementById("painel-word");
    const btnSep = document.getElementById("modo-separar");
    const btnMer = document.getElementById("modo-mesclar");
    const btnWord = document.getElementById("modo-word");

    separar?.classList.toggle("ativo", modo === "separar");
    mesclar?.classList.toggle("ativo", modo === "mesclar");
    word?.classList.toggle("ativo", modo === "word");
    btnSep?.classList.toggle("ativo", modo === "separar");
    btnMer?.classList.toggle("ativo", modo === "mesclar");
    btnWord?.classList.toggle("ativo", modo === "word");
}

function iniciarAlternanciaModos() {
    document.getElementById("modo-separar")?.addEventListener("click", () => {
        alternarModoPdf("separar");
    });
    document.getElementById("modo-mesclar")?.addEventListener("click", () => {
        alternarModoPdf("mesclar");
    });
    document.getElementById("modo-word")?.addEventListener("click", () => {
        alternarModoPdf("word");
    });
}
