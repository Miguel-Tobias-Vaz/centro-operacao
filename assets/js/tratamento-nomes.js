const EXTENSOES_PERMITIDAS = new Set([
    ".pdf", ".doc", ".docx", ".odt", ".xls", ".xlsx", ".png", ".jpg", ".jpeg"
]);

const ACENTOS_COMUNS = {
    preco: "Preço",
    precos: "Preços",
    orcamentaria: "Orçamentária",
    orcamentario: "Orçamentário",
    execucao: "Execução",
    licitacao: "Licitação",
    licitacoes: "Licitações",
    contratacao: "Contratação",
    administracao: "Administração",
    publica: "Pública",
    publico: "Público",
    municipio: "Município",
    relatorio: "Relatório",
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
    ratificacao: "Ratificação"
};

const TOKEN_ASSINADO_RX = /^(?:assinad[oa]s?|digital(?:mente)?|ass(?:\.|\b|$)|a\.s\.s\.?)$/i;

const SUFIXO_ASSINADO_FINAL_RX = /(?:[-_\s.]*(?:assinad[oa]s?|digital(?:mente)?|ass(?:\.|\b|$)|a\.s\.s\.?))+$/i;

function foldAscii(s) {
    return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function capitalizarPalavra(palavra) {
    if (!palavra) return palavra;
    const chave = foldAscii(palavra);
    if (ACENTOS_COMUNS[chave]) return ACENTOS_COMUNS[chave];
    if (palavra === palavra.toUpperCase() && palavra.length > 1) {
        palavra = palavra.toLowerCase();
    }
    return palavra.length > 1
        ? palavra[0].toUpperCase() + palavra.slice(1).toLowerCase()
        : palavra.toUpperCase();
}

function tokenEhLixo(token) {
    const t = token.trim().replace(/\./g, "");
    if (!t) return true;
    return TOKEN_ASSINADO_RX.test(t);
}

function tokensDoStem(stem) {
    let s = stem.trim();
    s = s.replace(/[_\-.]+/g, " ");
    s = s.replace(/\s+/g, " ").trim();
    if (!s) return [];
    return s.split(" ");
}

function normalizarNomeArquivo(nome) {
    const ultimoPonto = nome.lastIndexOf(".");
    const ext = ultimoPonto >= 0 ? nome.slice(ultimoPonto).toLowerCase() : "";
    let stem = ultimoPonto >= 0 ? nome.slice(0, ultimoPonto).trim() : nome.trim();

    stem = stem.replace(SUFIXO_ASSINADO_FINAL_RX, "").trim().replace(/^[\s_.-]+|[\s_.-]+$/g, "");
    let tokens = tokensDoStem(stem);
    while (tokens.length && tokenEhLixo(tokens[tokens.length - 1])) {
        tokens.pop();
    }
    tokens = tokens.filter((t) => !tokenEhLixo(t));
    if (!tokens.length) {
        tokens = tokensDoStem(stem);
        if (!tokens.length) tokens = [stem || "documento"];
    }

    let titulo = tokens.map(capitalizarPalavra).join(" ");
    titulo = titulo.replace(/\s+/g, " ").trim();
    titulo = titulo.replace(/[<>:"/\\|?*]/g, "");
    if (!titulo) titulo = "Documento";

    return titulo + ext;
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

async function processarZipTratamento(file) {
    const zip = await JSZip.loadAsync(file);
    const alteracoes = [];
    const usados = new Set();
    const saida = new JSZip();
    const entradas = [];

    zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const rel = relativePath.replace(/\\/g, "/");
        if (ignorarCaminho(rel)) return;

        const nome = rel.split("/").pop() || rel;
        const ext = extensaoArquivo(nome);
        if (!EXTENSOES_PERMITIDAS.has(ext)) return;

        entradas.push({ rel, zipEntry, nome });
    });

    entradas.sort((a, b) => a.rel.localeCompare(b.rel));

    for (const { rel, zipEntry, nome } of entradas) {
        const novoNome = normalizarNomeArquivo(nome);
        const pasta = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/") + 1) : "";
        const novoCaminho = nomeUnico(pasta + novoNome, usados);

        if (novoCaminho !== rel) {
            alteracoes.push([rel, novoCaminho]);
        }

        const conteudo = await zipEntry.async("uint8array");
        saida.file(novoCaminho, conteudo);
    }

    const documentos = [...usados].sort();
    const blob = await saida.generateAsync({ type: "blob" });

    return {
        alteracoes,
        documentos,
        blob,
        totalRenomeados: alteracoes.length,
        totalDocumentos: documentos.length
    };
}
