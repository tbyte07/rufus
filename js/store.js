// Zentraler Zustand im Speicher + Pub/Sub, damit Views sich nicht gegenseitig
// Daten zuschieben müssen. Kein Cache-Layer nötig - die Leadliste eines
// einzelnen Nutzers ist klein genug, um komplett im Speicher zu leben.
import * as api from "./api.js";

const state = {
  leads: [],
  leadsById: new Map(),
  loaded: false,
  loading: false,
};

const listeners = new Set();
function emit() {
  listeners.forEach((fn) => fn(state));
}
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function getState() {
  return state;
}
export function getLead(id) {
  return state.leadsById.get(id);
}

function indexLeads() {
  state.leadsById = new Map(state.leads.map((l) => [l.id, l]));
}

export async function loadLeads({ force = false } = {}) {
  if (state.loaded && !force) return state.leads;
  state.loading = true;
  emit();
  try {
    state.leads = await api.fetchLeads();
    indexLeads();
    state.loaded = true;
    return state.leads;
  } finally {
    state.loading = false;
    emit();
  }
}

export function patchLeadLocal(id, patch) {
  const lead = state.leadsById.get(id);
  if (!lead) return;
  Object.assign(lead, patch);
  emit();
}

export async function saveLeadNote(id, notiz) {
  patchLeadLocal(id, { notiz });
  await api.updateLead(id, { notiz });
}

// Erfasst einen Call: legt den Protokoll-Eintrag an und aktualisiert den
// Lead-Zustand (Stufe, nächste Aktion, Zähler) in einem Rutsch.
export async function recordCall({ leadId, stufe, nextAction, nextActionAt, terminAt, notiz }) {
  const call = await api.insertCall({
    lead_id: leadId,
    stufe,
    next_action: nextAction || "keine",
    next_action_at: nextActionAt || null,
    termin_at: terminAt || null,
    notiz: notiz || null,
  });

  const lead = state.leadsById.get(leadId);
  const patch = {
    last_call_at: call.called_at,
    call_count: (lead?.call_count || 0) + 1,
    next_action: nextAction && nextAction !== "keine" && nextAction !== "tot" ? nextAction : null,
    next_action_at: nextAction && nextAction !== "keine" && nextAction !== "tot" ? nextActionAt : null,
  };
  if (stufe === "termin") {
    patch.lead_status = "termin";
    patch.termin_at = terminAt || null;
  } else if (nextAction === "tot") {
    patch.lead_status = "tot";
  } else {
    patch.lead_status = "in_arbeit";
  }

  const updated = await api.updateLead(leadId, patch);
  if (updated) {
    Object.assign(lead, updated);
  } else {
    Object.assign(lead, patch);
  }
  emit();
  return call;
}

export async function addLead(row) {
  const created = await api.insertLead(row);
  state.leads.push(created);
  indexLeads();
  emit();
  return created;
}

// Für den Import: legt neue Leads an und aktualisiert bestehende in Batches,
// ohne je Call-Daten (Status, nächste Aktion, Notiz) zu berühren.
export async function bulkUpsertLeads({ toInsert, toUpdate }) {
  if (toInsert.length) {
    const created = await api.insertLeads(toInsert);
    state.leads.push(...created);
  }
  for (const { id, patch } of toUpdate) {
    const updated = await api.updateLead(id, patch);
    const lead = state.leadsById.get(id);
    if (lead && updated) Object.assign(lead, updated);
  }
  indexLeads();
  emit();
}

export function computeDueLeads() {
  const now = Date.now();
  return state.leads
    .filter((l) => l.next_action_at)
    .sort((a, b) => new Date(a.next_action_at) - new Date(b.next_action_at));
}
