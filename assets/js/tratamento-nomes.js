const EXTENSOES_COMPACTADOS = [".zip", ".ram", ".rar", ".7z"];

const EXTENSOES_DOCUMENTO = [
    ".pdf", ".doc", ".docx", ".odt", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"
];

const EXTENSOES_PERMITIDAS = new Set(EXTENSOES_DOCUMENTO);

/** Compat: nomes antigos usados na UI/testes. */
const EXTENSOES_ARQUIVO_ENTRADA = EXTENSOES_COMPACTADOS;

/** Palavras com acentuação correta (chave sem acento, minúscula). */
const ACENTOS_COMUNS = {
    preco: "Preço",
    precos: "Preços",
    orcamentaria: "Orçamentária",
    orcamentario: "Orçamentário",
    orcamento: "Orçamento",
    execucao: "Execução",
    licitacao: "Licitação",
    licitacoes: "Licitações",
    contratacao: "Contratação",
    contratacoes: "Contratações",
    administracao: "Administração",
    publica: "Pública",
    publico: "Público",
    municipio: "Município",
    municipios: "Municípios",
    relatorio: "Relatório",
    relatorios: "Relatórios",
    gestao: "Gestão",
    fiscal: "Fiscal",
    termo: "Termo",
    referencia: "Referência",
    justificativa: "Justificativa",
    dispensa: "Dispensa",
    inexigibilidade: "Inexigibilidade",
    pregao: "Pregão",
    ata: "Ata",
    registro: "Registro",
    edital: "Edital",
    homologacao: "Homologação",
    adjudicacao: "Adjudicação",
    ratificacao: "Ratificação",
    averbacao: "Averbação",
    averbacoes: "Averbações",
    aditivo: "Aditivo",
    aditivos: "Aditivos",
    apostilamento: "Apostilamento",
    empenho: "Empenho",
    empenhos: "Empenhos",
    portaria: "Portaria",
    portarias: "Portarias",
    despacho: "Despacho",
    despachos: "Despachos",
    certificacao: "Certificação",
    certificado: "Certificado",
    autorizacao: "Autorização",
    solicitacao: "Solicitação",
    notificacao: "Notificação",
    convocacao: "Convocação",
    declaracao: "Declaração",
    resolucao: "Resolução",
    deliberacao: "Deliberação",
    parecer: "Parecer",
    protocolo: "Protocolo",
    processo: "Processo",
    contrato: "Contrato",
    convenios: "Convênios",
    convenio: "Convênio",
    apostila: "Apostila",
    liquidacao: "Liquidação",
    pagamento: "Pagamento",
    medicao: "Medição",
    medicoes: "Medições",
    revisao: "Revisão",
    reuniao: "Reunião",
    reunioes: "Reuniões",
    anexos: "Anexos",
    anexo: "Anexo",
    minuta: "Minuta",
    proposicao: "Proposição",
    exigencia: "Exigência",
    exigencias: "Exigências",
    habilitacao: "Habilitação",
    qualificacao: "Qualificação",
    proposta: "Proposta",
    propostas: "Propostas",
    orgao: "Órgão",
    orgaos: "Órgãos",
    secretaria: "Secretaria",
    secretario: "Secretário",
    numero: "Número",
    numeros: "Números"
};

/** Artigos e preposições (minúsculas no meio do título). */
const MINUSCULAS = new Set([
    "a", "as", "o", "os",
    "de", "da", "do", "das", "dos",
    "e", "em", "na", "no", "nas", "nos",
    "por", "para", "pelo", "pela", "pelos", "pelas",
    "com", "sem", "sob", "sobre", "entre"
]);

/** Códigos / siglas que devem permanecer em maiúsculas. */
const SIGLAS = new Set([
    "sei", "cpf", "cnpj", "rg", "pdf", "xls", "doc",
    "n", "nr", "nro", "num", "nº", "n°"
]);

const TOKEN_LIXO_RX = /^(?:assinad[oa]s?|digital(?:mente)?|ass(?:\.|\b|$)|a\.s\.s\.?|scan(?:ned|eado)?|copia|c[oó]pia|copy|final|rascunho|draft|temp|tmp|novo|new|old|antigo|versao|versão|v\d+|rev\d*)$/i;

const SUFIXO_LIXO_FINAL_RX = /(?:[-_\s.]*(?:assinad[oa]s?|digital(?:mente)?|ass(?:\.|\b|$)|a\.s\.s\.?|scan(?:ned|eado)?|copia|c[oó]pia|copy|final|rascunho|draft|temp|tmp))+$/i;

/** Sufixos de cópia/duplicata — não remove números de documento (_123, -45). */
const SUFIXO_COPIA_RX = /(?:[-_\s]*(?:\(\d+\)|\[\d+\]|(?:copia|c[oó]pia|copy)[-_\s]*\d*))+$/i;

