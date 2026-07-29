/**
 * Otimização de imagens no cliente: redimensiona e converte para WebP
 * (qualidade alta, ficheiro mais leve). GIFs são sempre preservados.
 */
(() => {
    const PRESETS = {
        avatar: { maxLado: 640, qualidade: 0.92, maxBytes: 450 * 1024, rotulo: "avatar" },
        modulo: { maxLado: 960, qualidade: 0.9, maxBytes: 550 * 1024, rotulo: "módulo" },
        fundo: { maxLado: 1920, qualidade: 0.88, maxBytes: 900 * 1024, rotulo: "fundo" }
    };

    const LIMITE_GIF = 8 * 1024 * 1024;
    const LIMITE_UPLOAD = 3 * 1024 * 1024;

    const EXT_MIME = {
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        webp: "image/webp",
        gif: "image/gif"
    };

    function extensaoDe(nome) {
        return (String(nome || "").split(".").pop() || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    }

    function mimeDe(file) {
        if (file?.type && file.type.startsWith("image/")) return file.type;
        return EXT_MIME[extensaoDe(file?.name)] || "";
    }

    function ehGif(file) {
        const mime = mimeDe(file);
        return mime === "image/gif" || extensaoDe(file?.name) === "gif";
    }

    function comMimeCorreto(file) {
        const mime = mimeDe(file);
        if (!mime || file.type === mime) return file;
        return new File([file], file.name, { type: mime, lastModified: file.lastModified || Date.now() });
    }

    function suporteWebp() {
        try {
            const c = document.createElement("canvas");
            c.width = 1;
            c.height = 1;
            return c.toDataURL("image/webp").startsWith("data:image/webp");
        } catch {
            return false;
        }
    }

    function carregarImagem(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error("Não foi possível ler a imagem."));
            };
            img.src = url;
        });
    }

    function dimensoesAlvo(largura, altura, maxLado) {
        const maior = Math.max(largura, altura);
        if (maior <= maxLado) return { w: largura, h: altura };
        const escala = maxLado / maior;
        return {
            w: Math.max(1, Math.round(largura * escala)),
            h: Math.max(1, Math.round(altura * escala))
        };
    }

    function canvasParaBlob(canvas, tipo, qualidade) {
        return new Promise((resolve) => {
            canvas.toBlob((blob) => resolve(blob), tipo, qualidade);
        });
    }

    async function codificarCanvas(canvas, qualidadeAlvo, maxBytes) {
        const usaWebp = suporteWebp();
        const tipo = usaWebp ? "image/webp" : "image/jpeg";
        const ext = usaWebp ? "webp" : "jpg";
        let q = qualidadeAlvo;
        let blob = await canvasParaBlob(canvas, tipo, q);

        while (blob && blob.size > maxBytes && q > 0.62) {
            q = Math.round((q - 0.06) * 100) / 100;
            blob = await canvasParaBlob(canvas, tipo, q);
        }

        if (!blob) throw new Error("Falha ao comprimir a imagem.");
        return { blob, tipo, ext, qualidade: q };
    }

    function nomeBase(nome) {
        return String(nome || "imagem").replace(/\.[^.]+$/, "") || "imagem";
    }

    /**
     * @param {File} file
     * @param {{ maxLado: number, qualidade: number, maxBytes: number, rotulo?: string }} opts
     * @returns {Promise<{ file: File, otimizado: boolean, aviso?: string }>}
     */
    async function otimizar(file, opts) {
        if (!file) throw new Error("Selecione um ficheiro de imagem.");

        const mime = mimeDe(file);
        if (!mime) {
            throw new Error("Formato não suportado. Usa PNG, JPG, WebP ou GIF.");
        }

        // GIF: nunca passar pelo canvas (perde animação / pode falhar no Windows sem MIME)
        if (ehGif(file)) {
            if (file.size > LIMITE_GIF) {
                throw new Error(
                    "GIF demasiado grande (máx. 8 MB). Usa um GIF mais curto/leve."
                );
            }
            return {
                file: comMimeCorreto(file),
                otimizado: false,
                aviso: "GIF mantido sem recompressão."
            };
        }

        if (file.size > LIMITE_UPLOAD) {
            throw new Error("A imagem deve ter no máximo 3 MB.");
        }

        const cfg = {
            maxLado: opts?.maxLado || 960,
            qualidade: opts?.qualidade ?? 0.9,
            maxBytes: opts?.maxBytes || 550 * 1024
        };

        const ficheiro = comMimeCorreto(file);
        const img = await carregarImagem(ficheiro);
        const { w, h } = dimensoesAlvo(img.naturalWidth || img.width, img.naturalHeight || img.height, cfg.maxLado);
        const precisaResize = w < (img.naturalWidth || img.width) || h < (img.naturalHeight || img.height);
        const jaLeve = ficheiro.size <= cfg.maxBytes && /image\/(webp|jpeg)/i.test(mime);

        if (!precisaResize && jaLeve) {
            return { file: ficheiro, otimizado: false };
        }

        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) throw new Error("Canvas indisponível neste browser.");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, w, h);

        const { blob, tipo, ext, qualidade } = await codificarCanvas(canvas, cfg.qualidade, cfg.maxBytes);

        if (!precisaResize && ficheiro.size <= blob.size && ficheiro.size <= cfg.maxBytes * 1.15) {
            return { file: ficheiro, otimizado: false };
        }

        const otimizado = new File([blob], `${nomeBase(ficheiro.name)}.${ext}`, {
            type: tipo,
            lastModified: Date.now()
        });

        return {
            file: otimizado,
            otimizado: true,
            aviso: `Otimizada para ${ext.toUpperCase()} (q≈${qualidade}) · ${(otimizado.size / 1024).toFixed(0)} KB`
        };
    }

    window.ImagemOtimizar = {
        PRESETS,
        LIMITE_UPLOAD,
        LIMITE_GIF,
        LIMITE_GIF_ANIMADO: LIMITE_GIF,
        otimizar,
        mimeDe,
        ehGif,
        suporteWebp
    };
})();
