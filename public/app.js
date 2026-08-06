const state = {
  commune: null,
  data: null,
  filtered: []
};

const el = (id) => document.getElementById(id);

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Erreur inattendue.");
  return body;
}

function showLogin() {
  el("login").hidden = false;
  el("app").hidden = true;
}

function showApp() {
  el("login").hidden = true;
  el("app").hidden = false;
}

async function checkSession() {
  try {
    const { authenticated } = await api("/api/me");
    if (authenticated) showApp();
    else showLogin();
  } catch {
    showLogin();
  }
}

el("login-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = el("password").value;
  const errorEl = el("login-error");
  errorEl.textContent = "";
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    el("password").value = "";
    showApp();
  } catch (error) {
    errorEl.textContent = error.message;
  }
});

el("logout")?.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  showLogin();
});

let suggestionTimer = null;
el("commune")?.addEventListener("input", (event) => {
  const query = event.target.value.trim();
  clearTimeout(suggestionTimer);
  if (query.length < 2) {
    el("suggestions").hidden = true;
    return;
  }
  suggestionTimer = setTimeout(async () => {
    try {
      const { results } = await api(`/api/communes?q=${encodeURIComponent(query)}`);
      renderSuggestions(results);
    } catch {
      el("suggestions").hidden = true;
    }
  }, 250);
});

function renderSuggestions(results) {
  const box = el("suggestions");
  if (!results.length) {
    box.hidden = true;
    return;
  }
  box.innerHTML = "";
  for (const commune of results) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<span>${commune.nom}</span><small>${commune.departement}</small>`;
    button.addEventListener("click", () => selectCommune(commune));
    box.appendChild(button);
  }
  box.hidden = false;
}

async function selectCommune(commune) {
  el("commune").value = commune.nom;
  el("suggestions").hidden = true;
  state.commune = commune;
  el("empty").hidden = true;
  el("workspace").hidden = false;
  el("workspace").classList.add("loading");
  el("status").textContent = "Analyse du cadastre en cours…";

  try {
    const data = await api(`/api/prospects?code=${commune.code}`);
    state.data = data;
    el("metric-commune").textContent = commune.nom;
    el("metric-scanned").textContent = data.scanned.toLocaleString("fr-FR");
    el("metric-qualifies").textContent = data.qualifies.toLocaleString("fr-FR");
    el("metric-score").textContent = data.scoreMoyen;
    el("truncated-notice").hidden = !data.truncated;
    el("status").textContent = "";
    applyFilters();
  } catch (error) {
    el("status").textContent = error.message;
  } finally {
    el("workspace").classList.remove("loading");
  }
}

function applyFilters() {
  if (!state.data) return;
  const text = el("text-filter").value.trim().toLowerCase();
  const minSurface = Number(el("surface-filter").value || 0);

  state.filtered = state.data.results.filter((row) => {
    if (minSurface && row.contenance < minSurface) return false;
    if (text) {
      const haystack = `${row.section} ${row.numero} ${row.id}`.toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
  render();
}

function render() {
  const tbody = el("rows");
  tbody.innerHTML = "";
  for (const row of state.filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="badge">${row.score}</span></td>
      <td><code>${row.section}${row.numero}</code></td>
      <td>${row.section}</td>
      <td>${row.contenance.toLocaleString("fr-FR")} m²</td>
      <td>${row.created || "—"}</td>
      <td>${row.updated || "—"}</td>
      <td>${row.arpente ? "Oui" : "Non"}</td>
    `;
    tbody.appendChild(tr);
  }
}

el("text-filter")?.addEventListener("input", applyFilters);
el("surface-filter")?.addEventListener("input", applyFilters);

el("export")?.addEventListener("click", () => {
  if (!state.filtered.length) return;
  const csv =
    "Parcelle,Section,Numero,Surface_m2,Cree_le,Modifie_le,Arpente,Score\n" +
    state.filtered
      .map((r) => `${r.id},${r.section},${r.numero},${r.contenance},${r.created || ""},${r.updated || ""},${r.arpente ? "oui" : "non"},${r.score}`)
      .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `prospects_${state.commune?.code || "export"}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
});

document.addEventListener("click", (event) => {
  if (!el("commune")?.contains(event.target) && !el("suggestions")?.contains(event.target)) {
    el("suggestions").hidden = true;
  }
});

checkSession();
