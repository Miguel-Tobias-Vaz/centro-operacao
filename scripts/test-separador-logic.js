/**
 * Testes de lógica do Separador de PDF (Node.js)
 * Executar: node scripts/test-separador-logic.js
 */

function chaveDivisao(a, b) {
    return `${a}|${b}`;
}

function calcularGruposDocumentos(paginasOrdem, divisoesEntre) {
    if (!paginasOrdem.length) return [];
    const grupos = [];
    let atual = [paginasOrdem[0]];
    for (let i = 0; i < paginasOrdem.length - 1; i += 1) {
        const esq = paginasOrdem[i].indexOriginal;
        const dir = paginasOrdem[i + 1].indexOriginal;
        if (divisoesEntre.has(chaveDivisao(esq, dir))) {
            grupos.push(atual);
            atual = [paginasOrdem[i + 1]];
        } else {
            atual.push(paginasOrdem[i + 1]);
        }
    }
    grupos.push(atual);
    return grupos;
}

function criarEstadoPaginas(total) {
    return Array.from({ length: total }, (_, i) => ({ indexOriginal: i, rotacao: 0 }));
}

function limparDivisoesOrfas(paginasOrdem, divisoesEntre) {
    const validas = new Set();
    for (let i = 0; i < paginasOrdem.length - 1; i += 1) {
        const key = chaveDivisao(paginasOrdem[i].indexOriginal, paginasOrdem[i + 1].indexOriginal);
        if (divisoesEntre.has(key)) validas.add(key);
    }
    divisoesEntre.clear();
    validas.forEach((k) => divisoesEntre.add(k));
}

function removerPaginaNaPosicao(paginasOrdem, divisoesEntre, pos) {
    const [removida] = paginasOrdem.splice(pos, 1);
    limparDivisoesOrfas(paginasOrdem, divisoesEntre);
    return removida;
}

function aplicarDivisaoEntreTodasPaginas(paginasOrdem) {
    const divisoes = new Set();
    for (let i = 0; i < paginasOrdem.length - 1; i += 1) {
        divisoes.add(chaveDivisao(paginasOrdem[i].indexOriginal, paginasOrdem[i + 1].indexOriginal));
    }
    return divisoes;
}

function girarPagina(item) {
    item.rotacao = (item.rotacao + 90) % 360;
    return item.rotacao;
}

function assert(condicao, msg) {
    if (!condicao) throw new Error(`FALHOU: ${msg}`);
}

function nums(grupo) {
    return grupo.map((p) => p.indexOriginal + 1);
}

// Teste 1: 9 páginas, dividir 1-3 | 4-6 | 7-9, remover página 5 (indexOriginal 4)
{
    const paginas = criarEstadoPaginas(9);
    const divisoes = new Set([
        chaveDivisao(2, 3),
        chaveDivisao(5, 6)
    ]);

    removerPaginaNaPosicao(paginas, divisoes, 4);

    const grupos = calcularGruposDocumentos(paginas, divisoes);
    assert(grupos.length === 3, `esperava 3 docs, obteve ${grupos.length}`);
    assert(JSON.stringify(nums(grupos[0])) === "[1,2,3]", `doc1: ${nums(grupos[0])}`);
    assert(JSON.stringify(nums(grupos[1])) === "[4,6]", `doc2: ${nums(grupos[1])}`);
    assert(JSON.stringify(nums(grupos[2])) === "[7,8,9]", `doc3: ${nums(grupos[2])}`);
    console.log("✓ Teste 1 — remover página no meio do documento");
}

// Teste 2: rotação acumula 90° até 270°
{
    const p = { indexOriginal: 1, rotacao: 0 };
    girarPagina(p);
    assert(p.rotacao === 90, "rotação 90");
    girarPagina(p);
    assert(p.rotacao === 180, "rotação 180");
    girarPagina(p);
    assert(p.rotacao === 270, "rotação 270");
    girarPagina(p);
    assert(p.rotacao === 0, "rotação volta a 0");
    console.log("✓ Teste 2 — girar página 90° incremental");
}

// Teste 3: mesclagem simulada — contagem de páginas
{
    const arquivos = [{ totalPaginas: 3 }, { totalPaginas: 5 }];
    const total = arquivos.reduce((s, a) => s + a.totalPaginas, 0);
    assert(total === 8, `esperava 8 páginas, obteve ${total}`);
    console.log("✓ Teste 3 — mesclagem contagem 3+5=8");
}

// Teste 4: lazy — estrutura de 150 páginas sem erro
{
    const paginas = criarEstadoPaginas(150);
    assert(paginas.length === 150, "150 páginas criadas");
    assert(paginas[149].indexOriginal === 149, "última página índice 149");
    console.log("✓ Teste 4 — estrutura 150 páginas OK");
}

console.log("\nTodos os testes passaram.");
