/**
 * Testes da normalização de nomes (tratamento-nomes.js).
 * Executar: node scripts/test-tratamento-nomes.js
 */
const {
    normalizarNomeArquivo,
    normalizarCaminho,
    gerarCsvAlteracoes
} = require("../assets/js/tratamento-nomes.js");

let falhas = 0;

function assertEq(entrada, esperado, rotulo) {
    const obtido = normalizarNomeArquivo(entrada);
    if (obtido !== esperado) {
        falhas += 1;
        console.error(`✗ ${rotulo || entrada}`);
        console.error(`  esperado: ${esperado}`);
        console.error(`  obtido:   ${obtido}`);
        return;
    }
    console.log(`✓ ${rotulo || entrada} → ${obtido}`);
}

function assertPath(entrada, esperado) {
    const obtido = normalizarCaminho(entrada);
    if (obtido !== esperado) {
        falhas += 1;
        console.error(`✗ caminho ${entrada}`);
        console.error(`  esperado: ${esperado}`);
        console.error(`  obtido:   ${obtido}`);
        return;
    }
    console.log(`✓ ${entrada} → ${obtido}`);
}

console.log("\n— Exemplos da tela —");
assertEq("ATA_DE_REGISTRO_DE_PRECO.pdf", "Ata de Registro de Preço.pdf");
assertEq("edital-licitacao-001_ass.pdf", "Edital de Licitação 001.pdf");
assertEq("termo_referencia---assinado.pdf", "Termo de Referência.pdf");

console.log("\n— Remoção de lixo —");
assertEq("contrato_assinado.pdf", "Contrato.pdf");
assertEq("ata_digitalmente_assinada.pdf", "Ata.pdf");
assertEq("edital_a.s.s.pdf", "Edital.pdf");
assertEq("portaria_scan.pdf", "Portaria.pdf");
assertEq("despacho_copia.pdf", "Despacho.pdf");
assertEq("relatorio_final.pdf", "Relatório.pdf");
assertEq("minuta (1).pdf", "Minuta.pdf");
assertEq("proposta_copia_2.pdf", "Proposta.pdf");

console.log("\n— Artigos e preposições —");
assertEq("ATA_DE_PRECO.pdf", "Ata de Preço.pdf");
assertEq("termo_de_referencia.pdf", "Termo de Referência.pdf");
assertEq("registro_de_precos.pdf", "Registro de Preços.pdf");

console.log("\n— Dicionário ampliado —");
assertEq("AVERBACAO_CONTRATO.pdf", "Averbação Contrato.pdf");
assertEq("empenho_orcamentario.pdf", "Empenho Orçamentário.pdf");
assertEq("PORTARIA_HOMOLOGACAO.pdf", "Portaria Homologação.pdf");
assertEq("aditivo_contratacao.pdf", "Aditivo Contratação.pdf");
assertEq("convenio_municipio.pdf", "Convênio Município.pdf");

console.log("\n— Números e nº —");
assertEq("PORTARIA_N_123.pdf", "Portaria nº 123.pdf");
assertEq("portaria_nr_45.pdf", "Portaria nº 45.pdf");
assertEq("despacho_nº_10.pdf", "Despacho nº 10.pdf");
assertEq("SEI_123456.pdf", "SEI 123456.pdf");

console.log("\n— CamelCase —");
assertEq("AtaDePreco.pdf", "Ata de Preço.pdf");
assertEq("TermoDeReferencia.pdf", "Termo de Referência.pdf");

console.log("\n— ALLCAPS colado —");
assertEq("ATADEPRECO.pdf", "Ata de Preço.pdf");
assertEq("TERMODEREFERENCIA.pdf", "Termo de Referência.pdf");

console.log("\n— Extensão e sanitização —");
assertEq("Edital<>Licitacao.pdf", "Edital de Licitação.pdf");
assertEq("DOCUMENTO.PDF", "Documento.pdf");

console.log("\n— Pastas —");
assertPath("DOCUMENTOS_ASSINADOS/edital_ass.pdf", "Documentos/Edital.pdf");
assertPath("ATA_2024/termo_referencia.pdf", "Ata 2024/Termo de Referência.pdf");

(async () => {
    console.log("\n— CSV —");
    const blob = gerarCsvAlteracoes([
        ["a_ass.pdf", "A.pdf"],
        ["pasta/b.pdf", "Pasta/B.pdf"]
    ]);
    const csv = await blob.text();
    if (!csv.includes("nome_antigo;nome_novo") || !csv.includes("A.pdf") || !csv.includes("Pasta/B.pdf")) {
        falhas += 1;
        console.error("✗ CSV inválido", csv);
    } else {
        console.log("✓ relatório CSV");
    }

    // caminho sem renomear arquivo
    const preservado = normalizarCaminho("DOCS_ASSINADOS/readme.txt", { renomearArquivo: false });
    if (preservado !== "Docs/readme.txt") {
        falhas += 1;
        console.error("✗ preservar nome de arquivo extra", preservado);
    } else {
        console.log("✓ preservar arquivo extra com pasta normalizada →", preservado);
    }

    if (falhas) {
        console.error(`\n${falhas} teste(s) falharam.`);
        process.exit(1);
    }

    console.log("\nTodos os testes passaram.");
})();
