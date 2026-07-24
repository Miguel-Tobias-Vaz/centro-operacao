const botaoTema = document.getElementById("tema");
const loading = document.getElementById("loading");
const sidebar = document.getElementById("admin-sidebar");
const backdrop = document.getElementById("admin-sidebar-backdrop");

const TITULOS = {
    dashboard: ["Dashboard", "Resumo da operação e atividade recente"],
    usuarios: ["Utilizadores", "Crie contas, permissões e controle de acesso"],
    atividade: ["Atividade", "Quem fez o quê — filtre por data, utilizador e tipo"],
    config: ["Configuração", "Supabase e variáveis do projeto"]
};

let client = null;
let painelAtual = "dashboard";

function mostrarLoading(ativo) {
    if (loading) loading.hidden = !ativo;
}

function configValida() {
    return (
        window.SUPABASE_URL &&
        window.SUPABASE_ANON_KEY &&
        !String(window.SUPABASE_URL).includes("SEU_PROJETO") &&
        window.SUPABASE_ANON_KEY !== "sua-chave-anon-aqui"
    );
}

function mascararChave(chave) {
    const s = String(chave || "");
    if (!s || s === "sua-chave-anon-aqui") return "não configurada";
    if (s.length < 16) return "••••••••";
    return `${s.slice(0, 8)}…${s.slice(-6)} (${s.length} chars)`;
}

function atualizarIcones() {
    if (window.lucide?.createIcons) window.lucide.createIcons();
}

function atualizarTemaBotao() {
    const claro = document.body.classList.contains("tema-claro");
    const icone = document.getElementById("tema-icone");
    if (icone) {
        icone.setAttribute("data-lucide", claro ? "moon" : "sun");
        atualizarIcones();
    }
}

function abrirSidebarMobile(aberto) {
    if (!sidebar) return;
    sidebar.classList.toggle("is-mobile-open", aberto);
    if (backdrop) backdrop.hidden = !aberto;
}

function setSidebarOpen(open) {
    if (!sidebar) return;
    sidebar.dataset.open = open ? "true" : "false";
    const label = sidebar.querySelector(".admin-sidebar-toggle span");
    if (label) label.textContent = open ? "Recolher" : "Expandir";
    const chevron = sidebar.querySelector(".admin-sidebar-toggle i");
    if (chevron) chevron.style.transform = open ? "rotate(180deg)" : "";
}

function mostrarPainel(id) {
    painelAtual = id;
    document.querySelectorAll(".admin-painel").forEach((el) => {
        const ativo = el.id === `painel-${id}`;
        el.hidden = !ativo;
        el.classList.toggle("is-visible", ativo);
    });

    document.querySelectorAll(".admin-nav-item[data-painel]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.painel === id);
    });

    const [titulo, sub] = TITULOS[id] || ["Admin", ""];
    const h1 = document.getElementById("admin-titulo-pagina");
    const p = document.getElementById("admin-subtitulo-pagina");
    if (h1) h1.textContent = titulo;
    if (p) p.textContent = sub;

    abrirSidebarMobile(false);

    if (id === "atividade") atualizarLogs();
    if (id === "config") atualizarPainelConfig();
    if (id === "dashboard") atualizarDashboard();
    if (id === "usuarios") window.Auth?.renderizarListaUsuarios?.("lista-usuarios");
}

function lerFiltrosLogs() {
    return {
        q: document.getElementById("filtro-log-q")?.value || "",
        usuario: document.getElementById("filtro-log-usuario")?.value || "",
        entidade: document.getElementById("filtro-log-entidade")?.value || "",
        de: document.getElementById("filtro-log-de")?.value || "",
        ate: document.getElementById("filtro-log-ate")?.value || ""
    };
}

