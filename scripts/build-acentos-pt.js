/**
 * Gera assets/data/acentos-pt.json
 * Mapa foldAscii(palavra) → forma com acento (apenas entradas unívocas).
 *
 * Fonte: dictionary-pt (mesma base do @cspell/dict-pt-br / hunspell).
 */
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.join(__dirname, "..");
const dicPath = path.join(root, "node_modules", "dictionary-pt", "index.dic");
const outJson = path.join(root, "assets", "data", "acentos-pt.json");
const outGz = path.join(root, "assets", "data", "acentos-pt.json.gz");

function foldAscii(s) {
    return String(s)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

function temAcento(s) {
    return s !== foldAscii(s) || /[àáâãäéêíóôõöúüçñ]/i.test(s);
}

function palavraValida(raw) {
    if (!raw) return null;
    // Remove flags hunspell: palavra/ABC
    let w = raw.split("/")[0].trim();
    if (!w) return null;
    // Ignora entradas com números, pontuação estranha, hífen composto longo
    if (/[0-9.']/.test(w)) return null;
    if (w.includes("-")) return null;
    if (w.length < 4 || w.length > 28) return null;
    if (!temAcento(w)) return null;
    // Só letras (com acento)
    if (!/^[A-Za-zÀ-ÿ]+$/.test(w)) return null;
    return w.toLowerCase();
}

function main() {
    if (!fs.existsSync(dicPath)) {
        console.error("dictionary-pt não encontrado. Rode: npm install -D dictionary-pt");
        process.exit(1);
    }

    const texto = fs.readFileSync(dicPath, "utf8");
    const linhas = texto.split(/\r?\n/);
    // primeira linha = contagem
    const candidatos = new Map(); // fold -> Set(formas)

    for (let i = 1; i < linhas.length; i += 1) {
        const w = palavraValida(linhas[i]);
        if (!w) continue;
        const key = foldAscii(w);
        if (key === w) continue; // sem acento restante
        if (!candidatos.has(key)) candidatos.set(key, new Set());
        candidatos.get(key).add(w);
    }

    const unicos = {};
    let ambiguos = 0;
    for (const [key, set] of candidatos) {
        if (set.size === 1) {
            unicos[key] = [...set][0];
        } else {
            ambiguos += 1;
            // Preferir a forma com mais diacríticos se houver empate “óbvio”
            // Ainda assim, se houver >1, pular (segurança)
        }
    }

    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    const json = JSON.stringify(unicos);
    fs.writeFileSync(outJson, json, "utf8");
    fs.writeFileSync(outGz, zlib.gzipSync(Buffer.from(json, "utf8"), { level: 9 }));

    console.log("Entradas únicas:", Object.keys(unicos).length);
    console.log("Folds ambíguos ignorados:", ambiguos);
    console.log("JSON:", (json.length / 1024).toFixed(1), "KB");
    console.log("GZ:  ", (fs.statSync(outGz).size / 1024).toFixed(1), "KB");
    console.log("→", outJson);
    console.log("→", outGz);
}

main();
