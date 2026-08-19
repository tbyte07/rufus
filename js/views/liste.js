// Hauptansicht: durchsuchbare/filterbare Leadliste mit Fälligkeitsband oben.
import * as store from "../store.js";
import { openLeadPanel } from "./lead.js";
import { LEAD_STATUS_LABEL, ACTIONS_BY_KEY } from "../constants.js";
import { escapeHtml, fmtRelative, fmtDate, isOverdue, isDueSoon, debounce } from "../util.js";

export { openLeadPanel };

const filters = { search: "", icp: "alle", status: "alle", kampagne: "alle", aktion: "alle", sort: "faellig" };
let unsubscribe = null;

export async function renderListe(container) {
  container.innerHTML = `
    <div class="view-header">
      <div>
        <h1>Leads</h1>
        <div class="sub" id="liste-count"></div>
      </div>
    </div>

    <div id="due-band"></div>

    <div class="toolbar">
      <input type="search" class="search" id="f-search" placeholder="Suche nach Firma, Ort oder Telefonnummer..." value="${escapeHtml(filters.search)}" />
      <select id="f-icp">
        <option value="alle">ICP: Alle</option>
        <option value="JA">ICP: Ja</option>
        <option value="NEIN">ICP: Nein</option>
      </select>
      <select id="f-status">
        <option value="alle">Status: Alle</option>
        <option value="neu">Neu</option>
        <option value="in_arbeit">In Arbeit</option>
        <option value="termin">Termin</option>
        <option value="tot">Abgeschlossen</option>
      </select>
      <select id="f-kampagne"><option value="alle">Kampagne: Alle</option></select>
      <select id="f-aktion">
        <option value="alle">Aktion: Alle</option>
        <option value="info_mail">Nur Follow-ups</option>
        <option value="rueckruf">Nur Rückrufe</option>
      </select>
      <select id="f-sort">
        <option value="faellig">Sortierung: Fällig zuerst</option>
        <option value="firma">Sortierung: Firma A-Z</option>
        <option value="zuletzt">Sortierung: Zuletzt kontaktiert</option>
      </select>
    </div>

    <div class="card">
      <div style="overflow-x:auto">
        <table class="leads">
          <thead>
            <tr><th>Firma</th><th>Ort</th><th>ICP</th><th>Status</th><th>Nächste Aktion</th><th>Anrufe</th></tr>
          </thead>
          <tbody id="leads-tbody"></tbody>
        </table>
      </div>
      <div id="leads-empty"></div>
    </div>
  `;

  container.querySelector("#f-search").value = filters.search;
  container.querySelector("#f-icp").value = filters.icp;
  container.querySelector("#f-status").value = filters.status;
  container.querySelector("#f-aktion").value = filters.aktion;
  container.querySelector("#f-sort").value = filters.sort;

  const debouncedSearch = debounce((val) => { filters.search = val; renderTable(); }, 180);
  container.querySelector("#f-search").addEventListener("input", (e) => debouncedSearch(e.target.value));
  container.querySelector("#f-icp").addEventListener("change", (e) => { filters.icp = e.target.value; renderTable(); });
  container.querySelector("#f-status").addEventListener("change", (e) => { filters.status = e.target.value; renderTable(); });
  container.querySelector("#f-aktion").addEventListener("change", (e) => { filters.aktion = e.target.value; renderTable(); });
  container.querySelector("#f-sort").addEventListener("change", (e) => { filters.sort = e.target.value; renderTable(); });
  container.querySelector("#f-kampagne").addEventListener("change", (e) => { filters.kampagne = e.target.value; renderTable(); });

  populateKampagnen(container);
  renderTable();

  unsubscribe = store.subscribe(() => {
    populateKampagnen(container);
    renderTable();
  });
  return () => { if (unsubscribe) unsubscribe(); };
}

function populateKampagnen(container) {
  const sel = container.querySelector("#f-kampagne");
  if (!sel) return;
  const current = sel.value;
  const kampagnen = Array.from(new Set(store.getState().leads.map((l) => l.kampagne).filter(Boolean))).sort();
  sel.innerHTML = `<option value="alle">Kampagne: Alle</option>` + kampagnen.map((k) => `<option value="${escapeHtml(k)}">${escapeHtml(k)}</option>`).join("");
  sel.value = kampagnen.includes(current) ? current : "alle";
}