async function atualizarLogs() {
    const filtros = lerFiltrosLogs();
    const entradas = await window.LogsAtividade?.renderizar("lista-logs", {
        limite: 200,
        filtros,
        relativo: false
    });

    const resumo = document.getElementById("logs-resumo-filtro");
    if (resumo) {
        const n = entradas?.length || 0;
        const ativos = Object.values(filtros).some((v) => String(v).trim());
        resumo.textContent = ativos
            ? `${n} evento(s) com os filtros atuais.`
            : `${n} evento(s) mais recentes.`;
    }

    const badge = document.getElementById("badge-logs");
    if (badge && entradas) {
        badge.textContent = String(Math.min(entradas.length, 99));
        badge.hidden = entradas.length === 0;
    }

    await preencherAutoresDatalist();
}

async function preencherAutoresDatalist() {
    const list = document.getElementById("lista-autores-log");
    if (!list || !window.LogsAtividade) return;
    const todos = await window.LogsAtividade.listar(300);
    const autores = window.LogsAtividade.listarUsuariosUnicos(todos);
    list.innerHTML = autores
        .map((a) => `<option value="${a.email || a.nome}"></option>`)
        .join("");
}

async function contarTabela(nome) {
    if (!client) return null;
    try {
        const { count, error } = await client
            .from(nome)
            .select("id", { count: "exact", head: true });
        if (error) throw error;
        return count ?? 0;
    } catch (erro) {
        console.warn(`Contagem ${nome}:`, erro);
        return null;
    }
}

async function atualizarDashboard() {
    let usuarios = [];
    try {
        usuarios = (await window.Auth?.listarUsuarios?.()) || [];
    } catch (erro) {
        console.warn("Não foi possível listar utilizadores:", erro);
    }

    const [modulos, publicacoes, logs] = await Promise.all([
        contarTabela("modulos"),
        contarTabela("publicacoes"),
        window.LogsAtividade?.listar(300) || Promise.resolve([])
    ]);

    if (!Array.isArray(usuarios)) usuarios = [];
    const ativos = usuarios.filter((u) => u.ativo !== false).length;

    const elU = document.getElementById("stat-usuarios");
    const elUx = document.getElementById("stat-usuarios-extra");
    const elM = document.getElementById("stat-modulos");
    const elP = document.getElementById("stat-publicacoes");
    const elL = document.getElementById("stat-logs-24h");
    const elLt = document.getElementById("stat-logs-total");

    if (elU) elU.textContent = String(usuarios.length || "—");
    if (elUx) elUx.textContent = usuarios.length ? `${ativos} ativos · ${usuarios.length} total` : "sem dados";
    if (elM) elM.textContent = modulos == null ? "—" : String(modulos);
    if (elP) elP.textContent = publicacoes == null ? "—" : String(publicacoes);

    const stats = window.LogsAtividade?.estatisticas(logs || []) || {
        ultimas24h: 0,
        total: 0,
        topUsuarios: [],
        porEntidade: {},
        recentes: []
    };

    if (elL) elL.textContent = String(stats.ultimas24h);
    if (elLt) elLt.textContent = `${stats.total} eventos no histórico carregado`;

    const badgeU = document.getElementById("badge-usuarios");
    if (badgeU) {
        badgeU.textContent = String(usuarios.length);
        badgeU.hidden = !usuarios.length;
    }

    const dashAtiv = document.getElementById("dashboard-atividade");
    if (dashAtiv) {
        if (!stats.recentes.length) {
            dashAtiv.innerHTML = `<p class="lista-vazia">Ainda sem atividade registada. Crie um módulo ou publicação no hub.</p>`;
        } else {
            dashAtiv.innerHTML = stats.recentes
                .map((item) => window.LogsAtividade.montarItemHtml(item, { relativo: true }))
                .join("");
        }
    }

    const rank = document.getElementById("dashboard-top-usuarios");
    if (rank) {
        if (!stats.topUsuarios.length) {
            rank.innerHTML = `<p class="lista-vazia">Sem dados.</p>`;
        } else {
            const max = stats.topUsuarios[0].total || 1;
            rank.innerHTML = stats.topUsuarios
                .map(
                    (u) => `
                <div class="admin-rank-item">
                    <div class="admin-rank-meta">
                        <span class="admin-rank-nome">${escapar(u.nome)}</span>
                        <span class="admin-rank-total">${u.total}</span>
                    </div>
                    <div class="admin-barra-track">
                        <div class="admin-barra-fill" style="width:${Math.round((u.total / max) * 100)}%"></div>
                    </div>
                </div>`
                )
                .join("");
        }
    }

    const barras = document.getElementById("dashboard-por-entidade");
    if (barras) {
        const labels = {
            auth: "Auth",
            modulo: "Módulos",
            publicacao: "Publicações",
            categoria: "Categorias",
            usuario: "Utilizadores",
            outro: "Outro"
        };
        const entries = Object.entries(stats.porEntidade || {}).sort((a, b) => b[1] - a[1]);
        if (!entries.length) {
            barras.innerHTML = `<p class="lista-vazia">Sem dados.</p>`;
        } else {
            const max = entries[0][1] || 1;
            barras.innerHTML = entries
                .map(
                    ([k, v]) => `
                <div class="admin-rank-item">
                    <div class="admin-rank-meta">
                        <span class="admin-rank-nome">${escapar(labels[k] || k)}</span>
                        <span class="admin-rank-total">${v}</span>
                    </div>
                    <div class="admin-barra-track">
                        <div class="admin-barra-fill admin-barra-fill--alt" style="width:${Math.round((v / max) * 100)}%"></div>
                    </div>
                </div>`
                )
                .join("");
        }
    }

    atualizarIcones();
}

