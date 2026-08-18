// CSV-Import mit Vorschau vor dem Schreiben + Export in zwei Formaten.
// Ein Import überschreibt niemals Call-Daten (Notiz, Status, nächste Aktion) -
// er aktualisiert ausschließlich Stammdaten (Firma, Kontakt, ICP-Urteil).
import * as store from "../store.js";
import { toast } from "../toast.js";
import {
  parseCSV, csvRecordToLead, STAMMDATEN_FELDER,
  exportOriginalFormat, exportFullFormat, downloadCSV,
} from "../csv.js";
import { escapeHtml, fmtDate } from "../util.js";

let pendingDiff = null;

export async function renderImport(container) {
  container.innerHTML = `
    <div class="view-header">
      <div><h1>Import &amp; Export</h1>
      <div class="sub">Lade eine frisch angereicherte Liste hoch oder exportiere deinen aktuellen Stand.</div></div>
    </div>

    <div class="card card-pad" style="margin-bottom:24px">
      <h3 style="margin-bottom:14px">CSV importieren</h3>
      <div class="dropzone" id="dropzone">
        <div class="big">⇪</div>
        <div>CSV-Datei hierher ziehen oder <strong>klicken zum Auswählen</strong></div>
        <div class="sub" style="margin-top:6px">Erwartetes Format: ';'-getrennt, wie aus deiner Lead-Liste exportiert.</div>
      </div>
      <input type="file" id="file-input" accept=".csv,text/csv" hidden />
      <div id="import-preview"></div>
    </div>

    <div class="card card-pad">
      <h3 style="margin-bottom:6px">Export</h3>
      <p class="sub" style="margin-bottom:14px">Originalformat passt exakt zu deiner icp-check-Pipeline. Vollexport enthält zusätzlich Status und Call-Daten für Numbers.</p>
      <div class="btn-row">
        <button class="btn" id="export-original">Originalformat (.csv)</button>
        <button class="btn" id="export-full">Vollexport mit Call-Daten (.csv)</button>
      </div>
    </div>
  `;

  const dropzone = container.querySelector("#dropzone");
  const fileInput = container.querySelector("#file-input");

  dropzone.addEventListener("click", () => fileInput.click());
  dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
  dropzone.addEventListener("dragleave", () => dropzone.classList.remove("dragover"));
  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  });
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  });

  container.querySelector("#export-original").addEventListener("click", () => {
    downloadCSV(`leads_export_${fmtDate(new Date().toISOString()).replaceAll(".", "-")}.csv`, exportOriginalFormat(store.getState().leads));
    toast("Export gestartet.", "ok");
  });
  container.querySelector("#export-full").addEventListener("click", () => {
    downloadCSV(`leads_vollexport_${fmtDate(new Date().toISOString()).replaceAll(".", "-")}.csv`, exportFullFormat(store.getState().leads));
    toast("Export gestartet.", "ok");
  });
}

function handleFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const { records } = parseCSV(String(reader.result));
      if (!records.length) {
        toast("Die Datei enthält keine Zeilen.", "error");
        return;
      }
      const diff = computeDiff(records);
      pendingDiff = diff;
      renderPreview(diff, file.name);
    } catch (err) {
      toast("CSV konnte nicht gelesen werden: " + err.message, "error");
    }
  };
  reader.onerror = () => toast("Datei konnte nicht gelesen werden.", "error");
  reader.readAsText(file, "utf-8");
}

function matchKey(row) {
  return `${(row.firma || "").trim().toLowerCase()}|${(row.ort || "").trim().toLowerCase()}`;
}

function diffStammdaten(existing, incoming) {
  const patch = {};
  for (const field of STAMMDATEN_FELDER) {
    const a = existing[field] ?? null;
    const b = incoming[field] ?? null;
    if (a !== b && !(a === "" && b === null) && !(a === null && b === "")) patch[field] = b;
  }
  return patch;
}

function computeDiff(records) {
  const existingLeads = store.getState().leads;
  const byPhone = new Map();
  const byFirmaOrt = new Map();
  for (const l of existingLeads) {
    if (l.telefon_norm) byPhone.set(l.telefon_norm, l);
    const key = matchKey(l);
    if (!byFirmaOrt.has(key)) byFirmaOrt.set(key, l);
  }

  const mapped = records.map(csvRecordToLead);
  const withoutFirma = mapped.filter((r) => !r.firma).length;
  const rows = mapped.filter((r) => r.firma);

  const toInsertRaw = [];
  const toUpdate = [];
  let unchanged = 0;

  for (const incoming of rows) {
    const existing =
      (incoming.telefon_norm && byPhone.get(incoming.telefon_norm)) ||
      byFirmaOrt.get(matchKey(incoming)) ||
      null;

    if (existing) {
      const patch = diffStammdaten(existing, incoming);
      if (Object.keys(patch).length) toUpdate.push({ id: existing.id, patch, firma: existing.firma });
      else unchanged++;
    } else {
      toInsertRaw.push(incoming);
    }
  }

  // Dubletten innerhalb der importierten Datei selbst zusammenfassen (letzter Stand gewinnt).
  const seenPhone = new Set();
  const seenFirmaOrt = new Set();
  const toInsert = [];
  for (const r of toInsertRaw) {
    if (r.telefon_norm) {
      if (seenPhone.has(r.telefon_norm)) continue;
      seenPhone.add(r.telefon_norm);
    } else {
      const key = matchKey(r);
      if (seenFirmaOrt.has(key)) continue;
      seenFirmaOrt.add(key);
    }
    toInsert.push(r);
  }

  return { toInsert, toUpdate, unchanged, skipped: withoutFirma, total: records.length };
}

function renderPreview(diff, filename) {
  const el = document.getElementById("import-preview");
  if (!el) return;
  el.innerHTML = `
    <div class="import-summary">
      <div class="import-stat new"><div class="n">${diff.toInsert.length}</div>Neu</div>
      <div class="import-stat updated"><div class="n">${diff.toUpdate.length}</div>Aktualisiert</div>
      <div class="import-stat unchanged"><div class="n">${diff.unchanged}</div>Unverändert</div>
    </div>
    ${diff.skipped ? `<p class="sub" style="color:var(--danger)">${diff.skipped} Zeile(n) ohne Firmennamen übersprungen.</p>` : ""}
    <p class="sub" style="margin-bottom:14px">Datei: ${escapeHtml(filename)} · ${diff.total} Zeilen gelesen. Notizen, Status und geplante Aktionen bleiben unangetastet.</p>
    <div class="btn-row">
      <button class="btn primary" id="confirm-import">In Datenbank übernehmen</button>
      <button class="btn ghost" id="cancel-import">Abbrechen</button>
    </div>
  `;
  document.getElementById("confirm-import").addEventListener("click", applyImport);
  document.getElementById("cancel-import").addEventListener("click", () => { pendingDiff = null; el.innerHTML = ""; });
}

async function applyImport() {
  if (!pendingDiff) return;
  const btn = document.getElementById("confirm-import");
  btn.disabled = true;
  btn.textContent = "Wird übernommen...";
  try {
    await store.bulkUpsertLeads({ toInsert: pendingDiff.toInsert, toUpdate: pendingDiff.toUpdate });
    toast(`Import fertig: ${pendingDiff.toInsert.length} neu, ${pendingDiff.toUpdate.length} aktualisiert.`, "ok");
    pendingDiff = null;
    document.getElementById("import-preview").innerHTML = "";
  } catch (err) {
    toast("Import fehlgeschlagen: " + err.message, "error");
    btn.disabled = false;
    btn.textContent = "In Datenbank übernehmen";
  }
}
