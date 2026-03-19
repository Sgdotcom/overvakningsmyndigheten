import { setState } from '../state.js';

const behaviorState = {
  key: { lastAt: null, deltas: [] },
  mouse: { last: null, moves: 0, jitter: 0 },
  enabled: false,
};

function stats(arr) {
  if (!arr.length) return { n: 0, avg: null, std: null, min: null, max: null };
  const n = arr.length;
  const avg = arr.reduce((a, b) => a + b, 0) / n;
  const varSum = arr.reduce((a, b) => a + (b - avg) * (b - avg), 0) / n;
  const std = Math.sqrt(varSum);
  const min = Math.min(...arr);
  const max = Math.max(...arr);
  return { n, avg: Math.round(avg), std: Math.round(std), min, max };
}

function update() {
  const keyStats = stats(behaviorState.key.deltas.slice(-60));
  const out = {
    referrer: document.referrer || null,
    history_length: window.history.length,
    keystroke_ms: keyStats,
    mouse_moves: behaviorState.mouse.moves,
    mouse_jitter: Math.round(behaviorState.mouse.jitter),
  };
  setState({ behavior: out });
}

function onKeydown() {
  const now = performance.now();
  if (behaviorState.key.lastAt != null) {
    const d = now - behaviorState.key.lastAt;
    if (d >= 5 && d <= 2000) behaviorState.key.deltas.push(d);
  }
  behaviorState.key.lastAt = now;
  update();
}

function onMousemove(e) {
  const now = performance.now();
  behaviorState.mouse.moves += 1;
  if (behaviorState.mouse.last) {
    const dx = e.clientX - behaviorState.mouse.last.x;
    const dy = e.clientY - behaviorState.mouse.last.y;
    const dt = now - behaviorState.mouse.last.t;
    if (dt > 0 && dt < 250) {
      // “Jitter”: higher when tiny erratic motion dominates.
      const dist = Math.sqrt(dx * dx + dy * dy);
      behaviorState.mouse.jitter += dist / (dt / 16.0);
    }
  }
  behaviorState.mouse.last = { x: e.clientX, y: e.clientY, t: now };
  if (behaviorState.mouse.moves % 20 === 0) update();
}

export function startBehaviorCollectors() {
  if (behaviorState.enabled) return;
  behaviorState.enabled = true;
  window.addEventListener('keydown', onKeydown, { passive: true });
  window.addEventListener('mousemove', onMousemove, { passive: true });
  update();
}

export function stopBehaviorCollectors() {
  if (!behaviorState.enabled) return;
  behaviorState.enabled = false;
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('mousemove', onMousemove);
}

