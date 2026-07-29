#!/usr/bin/env node
/**
 * GIF deve animar via GifVivo (canvas) mesmo com CSS que congela <img> no Chromium.
 */
import { createServer } from "http";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { extname, join, normalize, resolve } from "path";
import { fileURLToPath } from "url";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(__dirname, "..");
const FIXTURE = "/scripts/fixtures/gif-animacao.html";
const OUT = join(root, "scripts/fixtures/_gif-shots");

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".gif": "image/gif",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".woff2": "font/woff2"
};

function startServer() {
    return new Promise((resolveServer) => {
        const server = createServer((req, res) => {
            let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
            if (urlPath === "/") urlPath = FIXTURE;
            const fp = normalize(join(root, urlPath.replace(/^\/+/, "")));
            if (!fp.startsWith(root) || !existsSync(fp)) {
                res.writeHead(404);
                res.end("not found");
                return;
            }
            const type = TYPES[extname(fp).toLowerCase()] || "application/octet-stream";
            res.writeHead(200, { "Content-Type": type, "Cache-Control": "no-store" });
            res.end(readFileSync(fp));
        });
        server.listen(0, "127.0.0.1", () => {
            resolveServer({ server, port: server.address().port });
        });
    });
}

function diffPng(aBuf, bBuf) {
    const a = PNG.sync.read(aBuf);
    const b = PNG.sync.read(bBuf);
    if (a.width !== b.width || a.height !== b.height) return Infinity;
    let diff = 0;
    const n = a.width * a.height;
    for (let i = 0; i < n; i++) {
        const o = i * 4;
        const d =
            Math.abs(a.data[o] - b.data[o]) +
            Math.abs(a.data[o + 1] - b.data[o + 1]) +
            Math.abs(a.data[o + 2] - b.data[o + 2]);
        if (d > 40) diff += 1;
    }
    return diff;
}

async function shots(page, selector, times = 6, gapMs = 120) {
    const el = page.locator(selector).first();
    await el.waitFor({ state: "visible", timeout: 10000 });
    const list = [];
    for (let i = 0; i < times; i++) {
        list.push(await el.screenshot({ type: "png", animations: "allow" }));
        if (i < times - 1) await page.waitForTimeout(gapMs);
    }
    return list;
}

function maxPairDiff(buffers) {
    let max = 0;
    for (let i = 0; i < buffers.length; i++) {
        for (let j = i + 1; j < buffers.length; j++) {
            max = Math.max(max, diffPng(buffers[i], buffers[j]));
        }
    }
    return max;
}

const CENAS = [
    { id: "card", sel: "#card-gif .card-modulo-grid-media", canvasNear: "#capa-gif" },
    { id: "avatar", sel: "#avatar-box", canvasNear: "#avatar-gif" },
    { id: "header", sel: ".hub-topbar .usuario-avatar-btn", canvasNear: ".auth-avatar-img" }
];

async function main() {
    mkdirSync(OUT, { recursive: true });
    const { server, port } = await startServer();
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}${FIXTURE}`, { waitUntil: "load" });
    await page.waitForSelector("canvas.gif-vivo-canvas", { timeout: 10000 });
    await page.waitForTimeout(400);

    let falhas = 0;

    for (const cena of CENAS) {
        const temCanvas = await page.locator(`${cena.canvasNear} + canvas.gif-vivo-canvas`).count();
        if (temCanvas < 1) {
            console.log(`FALHOU  ${cena.id.padEnd(10)} sem canvas GifVivo`);
            falhas += 1;
            continue;
        }
        const buffers = await shots(page, cena.sel);
        writeFileSync(join(OUT, `${cena.id}-0.png`), buffers[0]);
        writeFileSync(join(OUT, `${cena.id}-last.png`), buffers[buffers.length - 1]);
        const diff = maxPairDiff(buffers);
        const ok = diff >= 20;
        if (!ok) falhas += 1;
        console.log(`${(ok ? "OK" : "FALHOU").padEnd(7)} ${cena.id.padEnd(10)} canvas=1 diff=${diff}`);
    }

    // Otimizador
    await page.addScriptTag({ path: join(root, "assets/js/imagem-otimizar.js") });
    const ot = await page.evaluate(async () => {
        const res = await fetch("/scripts/fixtures/anim-teste.gif");
        const blob = await res.blob();
        const file = new File([blob], "anim-teste.gif", { type: "image/gif" });
        const out = await window.ImagemOtimizar.otimizar(file, window.ImagemOtimizar.PRESETS.modulo);
        return out.file.type === "image/gif" && out.otimizado === false;
    });
    console.log(`${(ot ? "OK" : "FALHOU").padEnd(7)} otimizar`);
    if (!ot) falhas += 1;

    await browser.close();
    server.close();
    if (falhas) {
        console.error(`\n${falhas} falha(s).`);
        process.exit(1);
    }
    console.log("\nTodas as verificações passaram.");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
