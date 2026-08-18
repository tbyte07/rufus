// Dashboard: Tageszahlen, Quoten, Trichter, 14-Tage-Verlauf, beste Anrufzeit.
// Holt die Calls bei jedem Aufruf frisch (kein Caching nötig bei dieser Datenmenge),
// damit die Zahlen immer den aktuellen Stand zeigen.
import * as api from "../api.js";
import { toast } from "../toast.js";
import { getSettings } from "../settings.js";
import { escapeHtml } from "../util.js";

const STAGE_COLOR = {
  versucht: "var(--text-faint)",
  gatekeeper: "var(--stage-gatekeeper)",
  entscheider: "var(--stage-entscheider)",
  termin: "var(--stage-termin)",
};
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export async function renderDashboard(container) {
  container.innerHTML = `
    <div class="view-header"><div><h1>Dashboard</h1><div class="sub">Deine Cold-Call-Performance im Überblick.</div></div></div>
    <div id="dash-body"><p class="sub">Lädt...</p></div>
  `;
  let calls;
  try {
    calls = await api.fetchAllCalls();
  } catch (err) {
    toast("Dashboard-Daten konnten nicht geladen werden: " + err.message, "error");
    document.getElementById("dash-body").innerHTML = `<p style="color:var(--danger)">Fehler beim Laden.</p>`;
    return;
  }
  const body = document.getElementById("dash-body");
  if (!body) return;

  if (!calls.length) {
    body.innerHTML = `<div class="empty-state"><div class="big">📞</div>Noch keine Anrufe erfasst.<br/>Starte in der <a href="#/liste">Leadliste</a> mit deinem ersten Call.</div>`;
    return;
  }

  const valid = calls.filter((c) => c.stufe !== "falsche_nummer");
  const settings = getSettings();

  body.innerHTML = `
    <div class="kpi-grid" id="kpi-heute"></div>
    <div class="kpi-grid" id="kpi-quoten"></div>
    <div class="dash-grid">
      <div class="card card-pad chart-card"><h3>Trichter</h3><div id="funnel"></div></div>
      <div class="card card-pad chart-card"><h3>Offen</h3><div id="offen"></div></div>
    </div>
    <div class="dash-grid" style="margin-top:18px">
      <div class="card card-pad chart-card"><h3>Verlauf (14 Tage)</h3><div id="verlauf"></div></div>
      <div class="card card-pad chart-card"><h3>Beste Anrufzeit</h3><div id="heatmap"></div></div>
    </div>
  `;

  renderHeute(valid, settings);
  renderQuoten(valid);
  renderFunnel(valid);
  renderVerlauf(valid);
  renderHeatmap(valid);
  await renderOffen();
}

