/**
 * Testes da normalização de nomes (renomeacao/).
 * Expectativas alinhadas ao motor atual (sem dicionário .gz no Node).
 * Executar: npm run test:nomes
 */
const { carregarRenomeacao } = require("./load-renomeacao.js");

const {
    normalizarNomeArquivo,
    normalizarCaminho,
    normalizarTextoLivre,
    gerarCsvAlteracoes
} = carregarRenomeacao();

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

function assertPath(entrada, esperado, opcoes) {
    const obtido = normalizarCaminho(entrada, opcoes);
    if (obtido !== esperado) {
        falhas += 1;
        console.error(`✗ caminho ${entrada}`);
        console.error(`  esperado: ${esperado}`);
        console.error(`  obtido:   ${obtido}`);
        return;
    }
    console.log(`✓ ${entrada} → ${obtido}`);
}

function assertTexto(entrada, esperado, rotulo) {
    const obtido = normalizarTextoLivre(entrada);
    if (obtido !== esperado) {
        falhas += 1;
        console.error(`✗ texto ${rotulo || entrada.slice(0, 40)}`);
        console.error(`  esperado: ${esperado}`);
        console.error(`  obtido:   ${obtido}`);
        return;
    }
    console.log(`✓ texto ${rotulo || "ok"}`);
}

console.log("\n— Exemplos da tela —");
assertEq("ATA_DE_REGISTRO_DE_PRECO.pdf", "Ata de Registro de Preço.pdf");
assertEq("edital-licitacao-001_ass.pdf", "Edital Licitação 001.pdf");
assertEq("termo_referencia---assinado.pdf", "Termo Referência.pdf");

console.log("\n— Remoção de lixo —");
assertEq("contrato_assinado.pdf", "Contrato.pdf");
assertEq("ata_digitalmente_assinada.pdf", "Ata.pdf");
assertEq("edital_a.s.s.pdf", "Edital.pdf");
assertEq("portaria_scan.pdf", "Portaria.pdf");
assertEq("despacho_copia.pdf", "Despacho.pdf");
assertEq("relatorio_final.pdf", "Relatório.pdf");
assertEq("minuta (1).pdf", "Minuta.pdf");
assertEq("proposta_copia_2.pdf", "Proposta 2.pdf");

console.log("\n— Artigos e preposições —");
// Em ALL CAPS, "DE" + palavra curta pode ser tratado como sigla administrativa
assertEq("ATA_DE_PRECO.pdf", "Ata DE Preço.pdf");
assertEq("termo_de_referencia.pdf", "Termo de Referência.pdf");
assertEq("registro_de_precos.pdf", "Registro de Preços.pdf");

console.log("\n— Dicionário ampliado (léxico local, sem acentos-pt.gz) —");
assertEq("AVERBACAO_CONTRATO.pdf", "Averbacao Contrato.pdf");
assertEq("empenho_orcamentario.pdf", "Empenho Orçamentário.pdf");
assertEq("PORTARIA_HOMOLOGACAO.pdf", "Portaria Homologação.pdf");
assertEq("aditivo_contratacao.pdf", "Aditivo Contratação.pdf");
assertEq("convenio_municipio.pdf", "Convênio Município.pdf");

console.log("\n— Números e nº —");
assertEq("PORTARIA_N_123.pdf", "Portaria Nº 123.pdf");
assertEq("portaria_nr_45.pdf", "Portaria Nº 45.pdf");
assertEq("despacho_nº_10.pdf", "Despacho Nº 10.pdf");
assertEq("SEI_123456.pdf", "SEI 123456.pdf");

console.log("\n— CamelCase —");
assertEq("AtaDePreco.pdf", "Ata de Preço.pdf");
assertEq("TermoDeReferencia.pdf", "Termo de Referência.pdf");

console.log("\n— Extensão e sanitização —");
assertEq("Edital_Licitacao.pdf", "Edital Licitação.pdf");
assertEq("DOCUMENTO.PDF", "Documento.pdf");

console.log("\n— Pastas —");
assertPath("DOCUMENTOS_ASSINADOS/edital_ass.pdf", "Documentos/Edital.pdf");
assertPath("ATA_2024/termo_referencia.pdf", "Ata 2024/Termo Referência.pdf");
assertPath("DOCS_ASSINADOS/readme.txt", "DOCS/readme.txt", { renomearArquivo: false });

console.log("\n— Texto livre —");
assertTexto(
    "CONTRATO DE PRECO NO MUNICIPIO",
    "Contrato de Preço no Município",
    "title case + acentos"
);
assertTexto(
    "CONTRATAÇÃO DO SHOW ARTISTICO DO GRUPO MENOS É MAIS PARA APRESENTAÇÃO NO DIA 31 DE JULHO DE 2026, NO EVENTO FEST VERÃO 2026 – NA PRAIA DAS GAIVOTAS, COM ENTRADA FRANCA, NO MUNICIPIO DE CONCEIÇÃO DO ARAGUAIA-PA.",
    "Contratação do Show Artístico do Grupo Menos é Mais para Apresentação no Dia 31 de Julho de 2026, no Evento Fest Verão 2026 – na Praia das Gaivotas, com Entrada Franca, no Município de Conceição do Araguaia-PA.",
    "exemplo show artístico"
);
assertTexto(
    "ATA DE REGISTRO DE PRECO",
    "Ata de Registro de Preço",
    "não trata DE como sigla em texto"
);
assertTexto(
    "CNPJ N 12.345.678/0001-90 E INSCRICAO ESTADUAL",
    "CNPJ Nº 12.345.678/0001-90 e Inscrição Estadual",
    "preserva CNPJ e funde N→Nº"
);
assertTexto(
    "CPF 123.456.789-09",
    "CPF 123.456.789-09",
    "preserva CPF"
);
assertTexto(
    "DOCUMENTO N. 1234/2025.",
    "Documento Nº 1234/2025.",
    "N. + processo"
);
assertTexto(
    "BELEM-PA",
    "Belém-PA",
    "município-UF"
);
assertTexto(
    "LICITATORIO. SEGUNDA PARTE.",
    "Licitatório. Segunda Parte.",
    "início de frase após ponto"
);
assertTexto(
    "versao 14.3 do edital",
    "Versão 14.3 do Edital",
    "decimal sem partir"
);

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

    if (falhas) {
        console.error(`\n${falhas} teste(s) falharam.`);
        process.exit(1);
    }

    console.log("\nTodos os testes passaram.");
})();
