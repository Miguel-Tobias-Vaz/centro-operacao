/**
 * Word → PDF: renderiza .docx no browser (iframe limpo) e exporta PDF A4.
 * Depende de: JSZip, docx-preview, html2canvas, jsPDF.
 */

const WORD_A4_LARGURA_PX = 794;
const WORD_A4_ALTURA_PX = 1123;
const WORD_A4_LARGURA_MM = 210;
const WORD_A4_ALTURA_MM = 297;
const WORD_MAX_MB = 50;

let wordArquivos = [];
let wordDownloadUrl = null;

const wordDropzone = () => document.getElementById("word-dropzone");
const wordFileInput = () => document.getElementById("word-file-input");
const wordLista = () => document.getElementById("word-lista-arquivos");
const wordContador = () => document.getElementById("word-contador");
const btnWordProcessar = () => document.getElementById("btn-word-processar");

function revogarWordDownload() {
    if (wordDownloadUrl) {
        URL.revokeObjectURL(wordDownloadUrl);
        wordDownloadUrl = null;
    }
}

function limparEstadoWord() {
    wordArquivos = [];
    revogarWordDownload();
    if (wordLista()) wordLista().replaceChildren();
    atualizarContadorWord();
    const input = wordFileInput();
    if (input) input.value = "";
}

function atualizarContadorWord() {
    const el = wordContador();
    if (el) {
        el.textContent = wordArquivos.length
            ? `${wordArquivos.length} arquivo(s) Word`
            : "Nenhum arquivo";
    }
    if (btnWordProcessar()) {
        btnWordProcessar().disabled = wordArquivos.length < 1;
    }
}

function escaparHtmlWord(texto) {
    const d = document.createElement("div");
    d.textContent = texto;
    return d.innerHTML;
}

function nomeBaseSemExt(nome) {
    return String(nome || "documento").replace(/\.[^.]+$/i, "");
}

function ehDocx(nome) {
    return String(nome || "").toLowerCase().endsWith(".docx");
}

function ehZipEntrada(nome) {
    const n = String(nome || "").toLowerCase();
    return n.endsWith(".zip") || n.endsWith(".ram");
}

function basenamePath(caminho) {
    const partes = String(caminho).replace(/\\/g, "/").split("/");
    return partes[partes.length - 1] || caminho;
}

async function extrairDocxDeZip(file) {
    const zip = await JSZip.loadAsync(file);
    const encontrados = [];

    const entradas = Object.keys(zip.files).sort((a, b) => a.localeCompare(b, "pt"));
    for (const caminho of entradas) {
        const entry = zip.files[caminho];
        if (entry.dir) continue;
        if (caminho.includes("__MACOSX") || caminho.startsWith(".")) continue;
        if (!ehDocx(caminho)) continue;

        const bytes = await entry.async("arraybuffer");
        encontrados.push({
            nome: basenamePath(caminho),
            bytes
        });
    }

    return encontrados;
}

async function coletarDocxDeFicheiros(fileList) {
    const resultado = [];

    for (const file of fileList) {
        const nome = file.name || "";
        const tamanhoMb = file.size / (1024 * 1024);
        if (tamanhoMb > WORD_MAX_MB) {
            throw new Error(`${nome}: excede ${WORD_MAX_MB} MB.`);
        }

        if (ehDocx(nome)) {
            resultado.push({
                nome,
                bytes: await file.arrayBuffer()
            });
            continue;
        }

        if (ehZipEntrada(nome)) {
            try {
                const dentro = await extrairDocxDeZip(file);
                if (!dentro.length) {
                    throw new Error("nenhum .docx encontrado dentro do arquivo.");
                }
                resultado.push(...dentro);
            } catch (e) {
                throw new Error(`${nome}: ${e.message || "não foi possível ler o ZIP/.ram."}`);
            }
            continue;
        }
    }

    return resultado;
}

