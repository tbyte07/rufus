// Rufus - der Pixel-Begleiter. Blockige Figur aus reinen Rechtecken (Kopf/Körper
// mit genippten oberen Ecken, quadratische Augen, zwei Arme, drei Beine),
// bewusst flach und ohne Umrisslinie - genau wie die Referenzfigur, nur blau
// statt terrakotta. Alles sind achsenparallele Rechtecke, darum bleiben die
// Kanten immer scharf (kein Anti-Aliasing wie bei Kurven/Kreisen).

const GRID = 24; // logische Pixelbreite/-höhe des Canvas
const PALETTE = {
  body: "#5b7cfa",
  eye: "#12141c",
  confettiA: "#f5c542",
  confettiB: "#34d399",
  confettiC: "#f87171",
  confettiD: "#6c8cff",
  sleep: "#7c8aa8",
  sparkle: "#ffe08a",
  alert: "#f5a623",
};

// Grundform (bevor bounce/Animation angewendet wird), in lokalen Einheiten.
const BX = 5, BY = 6, BW = 14, BH = 12, CUT = 2;

let ctx = null;
let bubbleEl = null;
let rafId = null;
let bubbleTimeout = null;

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function clear() {
  ctx.clearRect(0, 0, GRID, GRID);
}
function drawSparkle(x, y, color, size = 2.2) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - size / 2), Math.round(y), Math.round(size), 1);
  ctx.fillRect(Math.round(x), Math.round(y - size / 2), 1, Math.round(size));
}

// -- Pose-Komposition -------------------------------------------------------
// pose: { bounce, eyes: 'open'|'closed'|'wide', armsUp?, sparkle?, alert?, particles? }

function drawRufus(pose) {
  clear();
  const bounce = pose.bounce || 0;
  const by = BY + bounce;

  // Kopf/Körper: Rechteck mit genippten oberen Ecken (kein Cut unten).
  px(BX + CUT, by, BW - 2 * CUT, CUT, PALETTE.body); // oberste Reihe, schmaler
  px(BX, by + CUT, BW, BH - CUT, PALETTE.body); // Rest voll breit

  // Arme
  const armY = by + BH * 0.4;
  const armSize = 2.4;
  if (pose.armsUp) {
    px(BX - armSize, by - 1, armSize, armSize, PALETTE.body);
    px(BX + BW, by - 1, armSize, armSize, PALETTE.body);
  } else {
    px(BX - armSize, armY, armSize, armSize, PALETTE.body);
    px(BX + BW, armY, armSize, armSize, PALETTE.body);
  }

  // Beine: drei Rechtecke unten, gleichmäßig verteilt
  const legW = 2.2, legH = 3, gap = 1.4;
  const legsTotal = legW * 3 + gap * 2;
  let lx = BX + (BW - legsTotal) / 2;
  for (let i = 0; i < 3; i++) {
    px(lx, by + BH, legW, legH, PALETTE.body);
    lx += legW + gap;
  }

  // Augen: schwarze Quadrate direkt auf dem Körper, keine weiße Lederhaut.
  const eyeSize = pose.eyes === "wide" ? 3 : 2.5;
  const eyeY = by + BH * 0.3;
  const eyeXs = [BX + BW * 0.22, BX + BW * 0.78 - eyeSize];
  if (pose.eyes === "closed") {
    for (const ex of eyeXs) px(ex, eyeY + eyeSize / 2 - 0.5, eyeSize, 1, PALETTE.eye);
  } else {
    for (const ex of eyeXs) px(ex, eyeY, eyeSize, eyeSize, PALETTE.eye);
  }

  if (pose.sparkle) {
    drawSparkle(BX + BW + 2, by - 2, PALETTE.sparkle);
    drawSparkle(BX - 2, by, PALETTE.sparkle, 1.6);
  }
  if (pose.alert) {
    const pulse = 1.6 + Math.sin(Date.now() / 180) * 0.4;
    px(BX + BW - pulse / 2, by - 2 - pulse / 2, pulse, pulse, PALETTE.alert);
  }

  for (const p of pose.particles || []) {
    px(p.x, p.y, p.size || 1.5, p.size || 1.5, p.color);
  }
}

// -- Zustandsmaschine -------------------------------------------------------

