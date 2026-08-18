// Slide-over-Detailansicht eines Leads: Infos, Notiz, Zwei-Achsen-Call-Erfassung,
// Anrufhistorie. Wird von liste.js (Zeilenklick) und vom Router (#/lead/<id>,
// z.B. per Klick auf eine Benachrichtigung) geöffnet.
import * as api from "../api.js";
import * as store from "../store.js";
import { toast } from "../toast.js";
import { buddy } from "../buddy.js";
import { markActivity } from "../notify.js";
import { getSettings, fillTemplate } from "../settings.js";
import { STUFEN, ACTIONS, LEAD_STATUS_LABEL } from "../constants.js";
import { escapeHtml, fmtDateTime, fmtRelative, isOverdue, normalizePhone,
  inMinutes, inHours, todayAt, tomorrowAt, nextWeekAt, localInputToIso, isoToLocalInput, debounce } from "../util.js";

let currentLeadId = null;
let selectedStufe = null;
let selectedAction = "keine";
let selectedDatetime = null;
let mailOpenedManually = false;
let keydownHandler = null;
let overlayEl = null;

export function openLeadPanel(id) {
  const lead = store.getLead(id);
  if (!lead) {
    toast("Dieser Lead wurde nicht gefunden.", "error");
    return;
  }
  closeLeadPanel();

  currentLeadId = id;
  selectedStufe = null;
  selectedAction = "keine";
  selectedDatetime = null;
  mailOpenedManually = false;

  overlayEl = document.createElement("div");
  overlayEl.className = "overlay";
  overlayEl.innerHTML = `<div class="panel" id="lead-panel"></div>`;
  overlayEl.addEventListener("click", (e) => {
    if (e.target === overlayEl) closeLeadPanel();
  });
  document.body.appendChild(overlayEl);

  renderPanel();
  loadHistory();

  keydownHandler = (e) => {
    if (e.key === "Escape") { closeLeadPanel(); return; }
    const active = document.activeElement?.tagName;
    if (active === "INPUT" || active === "TEXTAREA" || active === "SELECT") return;
    if (["1", "2", "3", "4", "5"].includes(e.key)) {
      const idx = Number(e.key) - 1;
      if (STUFEN[idx]) selectStufe(STUFEN[idx].key);
    }
  };
  document.addEventListener("keydown", keydownHandler);
}

export function closeLeadPanel() {
  if (overlayEl) {
    overlayEl.remove();
    overlayEl = null;
  }
  if (keydownHandler) {
    document.removeEventListener("keydown", keydownHandler);
    keydownHandler = null;
  }
  currentLeadId = null;
}

function panelEl() {
  return document.getElementById("lead-panel");
}

