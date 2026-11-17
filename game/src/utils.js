// Shared math and random helpers for Solmar Bay. No game state lives here.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed angle difference from a to b, in (-PI, PI]. */
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * clamp(t, 0, 1);
}

export function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
  return Math.sqrt(dist2(ax, ay, bx, by));
}

/** Deterministic mulberry32 RNG. Seed it for staged screenshots. */
export function makeRng(seed) {
  let s = seed >>> 0;
  return function rng() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick one element with a rng. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Integer in [lo, hi]. */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Float in [lo, hi). */
export function randFloat(rng, lo, hi) {
  return lo + rng() * (hi - lo);
}

/** Shuffle a copy of an array. */
export function shuffled(rng, arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** Axis-aligned box overlap test. Boxes are {x, y, w, h} with x,y at centre. */
export function boxesOverlap(a, b) {
  return Math.abs(a.x - b.x) * 2 < a.w + b.w && Math.abs(a.y - b.y) * 2 < a.h + b.h;
}

/** Circle vs axis-aligned box test. Box is {x, y, w, h} centre-based. */
export function circleHitsBox(cx, cy, r, box) {
  const nx = clamp(cx, box.x - box.w / 2, box.x + box.w / 2);
  const ny = clamp(cy, box.y - box.h / 2, box.y + box.h / 2);
  return dist2(cx, cy, nx, ny) < r * r;
}

/** Format dollars as $1,234. */
export function money(n) {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Format seconds as M:SS. */
export function clock(secs) {
  const s = Math.max(0, Math.ceil(secs));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