function getFiltered() {
  const { leads } = store.getState();
  const q = filters.search.trim().toLowerCase();
  let result = leads.filter((l) => {
    if (filters.icp !== "alle" && l.icp_status !== filters.icp) return false;
    if (filters.status !== "alle" && l.lead_status !== filters.status) return false;
    if (filters.kampagne !== "alle" && l.kampagne !== filters.kampagne) return false;
    if (filters.aktion !== "alle" && l.next_action !== filters.aktion) return false;
    if (q) {
      const hay = `${l.firma || ""} ${l.ort || ""} ${l.telefon || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filters.sort === "firma") {
    result.sort((a, b) => (a.firma || "").localeCompare(b.firma || "", "de"));
  } else if (filters.sort === "faellig") {
    result.sort((a, b) => {
      if (!a.next_action_at && !b.next_action_at) return 0;
      if (!a.next_action_at) return 1;
      if (!b.next_action_at) return -1;
      return new Date(a.next_action_at) - new Date(b.next_action_at);
    });
  } else if (filters.sort === "zuletzt") {
    result.sort((a, b) => new Date(b.last_call_at || 0) - new Date(a.last_call_at || 0));
  }
  return result;
}

function renderTable() {
  const filtered = getFiltered();
  const countEl = document.getElementById("liste-count");
  if (countEl) countEl.textContent = `${filtered.length} von ${store.getState().leads.length} Leads`;

  renderDueBand();

  const tbody = document.getElementById("leads-tbody");
  const emptyEl = document.getElementById("leads-empty");
  if (!tbody) return;

  if (!filtered.length) {
    tbody.innerHTML = "";
    if (emptyEl) emptyEl.innerHTML = `<div class="empty-state"><div class="big">🔍</div>Keine Leads gefunden. Filter anpassen oder <a href="#/import">Liste importieren</a>.</div>`;
    return;
  }
  if (emptyEl) emptyEl.innerHTML = "";

  tbody.innerHTML = filtered.map((lead) => `
    <tr class="row" data-id="${lead.id}">
      <td class="firma-cell">${escapeHtml(lead.firma)}</td>
      <td class="muted">${escapeHtml(lead.ort || "—")}</td>
      <td><span class="badge ${lead.icp_status === "JA" ? "icp-ja" : "icp-nein"}">${escapeHtml(lead.icp_status || "?")}</span></td>
      <td><span class="badge stage-${lead.lead_status === "termin" ? "termin" : lead.lead_status === "tot" ? "falsche_nummer" : "nicht_erreicht"}">${LEAD_STATUS_LABEL[lead.lead_status] || lead.lead_status}</span></td>
      <td>${nextActionCell(lead)}</td>
      <td class="muted">${lead.call_count || 0}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("tr.row").forEach((tr) => {
    tr.addEventListener("click", () => openLeadPanel(tr.dataset.id));
  });
}

function nextActionCell(lead) {
  if (!lead.next_action_at) return `<span class="muted">—</span>`;
  const overdue = isOverdue(lead.next_action_at);
  const soon = !overdue && isDueSoon(lead.next_action_at, 120);
  const cls = overdue ? "overdue" : soon ? "soon" : "";
  const short = ACTIONS_BY_KEY[lead.next_action]?.short;
  return `<span class="badge ${cls}">${short ? escapeHtml(short) + " · " : ""}${fmtRelative(lead.next_action_at)}</span>`;
}

function renderDueBand() {
  const band = document.getElementById("due-band");
  if (!band) return;
  const due = store.computeDueLeads()
    .filter((l) => isOverdue(l.next_action_at) || isDueSoon(l.next_action_at, 48 * 60))
    .slice(0, 20);

  if (!due.length) { band.innerHTML = ""; return; }

  band.innerHTML = `<div class="due-band">${due.map((lead) => {
    const overdue = isOverdue(lead.next_action_at);
    const short = ACTIONS_BY_KEY[lead.next_action]?.short || "Fällig";
    return `
      <div class="due-card ${overdue ? "overdue" : ""}" data-id="${lead.id}">
        <div class="firma">${escapeHtml(lead.firma)}</div>
        <div class="when ${overdue ? "overdue-text" : "soon-text"}">${escapeHtml(short)} · ${fmtRelative(lead.next_action_at)}</div>
      </div>`;
  }).join("")}</div>`;

  band.querySelectorAll(".due-card").forEach((card) => {
    card.addEventListener("click", () => openLeadPanel(card.dataset.id));
  });
}
