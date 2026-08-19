// Eigene Unterseite: alle Leads mit offener nächster Aktion (Follow-up/Rückruf)
// an einem Ort, unabhängig von der Haupt-Leadliste - für den täglichen
// "was steht an"-Blick, ohne durch die ganze Liste filtern zu müssen.
import * as store from "../store.js";
import { openLeadPanel, nextActionCell } from "./liste.js";
import { escapeHtml, isOverdue, debounce, normalizePhone } from "../util.js";

export { openLeadPanel };

const filters = { aktion: "alle", search: "" };
let unsubscribe = null;

export async function renderFollowups(container) {
  container.innerHTML = `
    <div class="view-header">
      <div><h1>Follow-ups</h1><div class="sub">Alle Leads mit offener nächster Aktion, fällig zuerst.</div></div>
    </div>

    <div id="fu-stats" class="kpi-grid" style="margin-bottom:16px"></div>

    <div class="toolbar">
      <input type="search" class="search" id="fu-search" placeholder="Suche nach Firma oder Ort..." />
      <select id="fu-aktion">
        <option value="alle">Aktion: Alle</option>
        <option value="info_mail">Nur Follow-ups</option>
        <option value="rueckruf">Nur Rückrufe</option>
      </select>
    </div>

    <div class="card">
      <div style="overflow-x:auto">
        <table class="leads">
          <thead><tr><th>Firma</th><th>Telefon</th><th>Ort</th><th>Fällig</th></tr></thead>
          <tbody id="fu-tbody"></tbody>
        </table>
      </div>
      <div id="fu-empty"></div>
    </div>
  `;

  const debouncedSearch = debounce((val) => { filters.search = val; render(); }, 180);
  container.querySelector("#fu-search").addEventListener("input", (e) => debouncedSearch(e.target.value));
  container.querySelector("#fu-aktion").addEventListener("change", (e) => { filters.aktion = e.target.value; render(); });

  render();
  unsubscribe = store.subscribe(render);
  return () => { if (unsubscribe) unsubscribe(); };
}

function getItems() {
  const q = filters.search.trim().toLowerCase();
  return store.getState().leads
    .filter((l) => l.next_action_at && ["info_mail", "rueckruf"].includes(l.next_action))
    .filter((l) => filters.aktion === "alle" || l.next_action === filters.aktion)
    .filter((l) => {
      if (!q) return true;
      return `${l.firma || ""} ${l.ort || ""} ${l.telefon || ""}`.toLowerCase().includes(q);
    })
    .sort((a, b) => new Date(a.next_action_at) - new Date(b.next_action_at));
}

function render() {
  const items = getItems();

  const allDue = store.getState().leads.filter((l) => l.next_action_at && ["info_mail", "rueckruf"].includes(l.next_action));
  const overdueCount = allDue.filter((l) => isOverdue(l.next_action_at)).length;
  const todayCount = allDue.filter((l) => !isOverdue(l.next_action_at) && isSameDay(l.next_action_at)).length;
  const laterCount = allDue.length - overdueCount - todayCount;

  const statsEl = document.getElementById("fu-stats");
  if (statsEl) {
    statsEl.innerHTML = `
      <div class="kpi"><div class="label">Überfällig</div><div class="value" style="color:var(--danger)">${overdueCount}</div></div>
      <div class="kpi"><div class="label">Heute fällig</div><div class="value" style="color:var(--stage-gatekeeper)">${todayCount}</div></div>
      <div class="kpi"><div class="label">Später</div><div class="value">${laterCount}</div></div>
    `;
  }

  const tbody = document.getElementById("fu-tbody");
  const emptyEl = document.getElementById("fu-empty");
  if (!tbody) return;

  if (!items.length) {
    tbody.innerHTML = "";
    if (emptyEl) emptyEl.innerHTML = `<div class="empty-state"><div class="big">✓</div>Keine offenen Follow-ups oder Rückrufe${filters.search || filters.aktion !== "alle" ? " für diesen Filter" : ""}.</div>`;
    return;
  }
  if (emptyEl) emptyEl.innerHTML = "";

  tbody.innerHTML = items.map((lead) => `
    <tr class="row" data-id="${lead.id}">
      <td class="firma-cell">${escapeHtml(lead.firma)}</td>
      <td class="muted">${lead.telefon ? `<a href="tel:${normalizePhone(lead.telefon)}" onclick="event.stopPropagation()">${escapeHtml(lead.telefon)}</a>` : "—"}</td>
      <td class="muted">${escapeHtml(lead.ort || "—")}</td>
      <td>${nextActionCell(lead)}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr.row").forEach((tr) => {
    tr.addEventListener("click", () => openLeadPanel(tr.dataset.id));
  });
}

function isSameDay(iso) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}
