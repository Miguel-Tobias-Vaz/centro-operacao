const TAMANHO_MAX_PDF = 50 * 1024 * 1024;

function stemArquivoPdf(nome) {
    return nome.replace(/\.pdf$/i, "").replace(/[<>:"/\\|?*]/g, "_").trim() || "documento";
}

function sanitizarNomeDocumento(nome) {
    const limpo = nome
        .replace(/\.pdf$/i, "")
        .replace(/[<>:"/\\|?*]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    return limpo || "documento";
}

async function carregarPdf(bytes) {
    return PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true });
}

async function obterInfoPdf(file) {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
        throw new Error("Selecione um arquivo PDF.");
    }

    if (file.size > TAMANHO_MAX_PDF) {
        throw new Error("O PDF deve ter no máximo 50 MB.");
    }

    const bytes = await file.arrayBuffer();
    const pdf = await carregarPdf(bytes);
    const totalPaginas = pdf.getPageCount();

    if (totalPaginas === 0) {
        throw new Error("O PDF não possui páginas.");
    }

    return { bytes, totalPaginas };
}

function chaveDivisao(indiceEsquerda, indiceDireita) {
    return `${indiceEsquerda}|${indiceDireita}`;
}

function calcularGruposDocumentos(paginasOrdem, divisoesEntre) {
    if (!paginasOrdem.length) return [];

    const grupos = [];
    let atual = [paginasOrdem[0]];

    for (let i = 0; i < paginasOrdem.length - 1; i += 1) {
        const esq = paginasOrdem[i].indexOriginal;
        const dir = paginasOrdem[i + 1].indexOriginal;
        const temDivisao = divisoesEntre.has(chaveDivisao(esq, dir));

        if (temDivisao) {
            grupos.push(atual);
            atual = [paginasOrdem[i + 1]];
        } else {
            atual.push(paginasOrdem[i + 1]);
        }
    }

    grupos.push(atual);
    return grupos;
}

function nomePadraoDocumento(indice, paginas, stemBase) {
    const nums = paginas.map((p) => p.indexOriginal + 1);
    const prefixo = stemBase || "Documento";
    if (paginas.length === 1) {
        return `${prefixo} ${indice + 1} - pag ${nums[0]}`;
    }
    return `${prefixo} ${indice + 1} - pag ${nums[0]} a ${nums[nums.length - 1]}`;
}

function sincronizarNomesDocumentos(nomes, grupos, stemBase) {
    while (nomes.length < grupos.length) {
        nomes.push(nomePadraoDocumento(nomes.length, grupos[nomes.length], stemBase));
    }
    nomes.length = grupos.length;
    return nomes;
}

function aplicarDivisaoEntreTodasPaginas(paginasOrdem) {
    const divisoes = new Set();
    for (let i = 0; i < paginasOrdem.length - 1; i += 1) {
        divisoes.add(chaveDivisao(
            paginasOrdem[i].indexOriginal,
            paginasOrdem[i + 1].indexOriginal
        ));
    }
    return divisoes;
}

function aplicarRotacaoPaginaExportada(paginaCopiada, rotacaoUsuario) {
    if (!rotacaoUsuario) return;

    const anguloAtual = paginaCopiada.getRotation().angle;
    paginaCopiada.setRotation(PDFLib.degrees((anguloAtual + rotacaoUsuario) % 360));
}

async function exportarDocumentosAgrupados(bytes, documentos, onProgress) {
    if (!documentos.length) {
        throw new Error("Defina ao menos um documento para exportar.");
    }

    const pdf = await carregarPdf(bytes);
    const totalOriginal = pdf.getPageCount();
    const zip = new JSZip();
    const arquivos = [];
    const usados = new Set();

    for (let i = 0; i < documentos.length; i += 1) {
        if (onProgress) onProgress(i + 1, documentos.length);

        const { nome, paginas } = documentos[i];
        if (!paginas?.length) continue;

        const novo = await PDFLib.PDFDocument.create();

        for (const paginaInfo of paginas) {
            const indexOriginal = paginaInfo.indexOriginal ?? paginaInfo;
            const rotacao = paginaInfo.rotacao ?? 0;

            if (indexOriginal < 0 || indexOriginal >= totalOriginal) {
                throw new Error("Índice de página inválido.");
            }

            const [copiada] = await novo.copyPages(pdf, [indexOriginal]);
            aplicarRotacaoPaginaExportada(copiada, rotacao);
            novo.addPage(copiada);
        }

        const pdfBytes = await novo.save();
        let nomeArquivo = `${sanitizarNomeDocumento(nome)}.pdf`;

        if (usados.has(nomeArquivo.toLowerCase())) {
            let n = 2;
            while (usados.has(`${sanitizarNomeDocumento(nome)} (${n}).pdf`.toLowerCase())) {
                n += 1;
            }
            nomeArquivo = `${sanitizarNomeDocumento(nome)} (${n}).pdf`;
        }

        usados.add(nomeArquivo.toLowerCase());
        zip.file(nomeArquivo, pdfBytes);
        arquivos.push(nomeArquivo);
    }

    if (!arquivos.length) {
        throw new Error("Nenhum documento válido para exportar.");
    }

    const blob = await zip.generateAsync({ type: "blob" });

    return {
        totalDocumentos: arquivos.length,
        arquivos,
        blob
    };
}
