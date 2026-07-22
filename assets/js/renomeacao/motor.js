/**
 * Motor de renomeação — pipeline de normalização de nomes.
 * Depende de renomeacao/dados.js (globals).
 */

const CORRECAO_CACHE = new Map();

/** Índice foldAscii → palavra acentuada (lazy, via acentos-pt.json). */
let DICIONARIO_ACENTOS = null;
let DICIONARIO_PROMESSA = null;
let DICIONARIO_URL = "assets/data/acentos-pt.json";

function configurarDicionarioAcentos(url) {
    DICIONARIO_URL = url || DICIONARIO_URL;
    DICIONARIO_ACENTOS = null;
    DICIONARIO_PROMESSA = null;
    CORRECAO_CACHE.clear();
}

/**
 * Carrega o índice de acentos (dictionary-pt / base do @cspell/dict-pt-br).
 * Lazy + cache de Promise. Falha silenciosa → Map vazio.
 */
async function garantirDicionarioAcentos(url) {
    if (DICIONARIO_ACENTOS) return DICIONARIO_ACENTOS;
    if (DICIONARIO_PROMESSA) return DICIONARIO_PROMESSA;

    const alvo = url || DICIONARIO_URL;
    DICIONARIO_PROMESSA = (async () => {
        try {
            let data = null;

            // Preferir .gz quando DecompressionStream estiver disponível
            if (typeof DecompressionStream !== "undefined" && /\.json$/i.test(alvo)) {
                const gzUrl = alvo.replace(/\.json$/i, ".json.gz");
                try {
                    const resGz = await fetch(gzUrl);
                    if (resGz.ok) {
                        const stream = resGz.body.pipeThrough(new DecompressionStream("gzip"));
                        const texto = await new Response(stream).text();
                        data = JSON.parse(texto);
                    }
                } catch (_) {
                    /* cai no JSON puro */
                }
            }

            if (!data) {
                const res = await fetch(alvo);
                if (!res.ok) throw new Error("HTTP " + res.status);
                data = await res.json();
            }

            DICIONARIO_ACENTOS = new Map(Object.entries(data));
            CORRECAO_CACHE.clear();
        } catch (e) {
            console.warn("[renomeacao] Dicionário de acentos indisponível:", e.message || e);
            DICIONARIO_ACENTOS = new Map();
            CORRECAO_CACHE.clear();
        }
        return DICIONARIO_ACENTOS;
    })();

    return DICIONARIO_PROMESSA;
}

