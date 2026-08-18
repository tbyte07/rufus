// Rufus - der Retro-Pixel-Begleiter. Statt handgezeichneter Sprite-Raster wird
// die Figur aus kleinen Rechtecken komponiert (mit "Ecken kappen" für den
// abgerundeten Retro-Look) und über einen Pose-Zustand animiert. Robuster zu
// pflegen als Pixel-für-Pixel-Frames, sieht mit imageSmoothingEnabled=false
// trotzdem klar nach 16-Bit-Sprite aus.

const GRID = 24; // logische Pixelbreite/-höhe des Canvas
const PALETTE = {
  body: "#4f6fe8",
  bodyShade: "#3958c9",
  outline: "#141824",
  headset: "#232a3d",
  headsetLight: "#323b55",
  eye: "#f4f6fb",
  pupil: "#141824",
  mouth: "#141824",
  mic: "#9db2ff",
  happy: "#fbbf24",
  sad: "#7c8aa8",
  confettiA: "#f5c542",
  confettiB: "#34d399",
  confettiC: "#f87171",
  confettiD: "#6c8cff",
  sleep: "#5a6479",
};

let ctx = null;
let bubbleEl = null;
let rafId = null;
let bubbleTimeout = null;

// -- Zeichen-Helfer -------------------------------------------------------

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

// Rechteck mit gekappten Ecken -> wirkt bei niedriger Auflösung abgerundet.
function roundedRect(x, y, w, h, color, cut = 2) {
  ctx.fillStyle = color;
  ctx.fillRect(x + cut, y, w - 2 * cut, h);
  ctx.fillRect(x, y + cut, w, h - 2 * cut);
}

function clear() {
  ctx.clearRect(0, 0, GRID, GRID);
}

// -- Pose-Komposition -------------------------------------------------------
// pose: { bounce, eyes: 'open'|'closed'|'wide', mouth: 'neutral'|'smile'|'frown'|'oh',
//         arm: null|'wave'|'thumbsup'|'up', particles: [{x,y,color,size}], tilt }