function isToday(iso) {
  const d = new Date(iso), n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

function renderHeute(valid, settings) {
  const today = valid.filter((c) => isToday(c.called_at));
  const contacted = today.filter((c) => c.stufe !== "nicht_erreicht").length;
  const entscheider = today.filter((c) => ["entscheider", "termin"].includes(c.stufe)).length;
  const termine = today.filter((c) => c.stufe === "termin").length;

  document.getElementById("kpi-heute").innerHTML = kpi("Anrufe heute", today.length, `Ziel ${settings.dailyGoalCalls}`) +
    kpi("Kontakte heute", contacted) +
    kpi("Entscheider-Gespräche", entscheider) +
    kpi("Termine heute", termine, `Ziel ${settings.dailyGoalTermine}`, true);
}

function kpi(label, value, sub, accent) {
  return `<div class="kpi"><div class="label">${escapeHtml(label)}</div><div class="value${accent ? " accent" : ""}">${value}</div>${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ""}</div>`;
}

function pct(n, d) {
  if (!d) return "–";
  return Math.round((n / d) * 100) + "%";
}

function renderQuoten(valid) {
  const total = valid.length;
  const kontakt = valid.filter((c) => c.stufe !== "nicht_erreicht").length;
  const entscheider = valid.filter((c) => ["entscheider", "termin"].includes(c.stufe)).length;
  const termine = valid.filter((c) => c.stufe === "termin").length;

  document.getElementById("kpi-quoten").innerHTML =
    kpi("Erreichbarkeit", pct(kontakt, total), `${kontakt} von ${total} Anrufen`) +
    kpi("Gatekeeper-Durchkommquote", pct(entscheider, kontakt), `${entscheider} von ${kontakt} Kontakten`) +
    kpi("Termin-Quote", pct(termine, entscheider), `${termine} von ${entscheider} Entscheider-Gesprächen`) +
    kpi("Anrufe pro Termin", termine ? Math.round(total / termine) : "–", termine ? `bei ${termine} Terminen` : "noch kein Termin");
}

function renderFunnel(valid) {
  const total = valid.length;
  const gatekeeper = valid.filter((c) => ["gatekeeper", "entscheider", "termin"].includes(c.stufe)).length;
  const entscheider = valid.filter((c) => ["entscheider", "termin"].includes(c.stufe)).length;
  const termin = valid.filter((c) => c.stufe === "termin").length;
  const stages = [
    { label: "Angerufen", count: total, color: STAGE_COLOR.versucht },
    { label: "Kontakt (Gatekeeper+)", count: gatekeeper, color: STAGE_COLOR.gatekeeper },
    { label: "Entscheider erreicht", count: entscheider, color: STAGE_COLOR.entscheider },
    { label: "Termin", count: termin, color: STAGE_COLOR.termin },
  ];
  const max = total || 1;
  document.getElementById("funnel").innerHTML = stages.map((s) => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-dim);margin-bottom:4px">
        <span>${escapeHtml(s.label)}</span><span>${s.count}</span>
      </div>
      <div style="background:var(--bg-input);border-radius:6px;height:10px;overflow:hidden">
        <div style="width:${(s.count / max) * 100}%;background:${s.color};height:100%;border-radius:6px"></div>
      </div>
    </div>
  `).join("");
}

function renderVerlauf(valid) {
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }
  const counts = days.map((d) => {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const dayCalls = valid.filter((c) => { const t = new Date(c.called_at); return t >= d && t < next; });
    return { date: d, calls: dayCalls.length, termine: dayCalls.filter((c) => c.stufe === "termin").length };
  });
  const max = Math.max(1, ...counts.map((c) => c.calls));
  const w = 700, h = 150, barW = w / 14 - 6, padBottom = 22;

  let bars = "", dots = "", labels = "";
  counts.forEach((c, i) => {
    const x = i * (w / 14) + 3;
    const barH = (c.calls / max) * (h - padBottom - 10);
    const y = h - padBottom - barH;
    bars += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="2" fill="var(--accent)" opacity="0.85"><title>${c.date.toLocaleDateString("de-DE")}: ${c.calls} Anrufe</title></rect>`;
    if (c.termine > 0) {
      dots += `<circle cx="${x + barW / 2}" cy="${h - padBottom - barH - 8}" r="4" fill="var(--stage-termin)"><title>${c.termine} Termin(e)</title></circle>`;
    }
    if (i % 2 === 0) {
      labels += `<text x="${x + barW / 2}" y="${h - 6}" font-size="9" fill="var(--text-faint)" text-anchor="middle">${c.date.getDate()}.${c.date.getMonth() + 1}.</text>`;
    }
  });

  document.getElementById("verlauf").innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet">${bars}${dots}${labels}</svg>
    <div class="sub" style="margin-top:4px">Balken = Anrufe, grüner Punkt = Termin am Tag</div>
  `;
}

function renderHeatmap(valid) {
  const startHour = 8, endHour = 19;
  const hours = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  const cells = {}; // "day-hour" -> {attempts, contacted}
  for (const c of valid) {
    const d = new Date(c.called_at);
    const day = (d.getDay() + 6) % 7; // 0=Mo
    const hour = d.getHours();
    if (hour < startHour || hour > endHour) continue;
    const key = `${day}-${hour}`;
    if (!cells[key]) cells[key] = { attempts: 0, contacted: 0 };
    cells[key].attempts++;
    if (c.stufe !== "nicht_erreicht") cells[key].contacted++;
  }

  const cellW = 34, cellH = 22, labelW = 26, labelH = 16;
  const w = labelW + hours.length * cellW, h = labelH + 7 * cellH;

  let html = `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto" preserveAspectRatio="xMidYMid meet">`;
  hours.forEach((hr, i) => {
    html += `<text x="${labelW + i * cellW + cellW / 2}" y="12" font-size="9" fill="var(--text-faint)" text-anchor="middle">${hr}</text>`;
  });
  WEEKDAYS.forEach((wd, day) => {
    html += `<text x="12" y="${labelH + day * cellH + cellH / 2 + 3}" font-size="9" fill="var(--text-faint)" text-anchor="middle">${wd}</text>`;
    hours.forEach((hr, i) => {
      const cell = cells[`${day}-${hr}`];
      const rate = cell ? cell.contacted / cell.attempts : null;
      const fill = rate === null ? "var(--bg-input)" : rate === 0 ? "#2a3145" : `rgba(52, 211, 153, ${0.15 + rate * 0.75})`;
      const title = cell ? `${WEEKDAYS[day]} ${hr}:00 - ${cell.contacted}/${cell.attempts} Kontakt` : "keine Anrufe";
      html += `<rect x="${labelW + i * cellW + 1}" y="${labelH + day * cellH + 1}" width="${cellW - 2}" height="${cellH - 2}" rx="3" fill="${fill}"><title>${title}</title></rect>`;
    });
  });
  html += `</svg><div class="sub" style="margin-top:4px">Grüner = höhere Kontaktquote in diesem Zeitfenster</div>`;
  document.getElementById("heatmap").innerHTML = html;
}

async function renderOffen() {
  let leads;
  try {
    leads = await api.fetchLeads();
  } catch {
    document.getElementById("offen").innerHTML = `<p class="sub">Konnte nicht geladen werden.</p>`;
    return;
  }
  const rueckrufe = leads.filter((l) => l.next_action === "rueckruf").length;
  const mails = leads.filter((l) => l.next_action === "mail").length;
  const termine = leads.filter((l) => l.lead_status === "termin").length;
  document.getElementById("offen").innerHTML = `
    <dl class="info-grid">
      <dt>Fällige Rückrufe</dt><dd>${rueckrufe}</dd>
      <dt>Offene Mails</dt><dd>${mails}</dd>
      <dt>Anstehende Termine</dt><dd>${termine}</dd>
    </dl>
  `;
}
