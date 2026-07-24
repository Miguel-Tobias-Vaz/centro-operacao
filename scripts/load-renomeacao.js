/**
 * Carrega dados.js + motor.js (scripts de browser) num contexto Node.
 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

function carregarRenomeacao(opcoes = {}) {
    const dir = path.join(__dirname, "..", "assets", "js", "renomeacao");
    const sandbox = {
        console,
        Map,
        Set,
        Promise,
        Object,
        Array,
        String,
        Number,
        Boolean,
        RegExp,
        JSON,
        Math,
        Date,
        Error,
        parseInt,
        parseFloat,
        isNaN,
        undefined,
        fetch: async () => ({ ok: false, status: 404 }),
        Blob: undefined,
        DecompressionStream: undefined
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;

    vm.createContext(sandbox);

    for (const ficheiro of ["dados.js", "motor.js"]) {
        const codigo = fs.readFileSync(path.join(dir, ficheiro), "utf8");
        vm.runInContext(codigo, sandbox, { filename: ficheiro });
    }

    if (opcoes.dicionarioUrl) {
        sandbox.configurarDicionarioAcentos?.(opcoes.dicionarioUrl);
    }

    return {
        normalizarNomeArquivo: sandbox.normalizarNomeArquivo,
        normalizarCaminho: sandbox.normalizarCaminho,
        normalizarTextoLivre: sandbox.normalizarTextoLivre,
        gerarCsvAlteracoes: sandbox.gerarCsvAlteracoes,
        tokensDoStem: sandbox.tokensDoStem,
        garantirDicionarioAcentos: sandbox.garantirDicionarioAcentos
    };
}

module.exports = { carregarRenomeacao };
