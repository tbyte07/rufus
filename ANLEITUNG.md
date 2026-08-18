# Rufus - Cold-Call-Tracker

Kleine, persönliche Web-App zum Cold Callen: Lead-Infos während des Calls,
Erfassen des Ergebnisses in zwei Klicks, Erinnerungen an Rückrufe/Follow-ups,
Dashboard mit echten Quoten - begleitet von Rufus, deinem Pixel-Kumpel.

Kein Node.js, kein Build-Schritt, keine Installation nötig. Reines
HTML/CSS/JavaScript, das direkt mit deiner Supabase-Datenbank spricht.

## Live schalten (5 Schritte, ~10 Minuten)

### 1. Auf Netlify Drop hochladen
1. Öffne [app.netlify.com/drop](https://app.netlify.com/drop) im Browser.
2. Falls du noch keinen Netlify-Account hast: kostenlos anlegen (reicht der
   Gratis-Tarif völlig).
3. Ziehe den kompletten `coldcall`-Ordner (diesen hier, mit `index.html` direkt
   drin) auf die Drop-Fläche.
4. Nach ein paar Sekunden bekommst du eine URL wie
   `https://irgendein-name.netlify.app` - das ist deine App-Adresse. Notiere sie.

Tipp: Unter "Site settings" kannst du der Seite später einen sprechenderen
Namen geben (z.B. `rufus-calls.netlify.app`).

### 2. Supabase für diese URL freischalten
Deine Datenbank existiert schon (Projekt `coldcall`, Region Frankfurt). Damit
der Login-Link funktioniert, muss Supabase deine neue URL kennen:

1. Öffne das Supabase-Dashboard → Projekt `coldcall` → **Authentication** →
   **URL Configuration**.
2. Trage bei **Site URL** deine Netlify-URL ein (z.B. `https://rufus-calls.netlify.app`).
3. Füge unter **Redirect URLs** zusätzlich ein:
   - deine Netlify-URL (gleich wie oben)
   - `http://localhost:8000` (falls du die App auch mal lokal testen willst)
4. Speichern.

### 3. Einloggen
1. Öffne deine Netlify-URL.
2. Gib deine E-Mail-Adresse ein, klicke "Link senden".
3. Öffne die E-Mail (Absender: Supabase), klicke den Link - du landest direkt
   wieder in der App, eingeloggt.

Das ist ein Magic-Link-Login: kein Passwort, das du dir merken musst. Der Link
ist einmalig und läuft nach kurzer Zeit ab.

### 4. Auf dem iPhone einrichten
1. Öffne die Netlify-URL in Safari auf dem iPhone.
2. Teilen-Symbol → "Zum Home-Bildschirm".
3. Ab jetzt startet die App wie eine normale App - inklusive Erinnerungen,
   wenn du das im Schritt danach erlaubst.

### 5. Deine Lead-Liste importieren
1. In der App: **Import/Export** in der Seitenleiste.
2. Deine bestehende CSV aus Numbers dort reinziehen (Numbers → Datei →
   Exportieren → CSV, oder die schon vorhandene
   `LeadListe_GS_Möbel_Claude Import-Tabelle 1.csv`).
3. Du siehst eine Vorschau (Neu/Aktualisiert/Unverändert) bevor irgendetwas
   geschrieben wird. Erst nach Klick auf "In Datenbank übernehmen" landen die
   Daten wirklich drin.
4. Ein Import überschreibt nie deine Notizen, deinen Status oder geplante
   Rückrufe - er aktualisiert nur Firma/Kontakt/ICP-Urteil.

Danach kannst du jederzeit eine frisch angereicherte Liste (z.B. nach einem
neuen Lauf von `icp-check`) erneut hochladen, ohne deinen Fortschritt zu
verlieren.

## Täglich benutzen

- **Leads**: deine Hauptansicht. Oben das Fälligkeitsband für alles, was
  gerade dran ist. Klick auf eine Zeile öffnet den Lead.
- **Anruf erfassen**: erst wählen, wie weit du gekommen bist (Tastenkürzel
  1-5), dann - falls nötig - was als Nächstes ansteht (Mail/Rückruf/
  Follow-up mit Zeitpunkt). "Anruf speichern" - fertig.
- **Mail senden**: öffnet dein normales Mailprogramm mit ausgefülltem
  Betreff/Text (Vorlage unter Einstellungen anpassbar). Die App merkt sich,
  dass die Mail raus ist, und plant automatisch das Follow-up.
- **Erinnerungen**: In der Seitenleiste siehst du immer, wie viele Rückrufe
  gerade fällig sind. Erlaube unter Einstellungen zusätzlich
  Browser-Benachrichtigungen, dann meldet sich Rufus auch, wenn die App im
  Hintergrund ist (Tab muss offen bleiben).
- **Dashboard**: Tageszahlen, Quoten, Trichter, 14-Tage-Verlauf und die
  Heatmap für deine beste Anrufzeit.
- **Export**: Originalformat (passt exakt zu deiner `icp-check`-Pipeline)
  oder Vollexport mit allen Call-Daten für Numbers.

## Lokal testen (optional, ohne Netlify)

Mit dem auf jedem Mac vorhandenen Python:

```bash
cd "/Users/tim/Claude Work/coldcall"
python3 -m http.server 8000
```

Dann `http://localhost:8000` im Browser öffnen. Für den Login muss
`http://localhost:8000` in Supabase unter Redirect URLs eingetragen sein
(siehe Schritt 2).

## Grenzen, die du kennen solltest

- **Erinnerungen brauchen einen offenen Tab.** Solange die App komplett zu
  ist, kann sie dich nicht von selbst anpiepsen. Für echtes Hintergrund-Push
  (auch bei geschlossener App, auch aufs Handy) gibt es einen Nachrüstweg
  über eine zeitgesteuerte Supabase-Funktion - sag Bescheid, falls dir das im
  Alltag fehlt.
- **Ein Nutzer, ein Gerätesatz.** Die App ist bewusst dein persönliches
  Werkzeug, keine Team-Lösung.
- **Einstellungen (Mailvorlage, Tagesziel, Rufus-Name)** liegen lokal im
  Browser, nicht in der Datenbank. Auf einem neuen Gerät musst du sie einmal
  neu setzen.

## Technischer Überblick (falls du oder jemand anders später weiterbaut)

- `config.js` - Supabase-URL und öffentlicher (anon) Schlüssel. Der Schlüssel
  darf öffentlich sein, weil Row Level Security in der Datenbank dafür sorgt,
  dass jeder Nutzer nur seine eigenen Zeilen sieht.
- `js/api.js` - sämtlicher Netzwerkverkehr (Login, Datenbank) als schlanke
  `fetch`-Aufrufe gegen Supabase, ohne die `supabase-js`-Bibliothek.
- `js/store.js` - zentraler Zustand im Speicher, den alle Ansichten teilen.
- `js/csv.js` - Import/Export, exakt auf das `;`-CRLF-Format deiner
  Numbers-Exporte zugeschnitten.
- `js/views/*.js` - eine Datei pro Ansicht (Liste, Lead-Detail, Dashboard,
  Import, Einstellungen).
- `js/buddy.js` - Rufus, gezeichnet aus kleinen Rechtecken statt Bilddateien.
- Datenbankschema: Tabellen `leads` (aktueller Stand) und `calls`
  (unveränderliches Anrufprotokoll, Basis für alle Dashboard-Zahlen).