async function adicionarArquivosWord(fileList) {
    const candidatos = [...fileList].filter((f) => {
        const n = (f.name || "").toLowerCase();
        return n.endsWith(".docx") || n.endsWith(".zip") || n.endsWith(".ram");
    });

    if (!candidatos.length) {
        alert("Selecione arquivos .docx ou .zip / .ram com Word dentro.");
        return;
    }

    try {
        const novos = await coletarDocxDeFicheiros(candidatos);
        if (!novos.length) {
            alert("Nenhum .docx encontrado.");
            return;
        }

        for (const item of novos) {
            wordArquivos.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
                nome: item.nome,
                bytes: item.bytes
            });
        }

        renderizarListaWord();
        mostrarPassoFerramenta("step-word-editor", "word-step");
    } catch (e) {
        alert(e.message || "Falha ao ler os arquivos.");
    }
}

function removerArquivoWord(id) {
    wordArquivos = wordArquivos.filter((a) => a.id !== id);
    renderizarListaWord();
}

function renderizarListaWord() {
    const lista = wordLista();
    if (!lista) return;

    if (wordArquivos.length === 0) {
        lista.replaceChildren();
        atualizarContadorWord();
        mostrarPassoFerramenta("step-word-upload", "word-step");
        return;
    }

    lista.replaceChildren();
    atualizarContadorWord();

    wordArquivos.forEach((arq, idx) => {
        const item = document.createElement("article");
        item.className = "merge-arquivo-item";
        item.dataset.id = arq.id;

        item.innerHTML = `
            <div class="merge-arquivo-info">
                <span class="merge-arquivo-nome">${escaparHtmlWord(arq.nome)}</span>
                <span class="merge-arquivo-meta">posição ${idx + 1} · .docx</span>
            </div>
            <button type="button" class="btn btn-outline btn-sm merge-btn-remover" title="Remover">🗑</button>
        `;

        item.querySelector(".merge-btn-remover").addEventListener("click", () => {
            if (confirm(`Remover "${arq.nome}" da lista?`)) {
                removerArquivoWord(arq.id);
            }
        });

        lista.appendChild(item);
    });
}

function criarIframeWord() {
    const iframe = document.createElement("iframe");
    iframe.className = "word-render-iframe";
    iframe.setAttribute("aria-hidden", "true");
    iframe.title = "Render Word (temporário)";
    document.body.appendChild(iframe);

    const idoc = iframe.contentDocument;
    idoc.open();
    idoc.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
    width: ${WORD_A4_LARGURA_PX}px;
  }
  .docx-wrapper {
    background: #fff !important;
    padding: 0 !important;
  }
  .docx-wrapper > section.docx {
    box-shadow: none !important;
    margin: 0 auto 16px !important;
  }