function escapar(texto) {
    return String(texto ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

async function atualizarPainelConfig() {
    const urlEl = document.getElementById("config-status-url");
    const keyEl = document.getElementById("config-status-key");
    const logsEl = document.getElementById("config-status-logs");

    if (urlEl) {
        urlEl.textContent = configValida()
            ? String(window.SUPABASE_URL)
            : "não configurada (use o formulário abaixo)";
    }
    if (keyEl) keyEl.textContent = mascararChave(window.SUPABASE_ANON_KEY);

    if (logsEl && window.LogsAtividade?.detectarTabela) {
        const ok = await window.LogsAtividade.detectarTabela();
        logsEl.textContent = ok
            ? "disponível (Supabase + local)"
            : "só localStorage (corra supabase/003_logs_atividade.sql)";
    }
}

function gerarConteudoConfig(url, key) {
    return `// Gerado pela Administração — Central OPTO
// Project Settings → API → Project URL e anon public key
// Não commits este ficheiro (está no .gitignore).

window.SUPABASE_URL = ${JSON.stringify(url)};
window.SUPABASE_ANON_KEY = ${JSON.stringify(key)};
`;
}

function feedbackConfig(msg, erro = false) {
    const el = document.getElementById("config-feedback");
    if (!el) return;
    el.textContent = msg;
    el.hidden = !msg;
    el.classList.toggle("login-ok", !erro && !!msg);
    el.classList.toggle("login-erro", erro);
}

function obterValoresFormConfig() {
    const url = document.getElementById("config-supabase-url")?.value?.trim() || "";
    const key = document.getElementById("config-supabase-anon")?.value?.trim() || "";
    return { url, key };
}

async function copiarConfig() {
    const { url, key } = obterValoresFormConfig();
    if (!url || !key) {
        feedbackConfig("Preencha URL e anon key.", true);
        return;
    }
    const texto = gerarConteudoConfig(url, key);
    const preview = document.getElementById("config-preview");
    if (preview) {
        preview.hidden = false;
        preview.textContent = texto;
    }
    try {
        await navigator.clipboard.writeText(texto);
        feedbackConfig("config.js copiado. Cole na raiz do projeto como config.js e recarregue.");
    } catch {
        feedbackConfig("Não foi possível copiar. Selecione o texto no preview abaixo.", true);
    }
}

function baixarConfig() {
    const { url, key } = obterValoresFormConfig();
    if (!url || !key) {
        feedbackConfig("Preencha URL e anon key.", true);
        return;
    }
    const texto = gerarConteudoConfig(url, key);
    const blob = new Blob([texto], { type: "text/javascript;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "config.js";
    a.click();
    URL.revokeObjectURL(a.href);
    feedbackConfig("Download iniciado. Coloque o ficheiro na raiz do repositório.");
}

function preencherConfigAtual() {
    const url = document.getElementById("config-supabase-url");
    const key = document.getElementById("config-supabase-anon");
    if (url && window.SUPABASE_URL && !String(window.SUPABASE_URL).includes("SEU_PROJETO")) {
        url.value = window.SUPABASE_URL;
    }
    if (key && window.SUPABASE_ANON_KEY && window.SUPABASE_ANON_KEY !== "sua-chave-anon-aqui") {
        key.value = window.SUPABASE_ANON_KEY;
    }
    feedbackConfig("Campos preenchidos com os valores carregados nesta sessão.");
}

async function iniciar() {
    const temaSalvo = localStorage.getItem("tema");
    document.body.classList.toggle("tema-claro", temaSalvo === "claro");
    if (botaoTema) {
        botaoTema.addEventListener("click", () => {
            const claro = !document.body.classList.contains("tema-claro");
            document.body.classList.toggle("tema-claro", claro);
            localStorage.setItem("tema", claro ? "claro" : "escuro");
            atualizarTemaBotao();
        });
    }
    atualizarTemaBotao();
    setSidebarOpen(true);
    atualizarIcones();

    if (!configValida()) {
        mostrarPainel("config");
        feedbackConfig(
            "Configure o Supabase abaixo (ou em config.js) antes de usar a administração.",
            true
        );
        return;
    }

    client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    window.LogsAtividade?.iniciar(client);

    mostrarLoading(true);

    try {
        await window.Auth.iniciar(client);

        if (!window.Auth.getSession()) {
            window.Auth.abrirModalLogin();
            return;
        }

        if (!window.Auth.ehAdmin()) {
            alert("Apenas administradores podem aceder a esta página.");
            window.location.href = "index.html";
            return;
        }

        await window.Auth.renderizarListaUsuarios("lista-usuarios");
        await atualizarDashboard();
        await atualizarLogs();
        await atualizarPainelConfig();
        mostrarPainel("dashboard");
    } finally {
        mostrarLoading(false);
        atualizarIcones();
    }
}

window.addEventListener("auth:changed", async () => {
    if (!window.Auth.getSession()) {
        window.Auth.abrirModalLogin();
        return;
    }

    if (!window.Auth.ehAdmin()) {
        window.location.href = "index.html";
        return;
    }

    await window.Auth.renderizarListaUsuarios("lista-usuarios");
    await atualizarDashboard();
    await atualizarLogs();
});

window.addEventListener("logs:novo", () => {
    if (painelAtual === "dashboard") atualizarDashboard();
    if (painelAtual === "atividade") atualizarLogs();
});

document.querySelectorAll(".admin-nav-item[data-painel]").forEach((btn) => {
    btn.addEventListener("click", () => mostrarPainel(btn.dataset.painel));
});

document.querySelectorAll("[data-ir]").forEach((btn) => {
    btn.addEventListener("click", () => mostrarPainel(btn.dataset.ir));
});

document.getElementById("admin-sidebar-toggle")?.addEventListener("click", () => {
    const aberto = sidebar?.dataset.open !== "false";
    setSidebarOpen(!aberto);
});

document.getElementById("admin-menu-mobile")?.addEventListener("click", () => {
    abrirSidebarMobile(true);
});

backdrop?.addEventListener("click", () => abrirSidebarMobile(false));

document.getElementById("form-filtros-logs")?.addEventListener("submit", (e) => {
    e.preventDefault();
    atualizarLogs();
});

document.getElementById("btn-limpar-filtros-logs")?.addEventListener("click", () => {
    ["filtro-log-q", "filtro-log-usuario", "filtro-log-entidade", "filtro-log-de", "filtro-log-ate"].forEach(
        (id) => {
            const el = document.getElementById(id);
            if (el) el.value = "";
        }
    );
    atualizarLogs();
});

document.getElementById("btn-atualizar-logs")?.addEventListener("click", () => atualizarLogs());

document.getElementById("btn-config-copiar")?.addEventListener("click", () => copiarConfig());
document.getElementById("btn-config-baixar")?.addEventListener("click", () => baixarConfig());
document.getElementById("btn-config-preencher")?.addEventListener("click", () => preencherConfigAtual());

iniciar();
