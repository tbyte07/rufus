// Gemeinsame Metadaten für die zwei Erfassungs-Achsen, damit Liste, Detail
// und Dashboard exakt dieselben Labels/Farben verwenden.

export const STUFEN = [
  { key: "falsche_nummer", label: "Falsche Nummer", kicker: "1", desc: "Nummer tot / kein Anschluss" },
  { key: "nicht_erreicht", label: "Nicht erreicht", kicker: "2", desc: "Klingelt durch, besetzt, Mailbox" },
  { key: "gatekeeper", label: "Gatekeeper", kicker: "3", desc: "Jemand dran, aber nicht durchgekommen" },
  { key: "entscheider", label: "Entscheider", kicker: "4", desc: "Entscheider gesprochen, kein Termin" },
  { key: "termin", label: "Termin!", kicker: "5", desc: "Termin vereinbart" },
];
export const STUFEN_BY_KEY = Object.fromEntries(STUFEN.map((s) => [s.key, s]));

// Reihenfolge trägt den Trichter (aufsteigend, wie weit man kam).
export const STUFEN_ORDER = ["nicht_erreicht", "gatekeeper", "entscheider", "termin"];

export const ACTIONS = [
  { key: "keine", label: "Keine weitere Aktion" },
  { key: "info_mail", label: "Infos senden + Follow-up" },
  { key: "rueckruf", label: "Rückruf" },
  { key: "tot", label: "Lead abschließen" },
];
export const ACTIONS_BY_KEY = Object.fromEntries(ACTIONS.map((a) => [a.key, a]));

export const LEAD_STATUS_LABEL = {
  neu: "Neu",
  in_arbeit: "In Arbeit",
  termin: "Termin",
  tot: "Abgeschlossen",
};
