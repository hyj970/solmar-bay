// Pedestrians: the city's foot traffic. They stroll the sidewalks, cross
// roads at random, flee gunfire and explosions, and sometimes hail a taxi.
// A few wear gang colours and fight back during combat missions.

import { clamp, dist, pick, randFloat, randInt } from './utils.js';

const SHIRTS = ['#e85d75', '#4fa3e8', '#e8b23e', '#7ac74f', '#c05ad0', '#e8e8e8', '#5a6a7a', '#e86a2a'];
const PANTS = ['#2a3a4a', '#4a3a2a', '#3a3a3a', '#5a4a6a', '#2a4a3a'];
const SKINS = ['#f2c89a', '#c98d5f', '#8a5a3a', '#e8b88a'];

export function makePed(x, y, rng, opts = {}) {
  return {
    x, y,
    angle: randFloat(rng, 0, Math.PI * 2),
    speed: randFloat(rng, 26, 55),
    target: null,
    state: opts.state ?? 'walk', // walk | flee | dead | fight
    hp: 100,
    shirt: pick(rng, SHIRTS),
    pants: pick(rng, PANTS),
    skin: pick(rng, SKINS),
    gang: opts.gang ?? null, // 'harbor' for rival gang members
    hasGun: opts.hasGun ?? false,
    shootTimer: randFloat(rng, 0.5, 1.5),
    taxi: opts.taxi ?? false,
    deadTimer: 0,
    id: Math.floor(Math.random() * 1e9),
  };
}

export function pedNewTarget(ped, city, rng) {
  const p = city.randomSidewalkPoint(rng);
  ped.target = { x: p.x, y: p.y };
}

export function updatePed(ped, dt, city, rng, danger) {
  if (ped.state === 'dead') {
    ped.deadTimer += dt;
    return;
  }
  if (ped.state === 'flee') {
    // Run away from the danger point.
    const dx = ped.x - danger.x;
    const dy = ped.y - danger.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    ped.angle = Math.atan2(dy / d, dx / d);
    const nx = ped.x + Math.cos(ped.angle) * 150 * dt;
    const ny = ped.y + Math.sin(ped.angle) * 150 * dt;
    if (!city.collides(nx, ny, 10)) {
      ped.x = nx;
      ped.y = ny;
    }
    if (d > 520) ped.state = 'walk';
    return;
  }
  if (ped.state === 'fight') return; // combat is driven by missions.js
  // Stroll: pick a sidewalk target, walk to it, pick another.
  if (!ped.target || dist(ped.x, ped.y, ped.target.x, ped.target.y) < 12) {
    pedNewTarget(ped, city, rng);
  }
  const dx = ped.target.x - ped.x;
  const dy = ped.target.y - ped.y;
  const d = Math.max(1, Math.hypot(dx, dy));
  ped.angle = Math.atan2(dy, dx);
  const nx = ped.x + (dx / d) * ped.speed * dt;
  const ny = ped.y + (dy / d) * ped.speed * dt;
  if (!city.collides(nx, ny, 10)) {
    ped.x = nx;
    ped.y = ny;
  } else {
    ped.target = null;
  }
  ped.x = clamp(ped.x, 20, 3580);
  ped.y = clamp(ped.y, 20, 2780);
}

/** Scare every pedestrian near (x, y): they flee. */
export function scarePeds(peds, x, y, radius = 420) {
  for (const p of peds) {
    if (p.state === 'walk' && dist(p.x, p.y, x, y) < radius) {
      p.state = 'flee';
      p.target = null;
    }
  }
}

/** Keep the crowd topped up near the player; cull the far-away and the long-dead. */
export function maintainPeds(peds, city, cx, cy, count, rng) {
  let guard = 0;
  while (peds.filter((p) => p.state !== 'dead').length < count && guard++ < 60) {
    const p = city.randomSidewalkPoint(rng);
    if (dist(p.x, p.y, cx, cy) > 1000) continue;
    if (peds.some((q) => dist(q.x, q.y, p.x, p.y) < 40)) continue;
    peds.push(makePed(p.x, p.y, rng));
  }
  for (let i = peds.length - 1; i >= 0; i--) {
    const p = peds[i];
    if ((p.state === 'dead' && p.deadTimer > 14) || dist(p.x, p.y, cx, cy) > 1600) {
      peds.splice(i, 1);
    }
  }
}

export function drawPed(ctx, ped, time) {
  ctx.save();
  ctx.translate(ped.x, ped.y);
  if (ped.state === 'dead') {
    ctx.rotate(ped.angle + Math.PI / 2);
    ctx.globalAlpha = 0.85;
  } else {
    ctx.rotate(ped.angle);
  }
  const bob = ped.state === 'walk' ? Math.sin(time * 10 + ped.id) * 1.5 : 0;
  // Legs
  ctx.fillStyle = ped.pants;
  ctx.fillRect(-3, -6 + bob, 7, 5);
  ctx.fillRect(-3, 1 - bob, 7, 5);
  // Body
  ctx.fillStyle = ped.gang === 'harbor' ? '#3a1a2a' : ped.shirt;
  ctx.fillRect(-6, -7, 12, 14);
  if (ped.gang === 'harbor') {
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-6, -2, 12, 3); // gang stripe
  }
  // Head
  ctx.fillStyle = ped.skin;
  ctx.beginPath();
  ctx.arc(8, 0, 5, 0, Math.PI * 2);
  ctx.fill();
  // Gun in hand
  if (ped.hasGun && ped.state !== 'dead') {
    ctx.fillStyle = '#222';
    ctx.fillRect(10, -2, 9, 3);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}
