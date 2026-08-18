// Minimaler Hash-Router. Routen: #/liste, #/lead/<id>, #/dashboard, #/import, #/einstellungen
const routes = new Map();
let currentCleanup = null;
let container = null;

export function registerRoute(name, renderFn) {
  routes.set(name, renderFn);
}

function parseHash() {
  const raw = (window.location.hash || "#/liste").replace(/^#\/?/, "");
  const [name, param] = raw.split("/");
  return { name: name || "liste", param };
}

export function navigate(path) {
  window.location.hash = path.startsWith("/") ? path : `/${path}`;
}

async function renderCurrent() {
  const { name, param } = parseHash();
  const renderFn = routes.get(name) || routes.get("liste");

  if (typeof currentCleanup === "function") {
    try { currentCleanup(); } catch { /* egal */ }
  }
  document.querySelectorAll(".navlink").forEach((el) => {
    el.classList.toggle("active", el.dataset.route === name);
  });

  container.innerHTML = "";
  currentCleanup = await renderFn(container, param);
}

export function initRouter(rootEl) {
  container = rootEl;
  window.addEventListener("hashchange", renderCurrent);
  renderCurrent();
}
