// The HUD: money, wanted stars, health, minimap, objective banner, speed,
// messages — and the menu, pause and game-over screens. All drawn on the
// same canvas as the world so screenshots capture the whole game.

import { money, clock, clamp } from './utils.js';
import { WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, PLACES } from './city.js';

const STAR = '★';

export class Hud {
  constructor() {
    this.messages = []; // {text, color, timer}
  }

  message(text, color = '#ffffff', secs = 3) {
    this.messages.push({ text, color, timer: secs });
    if (this.messages.length > 4) this.messages.shift();
  }

  update(dt) {
    for (const m of this.messages) m.timer -= dt;
    this.messages = this.messages.filter((m) => m.timer > 0);
  }

  draw(ctx, game) {
    const { player, viewW, viewH } = game;
    const inCar = !!player.inCar;
    ctx.save();

    // --- top-left: cash, respect, missions
    this.panel(ctx, 14, 14, 232, 74);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23e';
    ctx.font = 'bold 24px Verdana, sans-serif';
    ctx.fillText(money(player.money), 28, 44);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillText(`Respect ${player.respect}   Jobs done ${player.missionsDone}/6`, 28, 66);
    ctx.fillStyle = '#7ac74f';
    ctx.fillText(`District: ${game.city.districtAt(player.x, player.y).name}`, 28, 82);

    // --- top-right: wanted stars
    if (player.wanted > 0) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 30px Verdana, sans-serif';
      ctx.fillStyle = '#ff5a3c';
      ctx.fillText(STAR.repeat(player.wanted) + '☆'.repeat(5 - player.wanted), viewW - 24, 48);
      ctx.font = '12px Verdana, sans-serif';
      ctx.fillStyle = '#ffd0c8';
      ctx.fillText('WANTED — lose the cops', viewW - 24, 68);
    } else {
      ctx.textAlign = 'right';
      ctx.font = 'bold 15px Verdana, sans-serif';
      ctx.fillStyle = '#9fd8a8';
      ctx.fillText('CLEAN', viewW - 24, 44);
    }