function tituloApartirDeMinusculas(s) {
    if (!s) return s;
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Cadeia: cache → LEXICO_PT → CORRECAO_RAPIDA → dicionário PT → null
 * Só grava no cache quando o resultado é definitivo (léxico/rápida ou dict já carregado).
 * @returns {string|null} forma canônica (Title Case)
 */
function resolverFormaCanonica(chave) {
    if (CORRECAO_CACHE.has(chave)) return CORRECAO_CACHE.get(chave);

    let forma = null;
    let definitivo = false;

    if (Object.prototype.hasOwnProperty.call(LEXICO_PT, chave)) {
        forma = LEXICO_PT[chave];
        definitivo = true;
    } else if (CORRECAO_RAPIDA.has(chave)) {
        forma = CORRECAO_RAPIDA.get(chave);
        definitivo = true;
    } else if (DICIONARIO_ACENTOS) {
        if (DICIONARIO_ACENTOS.has(chave)) {
            forma = tituloApartirDeMinusculas(DICIONARIO_ACENTOS.get(chave));
        }
        definitivo = true;
    }

    if (definitivo) CORRECAO_CACHE.set(chave, forma);
    return forma;
}

/**
 * Pré-aquece o cache para um lote de tokens (reduz lookups repetidos).
 * @param {Iterable<string>} palavras
 */
function preaquecerCorrecoes(palavras) {
    for (const p of palavras) {
        if (!p) continue;
        resolverFormaCanonica(foldAscii(p));
    }
}

function foldAscii(s) {
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function limparInvisiveis(s) {
    return String(s)
        // Preserva ordinais (NFKC transforma º→o e ª→a)
        .replace(/º/g, "\uE000")
        .replace(/ª/g, "\uE001")
        .normalize("NFKC")
        .replace(/\uE000/g, "º")
        .replace(/\uE001/g, "ª")
        .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, " ")
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
        .replace(/[\u2013\u2014]/g, "-");
}

function ehSigla(token) {
    const limpo = token.replace(/\./g, "");
    const chave = foldAscii(limpo);
    // Preposições/conectivos nunca são siglas (ex.: DE, COM, A)
    if (ehConectivo(chave)) return false;
    if (SIGLAS.has(chave)) return true;
    // 2–5 letras todas maiúsculas no original (ex.: TCE, PNCP)
    if (/^[A-ZÀ-Ü]{2,5}$/.test(limpo) && limpo === limpo.toUpperCase()) return true;
    // Padrão com pontos: C.N.P.J. / T.C.E.
    if (/^(?:[A-Za-zÀ-ü]\.){2,6}$/.test(token)) return true;
    return false;
}

function ehRomano(token) {
    return /^(?:[IVXLCDM]+)(?:º|ª|o|a)?$/i.test(token) && foldAscii(token).length <= 8;
}

function ehNumeroOuCodigo(token) {
    // 01, 2024, 14.231, 14.3, nº12, n12, art.1, 001-2025, 1º
    if (/^\d+([.,]\d+)*$/.test(token)) return true;
    if (/^\d{1,6}-\d{4}$/.test(token)) return true;
    if (/^\d+[ºªo°]?$/i.test(token) && /[ºªo°]/i.test(token)) return true;
    if (/^(?:n[ºo°.]?|nr|nro|num|numero|número)[\s._-]?\d+/i.test(token)) return true;
    if (/^(?:art|inc|par|§)[\s._-]?\d+/i.test(token)) return true;
    return false;
}

/** É preposição/artigo/conjunção (chave já em foldAscii ou palavra crua). */
function ehConectivo(palavraOuChave) {
    return PREPOSICOES.has(foldAscii(palavraOuChave));
}

/** No meio do título (não primeira nem última palavra). */
function conectivoNoMeioDoTitulo(indice, total) {
    return total > 1 && indice > 0 && indice < total - 1;
}

/** Forma minúscula correta para conectivo (com acento quando couber). */
function formaConectivoMinuscula(chave) {
    if (FORMA_PREPOSICAO[chave]) return FORMA_PREPOSICAO[chave];
    return chave;
}

/**
 * Complementos em que "DE" é sigla administrativa (não preposição).
 * Ex.: DE FISCAL, DE CONTRATO.
 */

function tokenMaiusculoLiteral(token) {
    const limpo = String(token || "").replace(/\./g, "");
    if (limpo.length <= 1) return false;
    if (!/[A-Za-zÀ-ü]/.test(limpo)) return false;
    return limpo === limpo.toUpperCase();
}

/** Sigla curta (2–6 letras) ou entrada do set SIGLAS. */
function tokenPareceSiglaCurta(token) {
    const limpo = String(token || "").replace(/\./g, "");
    if (!limpo) return false;
    const chave = foldAscii(limpo);
    if (SIGLAS.has(chave)) return true;
    if (limpo.length >= 2 && limpo.length <= 6 && /^[A-Za-zÀ-ü]+$/.test(limpo)) {
        return tokenMaiusculoLiteral(limpo);
    }
    return false;
}

function tokensEstaoGritando(tokens) {
    const alfa = tokens.filter((t) => /[A-Za-zÀ-ü]/.test(t));
    return alfa.length >= 2 && alfa.every((t) => t === t.toUpperCase());
}

/**
 * Detecta "DE" como sigla (não preposição), com base no contexto.
 * Padrões: DE FISCAL · SEMSA SJP DE FISCAL · DE FISCAL DE CONTRATO
 *
 * Em arquivos 100% MAIÚSCULOS, exige contexto admin ou siglas curtas
 * para não transformar "Ata de Registro" em "Ata DE Registro".
 */
function isSiglaDE(contexto, posicao) {
    const atual = contexto[posicao] || "";
    if (foldAscii(atual) !== "de") return false;

    const antes = contexto[posicao - 1] || "";
    const depois = contexto[posicao + 1] || "";
    const depoisFold = foldAscii(depois);
    const antesFold = foldAscii(antes);

    // DE + complemento administrativo (FISCAL, CONTRATO, …)
    if (depois && DE_SIGLA_SEGUINTES.has(depoisFold)) {
        return true;
    }

    const gritando = tokensEstaoGritando(contexto);

    if (!gritando) {
        // DE + palavra em maiúscula (sigla / bloco MAIÚSCULO)
        if (
            depois &&
            tokenMaiusculoLiteral(depois) &&
            depois.replace(/\./g, "").length > 1
        ) {
            if (
                tokenPareceSiglaCurta(depois) ||
                DE_SIGLA_SEGUINTES.has(depoisFold) ||
                depois.replace(/\./g, "").length <= 8
            ) {
                return true;
            }
        }

        // Palavra em maiúscula + DE + palavra em maiúscula
        if (
            tokenMaiusculoLiteral(antes) &&
            tokenMaiusculoLiteral(depois) &&
            antes.replace(/\./g, "").length > 1 &&
            depois.replace(/\./g, "").length > 1
        ) {
            return true;
        }

        // Sigla conhecida/curta + DE + (sigla | admin)
        if (
            tokenPareceSiglaCurta(antes) &&
            (tokenPareceSiglaCurta(depois) || DE_SIGLA_SEGUINTES.has(depoisFold))
        ) {
            return true;
        }
    } else {
        // Tudo maiúsculo: só admin ou entre siglas curtas
        if (DE_SIGLA_SEGUINTES.has(depoisFold)) return true;
        if (
            tokenPareceSiglaCurta(antes) &&
            (tokenPareceSiglaCurta(depois) || DE_SIGLA_SEGUINTES.has(depoisFold))
        ) {
            return true;
        }
        // Ex.: XX DE YY com ambas siglas curtas
        if (tokenPareceSiglaCurta(antes) && tokenPareceSiglaCurta(depois)) {
            return true;
        }
        // DE no início + admin (já coberto) ou DE + sigla curta após outra sigla na cadeia
        if (!antesFold && tokenPareceSiglaCurta(depois) && DE_SIGLA_SEGUINTES.has(depoisFold)) {
            return true;
        }
    }

    return false;
}

/**
 * Capitaliza token do título.
 * Conectivos: maiúscula só se forem a primeira palavra; minúscula no meio.
 * Exceção: "DE" sigla administrativa permanece "DE".
 */
function capitalizarPalavra(palavra, indice, total, tokensOriginais) {
    if (!palavra) return palavra;

    const chave = foldAscii(palavra);

    // "DE" como sigla (DE FISCAL, SEMSA DE CONTRATO, …)
    if (chave === "de" && tokensOriginais && isSiglaDE(tokensOriginais, indice)) {
        return "DE";
    }

    // 1) Conectivos no meio — sempre minúsculos (antes de sigla/léxico/dict)
    if (ehConectivo(chave) && conectivoNoMeioDoTitulo(indice, total)) {
        return formaConectivoMinuscula(chave);
    }

    const canon = resolverFormaCanonica(chave);
    if (canon) {
        // Conectivo na primeira posição: Title Case do léxico/rápida
        if (ehConectivo(chave) && indice === 0) {
            return canon;
        }
        return canon;
    }

    if (ehSigla(palavra)) {
        return palavra.replace(/\./g, "").toUpperCase();
    }

    if (ehRomano(palavra)) {
        return palavra.toUpperCase().replace(/A$/i, "ª").replace(/O$/i, "º");
    }

    if (ehNumeroOuCodigo(palavra)) {
        // Garante "Nº" (N maiúsculo) em numeração
        if (/^n[ºo°.]?\s*\d/i.test(palavra)) {
            return palavra.replace(/^n[ºo°.]?\s*/i, "Nº ");
        }
        return palavra;
    }

    // Conectivo sozinho / início sem léxico
    if (ehConectivo(chave)) {
        if (conectivoNoMeioDoTitulo(indice, total)) {
            return formaConectivoMinuscula(chave);
        }
        // Início do título
        const forma = formaConectivoMinuscula(chave);
        return forma.charAt(0).toUpperCase() + forma.slice(1);
    }

    let base = palavra;
    if (base === base.toUpperCase() && base.length > 1) {
        base = base.toLowerCase();
    }

    if (base.length <= 1) return base.toUpperCase();
    return base[0].toUpperCase() + base.slice(1).toLowerCase();
}

/**
 * Ajustes finais do título: locuções + conectivos minúsculos no meio.
 * Preserva "DE" quando for sigla administrativa.
 */
function aplicarRegrasTitulo(palavras, tokensOriginais) {
    let out = palavras.slice();
    const folds = out.map((p) => foldAscii(p));

    // Locuções (através de, por causa de, …)
    for (const loc of LOCUCOES_PREPOSITIVAS) {
        const n = loc.length;
        for (let i = 0; i <= folds.length - n; i += 1) {
            let ok = true;
            for (let j = 0; j < n; j += 1) {
                if (folds[i + j] !== loc[j]) {
                    ok = false;
                    break;
                }
            }
            if (!ok) continue;

            for (let j = 0; j < n; j += 1) {
                const idx = i + j;
                if (idx === 0) continue;
                const k = folds[idx];
                out[idx] = FORMA_PREPOSICAO[k] || k;
            }
            if (i > 0) {
                const k = folds[i];
                out[i] = FORMA_PREPOSICAO[k] || k;
            }
        }
    }

    // Conectivos isolados no meio + DE sigla
    const total = out.length;
    out = out.map((p, i) => {
        if (tokensOriginais && isSiglaDE(tokensOriginais, i)) return "DE";
        const chave = foldAscii(p);
        if (ehConectivo(chave) && conectivoNoMeioDoTitulo(i, total)) {
            return formaConectivoMinuscula(chave);
        }
        return p;
    });

    return out;
}

function tokenEhLixo(token) {
    const t = token.trim();
    if (!t || TOKEN_SO_PONTUACAO_RX.test(t)) return true;
    const semPontos = t.replace(/\./g, "");
    if (!semPontos) return true;
    if (TOKEN_LIXO_RX.test(semPontos)) return true;
    if (TOKEN_VERSAO_RX.test(t)) return true;
    if (TOKEN_COPIA_PAREN_RX.test(t)) return true;
    return false;
}

/** Reúne abreviações com o número seguinte: n + 12 → Nº 12 · n + 001-2025 → Nº 001-2025 */
function fundirAbrevComNumero(tokens) {
    const pref = /^(?:n[ºo°.]?|nr|nro|num|numero|número|art|inc|par)$/i;
    const numOuNumAno = /^(?:\d+(?:[.,]\d+)*|\d{1,6}-\d{4})$/;
    const out = [];
    for (let i = 0; i < tokens.length; i += 1) {
        const atual = tokens[i];
        const prox = tokens[i + 1];
        if (prox && pref.test(atual) && numOuNumAno.test(prox)) {
            const p = atual.replace(/\.$/, "");
            if (/^n/i.test(p)) {
                out.push(`Nº ${prox}`);
            } else {
                const rotulo = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
                out.push(`${rotulo} ${prox}`);
            }
            i += 1;
            continue;
        }
        out.push(atual);
    }
    return out;
}

/**
 * Junta número + ano com hífen: 001 2025 → 001-2025
 * Também: "Nº 001" + "2025" → "Nº 001-2025"
 */
function fundirNumeroComAno(tokens) {
    const out = [];
    for (let i = 0; i < tokens.length; i += 1) {
        const atual = tokens[i];
        const prox = tokens[i + 1];

        // "Nº 001" + "2025" → "Nº 001-2025"
        const mNum = /^(n[ºo°.]?)\s+(\d{1,6})$/i.exec(atual);
        if (mNum && prox && ehAnoQuatroDigitos(prox)) {
            out.push(`Nº ${mNum[2]}-${prox}`);
            i += 1;
            continue;
        }

        // "001" + "2025" → "001-2025" (não funde se o primeiro já for ano)
        if (
            prox &&
            /^\d{1,6}$/.test(atual) &&
            !ehAnoQuatroDigitos(atual) &&
            ehAnoQuatroDigitos(prox)
        ) {
            out.push(`${atual}-${prox}`);
            i += 1;
            continue;
        }

        // Normaliza "nº 001-2025" / "n 001-2025" já colados
        const mJa = /^(n[ºo°.]?)\s+(\d{1,6}-\d{4})$/i.exec(atual);
        if (mJa) {
            out.push(`Nº ${mJa[2]}`);
            continue;
        }

        out.push(atual);
    }
    return out;
}

/** Separa CamelCase, números colados e pontuação em tokens. */
function tokensDoStem(stem) {
    let s = limparInvisiveis(stem).trim();

    // Protege padrões antes de trocar hífen/ponto por espaço
    const protegidos = [];
    const proteger = (valor) => {
        protegidos.push(valor);
        return `\u0000${protegidos.length - 1}\u0000`;
    };

    // Número-ano: 001-2025
    s = s.replace(/(\d{1,6})\s*[-–—]\s*((?:19|20)\d{2})\b/g, (_, num, ano) =>
        proteger(`${num}-${ano}`)
    );

    // Numeração decimal de documento/seção: 14.3 · 3.1.2
    s = s.replace(/\b(\d+(?:\.\d+)+)\b/g, (m) => proteger(m));

    // Ordinais: 1º · 2ª
    s = s.replace(/\b(\d+[ºª])\b/gi, (m) => proteger(m));

    // Underscore / hífen / ponto (como separador) → espaço
    s = s.replace(/[_\-.·•]+/g, " ");

    // Restaura protegidos
    s = s.replace(/\u0000(\d+)\u0000/g, (_, idx) => protegidos[Number(idx)]);

    // CamelCase / PascalCase: AtaRegistroPreco → Ata Registro Preco
    s = s.replace(/([a-zà-ü])([A-ZÀ-Ü])/g, "$1 $2");
    s = s.replace(/([A-ZÀ-Ü]+)([A-ZÀ-Ü][a-zà-ü])/g, "$1 $2");

    // Número colado em letra: Lei14231 / art12 → Lei 14231 / art 12
    s = s.replace(/([a-zA-ZÀ-ü])(\d)/g, "$1 $2");
    s = s.replace(/(\d)([a-zA-ZÀ-ü])/g, "$1 $2");

    // Parênteses / colchetes → espaço (conteúdo vira tokens)
    s = s.replace(/[()[\]{}]/g, " ");

    s = s.replace(/\s+/g, " ").trim();
    if (!s) return [];

    let tokens = s.split(" ").filter(Boolean);
    tokens = fundirAbrevComNumero(tokens);
    tokens = fundirNumeroComAno(tokens);
    return tokens;
}

function removerDuplicatasConsecutivas(tokens) {
    const out = [];
    for (const t of tokens) {
        const ant = out[out.length - 1];
        if (ant && foldAscii(ant) === foldAscii(t)) continue;
        out.push(t);
    }
    return out;
}

/** Ano civil de 4 dígitos — não remover se estiver no início. */
function ehAnoQuatroDigitos(token) {
    return /^(19|20)\d{2}$/.test(String(token).trim());
}

/**
 * Número de ordenação/índice no início do nome (01, 026, 1…).
 * Não confundir com anos nem com códigos longos no meio do título.
 */
function ehNumeroPrefixoOrdenacao(token) {
    let t = String(token || "").trim();
    // "01." / "01)" / "01]"
    t = t.replace(/[.)\]]+$/g, "");
    if (!/^\d+$/.test(t)) return false;
    if (ehAnoQuatroDigitos(t)) return false;
    // Índices típicos de lista: 1 a 4 dígitos
    return t.length >= 1 && t.length <= 4;
}

