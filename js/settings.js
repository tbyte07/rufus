// Persönliche Einstellungen - bewusst in localStorage statt Supabase, weil sie
// rein lokal/geräteweise sind (Mailvorlage, Tagesziel, Rufus-Name).
const KEY = "coldcall_settings";

const DEFAULTS = {
  mailSubject: "Kurzes Follow-up - {firma}",
  mailBody:
    "Hallo,\n\nvielen Dank für das kurze Telefonat eben.\n\nWie besprochen melde ich mich hiermit per Mail." +
    "\n\nViele Grüße\nTim",
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

export function fillTemplate(str, lead) {
  return (str || "")
    .replaceAll("{firma}", lead.firma || "")
    .replaceAll("{ort}", lead.ort || "")
    .replaceAll("{ansprechpartner}", lead.ansprechpartner || "")
    .replaceAll("{notiz}", lead.notiz || "");
}