const QUIPS = {
  idle: ["Bereit, wenn du es bist.", "Nächster Lead wartet.", "Ruhig durchatmen."],
  call: ["Dranbleiben!", "Du machst das gut.", "Klare Stimme, lockerer Ton."],
  termin: ["Termin! Stark gemacht 🎉", "Das war's! Weiter so.", "Ein Termin mehr auf dem Konto."],
  entscheider: ["Entscheider erreicht, sauber!", "Guter Kontakt.", "Weiter so."],
  abgewimmelt: ["Nicht jeder Tag läuft gleich.", "Nächster Versuch, nächste Chance.", "Kurz schütteln, weiter geht's."],
  rueckruf: ["Rückruf ist fällig!", "Zeit für den nächsten Anruf.", "Jetzt dran denken zurückzurufen."],
  ziel: ["Tagesziel erreicht! 🏆", "Starke Leistung heute.", "Das war ein guter Tag."],
  schlaeft: ["Zzz... schon eine Weile still hier.", "Ich schlafe ein bisschen ein...", "Weiterrufen weckt mich wieder."],
};

function randomQuip(state) {
  const list = QUIPS[state] || QUIPS.idle;
  return list[Math.floor(Math.random() * list.length)];
}

const STATE_LOOPS = {
  idle: () => {
    const t = Date.now() / 900;
    return { bounce: Math.sin(t) * 0.6, eyes: Math.sin(t * 2.3) > 0.97 ? "closed" : "open" };
  },
  call: () => {
    const t = Date.now() / 300;
    return { bounce: Math.sin(t / 3) * 0.4, eyes: Math.sin(t) > 0.5 ? "closed" : "open" };
  },
  termin: (elapsed) => {
    const t = elapsed / 130;
    return { bounce: -Math.abs(Math.sin(t)) * 3.4, eyes: "wide", armsUp: true, sparkle: true, particles: confetti(elapsed) };
  },
  entscheider: () => ({ bounce: Math.sin(Date.now() / 500) * 0.4, eyes: "open", sparkle: true }),
  abgewimmelt: (elapsed) => {
    const t = elapsed / 200;
    return { bounce: Math.sin(t) * 0.9, eyes: "open" };
  },
  rueckruf: () => ({ bounce: Math.sin(Date.now() / 400) * 0.5, eyes: "wide", alert: true }),
  ziel: (elapsed) => {
    const t = elapsed / 140;
    return { bounce: -Math.abs(Math.sin(t)) * 3, eyes: "wide", armsUp: true, sparkle: true, particles: confetti(elapsed) };
  },
  schlaeft: (elapsed) => {
    const t = elapsed / 1400;
    return {
      bounce: Math.sin(t) * 0.3,
      eyes: "closed",
      particles: [
        { x: 20, y: 2 - ((elapsed / 400) % 8), size: 1.5, color: PALETTE.sleep },
        { x: 22, y: 5 - ((elapsed / 400) % 8), size: 1, color: PALETTE.sleep },
      ],
    };
  },
};

function confetti(elapsed) {
  const colors = [PALETTE.confettiA, PALETTE.confettiB, PALETTE.confettiC, PALETTE.confettiD];
  const out = [];
  for (let i = 0; i < 6; i++) {
    const speed = 6 + (i % 3);
    const y = 2 + ((elapsed / speed) % 22);
    out.push({ x: 2 + i * 3.4 + Math.sin(elapsed / 200 + i) * 2, y, size: 1.4, color: colors[i % colors.length] });
  }
  return out;
}

let currentState = "idle";
let stateStartedAt = Date.now();
let idleTimer = null;

function loop() {
  const fn = STATE_LOOPS[currentState] || STATE_LOOPS.idle;
  const pose = fn(Date.now() - stateStartedAt);
  drawRufus(pose);
  rafId = requestAnimationFrame(loop);
}

export const buddy = {
  setState(name, { message, autoIdleAfter } = {}) {
    if (!STATE_LOOPS[name]) name = "idle";
    currentState = name;
    stateStartedAt = Date.now();
    if (message !== false) showBubble(message || randomQuip(name));
    clearTimeout(idleTimer);
    if (name !== "idle" && name !== "schlaeft" && autoIdleAfter !== null) {
      idleTimer = setTimeout(() => buddy.setState("idle", { message: false }), autoIdleAfter || 3200);
    }
  },
  say(message) {
    showBubble(message);
  },
};

function showBubble(text) {
  if (!bubbleEl || !text) return;
  bubbleEl.textContent = text;
  bubbleEl.classList.add("show");
  clearTimeout(bubbleTimeout);
  bubbleTimeout = setTimeout(() => bubbleEl.classList.remove("show"), 4200);
}

export function mountBuddy(canvasEl, bubbleElement) {
  canvasEl.width = GRID;
  canvasEl.height = GRID;
  ctx = canvasEl.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  bubbleEl = bubbleElement;
  if (rafId) cancelAnimationFrame(rafId);
  loop();
}