function renderPanel() {
  const lead = store.getLead(currentLeadId);
  if (!lead || !panelEl()) return;

  const overdue = lead.next_action_at && isOverdue(lead.next_action_at);
  panelEl().innerHTML = `
    <div class="panel-head">
      <div>
        <h2>${escapeHtml(lead.firma)}</h2>
        <div class="panel-meta">
          ${lead.ort ? escapeHtml(lead.ort) + " · " : ""}
          <span class="badge ${lead.icp_status === "JA" ? "icp-ja" : "icp-nein"}">ICP ${escapeHtml(lead.icp_status || "?")}</span>
          <span class="badge stage-${lead.lead_status === "termin" ? "termin" : lead.lead_status === "tot" ? "falsche_nummer" : "nicht_erreicht"}" style="margin-left:6px">${LEAD_STATUS_LABEL[lead.lead_status] || lead.lead_status}</span>
        </div>
      </div>
      <button class="btn ghost sm" id="lead-close">✕</button>
    </div>

    ${lead.next_action_at ? `
      <div class="icp-box" style="margin-bottom:18px; border-color:${overdue ? "var(--danger)" : "var(--border)"}">
        <strong style="color:${overdue ? "var(--danger)" : "var(--text)"}">
          ${escapeHtml(ACTIONS.find(a => a.key === lead.next_action)?.label || "Nächste Aktion")}
        </strong>
        - ${fmtRelative(lead.next_action_at)} (${fmtDateTime(lead.next_action_at)})
      </div>` : ""}

    <div class="panel-section">
      <h3>Kontakt</h3>
      <dl class="info-grid">
        <dt>Telefon</dt><dd>${lead.telefon ? `<a href="tel:${normalizePhone(lead.telefon)}">${escapeHtml(lead.telefon)}</a>` : "—"}</dd>
        <dt>E-Mail</dt><dd>${lead.email ? `<a href="mailto:${escapeHtml(lead.email)}">${escapeHtml(lead.email)}</a>` : "—"}</dd>
        <dt>Website</dt><dd>${lead.website ? `<a href="${escapeHtml(lead.website)}" target="_blank" rel="noopener">${escapeHtml(lead.website)}</a>` : "—"}</dd>
        <dt>Gelbe Seiten</dt><dd>${lead.gs_website ? `<a href="${escapeHtml(lead.gs_website)}" target="_blank" rel="noopener">Eintrag ansehen</a>` : "—"}</dd>
        <dt>Anrufe bisher</dt><dd>${lead.call_count || 0}${lead.last_call_at ? " · zuletzt " + fmtDateTime(lead.last_call_at) : ""}</dd>
      </dl>
    </div>

    ${lead.icp_begruendung ? `
    <div class="panel-section">
      <h3>ICP-Begründung</h3>
      <div class="icp-box">${escapeHtml(lead.icp_begruendung)}</div>
    </div>` : ""}

    <div class="panel-section">
      <h3>Notiz</h3>
      <textarea id="lead-notiz" placeholder="Freie Notiz zu diesem Lead...">${escapeHtml(lead.notiz || "")}</textarea>
      <div id="notiz-saved" style="font-size:11.5px;color:var(--text-faint);margin-top:4px;height:14px;"></div>
    </div>

    <div class="panel-section">
      <h3>Anruf erfassen</h3>
      <div class="stufe-grid" id="stufe-grid">
        ${STUFEN.map(s => `
          <button type="button" class="stufe-btn stage-${s.key}" data-stufe="${s.key}">
            <span class="k">${s.kicker} · ${escapeHtml(s.desc)}</span>
            <span class="t">${escapeHtml(s.label)}</span>
          </button>`).join("")}
      </div>
      <div id="axis2-wrap"></div>
      <div class="btn-row" style="margin-top:16px">
        <button class="btn primary lg" id="save-call-btn">Anruf speichern</button>
      </div>
    </div>

    <div class="panel-section">
      <h3>Verlauf</h3>
      <div class="call-history" id="call-history"><p class="muted" style="color:var(--text-faint);font-size:13px">Lädt...</p></div>
    </div>
  `;

  panelEl().querySelector("#lead-close").addEventListener("click", closeLeadPanel);
  panelEl().querySelectorAll(".stufe-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectStufe(btn.dataset.stufe));
  });
  panelEl().querySelector("#save-call-btn").addEventListener("click", handleSaveCall);

  const notizEl = panelEl().querySelector("#lead-notiz");
  const savedEl = panelEl().querySelector("#notiz-saved");
  const saveNoteDebounced = debounce(async (val) => {
    try {
      await store.saveLeadNote(currentLeadId, val);
      savedEl.textContent = "Gespeichert.";
      setTimeout(() => { if (savedEl) savedEl.textContent = ""; }, 2000);
    } catch (err) {
      toast("Notiz konnte nicht gespeichert werden: " + err.message, "error");
    }
  }, 700);
  notizEl.addEventListener("input", (e) => saveNoteDebounced(e.target.value));
}

function selectStufe(key) {
  selectedStufe = key;
  selectedAction = "keine";
  selectedDatetime = null;
  panelEl().querySelectorAll(".stufe-btn").forEach((b) => b.classList.toggle("selected", b.dataset.stufe === key));
  renderAxis2();
}

