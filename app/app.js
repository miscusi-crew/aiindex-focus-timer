"use strict";
const $ = (id) => document.getElementById(id);
const LABEL = { focus: "Focus", short: "Short break", long: "Long break" };
const lengths = { focus: 25, short: 5, long: 15 };

let mode = "focus";
let remaining = lengths.focus * 60 * 1000; // ms left when paused
let endsAt = null; // timestamp while running
let tick = null;
let sessions = loadSessions();

function load(key) { try { return localStorage.getItem(key); } catch { return null; } }
function save(key, value) { try { localStorage.setItem(key, value); } catch { /* private mode */ } }

const today = () => new Date().toLocaleDateString("en-CA");
function loadSessions() {
  try {
    const s = JSON.parse(load("focus-sessions") || "{}");
    return s.day === today() ? s.count : 0;
  } catch { return 0; }
}

try {
  Object.assign(lengths, JSON.parse(load("focus-lengths") || "{}"));
} catch { /* keep defaults */ }
for (const k of Object.keys(lengths)) $(`len-${k}`).value = lengths[k];

function total() { return lengths[mode] * 60 * 1000; }
function left() { return endsAt ? Math.max(0, endsAt - Date.now()) : remaining; }

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function render() {
  const ms = left();
  $("clock").textContent = fmt(ms);
  $("bar").style.width = `${(1 - ms / total()) * 100}%`;
  $("toggle").textContent = endsAt ? "Pause" : ms < total() ? "Resume" : "Start";
  $("done").textContent = sessions;
  document.title = endsAt ? `${fmt(ms)} · ${LABEL[mode]}` : "Focus Timer";
  document.querySelectorAll(".modes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === mode)));
}

function start() {
  endsAt = Date.now() + remaining;
  $("msg").textContent = "";
  tick = setInterval(() => {
    if (left() <= 0) finish();
    else render();
  }, 250);
  render();
}

function pause() {
  remaining = left();
  endsAt = null;
  clearInterval(tick);
  render();
}

function setMode(m) {
  pause();
  mode = m;
  remaining = total();
  render();
}

function finish() {
  pause();
  chime();
  if (mode === "focus") {
    sessions++;
    save("focus-sessions", JSON.stringify({ day: today(), count: sessions }));
    const next = sessions % 4 === 0 ? "long" : "short";
    setMode(next);
    $("msg").textContent = `Nice work. Time for a ${next === "long" ? "long" : "short"} break.`;
  } else {
    setMode("focus");
    $("msg").textContent = "Break's over. Ready to focus?";
  }
}

/** A soft three-note chime, made with Web Audio (no sound files). */
function chime() {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    [660, 880, 990].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.frequency.value = f;
      o.type = "sine";
      const t = ac.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g).connect(ac.destination);
      o.start(t);
      o.stop(t + 0.65);
    });
    setTimeout(() => ac.close(), 1500);
  } catch { /* no audio available */ }
}

$("toggle").addEventListener("click", () => (endsAt ? pause() : start()));
$("reset").addEventListener("click", () => setMode(mode));
$("skip").addEventListener("click", () => {
  if (mode === "focus") setMode("short");
  else setMode("focus");
});
document.querySelectorAll(".modes button").forEach((b) => b.addEventListener("click", () => setMode(b.dataset.mode)));
for (const k of Object.keys(lengths)) {
  $(`len-${k}`).addEventListener("change", (e) => {
    const v = Math.round(Number(e.target.value));
    if (!(v >= 1 && v <= Number(e.target.max))) {
      e.target.value = lengths[k];
      return;
    }
    lengths[k] = v;
    save("focus-lengths", JSON.stringify(lengths));
    if (k === mode && !endsAt) {
      remaining = total();
      render();
    }
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key === " " && e.target === document.body) {
    e.preventDefault();
    if (endsAt) pause();
    else start();
  }
});

remaining = total();
render();
