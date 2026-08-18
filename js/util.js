// Kleine, abhängigkeitsfreie Helfer, die von mehreren Modulen gebraucht werden.

export function normalizePhone(raw) {
  if (!raw) return "";
  return String(raw).replace(/[^0-9]/g, "");
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function uid() {
  return "id_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const DATE_FMT = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
const TIME_FMT = new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" });
const DATETIME_FMT = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
});
const WEEKDAY_FMT = new Intl.DateTimeFormat("de-DE", { weekday: "short" });

export function fmtDate(iso) {
  if (!iso) return "";
  return DATE_FMT.format(new Date(iso));
}
export function fmtTime(iso) {
  if (!iso) return "";
  return TIME_FMT.format(new Date(iso));
}
export function fmtDateTime(iso) {
  if (!iso) return "";
  return DATETIME_FMT.format(new Date(iso));
}
export function fmtWeekday(iso) {
  if (!iso) return "";
  return WEEKDAY_FMT.format(new Date(iso));
}

// Menschlich lesbare relative Zeit, z.B. "in 12 Min" oder "vor 2 Std überfällig".
export function fmtRelative(iso) {
  if (!iso) return "";
  const target = new Date(iso).getTime();
  const now = Date.now();
  const diffMs = target - now;
  const diffMin = Math.round(diffMs / 60000);
  const abs = Math.abs(diffMin);

  let unit, value;
  if (abs < 60) {
    unit = "Min"; value = abs;
  } else if (abs < 60 * 24) {
    unit = "Std"; value = Math.round(abs / 60);
  } else {
    unit = "Tage"; value = Math.round(abs / (60 * 24));
  }
  if (diffMin >= 0) {
    return value === 0 ? "jetzt" : `in ${value} ${unit}`;
  }
  return `vor ${value} ${unit} überfällig`;
}

export function isOverdue(iso) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function isDueSoon(iso, withinMinutes = 60) {
  if (!iso) return false;
  const diffMin = (new Date(iso).getTime() - Date.now()) / 60000;
  return diffMin >= 0 && diffMin <= withinMinutes;
}

// Schnellzeiten für die Rückruf-/Follow-up-Auswahl.
export function inMinutes(n) {
  return new Date(Date.now() + n * 60000).toISOString();
}
export function inHours(n) {
  return new Date(Date.now() + n * 3600000).toISOString();
}
export function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); // schon vorbei -> morgen
  return d.toISOString();
}
export function tomorrowAt(hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
export function nextWeekAt(hour = 9, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Wandelt ein <input type="datetime-local">-Value (lokale Zeit, ohne Zeitzone)
// in einen korrekten ISO-String mit Zeitzone um.
export function localInputToIso(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
// ...und zurück, fürs Vorbefüllen von <input type="datetime-local">.
export function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
