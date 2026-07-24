#!/usr/bin/env node
/**
 * Servidor estático local (substitui python -m http.server quando o
 * Python da Microsoft Store é só um stub).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 5500);
const HOST = process.env.HOST || "127.0.0.1";
const root = path.resolve(__dirname, "..");

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".gz": "application/gzip",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".map": "application/json",
    ".txt": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
    try {
        let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
        if (urlPath === "/") urlPath = "/index.html";

        const fp = path.normalize(path.join(root, urlPath.replace(/^\/+/, "")));
        if (!fp.startsWith(root)) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }

        if (!fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
            res.writeHead(404);
            res.end("Not found");
            return;
        }

        const ext = path.extname(fp).toLowerCase();
        res.writeHead(200, {
            "Content-Type": TYPES[ext] || "application/octet-stream",
            "Cache-Control": "no-store"
        });
        fs.createReadStream(fp).pipe(res);
    } catch (erro) {
        res.writeHead(500);
        res.end(String(erro));
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Serving http://${HOST}:${PORT}/`);
});
