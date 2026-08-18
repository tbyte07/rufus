// RFC4180-artiger CSV Parser/Writer, exakt auf Tims Format zugeschnitten:
// ';'-getrennt, CRLF-Zeilenenden, UTF-8 ohne BOM, Felder in Anführungszeichen
// dürfen eingebettete Semikolons, Zeilenumbrüche und verdoppelte Anführungszeichen
// enthalten (seine ICP-Begründungsspalte tut das routinemäßig).
import { normalizePhone } from "./util.js";

const ORIGINAL_HEADERS = ["Firma", "GS_Website", "Telefonnummer", "ICP Status", "ICP", "Website", "Ort", "E-Mail"];

export function parseCSV(text, delimiter = ";") {
  // BOM defensiv entfernen, falls doch mal vorhanden.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      // \r\n oder einsames \r als Zeilenende behandeln
      if (text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  // letztes Feld/Zeile, falls die Datei nicht mit Zeilenumbruch endet
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }

  // Leere Schlusszeilen (z.B. durch ein abschließendes \r\n) rauswerfen
  while (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === "") {
    rows.pop();
  }

  if (!rows.length) return { headers: [], records: [] };
  const headers = rows[0];
  const records = rows.slice(1).map((r) => {
    const rec = {};
    headers.forEach((h, idx) => (rec[h] = r[idx] !== undefined ? r[idx] : ""));
    return rec;
  });
  return { headers, records };
}

function needsQuoting(value, delimiter) {
  return value.includes(delimiter) || value.includes('"') || value.includes("\n") || value.includes("\r");
}
function quoteField(value, delimiter) {
  const str = value === null || value === undefined ? "" : String(value);
  if (needsQuoting(str, delimiter)) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

export function writeCSV(headers, records, delimiter = ";") {
  const lines = [headers.map((h) => quoteField(h, delimiter)).join(delimiter)];
  for (const rec of records) {
    lines.push(headers.map((h) => quoteField(rec[h], delimiter)).join(delimiter));
  }
  return lines.join("\r\n") + "\r\n";
}

// Ein CSV-Record (Originalformat) auf die Lead-Datenbankspalten abbilden.
export function csvRecordToLead(rec) {
  const telefon = (rec["Telefonnummer"] || "").trim();
  return {
    firma: (rec["Firma"] || "").trim(),
    gs_website: (rec["GS_Website"] || "").trim() || null,
    telefon: telefon || null,
    telefon_norm: normalizePhone(telefon) || null,
    icp_status: (rec["ICP Status"] || "").trim().toUpperCase() === "JA" ? "JA"
      : (rec["ICP Status"] || "").trim().toUpperCase() === "NEIN" ? "NEIN" : null,
    icp_begruendung: (rec["ICP"] || "").trim() || null,
    website: (rec["Website"] || "").trim() || null,
    ort: (rec["Ort"] || "").trim() || null,
    email: (rec["E-Mail"] || "").trim() || null,
  };
}

// Nur die Stammdaten-Felder, die ein Import überschreiben darf - niemals
// Call-bezogene Felder wie notiz, lead_status, next_action, ...
export const STAMMDATEN_FELDER = [
  "firma", "gs_website", "telefon", "telefon_norm", "icp_status", "icp_begruendung", "website", "ort", "email",
];

export function leadToOriginalRecord(lead) {
  return {
    Firma: lead.firma || "",
    GS_Website: lead.gs_website || "",
    Telefonnummer: lead.telefon || "",
    "ICP Status": lead.icp_status || "",
    ICP: lead.icp_begruendung || "",
    Website: lead.website || "",
    Ort: lead.ort || "",
    "E-Mail": lead.email || "",
  };
}

export function exportOriginalFormat(leads) {
  return writeCSV(ORIGINAL_HEADERS, leads.map(leadToOriginalRecord));
}

const FULL_HEADERS = [
  ...ORIGINAL_HEADERS,
  "Notiz", "Lead-Status", "Nächste Aktion", "Nächste Aktion am", "Termin am", "Letzter Anruf", "Anzahl Anrufe",
];

export function exportFullFormat(leads) {
  const records = leads.map((lead) => ({
    ...leadToOriginalRecord(lead),
    Notiz: lead.notiz || "",
    "Lead-Status": lead.lead_status || "",
    "Nächste Aktion": lead.next_action || "",
    "Nächste Aktion am": lead.next_action_at || "",
    "Termin am": lead.termin_at || "",
    "Letzter Anruf": lead.last_call_at || "",
    "Anzahl Anrufe": lead.call_count ?? 0,
  }));
  return writeCSV(FULL_HEADERS, records);
}

export function downloadCSV(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
