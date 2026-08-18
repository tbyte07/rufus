// Sämtlicher Netzwerkverkehr mit Supabase - Auth (GoTrue) und Daten (PostgREST) -
// als schlanke fetch-Wrapper. Keine supabase-js-Bibliothek nötig.
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

const REST_URL = `${SUPABASE_URL}/rest/v1`;
const AUTH_URL = `${SUPABASE_URL}/auth/v1`;
const SESSION_KEY = "coldcall_session";

let session = loadSession();
const authListeners = new Set();

function loadSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveSession(s) {
  session = s;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  else localStorage.removeItem(SESSION_KEY);
  authListeners.forEach((fn) => fn(session));
}

export function onAuthChange(fn) {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}
export function getSession() {
  return session;
}
export function isLoggedIn() {
  return !!(session && session.access_token);
}

// --- Auth --------------------------------------------------------------

export async function requestMagicLink(email) {
  const redirectTo = window.location.origin + window.location.pathname;
  const res = await fetch(`${AUTH_URL}/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.error_description || err?.msg || err?.message || "Anmeldelink konnte nicht gesendet werden.");
  }
}

// Nach Klick auf den Magic-Link landet Tim mit #access_token=...&refresh_token=... zurück.
// Diese Funktion liest das aus, holt den Nutzer und speichert die Session.
export async function handleAuthRedirect() {
  const hash = window.location.hash;
  if (!hash || !hash.includes("access_token")) return false;
  const params = new URLSearchParams(hash.replace(/^#\/?/, ""));
  const access_token = params.get("access_token");
  const refresh_token = params.get("refresh_token");
  const expires_in = Number(params.get("expires_in") || "3600");
  if (!access_token) return false;

  const user = await fetchUser(access_token);
  saveSession({
    access_token,
    refresh_token,
    expires_at: Date.now() + expires_in * 1000,
    user,
  });
  // Hash-Fragment aus der URL entfernen, damit der Router wieder normal greift.
  history.replaceState(null, "", window.location.pathname + window.location.search + "#/liste");
  return true;
}

async function fetchUser(accessToken) {
  const res = await fetch(`${AUTH_URL}/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Nutzer konnte nicht geladen werden.");
  return res.json();
}

async function refreshSession() {
  if (!session?.refresh_token) return false;
  const res = await fetch(`${AUTH_URL}/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) {
    saveSession(null);
    return false;
  }
  const data = await res.json();
  saveSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
    user: data.user || session.user,
  });
  return true;
}

export async function ensureValidSession() {
  if (!session) return false;
  if (session.expires_at - Date.now() < 60000) {
    return refreshSession();
  }
  return true;
}

export async function signOut() {
  if (session?.access_token) {
    try {
      await fetch(`${AUTH_URL}/logout?scope=local`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${session.access_token}` },
      });
    } catch {
      // egal, wir räumen die lokale Session so oder so weg
    }
  }
  saveSession(null);
}

async function safeJson(res) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

// --- PostgREST -----------------------------------------------------------

async function restRequest(path, { method = "GET", body, query, prefer } = {}) {
  await ensureValidSession();
  if (!session?.access_token) throw new Error("Nicht angemeldet.");

  const url = new URL(`${REST_URL}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, v);
    }
  }

  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;

  let res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      headers.Authorization = `Bearer ${session.access_token}`;
      res = await fetch(url, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
    }
  }

  if (!res.ok) {
    const err = await safeJson(res);
    throw new Error(err?.message || err?.hint || `Fehler ${res.status} bei ${path}`);
  }
  if (res.status === 204) return null;
  return safeJson(res);
}

// --- Leads -----------------------------------------------------------------

export async function fetchLeads() {
  return restRequest("/leads", { query: { select: "*", order: "firma.asc" } }) || [];
}

export async function insertLead(row) {
  const rows = await restRequest("/leads", { method: "POST", body: row, prefer: "return=representation" });
  return rows?.[0];
}

export async function insertLeads(rows) {
  if (!rows.length) return [];
  return restRequest("/leads", { method: "POST", body: rows, prefer: "return=representation" }) || [];
}

export async function updateLead(id, patch) {
  const rows = await restRequest(`/leads`, {
    method: "PATCH",
    query: { id: `eq.${id}` },
    body: patch,
    prefer: "return=representation",
  });
  return rows?.[0];
}

export async function deleteLead(id) {
  await restRequest(`/leads`, { method: "DELETE", query: { id: `eq.${id}` } });
}

// --- Calls -------------------------------------------------------------

export async function fetchCallsForLead(leadId) {
  return restRequest("/calls", {
    query: { select: "*", lead_id: `eq.${leadId}`, order: "called_at.desc" },
  }) || [];
}

export async function fetchAllCalls() {
  return restRequest("/calls", { query: { select: "*", order: "called_at.asc" } }) || [];
}

export async function insertCall(row) {
  const rows = await restRequest("/calls", { method: "POST", body: row, prefer: "return=representation" });
  return rows?.[0];
}
