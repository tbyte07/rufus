// Persönliche Einstellungen: Mailvorlage, Tagesziel, Rufus-Name/Sichtbarkeit,
// Browser-Benachrichtigungen erlauben.
import { getSettings, saveSettings } from "../settings.js";
import { requestPermission } from "../notify.js";
import { toast } from "../toast.js";
import { escapeHtml } from "../util.js";

export async function renderEinstellungen(container) {
  const s = getSettings();
  const permission = ("Notification" in window) ? Notification.permission : "unsupported";

  container.innerHTML = `
    <div class="view-header"><div><h1>Einstellungen</h1><div class="sub">Ganz persönlich - nur auf diesem Gerät gespeichert.</div></div></div>

    <div class="card card-pad" style="margin-bottom:20px;max-width:640px">
      <h3 style="margin-bottom:4px">Mail bei Termin</h3>
      <p class="sub" style="margin-bottom:14px">Wird vorgeschlagen, sobald du einen Termin einträgst. Platzhalter: <code>{firma}</code> <code>{ort}</code> <code>{ansprechpartner}</code> <code>{notiz}</code> <code>{termin}</code></p>
      <div class="field"><label>Betreff</label><input type="text" id="s-termin-subject" value="${escapeHtml(s.mailTerminSubject)}" /></div>
      <div class="field"><label>Text</label><textarea id="s-termin-body" style="min-height:120px">${escapeHtml(s.mailTerminBody)}</textarea></div>
    </div>

    <div class="card card-pad" style="margin-bottom:20px;max-width:640px">
      <h3 style="margin-bottom:4px">Mail bei Interesse (kein Termin)</h3>
      <p class="sub" style="margin-bottom:14px">Wird vorgeschlagen bei "Infos senden + Follow-up". Platzhalter: <code>{firma}</code> <code>{ort}</code> <code>{ansprechpartner}</code> <code>{notiz}</code></p>
      <div class="field"><label>Betreff</label><input type="text" id="s-info-subject" value="${escapeHtml(s.mailInfoSubject)}" /></div>
      <div class="field"><label>Text</label><textarea id="s-info-body" style="min-height:120px">${escapeHtml(s.mailInfoBody)}</textarea></div>
      <div class="field"><label>Follow-up-Erinnerung nach dieser Mail (Tage)</label><input type="text" id="s-followup-days" value="${s.mailFollowupDays}" style="max-width:100px" /></div>
    </div>

    <div class="card card-pad" style="margin-bottom:20px;max-width:640px">
      <h3 style="margin-bottom:14px">Tagesziel</h3>
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        <div class="field" style="max-width:160px"><label>Anrufe pro Tag</label><input type="text" id="s-goal-calls" value="${s.dailyGoalCalls}" /></div>
        <div class="field" style="max-width:160px"><label>Termine pro Tag</label><input type="text" id="s-goal-termine" value="${s.dailyGoalTermine}" /></div>
      </div>
    </div>

    <div class="card card-pad" style="margin-bottom:20px;max-width:640px">
      <h3 style="margin-bottom:14px">Rufus</h3>
      <div class="field" style="max-width:260px"><label>Name</label><input type="text" id="s-buddy-name" value="${escapeHtml(s.buddyName)}" /></div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="s-buddy-enabled" ${s.buddyEnabled ? "checked" : ""} style="width:auto" />
        <span>Rufus in der Ecke anzeigen</span>
      </label>
    </div>

    <div class="card card-pad" style="max-width:640px">
      <h3 style="margin-bottom:10px">Benachrichtigungen</h3>
      <p class="sub" style="margin-bottom:12px">Status: <strong>${permissionLabel(permission)}</strong></p>
      <button class="btn" id="s-request-perm" ${permission === "granted" ? "disabled" : ""}>Browser-Benachrichtigungen erlauben</button>
    </div>

    <div class="btn-row" style="margin-top:22px;max-width:640px">
      <button class="btn primary lg" id="s-save">Speichern</button>
      <span id="s-saved" style="align-self:center;color:var(--success);font-size:13px"></span>
    </div>
  `;

  container.querySelector("#s-request-perm").addEventListener("click", async () => {
    const result = await requestPermission();
    toast(result === "granted" ? "Benachrichtigungen erlaubt." : "Nicht erlaubt.", result === "granted" ? "ok" : "error");
    renderEinstellungen(container);
  });

  container.querySelector("#s-save").addEventListener("click", () => {
    saveSettings({
      mailTerminSubject: container.querySelector("#s-termin-subject").value,
      mailTerminBody: container.querySelector("#s-termin-body").value,
      mailInfoSubject: container.querySelector("#s-info-subject").value,
      mailInfoBody: container.querySelector("#s-info-body").value,
      mailFollowupDays: Number(container.querySelector("#s-followup-days").value) || 3,
      dailyGoalCalls: Number(container.querySelector("#s-goal-calls").value) || 40,
      dailyGoalTermine: Number(container.querySelector("#s-goal-termine").value) || 2,
      buddyName: container.querySelector("#s-buddy-name").value || "Rufus",
      buddyEnabled: container.querySelector("#s-buddy-enabled").checked,
    });
    document.querySelector(".buddy-corner").style.display = getSettings().buddyEnabled ? "flex" : "none";
    const savedEl = container.querySelector("#s-saved");
    savedEl.textContent = "Gespeichert.";
    setTimeout(() => { if (savedEl) savedEl.textContent = ""; }, 2500);
    toast("Einstellungen gespeichert.", "ok");
  });
}

function permissionLabel(p) {
  if (p === "granted") return "Erlaubt";
  if (p === "denied") return "Blockiert (in den Browser-Einstellungen ändern)";
  if (p === "unsupported") return "Nicht unterstützt";
  return "Noch nicht angefragt";
}
