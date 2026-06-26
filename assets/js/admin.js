const botaoTema = document.getElementById("tema");
const loading = document.getElementById("loading");

function mostrarLoading(ativo) {
    if (loading) loading.hidden = !ativo;
}

function configValida() {
    return (
        window.SUPABASE_URL &&
        window.SUPABASE_ANON_KEY &&
        !window.SUPABASE_URL.includes("SEU_PROJETO") &&
        window.SUPABASE_ANON_KEY !== "sua-chave-anon-aqui"
    );
}

async function iniciar() {
    const temaSalvo = localStorage.getItem("tema");
    document.body.classList.toggle("tema-claro", temaSalvo === "claro");
    if (botaoTema) {
        botaoTema.textContent = temaSalvo === "claro" ? "Escuro" : "Claro";
        botaoTema.addEventListener("click", () => {
            const claro = !document.body.classList.contains("tema-claro");
            document.body.classList.toggle("tema-claro", claro);
            botaoTema.textContent = claro ? "Escuro" : "Claro";
            localStorage.setItem("tema", claro ? "claro" : "escuro");
        });
    }

    if (!configValida()) {
        alert("Configure o Supabase em config.js antes de usar a administração.");
        return;
    }

    const client = window.supabase.createClient(
        window.SUPABASE_URL,
        window.SUPABASE_ANON_KEY
    );

    mostrarLoading(true);

    try {
        await window.Auth.iniciar(client);

        if (!window.Auth.getSession()) {
            window.Auth.abrirModalLogin();
            return;
        }

        if (!window.Auth.ehAdmin()) {
            alert("Apenas administradores podem acessar esta página.");
            window.location.href = "index.html";
            return;
        }

        await window.Auth.renderizarListaUsuarios("lista-usuarios");
    } finally {
        mostrarLoading(false);
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
});

iniciar();