function renderAxis2() {
  const wrap = panelEl()?.querySelector("#axis2-wrap");
  if (!wrap) return;

  if (!selectedStufe) { wrap.innerHTML = ""; return; }

  if (selectedStufe === "termin") {
    const defaultVal = isoToLocalInput(tomorrowAt(10));
    wrap.innerHTML = `
      <div class="field" style="margin-top:14px">
        <label>Termin am</label>
        <input type="datetime-local" id="termin-input" value="${defaultVal}" />
      </div>`;
    selectedDatetime = localInputToIso(defaultVal);
    wrap.querySelector("#termin-input").addEventListener("change", (e) => {
      selectedDatetime = localInputToIso(e.target.value);
    });
    return;
  }

  const relevantActions = ACTIONS.filter((a) => a.key !== "keine" || true);
  wrap.innerHTML = `
    <div class="field" style="margin-top:14px">
      <label>Was ist als Nächstes dran?</label>
      <div class="action-grid">
        ${relevantActions.map(a => `<button type="button" class="action-btn" data-action="${a.key}">${escapeHtml(a.label)}</button>`).join("")}
      </div>
    </div>
    <div id="time-picker-wrap"></div>
  `;
  wrap.querySelectorAll(".action-btn").forEach((btn) => {
    btn.addEventListener("click", () => selectAction(btn.dataset.action));
  });
  selectAction("keine");
}

function selectAction(key) {
  selectedAction = key;
  const wrap = panelEl()?.querySelector("#axis2-wrap");
  wrap?.querySelectorAll(".action-btn").forEach((b) => b.classList.toggle("selected", b.dataset.action === key));

  const timeWrap = panelEl()?.querySelector("#time-picker-wrap");
  if (!timeWrap) return;

  if (!["mail", "rueckruf", "followup"].includes(key)) {
    timeWrap.innerHTML = "";
    selectedDatetime = null;
    return;
  }

  const settings = getSettings();
  const quickTimes = key === "rueckruf"
    ? [
        { label: "in 1 Std", iso: inHours(1) },
        { label: "heute 15:00", iso: todayAt(15) },
        { label: "morgen früh", iso: tomorrowAt(9) },
        { label: "nächste Woche", iso: nextWeekAt() },
      ]
    : [
        { label: `in ${settings.mailFollowupDays} Tagen`, iso: (() => { const d = new Date(); d.setDate(d.getDate() + settings.mailFollowupDays); d.setHours(10,0,0,0); return d.toISOString(); })() },
        { label: "morgen früh", iso: tomorrowAt(9) },
        { label: "nächste Woche", iso: nextWeekAt() },
      ];

  selectedDatetime = quickTimes[0].iso;
  timeWrap.innerHTML = `
    <div class="quick-times">
      ${quickTimes.map((q, i) => `<span class="quick-time ${i === 0 ? "selected" : ""}" data-iso="${q.iso}">${escapeHtml(q.label)}</span>`).join("")}
    </div>
    <input type="datetime-local" id="custom-time-input" value="${isoToLocalInput(selectedDatetime)}" />
    ${key === "mail" ? `<button type="button" class="btn sm" id="open-mail-btn" style="margin-top:10px">✉ Mail-Entwurf ansehen</button>` : ""}
  `;
  timeWrap.querySelectorAll(".quick-time").forEach((chip) => {
    chip.addEventListener("click", () => {
      selectedDatetime = chip.dataset.iso;
      timeWrap.querySelectorAll(".quick-time").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
      timeWrap.querySelector("#custom-time-input").value = isoToLocalInput(selectedDatetime);
    });
  });
  timeWrap.querySelector("#custom-time-input").addEventListener("change", (e) => {
    selectedDatetime = localInputToIso(e.target.value);
    timeWrap.querySelectorAll(".quick-time").forEach((c) => c.classList.remove("selected"));
  });
  timeWrap.querySelector("#open-mail-btn")?.addEventListener("click", () => {
    const lead = store.getLead(currentLeadId);
    window.open(buildMailto(lead), "_blank");
    mailOpenedManually = true;
  });
}

