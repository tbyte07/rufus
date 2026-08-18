// Rufus - der Pixel-Begleiter. Ein einfacher, runder blauer Blob mit Gesicht -
// bewusst ohne Kopfhörer/Mikro/Arme, die beim ersten Entwurf eher wie ein
// kleiner Roboter mit Anbauteilen wirkten als wie ein sympathisches Maskottchen.
// Gezeichnet auf einem winzigen Canvas (imageSmoothingEnabled=false) und per CSS
// pixelig hochskaliert, damit auch runde Formen den Retro-Pixel-Look behalten.

const GRID = 24; // logische Pixelbreite/-höhe des Canvas
const PALETTE = {
  body: "#5b7cfa",
  outline: "#141824",
  eye: "#f4f6fb",
  pupil: "#141824",
  mouth: "#141824",
  confettiA: "#f5c542",
  confettiB: "#34d399",
  confettiC: "#f87171",
  confettiD: "#6c8cff",
  sleep: "#5a6479",
  sparkle: "#ffe08a",
  alert: "#f5a623",
};

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

// Canvas-Kurven/-Kreise (arc, ellipse, stroke) werden IMMER kantengeglättet
// gezeichnet - imageSmoothingEnabled wirkt nur beim Hochskalieren, nicht beim
// Zeichnen selbst. Für einen wirklich scharfkantigen Pixel-Look wird darum
// jede runde Form zeilenweise aus vollen Pixel-Rechtecken zusammengesetzt.
function fillEllipseRows(cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  const top = Math.round(cy - ry);
  const bottom = Math.round(cy + ry);
  for (let y = top; y <= bottom; y++) {
    const dy = (y + 0.5 - cy) / ry;
    const t = 1 - dy * dy;
    if (t < 0) continue;
    const halfW = rx * Math.sqrt(t);
    const xLeft = Math.round(cx - halfW);
    const xRight = Math.round(cx + halfW);
    ctx.fillRect(xLeft, y, Math.max(1, xRight - xLeft), 1);
  }
}
function fillCircle(cx, cy, r, color) {
  fillEllipseRows(cx, cy, r, r, color);
}

function drawSparkle(x, y, color, size = 2.4) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x - size / 2), Math.round(y), Math.round(size), 1);
  ctx.fillRect(Math.round(x), Math.round(y - size / 2), 1, Math.round(size));
}

// Mund als kleine feste Pixel-Blöcke - kein Stroke/Kurve, damit die Kante hart bleibt.
function drawMouth(cx, y, style) {
  const c = PALETTE.mouth;
  const x = Math.round(cx), yy = Math.round(y);
  if (style === "smile") {
    px(x - 3, yy, 1, 1, c);
    px(x - 2, yy + 1, 4, 1, c);
    px(x + 2, yy, 1, 1, c);
  } else if (style === "frown") {
    px(x - 3, yy + 1, 1, 1, c);
    px(x - 2, yy, 4, 1, c);
    px(x + 2, yy + 1, 1, 1, c);
  } else if (style === "oh") {
    px(x - 1, yy - 1, 2, 2, c);
  } else {
    px(x - 2, yy, 4, 1, c);
  }
}

// -- Pose-Komposition -------------------------------------------------------
// pose: { bounce, eyes: 'open'|'closed'|'wide', mouth: 'neutral'|'smile'|'frown'|'oh',
//         sparkle?: bool, alert?: bool, particles?: [{x,y,color,size}] }

function drawRufus(pose) {
  clear();
  const bounce = pose.bounce || 0;
  const cx = GRID / 2;
  const cy = 13 + bounce;
  const rx = 8.5, ry = 7.8;

  // Kontur (etwas größer, dahinter) + Körper obendrauf - beides zeilenweise
  // aus harten Pixel-Rechtecken, damit am Rand keine grauen Zwischentöne entstehen.
  fillEllipseRows(cx, cy, rx + 1, ry + 1, PALETTE.outline);
  fillEllipseRows(cx, cy, rx, ry, PALETTE.body);

  // Augen
  const eyeY = cy - ry * 0.12;
  const eyeDX = rx * 0.42;
  const eyeR = pose.eyes === "wide" ? 2.3 : 1.85;

  if (pose.eyes === "closed") {
    for (const dx of [-eyeDX, eyeDX]) {
      px(cx + dx - 1.5, eyeY, 3, 1, PALETTE.outline);
    }
  } else {
    for (const dx of [-eyeDX, eyeDX]) {
      fillCircle(cx + dx, eyeY, eyeR, PALETTE.eye);
      fillCircle(cx + dx + 0.4, eyeY + 0.4, eyeR * 0.5, PALETTE.pupil);
      fillCircle(cx + dx - eyeR * 0.4, eyeY - eyeR * 0.4, Math.max(0.6, eyeR * 0.22), "#ffffff");
    }
  }

  drawMouth(cx, cy + ry * 0.42, pose.mouth);

  if (pose.sparkle) {
    drawSparkle(cx + rx + 1.5, cy - ry - 1, PALETTE.sparkle);
    drawSparkle(cx - rx - 0.5, cy - ry + 1.5, PALETTE.sparkle, 1.6);
  }
  if (pose.alert) {
    const pulse = 1.4 + Math.sin(Date.now() / 180) * 0.3;
    fillCircle(cx + rx - 1, cy - ry + 1, pulse, PALETTE.alert);
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
    return { bounce: Math.sin(t) * 0.6, eyes: Math.sin(t * 2.3) > 0.97 ? "closed" : "open", mouth: "neutral" };
  },
  call: () => {
    const t = Date.now() / 260;
    return { bounce: Math.sin(t / 3) * 0.4, eyes: "open", mouth: Math.sin(t) > 0 ? "oh" : "neutral" };
  },
  termin: (elapsed) => {
    const t = elapsed / 130;
    return { bounce: -Math.abs(Math.sin(t)) * 3.2, eyes: "wide", mouth: "smile", sparkle: true, particles: confetti(elapsed) };
  },
  entscheider: () => ({ bounce: Math.sin(Date.now() / 500) * 0.4, eyes: "open", mouth: "smile", sparkle: true }),
  abgewimmelt: (elapsed) => {
    const t = elapsed / 180;
    return { bounce: Math.sin(t) * 0.8, eyes: "open", mouth: "frown" };
  },
  rueckruf: () => ({ bounce: Math.sin(Date.now() / 400) * 0.5, eyes: "wide", mouth: "neutral", alert: true }),
  ziel: (elapsed) => {
    const t = elapsed / 140;
    return { bounce: -Math.abs(Math.sin(t)) * 2.8, eyes: "wide", mouth: "smile", sparkle: true, particles: confetti(elapsed) };
  },
  schlaeft: (elapsed) => {
    const t = elapsed / 1400;
    return {
      bounce: Math.sin(t) * 0.3,
      eyes: "closed",
      mouth: "neutral",
      particles: [
        { x: 17, y: 3 - ((elapsed / 400) % 8), size: 1.5, color: PALETTE.sleep },
        { x: 19, y: 6 - ((elapsed / 400) % 8), size: 1, color: PALETTE.sleep },
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