/** Pares que pedem "de" entre eles quando o "de" não veio no nome. */
const PARES_COM_DE = new Set([
    "termo|referencia",
    "registro|preco",
    "registro|precos",
    "ata|registro",
    "ata|preco",
    "ata|precos",
    "termo|contratacao",
    "edital|licitacao",
    "aviso|licitacao"
]);

const CONECTORES_COLADOS = ["dos", "das", "pelo", "pela", "pelos", "pelas", "para", "com", "sem", "de", "da", "do", "e", "em", "na", "no"];

function foldAscii(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function capitalizarPalavra(palavra, indice, total) {
    if (!palavra) return palavra;

    const chave = foldAscii(palavra);

    if (ACENTOS_COMUNS[chave]) {
        const forma = ACENTOS_COMUNS[chave];
        if (indice > 0 && MINUSCULAS.has(chave)) return chave;
        return forma;
    }

    if (SIGLAS.has(chave) || /^n[º°]?$/i.test(palavra)) {
        if (/^n[º°]?$/i.test(palavra) || chave === "n" || chave === "nr" || chave === "nro" || chave === "num") {
            return "nº";
        }
        return chave.toUpperCase();
    }

    if (/^\d+[a-z]?$/i.test(palavra)) return palavra.toLowerCase();

    if (indice > 0 && MINUSCULAS.has(chave)) return chave;

    let base = palavra;
    if (base === base.toUpperCase() && base.length > 1) {
        base = base.toLowerCase();
    }

    if (base.length <= 1) return base.toUpperCase();
    return base[0].toUpperCase() + base.slice(1).toLowerCase();
}

function tokenEhLixo(token) {
    const t = token.trim().replace(/\./g, "");
    if (!t) return true;
    if (/^\(\d+\)$/.test(t) || /^\[\d+\]$/.test(t)) return true;
    return TOKEN_LIXO_RX.test(t);
}

/** Separa CamelCase e blocos ALLCAPS colados em palavras conhecidas. */
function separarTokenColado(token) {
    if (!token || token.length < 4) return [token];

    if (/[a-z][A-Z]/.test(token)) {
        return token
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
            .split(/\s+/)
            .filter(Boolean);
    }

    const lower = foldAscii(token);
    if (!/^[a-z0-9]+$/i.test(lower) || lower.length < 6) return [token];

    const chaves = [
        ...Object.keys(ACENTOS_COMUNS),
        ...CONECTORES_COLADOS
    ].sort((a, b) => b.length - a.length);

    const partes = [];
    let resto = lower;

    while (resto.length) {
        let achou = false;

        const num = resto.match(/^\d+[a-z]?/i);
        if (num) {
            partes.push(num[0]);
            resto = resto.slice(num[0].length);
            continue;
        }

        for (const chave of chaves) {
            const minLen = CONECTORES_COLADOS.includes(chave) ? 2 : 3;
            if (resto.startsWith(chave) && chave.length >= minLen) {
                partes.push(chave);
                resto = resto.slice(chave.length);
                achou = true;
                break;
            }
        }

        if (!achou) {
            if (partes.length) {
                partes[partes.length - 1] += resto;
            } else {
                partes.push(resto);
            }
            break;
        }
    }

    return partes.length > 1 ? partes : [token];
}

function tokensDoStem(stem) {
    let s = stem.trim();
    s = s.replace(/[<>:"/\\|?*]+/g, " ");
    s = s.replace(/[_\-.]+/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    if (!s) return [];

    const bruto = s.split(" ");
    const saida = [];
    for (const t of bruto) {
        saida.push(...separarTokenColado(t));
    }
    return saida.filter(Boolean);
}

function limparStem(stem) {
    let s = stem.trim();
    s = s.replace(SUFIXO_COPIA_RX, "");
    s = s.replace(SUFIXO_LIXO_FINAL_RX, "");
    return s.trim().replace(/^[\s_.-]+|[\s_.-]+$/g, "");
}

function inserirDeEntrePares(tokens) {
    if (tokens.length < 2) return tokens;

    const saida = [tokens[0]];
    for (let i = 1; i < tokens.length; i++) {
        const ant = foldAscii(saida[saida.length - 1]);
        const atual = foldAscii(tokens[i]);
        if (PARES_COM_DE.has(`${ant}|${atual}`)) {
            saida.push("de");
        }
        saida.push(tokens[i]);
    }
    return saida;
}

function normalizarNomeArquivo(nome) {
    const ultimoPonto = nome.lastIndexOf(".");
    const ext = ultimoPonto >= 0 ? nome.slice(ultimoPonto).toLowerCase() : "";
    let stem = ultimoPonto >= 0 ? nome.slice(0, ultimoPonto).trim() : nome.trim();

    stem = limparStem(stem);

    let tokens = tokensDoStem(stem);
    while (tokens.length && tokenEhLixo(tokens[tokens.length - 1])) {
        tokens.pop();
    }
    tokens = tokens.filter((t) => !tokenEhLixo(t));

    if (!tokens.length) {
        tokens = tokensDoStem(stem);
        if (!tokens.length) tokens = [stem || "documento"];
    }

    tokens = inserirDeEntrePares(tokens);

    const mesclados = [];
    for (let i = 0; i < tokens.length; i++) {
        const atual = tokens[i];
        const prox = tokens[i + 1];
        const chave = foldAscii(atual);
        if (
            (chave === "n" || chave === "nr" || chave === "nro" || chave === "num" || /^n[º°]$/i.test(atual)) &&
            prox &&
            /^\d/.test(prox)
        ) {
            mesclados.push("nº");
            continue;
        }
        mesclados.push(atual);
    }

    let titulo = mesclados
        .map((t, i) => capitalizarPalavra(t, i, mesclados.length))
        .join(" ");

    titulo = titulo.replace(/\s+/g, " ").trim();
    titulo = titulo.replace(/[<>:"/\\|?*]/g, "");
    if (!titulo) titulo = "Documento";

    return titulo + ext;
}

function normalizarNomePasta(nome) {
    return normalizarNomeArquivo(nome);
}

function normalizarCaminho(rel, { renomearArquivo = true } = {}) {
    const partes = rel.replace(/\\/g, "/").split("/").filter((p) => p.length > 0);
    if (!partes.length) return rel.replace(/\\/g, "/");

    const arquivo = partes.pop();
    const pastas = partes.map(normalizarNomePasta);
    const novoArquivo = renomearArquivo ? normalizarNomeArquivo(arquivo) : arquivo;
    return [...pastas, novoArquivo].join("/");
}

function ignorarCaminho(rel) {
    const partes = rel.replace(/\\/g, "/").toLowerCase().split("/");
    if (partes.some((p) => p.startsWith("."))) return true;
    return partes.includes("__macosx");
}

function extensaoArquivo(nome) {
    const i = nome.lastIndexOf(".");
    return i >= 0 ? nome.slice(i).toLowerCase() : "";
}

function extensaoPorLista(nome, lista) {
    const lower = nome.toLowerCase();
    return lista.find((ext) => lower.endsWith(ext)) || null;
}

function extensaoArquivoEntrada(nome) {
    return extensaoPorLista(nome, EXTENSOES_COMPACTADOS);
}

function ehCompactado(nome) {
    return extensaoArquivoEntrada(nome) !== null;
}

function ehDocumentoAvulso(nome) {
    return EXTENSOES_PERMITIDAS.has(extensaoArquivo(nome));
}

function ehArquivoTratamento(nome) {
    return ehCompactado(nome) || ehDocumentoAvulso(nome);
}

function rotuloArquivosEntrada() {
    return [...EXTENSOES_COMPACTADOS, ...EXTENSOES_DOCUMENTO].join(", ");
}

function acceptArquivosEntrada() {
    return [...EXTENSOES_COMPACTADOS, ...EXTENSOES_DOCUMENTO].join(",");
}

function nomeUnico(caminho, usados) {
    const norm = caminho.replace(/\\/g, "/");
    if (!usados.has(norm)) {
        usados.add(norm);
        return norm;
    }

    const barra = norm.lastIndexOf("/");
    const pasta = barra >= 0 ? norm.slice(0, barra + 1) : "";
    const nome = barra >= 0 ? norm.slice(barra + 1) : norm;
    const dot = nome.lastIndexOf(".");
    const stem = dot >= 0 ? nome.slice(0, dot) : nome;
    const ext = dot >= 0 ? nome.slice(dot) : "";

    let n = 2;
    while (true) {
        const cand = `${pasta}${stem} (${n})${ext}`;
        if (!usados.has(cand)) {
            usados.add(cand);
            return cand;
        }
        n += 1;
    }
}

function escaparCsv(valor) {
    const texto = String(valor ?? "");
    if (/[;"\r\n]/.test(texto)) {
        return `"${texto.replace(/"/g, '""')}"`;
    }
    return texto;
}

function gerarCsvAlteracoes(alteracoes) {
    const linhas = ["nome_antigo;nome_novo"];
    for (const [antigo, novo] of alteracoes) {
        linhas.push(`${escaparCsv(antigo)};${escaparCsv(novo)}`);
    }
    return new Blob(["\uFEFF" + linhas.join("\r\n")], {
        type: "text/csv;charset=utf-8"
    });
}

let archiveInitPromise = null;

async function obterArchive() {
    if (window.__LibArchive) return window.__LibArchive;

    if (!archiveInitPromise) {
        archiveInitPromise = (async () => {
            const { Archive } = await import("./assets/vendor/libarchivejs/main.js");
            Archive.init({
                workerUrl: "assets/vendor/libarchivejs/dist/worker-bundle.js"
            });
            window.__LibArchive = Archive;
            return Archive;
        })();
    }

    return archiveInitPromise;
}

async function extrairEntradasJsZip(file) {
    const zip = await JSZip.loadAsync(file);
    const entradas = [];

    zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const rel = relativePath.replace(/\\/g, "/");
        if (ignorarCaminho(rel)) return;
        entradas.push({
            rel,
            getBytes: () => zipEntry.async("uint8array")
        });
    });

    return entradas;
}

async function extrairEntradasLibarchive(file) {
    const Archive = await obterArchive();
    const archive = await Archive.open(file);
    const entradas = [];

    await archive.extractFiles(({ file: arquivo, path }) => {
        const rel = String(path || arquivo?.name || "").replace(/\\/g, "/");
        if (!rel || rel.endsWith("/") || ignorarCaminho(rel)) return;
        entradas.push({
            rel,
            getBytes: async () => new Uint8Array(await arquivo.arrayBuffer())
        });
    });

    return entradas;
}

async function extrairEntradas(file) {
    const ext = extensaoArquivoEntrada(file.name);

    if (ext === ".zip" || ext === ".ram") {
        try {
            return await extrairEntradasJsZip(file);
        } catch (erro) {
            console.warn("JSZip falhou, tentando libarchive:", erro);
            return extrairEntradasLibarchive(file);
        }
    }

    if (ext === ".rar" || ext === ".7z") {
        return extrairEntradasLibarchive(file);
    }

    throw new Error("Formato de pacote não suportado.");
}

async function processarDocumentoAvulso(file) {
    const nome = file.name;
    const novoNome = normalizarNomeArquivo(nome);
    const bytes = new Uint8Array(await file.arrayBuffer());
    const blob = new Blob([bytes], { type: file.type || "application/octet-stream" });
    const alteracoes = novoNome !== nome ? [[nome, novoNome]] : [[nome, novoNome]];

    return {
        modo: "arquivo",
        alteracoes: novoNome !== nome ? [[nome, novoNome]] : [],
        documentos: [novoNome],
        blob,
        csvBlob: gerarCsvAlteracoes(alteracoes),
        nomeDownload: novoNome,
        totalRenomeados: novoNome !== nome ? 1 : 0,
        totalDocumentos: 1,
        totalPreservados: 0
    };
}

async function processarArquivoTratamento(file, opcoes = {}) {
    const manterExtras = opcoes.manterExtras !== false;

    if (ehDocumentoAvulso(file.name) && !ehCompactado(file.name)) {
        return processarDocumentoAvulso(file);
    }

    const entradas = await extrairEntradas(file);
    entradas.sort((a, b) => a.rel.localeCompare(b.rel, "pt-BR"));

    const alteracoes = [];
    const usados = new Set();
    const saida = new JSZip();
    const documentos = [];
    let totalPreservados = 0;

    for (const { rel, getBytes } of entradas) {
        const nome = rel.split("/").pop() || rel;
        const ext = extensaoArquivo(nome);
        const ehDocumento = EXTENSOES_PERMITIDAS.has(ext);

        if (!ehDocumento && !manterExtras) continue;

        const novoCaminhoBruto = normalizarCaminho(rel, { renomearArquivo: ehDocumento });
        const novoCaminho = nomeUnico(novoCaminhoBruto, usados);

        if (novoCaminho !== rel) {
            alteracoes.push([rel, novoCaminho]);
        }

        if (ehDocumento) {
            documentos.push(novoCaminho);
        } else {
            totalPreservados += 1;
        }

        const conteudo = await getBytes();
        saida.file(novoCaminho, conteudo);
    }

    const blob = await saida.generateAsync({ type: "blob" });
    const paresCsv = alteracoes.length
        ? alteracoes
        : documentos.map((d) => [d, d]);

    return {
        modo: "pacote",
        alteracoes,
        documentos: documentos.sort((a, b) => a.localeCompare(b, "pt-BR")),
        blob,
        csvBlob: gerarCsvAlteracoes(paresCsv),
        nomeDownload: null,
        totalRenomeados: alteracoes.length,
        totalDocumentos: documentos.length,
        totalPreservados
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        normalizarNomeArquivo,
        normalizarCaminho,
        normalizarNomePasta,
        limparStem,
        tokensDoStem,
        gerarCsvAlteracoes,
        EXTENSOES_ARQUIVO_ENTRADA,
        EXTENSOES_COMPACTADOS,
        EXTENSOES_DOCUMENTO,
        EXTENSOES_PERMITIDAS
    };
}