</style>
</head>
<body></body>
</html>`);
    idoc.close();

    return iframe;
}

function obterApiDocx() {
    if (window.docx?.renderAsync) return window.docx;
    if (window.docxPreview?.renderAsync) return window.docxPreview;
    return null;
}

function obterJsPdf() {
    return window.jspdf?.jsPDF || window.jsPDF || null;
}

async function aguardarPintura(ms = 400) {
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    await new Promise((r) => setTimeout(r, ms));
}

async function capturarElementoCanvas(el, docWin) {
    return html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: WORD_A4_LARGURA_PX,
        scrollX: 0,
        scrollY: 0,
        ...(docWin ? { windowWidth: WORD_A4_LARGURA_PX } : {})
    });
}

/** Fatia o canvas em folhas A4. Se `novaPaginaAntes`, começa numa página nova. */
function adicionarCanvasAoPdf(pdf, canvas, novaPaginaAntes) {
    const imgWidthMm = WORD_A4_LARGURA_MM;
    const pageHeightMm = WORD_A4_ALTURA_MM;
    const totalHeightMm = (canvas.height * imgWidthMm) / canvas.width;

    let offsetMm = 0;
    let fatia = 0;

    while (offsetMm < totalHeightMm - 0.5) {
        if (novaPaginaAntes || fatia > 0) {
            pdf.addPage();
            novaPaginaAntes = false;
        }

        const sourceY = (offsetMm * canvas.width) / imgWidthMm;
        const sourceH = Math.min(
            (pageHeightMm * canvas.width) / imgWidthMm,
            canvas.height - sourceY
        );

        if (sourceH <= 0) break;

        const pageCanvas = document.createElement("canvas");
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.max(1, Math.ceil(sourceH));
        const ctx = pageCanvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
            canvas,
            0,
            sourceY,
            canvas.width,
            sourceH,
            0,
            0,
            canvas.width,
            sourceH
        );

        const data = pageCanvas.toDataURL("image/jpeg", 0.92);
        const sliceHeightMm = (sourceH * imgWidthMm) / canvas.width;
        pdf.addImage(data, "JPEG", 0, 0, imgWidthMm, sliceHeightMm);

        offsetMm += pageHeightMm;
        fatia += 1;
    }
}

/**
 * Converte um .docx (ArrayBuffer) num PDF (Uint8Array).
 * Usa iframe isolado — nunca left:-10000px (corta texto).
 */
async function converterDocxParaPdfBytes(bytes) {
    const api = obterApiDocx();
    const JsPDF = obterJsPdf();
    if (!api) throw new Error("Biblioteca docx-preview não carregada.");
    if (!JsPDF) throw new Error("Biblioteca jsPDF não carregada.");
    if (typeof html2canvas !== "function") throw new Error("Biblioteca html2canvas não carregada.");

    const iframe = criarIframeWord();
    const idoc = iframe.contentDocument;
    const iwin = iframe.contentWindow;
    const container = idoc.body;

    try {
        await api.renderAsync(bytes, container, null, {
            className: "docx",
            inWrapper: true,
            ignoreWidth: false,
            ignoreHeight: false,
            breakPages: true,
            ignoreLastRenderedPageBreak: false,
            experimental: true,
            useBase64URL: true
        });

        // Expandir iframe para o conteúdo total (sem off-screen; evita corte de texto)
        const alturaConteudo = Math.max(
            WORD_A4_ALTURA_PX,
            container.scrollHeight,
            idoc.documentElement.scrollHeight,
            idoc.body.scrollHeight
        );
        iframe.style.height = `${alturaConteudo + 48}px`;

        await aguardarPintura(500);

        const secoes = container.querySelectorAll(".docx-wrapper > section.docx");
        const pdf = new JsPDF({
            orientation: "portrait",
            unit: "mm",
            format: "a4",
            compress: true
        });

        let jaTemConteudo = false;

        if (secoes.length > 0) {
            for (const secao of secoes) {
                secao.style.boxShadow = "none";
                secao.style.margin = "0";
                const canvas = await capturarElementoCanvas(secao, iwin);
                adicionarCanvasAoPdf(pdf, canvas, jaTemConteudo);
                jaTemConteudo = true;
            }
        } else {
            const alvo = container.querySelector(".docx-wrapper") || container;
            const canvas = await capturarElementoCanvas(alvo, iwin);
            adicionarCanvasAoPdf(pdf, canvas, false);
        }

        return pdf.output("arraybuffer");
    } finally {
        iframe.remove();
    }
}

async function processarWordParaPdf() {
    if (!wordArquivos.length) return;

    const logEl = document.getElementById("word-log");
    const btn = btnWordProcessar();
    if (btn) btn.disabled = true;

    mostrarPassoFerramenta("step-word-processing", "word-step");
    if (logEl) logEl.textContent = "A converter Word → PDF…\n";

    try {
        const pdfs = [];

        for (let i = 0; i < wordArquivos.length; i += 1) {
            const arq = wordArquivos[i];
            if (logEl) {
                logEl.textContent =
                    `A processar ${arq.nome}… (${i + 1}/${wordArquivos.length})\n`;
            }

            const pdfBytes = await converterDocxParaPdfBytes(arq.bytes);
            const base = sanitizarNomeDocumento(nomeBaseSemExt(arq.nome));
            pdfs.push({
                nome: `${base}.pdf`,
                bytes: pdfBytes
            });
        }

        revogarWordDownload();

        let blob;
        let downloadNome;
        let subTexto;

        if (pdfs.length === 1) {
            blob = new Blob([pdfs[0].bytes], { type: "application/pdf" });
            downloadNome = pdfs[0].nome;
            subTexto = `1 arquivo convertido: ${pdfs[0].nome}`;
        } else {
            const zip = new JSZip();
            const usados = new Set();

            for (const p of pdfs) {
                let nome = p.nome;
                let n = 2;
                const lower = nome.toLowerCase();
                if (usados.has(lower)) {
                    const stem = nome.replace(/\.pdf$/i, "");
                    while (usados.has(`${stem} (${n}).pdf`.toLowerCase())) n += 1;
                    nome = `${stem} (${n}).pdf`;
                }
                usados.add(nome.toLowerCase());
                zip.file(nome, p.bytes);
            }

            blob = await zip.generateAsync({ type: "blob" });
            downloadNome = "word_para_pdf.zip";
            subTexto = `${pdfs.length} PDFs gerados em um ZIP.`;
        }

        wordDownloadUrl = URL.createObjectURL(blob);

        const dl = document.getElementById("btn-word-download");
        if (dl) {
            dl.href = wordDownloadUrl;
            dl.download = downloadNome;
            dl.hidden = false;
        }

        const sub = document.getElementById("word-result-sub");
        if (sub) sub.textContent = subTexto;

        const stat = document.getElementById("word-stat-ficheiros");
        if (stat) stat.textContent = String(pdfs.length);

        const lista = document.getElementById("word-result-lista");
        if (lista) {
            lista.replaceChildren();
            pdfs.forEach((p) => {
                const li = document.createElement("li");
                li.textContent = p.nome;
                lista.appendChild(li);
            });
        }

        mostrarPassoFerramenta("step-word-result", "word-step");
    } catch (e) {
        console.error(e);
        const msg = document.getElementById("word-error-msg");
        if (msg) msg.textContent = e.message || "Falha ao converter Word → PDF.";
        mostrarPassoFerramenta("step-word-error", "word-step");
    } finally {
        if (btn) btn.disabled = wordArquivos.length === 0;
    }
}

function iniciarDropzoneWord() {
    const dropzone = wordDropzone();
    const input = wordFileInput();
    if (!dropzone || !input) return;

    dropzone.addEventListener("click", () => input.click());

    input.addEventListener("change", () => {
        if (input.files?.length) adicionarArquivosWord(input.files);
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
            adicionarArquivosWord(e.dataTransfer.files);
        }
    });
}

function iniciarModoWord() {
    iniciarDropzoneWord();

    document.getElementById("btn-word-processar")?.addEventListener("click", processarWordParaPdf);
    document.getElementById("btn-word-novo")?.addEventListener("click", () => {
        limparEstadoWord();
        mostrarPassoFerramenta("step-word-upload", "word-step");
    });
    document.getElementById("btn-word-trocar")?.addEventListener("click", () => {
        limparEstadoWord();
        mostrarPassoFerramenta("step-word-upload", "word-step");
    });
    document.getElementById("btn-word-error-back")?.addEventListener("click", () => {
        mostrarPassoFerramenta(
            wordArquivos.length ? "step-word-editor" : "step-word-upload",
            "word-step"
        );
    });
    document.getElementById("btn-word-limpar")?.addEventListener("click", () => {
        if (!wordArquivos.length || confirm("Limpar todos os arquivos da lista?")) {
            limparEstadoWord();
            mostrarPassoFerramenta("step-word-upload", "word-step");
        }
    });
}
