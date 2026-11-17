// Cars: the player's ride, traffic and police interceptors. Traffic follows
// the road grid (right-hand lanes, turns at intersections); the player's car
// uses arcade physics with drift, damage and smoke.

import { clamp, angleDiff, angleLerp, dist, pick, randFloat, randInt, makeRng } from './utils.js';
import { ROAD_W, AVENUES, STREETS } from './city.js';

export const CAR_MODELS = [
  { name: 'Sunny Coupe', color: '#e83e3e', top: 330, accel: 300, grip: 3.4, len: 46, wid: 22, price: 900 },
  { name: 'Marlin GT', color: '#2a7de8', top: 390, accel: 340, grip: 3.8, len: 48, wid: 22, price: 2400 },
  { name: 'Vagabond Van', color: '#e8a13e', top: 260, accel: 220, grip: 2.8, len: 56, wid: 26, price: 700 },
  { name: 'Dune Buggy', color: '#7ac74f', top: 310, accel: 290, grip: 3.0, len: 44, wid: 24, price: 1100 },
  { name: 'Anchor Taxi', color: '#ffd23e', top: 300, accel: 260, grip: 3.2, len: 46, wid: 22, price: 0 },
  { name: 'Cargo Truck', color: '#8a8a8a', top: 230, accel: 180, grip: 2.4, len: 66, wid: 28, price: 1500 },
  { name: 'Solstice Sedan', color: '#c05ad0', top: 320, accel: 280, grip: 3.3, len: 48, wid: 22, price: 1300 },
  { name: 'Police Interceptor', color: '#1a2a4a', top: 400, accel: 360, grip: 4.0, len: 48, wid: 22, price: 0 },
];

export function makeCar(x, y, angle, modelIdx, opts = {}) {
  const model = CAR_MODELS[modelIdx];
  return {
    x, y, angle, speed: 0,
    modelIdx, model,
    health: 100,
    hitCooldown: 0,
    driver: opts.driver ?? null, // 'player' | 'traffic' | 'police' | 'parked'
    vertical: opts.vertical ?? true,
    dir: opts.dir ?? 1, // +1 along the axis, -1 against
    lane: opts.lane ?? 0,
    cruise: opts.cruise ?? 90 + Math.random() * 60,
    turnAt: null,
    stuck: 0,
    smokeTimer: 0,
    siren: modelIdx === 7,
    id: opts.id ?? Math.floor(Math.random() * 1e9),
    wanted: false,
  };
}

export function carPoints(car) {
  const c = Math.cos(car.angle);
  const s = Math.sin(car.angle);
  const hl = car.model.len / 2;
  const hw = car.model.wid / 2;
  return {
    front: { x: car.x + c * hl, y: car.y + s * hl },
    back: { x: car.x - c * hl, y: car.y - s * hl },
    left: { x: car.x - s * hw, y: car.y + c * hw },
    right: { x: car.x + s * hw, y: car.y - c * hw },
  };
}

/** Push two overlapping cars apart and trade a little speed. */
export function collideCars(a, b, effects, sounds) {
  const d = dist(a.x, a.y, b.x, b.y);
  const minD = (a.model.len + b.model.len) / 2 - 14;
  if (d >= minD || d < 0.01) return;
  const nx = (b.x - a.x) / d;
  const ny = (b.y - a.y) / d;
  const overlap = (minD - d) / 2;
  a.x -= nx * overlap;
  a.y -= ny * overlap;
  b.x += nx * overlap;
  b.y += ny * overlap;
  const impact = Math.abs(a.speed - b.speed);
  if (impact > 60) {
    a.health -= impact * 0.02;
    b.health -= impact * 0.02;
    if (effects) effects.burst((a.x + b.x) / 2, (a.y + b.y) / 2, 6, '#ffd23e', 120, 0.4, 3);
    if (sounds && impact > 140) sounds.crash();
  }
  const tmp = a.speed;
  a.speed = b.speed * 0.5;
  b.speed = tmp * 0.5;
}