function buildMailto(lead) {
  const settings = getSettings();
  const subject = fillTemplate(settings.mailSubject, lead);
  const body = fillTemplate(settings.mailBody, lead);
  return `mailto:${encodeURIComponent(lead.email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function handleSaveCall() {
  if (!selectedStufe) {
    toast("Bitte wähle, wie weit du gekommen bist.", "error");
    return;
  }
  let nextAction = selectedStufe === "termin" ? "keine" : selectedAction;
  let nextActionAt = null;
  let terminAt = null;

  if (selectedStufe === "termin") {
    terminAt = selectedDatetime;
    if (!terminAt) { toast("Bitte einen Termin-Zeitpunkt wählen.", "error"); return; }
  } else if (["mail", "rueckruf", "followup"].includes(nextAction)) {
    nextActionAt = selectedDatetime;
    if (!nextActionAt) { toast("Bitte einen Zeitpunkt wählen.", "error"); return; }
  }

  const btn = panelEl().querySelector("#save-call-btn");
  btn.disabled = true;
  try {
    await store.recordCall({ leadId: currentLeadId, stufe: selectedStufe, nextAction, nextActionAt, terminAt });
    markActivity();
    toast("Anruf gespeichert.", "ok");

    if (nextAction === "mail" && !mailOpenedManually) {
      window.open(buildMailto(store.getLead(currentLeadId)), "_blank");
    }
    triggerBuddy(selectedStufe);

    selectedStufe = null;
    selectedAction = "keine";
    selectedDatetime = null;
    mailOpenedManually = false;
    renderPanel();
    loadHistory();
  } catch (err) {
    toast("Fehler beim Speichern: " + err.message, "error");
  } finally {
    if (panelEl()) panelEl().querySelector("#save-call-btn").disabled = false;
  }
}

function triggerBuddy(stufe) {
  if (stufe === "termin") buddy.setState("termin", { autoIdleAfter: 4500 });
  else if (stufe === "entscheider") buddy.setState("entscheider", { autoIdleAfter: 3500 });
  else buddy.setState("abgewimmelt", { autoIdleAfter: 3000 });
}

const STUFE_DOT_COLOR = {
  falsche_nummer: "var(--stage-falsche-nummer)",
  nicht_erreicht: "var(--stage-nicht-erreicht)",
  gatekeeper: "var(--stage-gatekeeper)",
  entscheider: "var(--stage-entscheider)",
  termin: "var(--stage-termin)",
};

async function loadHistory() {
  const listEl = panelEl()?.querySelector("#call-history");
  if (!listEl) return;
  try {
    const calls = await api.fetchCallsForLead(currentLeadId);
    if (!panelEl()) return; // Panel inzwischen geschlossen
    const target = panelEl().querySelector("#call-history");
    if (!target) return;
    if (!calls.length) {
      target.innerHTML = `<p style="color:var(--text-faint);font-size:13px">Noch keine Anrufe erfasst.</p>`;
      return;
    }
    target.innerHTML = calls.map((c) => {
      const stufeInfo = STUFEN.find((s) => s.key === c.stufe);
      const actionInfo = ACTIONS.find((a) => a.key === c.next_action);
      return `
        <div class="call-history-item">
          <span class="dot" style="background:${STUFE_DOT_COLOR[c.stufe] || "var(--text-faint)"}"></span>
          <div>
            <div><strong>${escapeHtml(stufeInfo?.label || c.stufe)}</strong>${c.next_action && c.next_action !== "keine" ? " · " + escapeHtml(actionInfo?.label || c.next_action) : ""}</div>
            <div class="when">${fmtDateTime(c.called_at)}${c.next_action_at ? " · fällig " + fmtDateTime(c.next_action_at) : ""}${c.termin_at ? " · Termin " + fmtDateTime(c.termin_at) : ""}</div>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    if (listEl) listEl.innerHTML = `<p style="color:var(--danger);font-size:13px">Verlauf konnte nicht geladen werden.</p>`;
  }
}
