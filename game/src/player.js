// Jax Rook on foot: run, sprint, steal a car, punch, shoot. The player is
// a small top-down figure; the camera and the HUD live elsewhere.

import { clamp, dist, angleLerp } from './utils.js';

export const PLAYER_RADIUS = 13;

export function makePlayer(x, y) {
  return {
    x, y,
    angle: -Math.PI / 2,
    speed: 0,
    hp: 100,
    maxHp: 100,
    money: 250,
    respect: 0,
    ammo: 24,
    hasGun: false,
    inCar: null, // the car object when driving
    punchTimer: 0,
    shootTimer: 0,
    hurtTimer: 0,
    wanted: 0,
    wantedTimer: 0,
    kills: 0,
    carsStolen: 0,
    missionsDone: 0,
    cashEarned: 0,
  };
}

export function updatePlayerOnFoot(player, input, dt, city, game) {
  const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
  const mx = input.axis('KeyA', 'KeyD') + input.axis('ArrowLeft', 'ArrowRight');
  const my = input.axis('KeyS', 'KeyW') + input.axis('ArrowDown', 'ArrowUp');
  const moving = mx !== 0 || my !== 0;
  const speed = sprint ? 235 : 150;
  if (moving) {
    const len = Math.hypot(mx, my);
    const nx = player.x + (mx / len) * speed * dt;
    const ny = player.y + (my / len) * speed * dt;
    // Move axis by axis so the player slides along walls.
    const rx = city.resolveCollision(nx, player.y, PLAYER_RADIUS);
    player.x = rx.x;
    const ry = city.resolveCollision(player.x, ny, PLAYER_RADIUS);
    player.y = ry.y;
    player.angle = angleLerp(player.angle, Math.atan2(my, mx), Math.min(1, 14 * dt));
  }
  // Face the mouse when armed; otherwise face the walk direction.
  if (player.hasGun && game) {
    const wx = game.camera.x + (input.mouseX - game.viewW / 2) / game.camera.zoom;
    const wy = game.camera.y + (input.mouseY - game.viewH / 2) / game.camera.zoom;
    player.angle = Math.atan2(wy - player.y, wx - player.x);
  }
  player.punchTimer = Math.max(0, player.punchTimer - dt);
  player.shootTimer = Math.max(0, player.shootTimer - dt);
  player.hurtTimer = Math.max(0, player.hurtTimer - dt);
  return moving;
}

/** Punch the nearest pedestrian or cop in front of the player. */
export function playerPunch(player, peds, cops, effects, sounds) {
  if (player.punchTimer > 0) return false;
  player.punchTimer = 0.35;
  sounds.punch();
  const px = player.x + Math.cos(player.angle) * 22;
  const py = player.y + Math.sin(player.angle) * 22;
  let hit = false;
  for (const p of peds) {
    if (p.state !== 'dead' && dist(p.x, p.y, px, py) < 26) {
      p.hp -= 34;
      effects.blood(p.x, p.y);
      if (p.hp <= 0) {
        p.state = 'dead';
        p.deadTimer = 0;
        player.kills++;
      } else {
        p.state = 'flee';
      }
      hit = true;
    }
  }
  for (const c of cops) {
    if (!c.down && dist(c.x, c.y, px, py) < 26) {
      c.hp -= 34;
      effects.burst(c.x, c.y, 6, '#ffd23e', 120, 0.3, 3);
      if (c.hp <= 0) c.down = true;
      hit = true;
    }
  }
  return hit;
}

/** Fire the pistol toward the mouse. Returns the bullet or null. */
export function playerShoot(player, input, game, effects, sounds) {
  if (!player.hasGun || player.ammo <= 0 || player.shootTimer > 0) return null;
  player.shootTimer = 0.22;
  player.ammo--;
  sounds.gunshot();
  const wx = game.camera.x + (input.mouseX - game.viewW / 2) / game.camera.zoom;
  const wy = game.camera.y + (input.mouseY - game.viewH / 2) / game.camera.zoom;
  const angle = Math.atan2(wy - player.y, wx - player.x);
  const bx = player.x + Math.cos(angle) * 20;
  const by = player.y + Math.sin(angle) * 20;
  effects.muzzle(bx, by, angle);
  return {
    x: bx, y: by,
    vx: Math.cos(angle) * 900, vy: Math.sin(angle) * 900,
    life: 0.9, from: 'player', damage: 34,
  };
}

export function drawPlayer(ctx, player, time) {
  if (player.inCar) return;
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);
  const bob = Math.sin(time * 12) * 1.2;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 4, 12, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  // Legs
  ctx.fillStyle = '#2a3a4a';
  ctx.fillRect(-4, -7 + bob, 8, 6);
  ctx.fillRect(-4, 1 - bob, 8, 6);
  // Jacket — Jax wears a teal bomber.
  ctx.fillStyle = player.hurtTimer > 0 && Math.floor(time * 12) % 2 === 0 ? '#ff5a5a' : '#2a9d8f';
  ctx.fillRect(-7, -8, 14, 16);
  ctx.fillStyle = '#f4a261';
  ctx.fillRect(-7, -3, 14, 3);
  // Head
  ctx.fillStyle = '#e8b88a';
  ctx.beginPath();
  ctx.arc(9, 0, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath();
  ctx.arc(9, -1, 5, Math.PI, Math.PI * 2);
  ctx.fill();
  // Gun
  if (player.hasGun) {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(11, -2, 11, 4);
  }
  ctx.restore();
}