function drawRufus(pose) {
  clear();
  const bounce = pose.bounce || 0;
  const bx = 4, by = 5 + bounce, bw = 16, bh = 15;

  // Kontur (etwas größer, dahinter gezeichnet) + Körper obendrauf
  roundedRect(bx - 1, by - 1, bw + 2, bh + 2, PALETTE.outline, 3);
  roundedRect(bx, by, bw, bh, PALETTE.body, 2);
  // dezenter Schattenwurf unten am Körper für Tiefe
  px(bx + 2, by + bh - 4, bw - 4, 3, PALETTE.bodyShade);

  // Headset: Band oben + zwei Ohrmuscheln
  px(bx + 2, by - 2, bw - 4, 2, PALETTE.headset);
  roundedRect(bx - 2, by, 3, 5, PALETTE.headset, 1);
  roundedRect(bx + bw - 1, by, 3, 5, PALETTE.headset, 1);
  // Mikro-Boom von der rechten Ohrmuschel zum Mund
  px(bx + bw + 1, by + 4, 2, 2, PALETTE.headsetLight);
  px(bx + bw - 1, by + 6, 2, 2, PALETTE.headsetLight);
  px(bx + bw - 3, by + 8, 2, 2, PALETTE.mic);

  // Augen
  const eyeY = by + 5;
  const leftX = bx + 3, rightX = bx + bw - 6;
  if (pose.eyes === "closed") {
    px(leftX, eyeY + 1, 3, 1, PALETTE.outline);
    px(rightX, eyeY + 1, 3, 1, PALETTE.outline);
  } else if (pose.eyes === "wide") {
    px(leftX - 1, eyeY - 1, 4, 4, PALETTE.eye);
    px(rightX - 1, eyeY - 1, 4, 4, PALETTE.eye);
    px(leftX, eyeY, 2, 2, PALETTE.pupil);
    px(rightX, eyeY, 2, 2, PALETTE.pupil);
  } else {
    px(leftX, eyeY, 3, 3, PALETTE.eye);
    px(rightX, eyeY, 3, 3, PALETTE.eye);
    px(leftX + 1, eyeY + 1, 1, 1, PALETTE.pupil);
    px(rightX + 1, eyeY + 1, 1, 1, PALETTE.pupil);
  }

  // Mund
  const mouthY = by + 10;
  const mouthX = bx + 6;
  if (pose.mouth === "smile") {
    px(mouthX, mouthY, 1, 1, PALETTE.mouth);
    px(mouthX + 1, mouthY + 1, 2, 1, PALETTE.mouth);
    px(mouthX + 3, mouthY, 1, 1, PALETTE.mouth);
  } else if (pose.mouth === "frown") {
    px(mouthX, mouthY + 1, 1, 1, PALETTE.mouth);
    px(mouthX + 1, mouthY, 2, 1, PALETTE.mouth);
    px(mouthX + 3, mouthY + 1, 1, 1, PALETTE.mouth);
  } else if (pose.mouth === "oh") {
    px(mouthX + 1, mouthY, 2, 2, PALETTE.mouth);
  } else {
    px(mouthX, mouthY, 4, 1, PALETTE.mouth);
  }

  // Arm (optional, für Gesten)
  if (pose.arm === "thumbsup") {
    px(bx + bw - 2, by + 6, 3, 5, PALETTE.body);
    px(bx + bw - 1, by + 3, 2, 3, PALETTE.body);
    px(bx + bw - 1, by + 2, 2, 1, PALETTE.eye);
  } else if (pose.arm === "wave") {
    px(bx + bw - 1, by + 3 + Math.round(Math.sin(Date.now() / 120) * 1.5), 3, 4, PALETTE.body);
  } else if (pose.arm === "up") {
    px(bx + bw - 3, by - 4, 3, 6, PALETTE.body);
    px(bx - 3, by - 4, 3, 6, PALETTE.body);
  } else if (pose.arm === "point-clock") {
    px(bx + bw - 1, by + 4, 4, 3, PALETTE.body);
    roundedRect(bx + bw + 2, by + 1, 6, 6, PALETTE.headset, 1);
    px(bx + bw + 4, by + 2, 1, 3, PALETTE.eye);
    px(bx + bw + 4, by + 4, 2, 1, PALETTE.eye);
  }

  // Partikel (Konfetti, Zzz, ...)
  for (const p of pose.particles || []) {
    px(p.x, p.y, p.size || 1.5, p.size || 1.5, p.color);
  }
}

// -- Zustandsmaschine -------------------------------------------------------

const QUIPS = {
  idle: ["Bereit, wenn du es bist.", "Nächster Lead wartet.", "Ruhig durchatmen."],
  call: ["Dranbleiben!", "Du machst das gut.", "Klare Stimme, lockerer Ton."],
  termin: ["Termin! Stark gemacht 🎉", "Das war's! Weiter so.", "Ein Termin mehr auf dem Konto."],
  entscheider: ["Entscheider erreicht, sauber!", "Guter Kontakt.", "Daumen hoch."],
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
    return {
      bounce: -Math.abs(Math.sin(t)) * 3.5,
      eyes: "wide",
      mouth: "smile",
      arm: "up",
      particles: confetti(elapsed),
    };
  },
  entscheider: () => ({ bounce: Math.sin(Date.now() / 500) * 0.4, eyes: "open", mouth: "smile", arm: "thumbsup" }),
  abgewimmelt: (elapsed) => {
    const t = elapsed / 180;
    return { bounce: Math.sin(t) * 0.8, eyes: "open", mouth: "frown" };
  },
  rueckruf: () => ({ bounce: Math.sin(Date.now() / 400) * 0.5, eyes: "wide", mouth: "neutral", arm: "point-clock" }),
  ziel: (elapsed) => {
    const t = elapsed / 140;
    return { bounce: -Math.abs(Math.sin(t)) * 3, eyes: "wide", mouth: "smile", arm: "up", particles: confetti(elapsed) };
  },
  schlaeft: (elapsed) => {
    const t = elapsed / 1400;
    return {
      bounce: Math.sin(t) * 0.3,
      eyes: "closed",
      mouth: "neutral",
      particles: [
        { x: 20, y: 3 - ((elapsed / 400) % 8), size: 1.5, color: PALETTE.sleep },
        { x: 21, y: 6 - ((elapsed / 400) % 8), size: 1, color: PALETTE.sleep },
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
