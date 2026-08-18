// Boot-Skript: Login-Fluss, App-Shell, Router-Registrierung, Erinnerungen, Rufus.
import * as api from "./api.js";
import * as store from "./store.js";
import { initRouter, registerRoute, navigate } from "./router.js";
import { toast } from "./toast.js";
import { renderListe, openLeadPanel } from "./views/liste.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderImport } from "./views/import.js";
import { renderEinstellungen } from "./views/einstellungen.js";
import { startNotifyWatcher } from "./notify.js";
import { mountBuddy, buddy } from "./buddy.js";
import { getSettings } from "./settings.js";

const loginScreen = document.getElementById("login-screen");
const appShell = document.getElementById("app");
const loginForm = document.getElementById("login-form");
const loginMsg = document.getElementById("login-msg");
const logoutBtn = document.getElementById("logout-btn");
const sidebarDue = document.getElementById("sidebar-due");
const sidebarDueCount = document.getElementById("sidebar-due-count");

registerRoute("liste", async (container, param) => {
  await renderListe(container);
  if (param) openLeadPanel(param);
});
registerRoute("lead", async (container, param) => {
  await renderListe(container);
  if (param) openLeadPanel(param);
});
registerRoute("dashboard", renderDashboard);
registerRoute("import", renderImport);
registerRoute("einstellungen", renderEinstellungen);

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim();
  const btn = loginForm.querySelector("button");
  btn.disabled = true;
  loginMsg.textContent = "";
  loginMsg.className = "login-msg";
  try {
    await api.requestMagicLink(email);
    loginMsg.textContent = `Link verschickt an ${email}. E-Mail öffnen und Link antippen - du landest direkt wieder hier.`;
    loginMsg.classList.add("ok");
  } catch (err) {
    loginMsg.textContent = err.message;
    loginMsg.classList.add("error");
  } finally {
    btn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  await api.signOut();
  location.reload();
});

function updateSidebarDue() {
  const due = store.computeDueLeads().filter((l) => new Date(l.next_action_at).getTime() <= Date.now());
  if (due.length > 0) {
    sidebarDue.hidden = false;
    sidebarDueCount.textContent = String(due.length);
  } else {
    sidebarDue.hidden = true;
  }
}

async function bootApp() {
  loginScreen.hidden = true;
  appShell.hidden = false;
  mountBuddy(document.getElementById("buddy-canvas"), document.getElementById("buddy-bubble"));
  buddy.setState("idle");
  document.querySelector(".buddy-corner").style.display = getSettings().buddyEnabled ? "flex" : "none";

  try {
    await store.loadLeads();
  } catch (err) {
    toast("Leads konnten nicht geladen werden: " + err.message, "error");
  }
  store.subscribe(updateSidebarDue);
  updateSidebarDue();

  initRouter(document.getElementById("main-content"));
  startNotifyWatcher();
  registerServiceWorker();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service Worker nicht verfügbar:", err));
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "open-lead" && event.data.leadId) {
      navigate(`/lead/${event.data.leadId}`);
    }
  });
}

async function boot() {
  try {
    await api.handleAuthRedirect();
  } catch (err) {
    console.error("Auth-Redirect fehlgeschlagen:", err);
    toast("Anmeldelink war ungültig oder abgelaufen.", "error");
  }

  if (api.isLoggedIn()) {
    await bootApp();
  } else {
    loginScreen.hidden = false;
    appShell.hidden = true;
  }

  api.onAuthChange((session) => {
    if (!session) {
      location.hash = "";
      location.reload();
    }
  });
}

boot();