/** Arcade driving for the player's car. Returns nothing; mutates car. */
export function drivePlayerCar(car, input, dt, city, effects, sounds) {
  const accelIn = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
  const steerIn = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const handbrake = input.down('ShiftLeft') || input.down('ShiftRight') || input.down('Space');
  const m = car.model;
  const forward = car.speed >= 0 ? 1 : -1;

  if (accelIn > 0) car.speed += m.accel * accelIn * dt;
  else if (accelIn < 0) {
    if (car.speed > 8) car.speed -= m.accel * 1.4 * dt; // brake
    else car.speed -= m.accel * 0.55 * dt; // reverse
  } else {
    car.speed -= car.speed * 0.6 * dt; // drag
  }
  car.speed = clamp(car.speed, -m.top * 0.45, m.top);
  if (handbrake) car.speed -= car.speed * 1.8 * dt;

  const steerAuthority = clamp(Math.abs(car.speed) / 120, 0, 1);
  const turnRate = (handbrake ? 3.4 : 2.1) * steerAuthority;
  car.angle += steerIn * turnRate * forward * dt * (handbrake ? 1.25 : 1);

  // Drift: velocity lags the heading when turning hard or handbraking.
  const grip = handbrake ? 1.2 : m.grip;
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  car.vx = car.vx === undefined ? vx : car.vx + (vx - car.vx) * Math.min(1, grip * dt);
  car.vy = car.vy === undefined ? vy : car.vy + (vy - car.vy) * Math.min(1, grip * dt);

  const nx = car.x + car.vx * dt;
  const ny = car.y + car.vy * dt;
  // Buildings: slide along them, lose speed on impact.
  const pts = carPoints({ ...car, x: nx, y: ny });
  let hit = false;
  for (const p of [pts.front, pts.back, pts.left, pts.right]) {
    if (city.collides(p.x, p.y, 4)) { hit = true; break; }
  }
  if (hit) {
    const before = Math.abs(car.speed);
    car.speed *= 0.45;
    car.vx *= 0.3;
    car.vy *= 0.3;
    // One damage tick per scrape, not one per frame while grinding a wall.
    car.hitCooldown = Math.max(0, (car.hitCooldown ?? 0) - dt);
    if (car.hitCooldown <= 0 && before > 60) {
      car.hitCooldown = 0.6;
      car.health -= before * 0.03;
      if (before > 120 && sounds) sounds.crash();
      if (before > 200 && effects) effects.burst(car.x, car.y, 8, '#ffb347', 140, 0.5, 3);
    }
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = clamp(car.x, 30, 3570);
  car.y = clamp(car.y, 30, 2770);

  // Skid marks + smoke when drifting or damaged.
  const sliding = Math.abs(car.vx - vx) + Math.abs(car.vy - vy) > 60;
  if ((sliding || handbrake) && Math.abs(car.speed) > 90 && effects) {
    effects.addSkid(car.x - Math.cos(car.angle) * 14, car.y - Math.sin(car.angle) * 14, car.angle);
  }
  if (car.health < 45) {
    car.smokeTimer -= dt;
    if (car.smokeTimer <= 0) {
      car.smokeTimer = 0.12;
      if (effects) effects.smoke(car.x, car.y - 6, 1);
    }
  }
  if (car.health <= 0) {
    car.health = 0;
    return 'wrecked';
  }
  return null;
}

/** Traffic AI: cruise along the current road, turn at intersections. */
export function updateTrafficCar(car, dt, city, cars, playerX, playerY) {
  const m = car.model;
  // Slow down for the car ahead on the same road.
  let target = car.cruise;
  for (const other of cars) {
    if (other === car || other.driver === 'parked') continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = car.vertical
      ? (dy * car.dir > 0 && Math.abs(dx) < 26)
      : (dx * car.dir > 0 && Math.abs(dy) < 26);
    if (!ahead) continue;
    const gap = car.vertical ? Math.abs(dy) : Math.abs(dx);
    if (gap < 90) target = Math.min(target, Math.max(0, (gap - 40) * 1.2));
  }
  car.speed += clamp(target - car.speed, -260 * dt, 160 * dt);

  const step = car.speed * car.dir * dt;
  if (car.vertical) car.y += step;
  else car.x += step;

  // At an intersection, maybe turn onto the cross street.
  const nearAvenue = nearestAxis(car.x, AVENUES);
  const nearStreet = nearestAxis(car.y, STREETS);
  if (car.vertical && Math.abs(car.y - nearStreet) < 6 && car.turnAt !== nearStreet) {
    car.turnAt = nearStreet;
    if (Math.random() < 0.45) {
      car.vertical = false;
      car.dir = Math.random() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? 0 : Math.PI;
    }
  } else if (!car.vertical && Math.abs(car.x - nearAvenue) < 6 && car.turnAt !== nearAvenue) {
    car.turnAt = nearAvenue;
    if (Math.random() < 0.45) {
      car.vertical = true;
      car.dir = Math.random() < 0.5 ? 1 : -1;
      car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    }
  }
  // Smooth the heading toward the travel direction.
  const wantAngle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
  car.angle = angleLerp(car.angle, wantAngle, Math.min(1, 6 * dt));

  // Wrap around the city edge instead of piling up at the border.
  if (car.x < 60 || car.x > 3540 || car.y < 60 || car.y > 2740) {
    const p = city.randomRoadPoint(makeRng((Math.random() * 1e9) | 0));
    car.x = p.x;
    car.y = p.y;
    car.vertical = p.vertical;
    car.dir = Math.random() < 0.5 ? 1 : -1;
    car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    car.turnAt = null;
  }
}

function nearestAxis(v, axes) {
  let best = axes[0];
  for (const a of axes) if (Math.abs(v - a) < Math.abs(v - best)) best = a;
  return best;
}

/** Spawn traffic cars around (cx, cy) until the list holds `count`. */
export function maintainTraffic(cars, city, cx, cy, count, rng) {
  const traffic = cars.filter((c) => c.driver === 'traffic');
  let guard = 0;
  while (traffic.length < count && guard++ < 40) {
    const p = city.randomRoadPoint(rng);
    if (dist(p.x, p.y, cx, cy) > 1100) continue;
    if (cars.some((c) => dist(c.x, c.y, p.x, p.y) < 120)) continue;
    const modelIdx = randInt(rng, 0, 6);
    const car = makeCar(p.x, p.y, p.vertical ? Math.PI / 2 : 0, modelIdx, {
      driver: 'traffic', vertical: p.vertical, dir: rng() < 0.5 ? 1 : -1,
      cruise: randFloat(rng, 80, 150),
    });
    car.angle = car.vertical ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
    cars.push(car);
    traffic.push(car);
  }
  // Despawn traffic that wandered far from the player.
  for (let i = cars.length - 1; i >= 0; i--) {
    const c = cars[i];
    if (c.driver === 'traffic' && dist(c.x, c.y, cx, cy) > 1500) cars.splice(i, 1);
  }
}

/** Parked cars the player can steal, scattered near roads. */
export function spawnParkedCars(cars, city, rng, count = 26) {
  for (let i = 0; i < count; i++) {
    const p = city.randomRoadPoint(rng);
    const side = rng() < 0.5 ? -1 : 1;
    const x = p.vertical ? p.x + side * 34 : p.x + randFloat(rng, -60, 60);
    const y = p.vertical ? p.y + randFloat(rng, -60, 60) : p.y + side * 34;
    if (city.buildingAt(x, y)) continue;
    const modelIdx = randInt(rng, 0, 6);
    const angle = p.vertical ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
    cars.push(makeCar(x, y, angle, modelIdx, { driver: 'parked' }));
  }
}
