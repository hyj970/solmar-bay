// The Solmar Bay Police Department: a wanted level from 0 to 5 stars, foot
// cops who chase and arrest, and interceptor cars that ram the player off
// the road. Wanted decays when the player stays clean and out of sight.

import { clamp, dist, angleLerp, makeRng } from './utils.js';
import { makeCar, CAR_MODELS } from './vehicles.js';

export const MAX_WANTED = 5;

export function makeCop(x, y) {
  return {
    x, y, angle: 0, speed: 165, hp: 60,
    down: false, arrestTimer: 0, shootTimer: 0.5 + Math.random() * 0.7,
  };
}

/** How many cops / interceptors the current wanted level fields. */
export function wantedForce(wanted) {
  return {
    footCops: [0, 2, 3, 4, 6, 8][wanted],
    cars: [0, 0, 1, 2, 3, 4][wanted],
  };
}

export class Police {
  constructor(city) {
    this.city = city;
    this.cops = [];
    this.cars = [];
    this.rng = makeRng(777);
  }

  addWanted(player, amount, reason) {
    const before = player.wanted;
    player.wanted = clamp(player.wanted + amount, 0, MAX_WANTED);
    player.wantedTimer = 0;
    return { before, after: player.wanted, reason };
  }

  /** Spawn / despawn forces to match the wanted level. */
  maintain(player, cars) {
    const force = wantedForce(player.wanted);
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    // Foot cops spawn on the road near the player.
    let guard = 0;
    while (this.cops.filter((c) => !c.down).length < force.footCops && guard++ < 10) {
      const p = this.city.randomRoadPoint(this.rng);
      if (dist(p.x, p.y, px, py) > 700) continue;
      if (dist(p.x, p.y, px, py) < 260) continue;
      this.cops.push(makeCop(p.x, p.y));
    }
    // Interceptors spawn on a road ahead of the player.
    guard = 0;
    while (this.cars.length < force.cars && guard++ < 10) {
      const p = this.city.randomRoadPoint(this.rng);
      if (dist(p.x, p.y, px, py) > 900 || dist(p.x, p.y, px, py) < 320) continue;
      const car = makeCar(p.x, p.y, p.vertical ? Math.PI / 2 : 0, 7, {
        driver: 'police', vertical: p.vertical, dir: 1,
      });
      car.wanted = true;
      this.cars.push(car);
      cars.push(car);
    }
    // Cull forces that fell far behind or are wrecked.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const c = this.cars[i];
      if (c.health <= 0 || dist(c.x, c.y, px, py) > 1600) {
        const idx = cars.indexOf(c);
        if (idx >= 0) cars.splice(idx, 1);
        this.cars.splice(i, 1);
      }
    }
    for (let i = this.cops.length - 1; i >= 0; i--) {
      const c = this.cops[i];
      if ((c.down && dist(c.x, c.y, px, py) > 900) || dist(c.x, c.y, px, py) > 1600) {
        this.cops.splice(i, 1);
      }
    }
  }

  update(dt, player, cars, peds, effects, sounds) {
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;
    // Wanted decay: stay clean and unseen for a while.
    if (player.wanted > 0) {
      const nearestCop = this.nearestDistance(px, py);
      if (nearestCop > 420) {
        player.wantedTimer += dt;
        if (player.wantedTimer > 16) {
          player.wanted--;
          player.wantedTimer = 0;
        }
      } else {
        player.wantedTimer = 0;
      }
    }
    // Foot cops: run at the player, arrest on touch, shoot at 3+ stars.
    for (const cop of this.cops) {
      if (cop.down) continue;
      const d = dist(cop.x, cop.y, px, py);
      const dx = px - cop.x;
      const dy = py - cop.y;
      cop.angle = Math.atan2(dy, dx);
      if (d > 26) {
        const step = cop.speed * dt;
        const nx = cop.x + Math.cos(cop.angle) * step;
        const ny = cop.y + Math.sin(cop.angle) * step;
        if (!this.city.collides(nx, ny, 10)) {
          cop.x = nx;
          cop.y = ny;
        }
      } else if (!player.inCar) {
        // Arrest: hold still next to the player for 1.2s.
        cop.arrestTimer += dt;
        if (cop.arrestTimer > 1.2) return 'busted';
      }
      // Cops shoot the player on foot at 3+ stars.
      if (player.wanted >= 3 && !player.inCar && d < 420 && d > 60) {
        cop.shootTimer -= dt;
        if (cop.shootTimer <= 0) {
          cop.shootTimer = 0.7 + Math.random() * 0.7;
          sounds.gunshot();
          const a = Math.atan2(py - cop.y, px - cop.x) + (Math.random() - 0.5) * 0.24;
          effects.muzzle(cop.x + Math.cos(a) * 16, cop.y + Math.sin(a) * 16, a);
          if (Math.random() < 0.35) {
            player.hp -= 9;
            player.hurtTimer = 0.4;
            effects.blood(player.x, player.y);
          }
        }
      }
    }
    // Interceptors: steer at the player's car and ram it.
    for (const car of this.cars) {
      const d = dist(car.x, car.y, px, py);
      const targetAngle = Math.atan2(py - car.y, px - car.x);
      car.angle = angleLerp(car.angle, targetAngle, Math.min(1, 2.2 * dt));
      // Keep interceptors from piling onto one point: push apart.
      for (const other of this.cars) {
        if (other === car) continue;
        const od = dist(car.x, car.y, other.x, other.y);
        if (od < 70 && od > 0.01) {
          car.x += ((car.x - other.x) / od) * (70 - od) * 0.5;
          car.y += ((car.y - other.y) / od) * (70 - od) * 0.5;
        }
      }
      const wantSpeed = d > 120 ? 400 : 300;
      car.speed += clamp(wantSpeed - car.speed, -300 * dt, 240 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const pts = [{ x: nx + Math.cos(car.angle) * 20, y: ny + Math.sin(car.angle) * 20 }];
      let hit = false;
      for (const p of pts) if (this.city.collides(p.x, p.y, 4)) { hit = true; break; }
      if (!hit) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= 0.4;
        car.health -= 4;
      }
      // Ram the player's car.
      if (player.inCar && d < 52) {
        player.inCar.health -= 7 * dt;
        player.inCar.speed *= 0.985;
        if (Math.random() < dt * 3) {
          sounds.crash();
          effects.burst(player.inCar.x, player.inCar.y, 5, '#ffd23e', 120, 0.3, 3);
        }
      }
    }
    return null;
  }

  nearestDistance(x, y) {
    let best = Infinity;
    for (const c of this.cops) if (!c.down) best = Math.min(best, dist(c.x, c.y, x, y));
    for (const c of this.cars) best = Math.min(best, dist(c.x, c.y, x, y));
    return best;
  }

  /** Siren loudness 0..1 from the nearest police unit. */
  sirenLevel(x, y) {
    const d = this.nearestDistance(x, y);
    if (!isFinite(d)) return 0;
    return clamp(1 - d / 900, 0, 1);
  }

  draw(ctx, time) {
    for (const cop of this.cops) {
      ctx.save();
      ctx.translate(cop.x, cop.y);
      if (cop.down) {
        ctx.rotate(cop.angle + Math.PI / 2);
        ctx.globalAlpha = 0.8;
      } else {
        ctx.rotate(cop.angle);
      }
      ctx.fillStyle = '#1a2a4a';
      ctx.fillRect(-7, -8, 14, 16);
      ctx.fillStyle = '#ffd23e';
      ctx.fillRect(-7, -3, 14, 3);
      ctx.fillStyle = '#e8b88a';
      ctx.beginPath();
      ctx.arc(9, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1a2a4a';
      ctx.beginPath();
      ctx.arc(9, -1, 5, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // Police cars are drawn by the vehicle renderer; their light bars flash here.
    for (const car of this.cars) {
      const flash = Math.floor(time * 6) % 2 === 0;
      ctx.save();
      ctx.translate(car.x, car.y);
      ctx.rotate(car.angle);
      ctx.fillStyle = flash ? '#ff2a2a' : '#2a7de8';
      ctx.globalAlpha = 0.9;
      ctx.fillRect(-6, -11, 12, 5);
      ctx.fillStyle = flash ? '#2a7de8' : '#ff2a2a';
      ctx.fillRect(-6, 6, 12, 5);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