    // --- top-centre: objective banner
    const obj = game.objective;
    if (obj) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px Verdana, sans-serif';
      const w = ctx.measureText(obj.label).width + 44;
      this.panel(ctx, viewW / 2 - w / 2, 12, w, 34);
      ctx.fillStyle = '#ffd76a';
      ctx.fillText('◆ ' + obj.label, viewW / 2, 35);
    }

    // --- mission intro / complete / fail banners
    if (game.mission && game.mission.bannerTimer > 0) {
      const a = Math.min(1, game.mission.bannerTimer);
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = 'bold 34px Verdana, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#111';
      ctx.strokeText(game.mission.def.title, viewW / 2, viewH * 0.32);
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(game.mission.def.title, viewW / 2, viewH * 0.32);
      ctx.font = '15px Verdana, sans-serif';
      ctx.fillStyle = '#fff';
      this.wrapText(ctx, game.mission.def.brief, viewW / 2, viewH * 0.32 + 30, 620, 22);
      ctx.globalAlpha = 1;
    }
    if (game.missionComplete) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Verdana, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#111';
      ctx.strokeText('JOB COMPLETE', viewW / 2, viewH * 0.3);
      ctx.fillStyle = '#7ac74f';
      ctx.fillText('JOB COMPLETE', viewW / 2, viewH * 0.3);
      ctx.font = 'bold 20px Verdana, sans-serif';
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(`+${money(game.missionComplete.reward)}  —  ${game.missionComplete.title}`, viewW / 2, viewH * 0.3 + 34);
    }
    if (game.missionFailed) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Verdana, sans-serif';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#111';
      ctx.strokeText('JOB FAILED', viewW / 2, viewH * 0.3);
      ctx.fillStyle = '#ff5a3c';
      ctx.fillText('JOB FAILED', viewW / 2, viewH * 0.3);
      ctx.font = '16px Verdana, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(game.missionFailed.reason + '  —  press M in the pause menu to retry', viewW / 2, viewH * 0.3 + 32);
    }

    // --- bottom-left: health, ammo, weapon
    this.panel(ctx, 14, viewH - 66, 232, 52);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff5a3c';
    ctx.fillRect(28, viewH - 54, 120 * clamp(player.hp / 100, 0, 1), 14);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(28, viewH - 54, 120, 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.fillText(`HP ${Math.ceil(player.hp)}`, 156, viewH - 42);
    ctx.font = '13px Verdana, sans-serif';
    ctx.fillStyle = player.hasGun ? '#ffd23e' : '#c8c8c8';
    ctx.fillText(player.hasGun ? `Pistol  •  ${player.ammo} rounds  (click to fire)` : 'Unarmed  •  Space to punch', 28, viewH - 24);

    // --- bottom-right: minimap + speed
    this.drawMinimap(ctx, game, viewW - 214, viewH - 214, 200, 200);
    if (inCar) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 26px Verdana, sans-serif';
      ctx.fillStyle = '#fff';
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#111';
      const spd = Math.round(Math.abs(player.inCar.speed) * 0.55);
      ctx.strokeText(spd + '', viewW - 114, viewH - 246);
      ctx.fillText(spd + '', viewW - 114, viewH - 246);
      ctx.font = '11px Verdana, sans-serif';
      ctx.fillStyle = '#ffd23e';
      ctx.fillText(player.inCar.model.name, viewW - 114, viewH - 228);
      ctx.fillText('km/h', viewW - 114, viewH - 262);
    }

    // --- interaction prompt
    if (game.prompt) {
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px Verdana, sans-serif';
      const w = ctx.measureText(game.prompt).width + 36;
      this.panel(ctx, viewW / 2 - w / 2, viewH - 116, w, 32);
      ctx.fillStyle = '#fff';
      ctx.fillText(game.prompt, viewW / 2, viewH - 94);
    }

    // --- toast messages
    ctx.textAlign = 'left';
    let my = 108;
    for (const m of this.messages) {
      ctx.globalAlpha = Math.min(1, m.timer);
      ctx.font = 'bold 14px Verdana, sans-serif';
      const w = ctx.measureText(m.text).width + 20;
      ctx.fillStyle = 'rgba(10, 18, 34, 0.66)';
      ctx.beginPath();
      ctx.roundRect(18, my - 16, w, 22, 6);
      ctx.fill();
      ctx.fillStyle = m.color;
      ctx.fillText(m.text, 28, my);
      my += 28;
    }
    ctx.globalAlpha = 1;

    // --- controls hint (first minute only)
    if (game.time < 45 && game.state === 'playing') {
      ctx.textAlign = 'center';
      ctx.font = '13px Verdana, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillText('WASD move / drive  •  E enter & steal cars  •  Shift sprint / handbrake  •  Mouse + click to shoot  •  P pause  •  M mute', viewW / 2, viewH - 8);
    }
    ctx.restore();
  }

  panel(ctx, x, y, w, h) {
    ctx.fillStyle = 'rgba(10, 18, 34, 0.72)';
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
  }

  wrapText(ctx, text, cx, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, yy);
        line = w;
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, yy);
  }

  drawMinimap(ctx, game, x, y, w, h) {
    const scale = w / WORLD_W;
    ctx.save();
    ctx.fillStyle = 'rgba(10, 18, 34, 0.78)';
    ctx.strokeStyle = 'rgba(255, 215, 106, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const ox = x;
    const oy = y;
    // Water strip on the west edge.
    ctx.fillStyle = '#2a6a8a';
    ctx.fillRect(ox, oy, 26 * scale * 10, h);
    // Roads
    ctx.strokeStyle = '#8a8a8a';
    ctx.lineWidth = Math.max(2, ROAD_W * scale);
    for (const ax of AVENUES) {
      ctx.beginPath();
      ctx.moveTo(ox + ax * scale, oy);
      ctx.lineTo(ox + ax * scale, oy + h);
      ctx.stroke();
    }
    for (const sy of STREETS) {
      ctx.beginPath();
      ctx.moveTo(ox, oy + sy * scale);
      ctx.lineTo(ox + w, oy + sy * scale);
      ctx.stroke();
    }
    // Park
    ctx.fillStyle = '#4a8a4a';
    ctx.fillRect(ox + 880 * scale, oy + 1580 * scale, 320 * scale, 320 * scale);
    // Objective marker
    const obj = game.objective;
    if (obj && obj.x !== undefined) {
      const pulse = 1 + Math.sin(game.time * 5) * 0.25;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(ox + obj.x * scale, oy + obj.y * scale, 6 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Police
    ctx.fillStyle = '#3a9df0';
    for (const c of game.police.cars) {
      ctx.beginPath();
      ctx.arc(ox + c.x * scale, oy + c.y * scale, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#7ab8f0';
    for (const c of game.police.cops) {
      if (c.down) continue;
      ctx.beginPath();
      ctx.arc(ox + c.x * scale, oy + c.y * scale, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow
    const p = game.player;
    const px = p.inCar ? p.inCar.x : p.x;
    const py = p.inCar ? p.inCar.y : p.y;
    ctx.save();
    ctx.translate(ox + px * scale, oy + py * scale);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -5);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // North + view cone
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('N', ox + 6, oy + 14);
    ctx.restore();
  }
}

// ------------------------------------------------------------------- screens

export function drawMenu(ctx, game) {
  const { viewW, viewH } = game;
  // Sunset gradient sky over a stylised bay.
  const g = ctx.createLinearGradient(0, 0, 0, viewH);
  g.addColorStop(0, '#2a1a4a');
  g.addColorStop(0.45, '#c94f6a');
  g.addColorStop(0.7, '#f4a261');
  g.addColorStop(1, '#ffd76a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, viewW, viewH);
  // Sun
  ctx.fillStyle = '#fff3c8';
  ctx.beginPath();
  ctx.arc(viewW * 0.78, viewH * 0.3, 70, 0, Math.PI * 2);
  ctx.fill();
  // Sea
  ctx.fillStyle = '#1a5a7a';
  ctx.fillRect(0, viewH * 0.68, viewW, viewH * 0.32);
  ctx.fillStyle = 'rgba(255, 215, 106, 0.5)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(viewW * 0.7 + i * 14, viewH * 0.7 + i * 12, 90 - i * 8, 3);
  }
  // Skyline
  ctx.fillStyle = '#1a1430';
  const base = viewH * 0.68;
  let bx = 0;
  const heights = [150, 220, 120, 260, 180, 300, 140, 240, 170, 200, 130, 280, 160];
  for (let i = 0; bx < viewW; i++) {
    const w = 70 + (i % 3) * 24;
    const h = heights[i % heights.length];
    ctx.fillRect(bx, base - h, w, h);
    ctx.fillStyle = '#ffd76a';
    for (let wy = base - h + 14; wy < base - 12; wy += 22) {
      for (let wx = bx + 10; wx < bx + w - 10; wx += 18) {
        if ((wx + wy) % 3 === 0) ctx.fillRect(wx, wy, 7, 9);
      }
    }
    ctx.fillStyle = '#1a1430';
    bx += w + 8;
  }
  // Palm silhouettes
  ctx.strokeStyle = '#0d1526';
  ctx.lineWidth = 5;
  for (const px of [viewW * 0.12, viewW * 0.88]) {
    ctx.beginPath();
    ctx.moveTo(px, base + 30);
    ctx.quadraticCurveTo(px + 10, base - 60, px + 26, base - 96);
    ctx.stroke();
    for (let a = 0; a < 5; a++) {
      const ang = Math.PI * (0.15 + a * 0.18);
      ctx.beginPath();
      ctx.moveTo(px + 26, base - 96);
      ctx.quadraticCurveTo(px + 26 + Math.cos(ang) * 34, base - 96 - Math.sin(ang) * 26, px + 26 + Math.cos(ang) * 52, base - 96 - Math.sin(ang) * 18);
      ctx.stroke();
    }
  }
  // Title
  ctx.textAlign = 'center';
  ctx.font = 'bold 84px Verdana, sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = '#1a1430';
  ctx.strokeText('SOLMAR BAY', viewW / 2, viewH * 0.32);
  const tg = ctx.createLinearGradient(0, viewH * 0.2, 0, viewH * 0.34);
  tg.addColorStop(0, '#fff3c8');
  tg.addColorStop(1, '#ffb347');
  ctx.fillStyle = tg;
  ctx.fillText('SOLMAR BAY', viewW / 2, viewH * 0.32);
  ctx.font = 'bold 20px Verdana, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('AN OPEN-WORLD CRIME STORY  •  PORT SOLMAR', viewW / 2, viewH * 0.32 + 40);
  // Menu
  const items = game.menuItems;
  const sel = game.menuSel;
  ctx.font = 'bold 24px Verdana, sans-serif';
  items.forEach((it, i) => {
    const y = viewH * 0.52 + i * 46;
    if (i === sel) {
      ctx.fillStyle = 'rgba(10, 18, 34, 0.7)';
      const w = ctx.measureText(it.label).width + 60;
      ctx.beginPath();
      ctx.roundRect(viewW / 2 - w / 2, y - 30, w, 40, 8);
      ctx.fill();
      ctx.fillStyle = '#ffd23e';
      ctx.fillText('▶ ' + it.label, viewW / 2, y);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillText(it.label, viewW / 2, y);
    }
  });
  ctx.font = '15px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('WASD move & drive  •  E steal & enter cars  •  Shift sprint / handbrake  •  Mouse aim, click to shoot', viewW / 2, viewH - 64);
  ctx.fillText('Six story jobs from Vera Solano  •  Taxi fares  •  Five-star wanted system  •  Progress saves automatically', viewW / 2, viewH - 38);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px Verdana, sans-serif';
  ctx.fillText('An original game. No real city, person or brand appears in it.', viewW / 2, viewH - 16);
}

export function drawPause(ctx, game) {
  const { viewW, viewH } = game;
  ctx.fillStyle = 'rgba(8, 12, 26, 0.72)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 44px Verdana, sans-serif';
  ctx.fillText('PAUSED', viewW / 2, viewH * 0.3);
  const items = game.pauseItems;
  const sel = game.pauseSel;
  ctx.font = 'bold 22px Verdana, sans-serif';
  items.forEach((it, i) => {
    const y = viewH * 0.44 + i * 44;
    if (i === sel) {
      ctx.fillStyle = '#ffd23e';
      ctx.fillText('▶ ' + it.label, viewW / 2, y);
    } else {
      ctx.fillStyle = '#fff';
      ctx.fillText(it.label, viewW / 2, y);
    }
  });
  ctx.font = '14px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  const p = game.player;
  ctx.fillText(`${money(p.money)}  •  Respect ${p.respect}  •  Jobs ${p.missionsDone}/6  •  Cars stolen ${p.carsStolen}`, viewW / 2, viewH * 0.44 + items.length * 44 + 30);
}

export function drawGameOver(ctx, game) {
  const { viewW, viewH } = game;
  ctx.fillStyle = 'rgba(20, 4, 8, 0.82)';
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a3c';
  ctx.font = 'bold 56px Verdana, sans-serif';
  ctx.fillText(game.overTitle, viewW / 2, viewH * 0.38);
  ctx.fillStyle = '#fff';
  ctx.font = '18px Verdana, sans-serif';
  ctx.fillText(game.overText, viewW / 2, viewH * 0.38 + 40);
  ctx.font = 'bold 20px Verdana, sans-serif';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText('Press ENTER to get back on your feet', viewW / 2, viewH * 0.38 + 110);
  ctx.font = '15px Verdana, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`You kept ${money(game.player.money)} and your respect. The city is still yours to take.`, viewW / 2, viewH * 0.38 + 150);
}

export { clock };
