// Prüft minütlich, welche Rückrufe/Follow-ups fällig sind, und feuert dafür
// eine Browser-Benachrichtigung (einmal pro Fälligkeit) sowie einen Rufus-Hinweis.
import * as store from "./store.js";
import { buddy } from "./buddy.js";

const NOTIFIED_KEY = "coldcall_notified_ids";
let notifiedIds = loadNotified();
let lastCallTime = Date.now();
let sleepCheckStarted = false;

function loadNotified() {
  try {
    return new Set(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function saveNotified() {
  // nur die letzten 200 IDs behalten, damit das nicht unbegrenzt wächst
  const arr = Array.from(notifiedIds).slice(-200);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
}

export async function requestPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "default") {
    return Notification.requestPermission();
  }
  return Notification.permission;
}

function fireBrowserNotification(lead) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const label = lead.next_action === "info_mail" ? "Follow-up" : "Rückruf";
  const body = `${label} fällig: ${lead.firma}${lead.ort ? " · " + lead.ort : ""}`;

  const swReady = navigator.serviceWorker?.ready;
  if (swReady) {
    swReady.then((reg) =>
      reg.showNotification("Rufus erinnert dich", {
        body,
        tag: `lead-${lead.id}`,
        data: { leadId: lead.id },
        icon: undefined,
      })
    ).catch(() => new Notification("Rufus erinnert dich", { body }));
  } else {
    new Notification("Rufus erinnert dich", { body });
  }
}

function checkDue() {
  const now = Date.now();
  const leads = store.getState().leads;
  let anyOverdue = false;
  for (const lead of leads) {
    if (!lead.next_action_at) continue;
    const due = new Date(lead.next_action_at).getTime();
    if (due > now) continue;
    anyOverdue = true;
    const key = `${lead.id}:${lead.next_action_at}`;
    if (!notifiedIds.has(key)) {
      notifiedIds.add(key);
      saveNotified();
      fireBrowserNotification(lead);
    }
  }
  if (anyOverdue && Date.now() - lastCallTime > 20000) {
    buddy.setState("rueckruf", { autoIdleAfter: 4000 });
  }
}

// Wenn lange nichts erfasst wurde, döst Rufus sanft ein - ein Reminder,
// weiterzumachen, ohne mahnend zu wirken.
function checkSleep() {
  const idleMs = Date.now() - lastCallTime;
  if (idleMs > 25 * 60 * 1000) {
    buddy.setState("schlaeft", { autoIdleAfter: null });
  }
}

export function markActivity() {
  lastCallTime = Date.now();
}

export function startNotifyWatcher() {
  requestPermission();
  checkDue();
  setInterval(checkDue, 60000);
  if (!sleepCheckStarted) {
    sleepCheckStarted = true;
    setInterval(checkSleep, 60000);
  }
}
