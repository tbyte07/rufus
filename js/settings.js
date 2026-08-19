// Persönliche Einstellungen - bewusst in localStorage statt Supabase, weil sie
// rein lokal/geräteweise sind (Mailvorlage, Tagesziel, Rufus-Name).
const KEY = "coldcall_settings";

const DEFAULTS = {
  mailTerminSubject: "Termin bestätigt - {firma}",
  mailTerminBody:
    "Hallo,\n\nvielen Dank für das Telefonat eben - wie besprochen halten wir uns den Termin am {termin} fest." +
    "\n\nBei Fragen vorab einfach melden.\n\nViele Grüße\nTim",
  mailInfoSubject: "Infos wie besprochen - {firma}",
  mailInfoBody:
    "Hallo,\n\nvielen Dank für das kurze Telefonat eben. Wie besprochen sende ich dir ein paar Infos zu." +
    "\n\nIch melde mich in den nächsten Tagen nochmal, um zu hören, was du denkst.\n\nViele Grüße\nTim",
  mailFollowupDays: 3,
  dailyGoalCalls: 40,
  dailyGoalTermine: 2,
  buddyName: "Rufus",
  buddyEnabled: true,
};

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(patch) {
  const merged = { ...getSettings(), ...patch };
  localStorage.setItem(KEY, JSON.stringify(merged));
  return merged;
}

export function fillTemplate(str, lead, extra = {}) {
  return (str || "")
    .replaceAll("{firma}", lead.firma || "")
    .replaceAll("{ort}", lead.ort || "")
    .replaceAll("{ansprechpartner}", lead.ansprechpartner || "")
    .replaceAll("{notiz}", lead.notiz || "")
    .replaceAll("{termin}", extra.termin || "");
}
