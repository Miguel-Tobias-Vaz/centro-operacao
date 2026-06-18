const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
    console.error("Defina SUPABASE_URL e SUPABASE_ANON_KEY nas variáveis de ambiente da Vercel.");
    process.exit(1);
}

const conteudo = `// Gerado automaticamente no deploy
window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`;

fs.writeFileSync(path.join(__dirname, "..", "config.js"), conteudo, "utf8");
console.log("config.js gerado com sucesso.");