/**
 * Opção 1: remove números sequenciais do início do título.
 * Ex.: "01 Portaria…" → "Portaria…" · "026 Contrato…" → "Contrato…"
 * Preserva anos (2025…) e números que não estão no início.
 */
function removerNumerosIniciais(tokens) {
    if (!tokens.length) return tokens;
    const out = tokens.slice();
    while (out.length > 1 && ehNumeroPrefixoOrdenacao(out[0])) {
        out.shift();
    }
    return out;
}

function normalizarNomeArquivo(nome) {
    const bruto = limparInvisiveis(nome).trim();
    const ultimoPonto = bruto.lastIndexOf(".");
    const ext = ultimoPonto >= 0 ? bruto.slice(ultimoPonto).toLowerCase() : "";
    let stem = ultimoPonto >= 0 ? bruto.slice(0, ultimoPonto).trim() : bruto;

    // Remove sufixos de lixo no final do stem inteiro
    stem = stem.replace(SUFIXO_LIXO_FINAL_RX, "").trim();
    stem = stem.replace(/^[\s_.\-–—]+|[\s_.\-–—]+$/g, "");

    let tokens = tokensDoStem(stem);

    // Remove lixo do fim e do meio
    while (tokens.length && tokenEhLixo(tokens[tokens.length - 1])) {
        tokens.pop();
    }
    tokens = tokens.filter((t) => !tokenEhLixo(t));
    tokens = removerDuplicatasConsecutivas(tokens);
    tokens = removerNumerosIniciais(tokens);

    if (!tokens.length) {
        tokens = tokensDoStem(stem);
        tokens = tokens.filter((t) => t && !TOKEN_SO_PONTUACAO_RX.test(t));
        tokens = removerNumerosIniciais(tokens);
        if (!tokens.length) tokens = [stem || "documento"];
    }

    const total = tokens.length;
    const palavras = aplicarRegrasTitulo(
        tokens.map((t, i) => capitalizarPalavra(t, i, total, tokens)),
        tokens
    );

    let titulo = palavras.join(" ");

    titulo = titulo.replace(/\s+/g, " ").trim();
    titulo = titulo.replace(/[<>:"/\\|?*]/g, "");
    // Evita espaços antes de extensão implícita / pontuação residual
    titulo = titulo.replace(/\s+([.,;:])/g, "$1").trim();

    if (!titulo) titulo = "Documento";

    // Limite defensivo de nome (Windows ~255; deixa margem para pasta + (n))
    const maxStem = 180;
    if (titulo.length > maxStem) {
        titulo = titulo.slice(0, maxStem).trim();
    }

    return titulo + ext;
}

function ignorarCaminho(rel) {
    const partes = rel.replace(/\\/g, "/").toLowerCase().split("/");
    if (partes.some((p) => p.startsWith("."))) return true;
    if (partes.includes("__macosx")) return true;
    if (partes.includes("thumbs.db")) return true;
    const nome = partes[partes.length - 1] || "";
    if (ehArquivoLixoNome(nome)) return true;
    return false;
}

/**
 * Arquivos gerados automaticamente que não devem ser processados.
 * Ex.: "Página 1.csv", "….xlsx - Página1.csv"
 */
function ehArquivoLixoNome(nome) {
    const base = String(nome || "").replace(/\\/g, "/").split("/").pop() || "";
    const ext = extensaoArquivo(base);
    const stem = base.replace(/\.[^.]+$/, "").trim();

    // Página 1 · Página1 · Página 1 (2)
    if (/^p[aá]gina\s*\d+(?:\s*\(\d+\))?$/i.test(stem)) return true;
    if (/^page\s*\d+(?:\s*\(\d+\))?$/i.test(stem)) return true;

    // Export Excel/Sheets: "arquivo.xlsx - Página1" / "… - Página 1 (1)"
    if (/\.xlsx\s*-\s*p[aá]gina\s*\d+/i.test(stem)) return true;
    if (/\s-\s*p[aá]gina\s*\d+(?:\s*\(\d+\))?$/i.test(stem)) return true;

    // Qualquer CSV cujo nome contenha "PáginaN" (dump de planilha)
    if (ext === ".csv" && /p[aá]gina\s*\d+/i.test(stem)) return true;

    return false;
}

function extensaoArquivoEntrada(nome) {
    const lower = nome.toLowerCase();
    return EXTENSOES_ARQUIVO_ENTRADA.find((ext) => lower.endsWith(ext)) || null;
}

function ehArquivoTratamento(nome) {
    return extensaoArquivoEntrada(nome) !== null;
}

function rotuloArquivosEntrada() {
    return EXTENSOES_ARQUIVO_ENTRADA.join(", ");
}

function extensaoArquivo(nome) {
    const i = nome.lastIndexOf(".");
    return i >= 0 ? nome.slice(i).toLowerCase() : "";
}

function nomeUnico(caminho, usados) {
    const norm = caminho.replace(/\\/g, "/");
    // Comparação case-insensitive (Windows / ZIP misturado)
    const chave = norm.toLowerCase();
    const chaves = usados._chaves || (usados._chaves = new Set(
        [...usados].map((c) => String(c).toLowerCase())
    ));

    if (!chaves.has(chave)) {
        usados.add(norm);
        chaves.add(chave);
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
        const candChave = cand.toLowerCase();
        if (!chaves.has(candChave)) {
            usados.add(cand);
            chaves.add(candChave);
            return cand;
        }
        n += 1;
    }
}

async function processarArquivoTratamento(file, opcoes = {}) {
    const onProgress = typeof opcoes.onProgress === "function" ? opcoes.onProgress : null;

    if (opcoes.dicionarioUrl) {
        configurarDicionarioAcentos(opcoes.dicionarioUrl);
    }
    if (opcoes.carregarDicionario !== false) {
        if (onProgress) onProgress({ atual: 0, total: 1, arquivo: "dicionário" });
        await garantirDicionarioAcentos();
    }

    const zip = await JSZip.loadAsync(file);
    const alteracoes = [];
    const usados = new Set();
    const saida = new JSZip();
    const entradas = [];
    const ignorados = [];

    zip.forEach((relativePath, zipEntry) => {
        if (zipEntry.dir) return;
        const rel = relativePath.replace(/\\/g, "/");
        if (ignorarCaminho(rel)) return;

        const nome = rel.split("/").pop() || rel;
        const ext = extensaoArquivo(nome);
        if (!EXTENSOES_PERMITIDAS.has(ext)) {
            ignorados.push(rel);
            return;
        }

        entradas.push({ rel, zipEntry, nome });
    });

    entradas.sort((a, b) => a.rel.localeCompare(b.rel, "pt-BR"));

    // Lote: pré-aquece correções dos stems antes do loop pesado de I/O
    const tokensLote = [];
    for (const { nome } of entradas) {
        const stem = nome.includes(".") ? nome.slice(0, nome.lastIndexOf(".")) : nome;
        tokensLote.push(...tokensDoStem(stem));
    }
    preaquecerCorrecoes(tokensLote);

    let i = 0;
    for (const { rel, zipEntry, nome } of entradas) {
        i += 1;
        if (onProgress) {
            onProgress({ atual: i, total: entradas.length, arquivo: nome });
        }

        const novoNome = normalizarNomeArquivo(nome);
        const pasta = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/") + 1) : "";
        const novoCaminho = nomeUnico(pasta + novoNome, usados);

        if (novoCaminho !== rel) {
            alteracoes.push([rel, novoCaminho]);
        }

        const conteudo = await zipEntry.async("uint8array");
        saida.file(novoCaminho, conteudo);
    }

    const documentos = [...usados].filter((c) => typeof c === "string").sort((a, b) =>
        a.localeCompare(b, "pt-BR")
    );
    const blob = await saida.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    return {
        alteracoes,
        documentos,
        blob,
        totalRenomeados: alteracoes.length,
        totalDocumentos: documentos.length,
        totalIgnorados: ignorados.length,
        ignorados
    };
}
