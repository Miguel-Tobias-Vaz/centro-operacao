function criarEstadoPaginas(total) {
    return Array.from({ length: total }, (_, indexOriginal) => ({
        indexOriginal,
        rotacao: 0
    }));
}

function obterPaginaPorPosicao(paginasOrdem, pos) {
    return paginasOrdem[pos] || null;
}

function obterRotacaoPagina(paginasOrdem, indexOriginal) {
    const item = paginasOrdem.find((p) => p.indexOriginal === indexOriginal);
    return item?.rotacao ?? 0;
}

function girarPagina(item) {
    if (!item) return 0;
    item.rotacao = (item.rotacao + 90) % 360;
    return item.rotacao;
}

function limparDivisoesOrfas(paginasOrdem, divisoesEntre) {
    const validas = new Set();

    for (let i = 0; i < paginasOrdem.length - 1; i += 1) {
        const key = chaveDivisao(
            paginasOrdem[i].indexOriginal,
            paginasOrdem[i + 1].indexOriginal
        );
        if (divisoesEntre.has(key)) validas.add(key);
    }

    divisoesEntre.clear();
    validas.forEach((k) => divisoesEntre.add(k));
}

function removerPaginaNaPosicao(paginasOrdem, divisoesEntre, pos) {
    if (pos < 0 || pos >= paginasOrdem.length) return null;

    const [removida] = paginasOrdem.splice(pos, 1);
    limparDivisoesOrfas(paginasOrdem, divisoesEntre);
    return removida;
}

function confirmarRemocaoPagina(item) {
    const num = item.indexOriginal + 1;
    return confirm(
        `Remover a página ${num} do PDF?\n\nEla não será exportada nos documentos finais.`
    );
}

function reordenarPaginaNaLista(paginasOrdem, dePos, paraPos) {
    if (dePos === paraPos || dePos < 0 || paraPos < 0) return false;
    if (dePos >= paginasOrdem.length || paraPos >= paginasOrdem.length) return false;

    const [item] = paginasOrdem.splice(dePos, 1);
    paginasOrdem.splice(paraPos, 0, item);
    return true;
}

function indicesAtivos(paginasOrdem) {
    return paginasOrdem.map((p) => p.indexOriginal);
}
