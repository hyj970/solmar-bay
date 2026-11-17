// World rendering: the sun-soaked city seen from above. Ground, water and
// beach, the road grid with lane paint, buildings with height shadows,
// palms, docks and boats, cars, and the objective beacon.

import { WORLD_W, WORLD_H, AVENUES, STREETS, ROAD_W, SIDEWALK } from './city.js';
import { clamp } from './utils.js';

const GROUND = '#c9b183';
const GROUND_ALT = '#bfa87a';

export function drawWorld(ctx, game) {
  const { city, camera, viewW, viewH } = game;
  const x0 = camera.x - viewW / 2 / camera.zoom - 60;
  const y0 = camera.y - viewH / 2 / camera.zoom - 60;
  const x1 = camera.x + viewW / 2 / camera.zoom + 60;
  const y1 = camera.y + viewH / 2 / camera.zoom + 60;

  // Ground: warm sand blocks with a subtle checker tint per block.
  ctx.fillStyle = GROUND;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  ctx.fillStyle = GROUND_ALT;
  for (let ai = 0; ai < AVENUES.length - 1; ai++) {
    for (let si = 0; si < STREETS.length - 1; si++) {
      if ((ai + si) % 2 === 0) continue;
      const bx0 = AVENUES[ai] + ROAD_W / 2;
      const by0 = STREETS[si] + ROAD_W / 2;
      const bx1 = AVENUES[ai + 1] - ROAD_W / 2;
      const by1 = STREETS[si + 1] - ROAD_W / 2;
      if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1) continue;
      ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
    }
  }

  // Water + beach on the west edge.
  ctx.fillStyle = '#2a7a9a';
  ctx.fillRect(0, y0, 120, y1 - y0);
  ctx.fillStyle = '#3a9ab8';
  ctx.fillRect(60, y0, 60, y1 - y0);
  ctx.fillStyle = '#e8d8a0';
  ctx.fillRect(120, y0, 46, y1 - y0);
  // Wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  for (let y = Math.floor(y0 / 90) * 90; y < y1; y += 90) {
    ctx.beginPath();
    ctx.moveTo(8, y);
    ctx.quadraticCurveTo(40, y + 8, 72, y);
    ctx.stroke();
  }

  // Roads: asphalt, sidewalks, centre dashes.
  drawRoads(ctx, x0, y0, x1, y1);

  // Park.
  for (const park of city.parks) {
    if (park.x + park.w / 2 < x0 || park.x - park.w / 2 > x1 || park.y + park.h / 2 < y0 || park.y - park.h / 2 > y1) continue;
    ctx.fillStyle = '#6aa84f';
    ctx.fillRect(park.x - park.w / 2, park.y - park.h / 2, park.w, park.h);
    ctx.fillStyle = '#7ab85f';
    ctx.fillRect(park.x - park.w / 2 + 12, park.y - park.h / 2 + 12, park.w - 24, park.h - 24);
    // Paths
    ctx.strokeStyle = '#d8c8a0';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(park.x - park.w / 2, park.y);
    ctx.lineTo(park.x + park.w / 2, park.y);
    ctx.moveTo(park.x, park.y - park.h / 2);
    ctx.lineTo(park.x, park.y + park.h / 2);
    ctx.stroke();
    // Pond
    ctx.fillStyle = '#4a9ab8';
    ctx.beginPath();
    ctx.ellipse(park.x + park.w / 4, park.y - park.h / 4, 52, 34, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Docks + boats.
  for (const d of city.docks) {
    if (d.x + d.w < x0 || d.x > x1 || d.y + d.h < y0 || d.y > y1) continue;
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(d.x - d.w / 2, d.y - d.h / 2, d.w, d.h);
    ctx.fillStyle = '#f0f0f0';
    ctx.beginPath();
    ctx.ellipse(d.x - d.w / 2 - 26, d.y, 22, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a7de8';
    ctx.fillRect(d.x - d.w / 2 - 34, d.y - 4, 16, 8);
  }

  // Trees.
  for (const t of city.trees) {
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    drawTree(ctx, t);
  }

  // Buildings, sorted so taller ones draw after shorter (painter's order).
  const visible = city.buildings.filter((b) => b.x + b.w / 2 > x0 && b.x - b.w / 2 < x1 && b.y + b.h / 2 > y0 && b.y - b.h / 2 < y1);
  visible.sort((a, b) => a.y - b.y);
  for (const b of visible) drawBuilding(ctx, b);
}

function drawRoads(ctx, x0, y0, x1, y1) {
  // Sidewalk border.
  ctx.fillStyle = '#d8d0c0';
  for (const ax of AVENUES) {
    if (ax < x0 - ROAD_W || ax > x1 + ROAD_W) continue;
    ctx.fillRect(ax - ROAD_W / 2 - SIDEWALK, y0, ROAD_W + SIDEWALK * 2, y1 - y0);
  }
  for (const sy of STREETS) {
    if (sy < y0 - ROAD_W || sy > y1 + ROAD_W) continue;
    ctx.fillRect(x0, sy - ROAD_W / 2 - SIDEWALK, x1 - x0, ROAD_W + SIDEWALK * 2);
  }
  // Asphalt.
  ctx.fillStyle = '#3a3a42';
  for (const ax of AVENUES) {
    if (ax < x0 - ROAD_W || ax > x1 + ROAD_W) continue;
    ctx.fillRect(ax - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  }
  for (const sy of STREETS) {
    if (sy < y0 - ROAD_W || sy > y1 + ROAD_W) continue;
    ctx.fillRect(x0, sy - ROAD_W / 2, x1 - x0, ROAD_W);
  }
  // Centre dashes.
  ctx.fillStyle = '#ffd23e';
  for (const ax of AVENUES) {
    if (ax < x0 - ROAD_W || ax > x1 + ROAD_W) continue;
    for (let y = Math.floor(y0 / 56) * 56; y < y1; y += 56) {
      ctx.fillRect(ax - 2, y, 4, 26);
    }
  }
  for (const sy of STREETS) {
    if (sy < y0 - ROAD_W || sy > y1 + ROAD_W) continue;
    for (let x = Math.floor(x0 / 56) * 56; x < x1; x += 56) {
      ctx.fillRect(x, sy - 2, 26, 4);
    }
  }
  // Crosswalks at intersections.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const ax of AVENUES) {
    for (const sy of STREETS) {
      if (ax < x0 - 80 || ax > x1 + 80 || sy < y0 - 80 || sy > y1 + 80) continue;
      for (let i = -3; i <= 3; i++) {
        ctx.fillRect(ax + i * 12 - 3, sy - ROAD_W / 2 - 4, 6, 8);
        ctx.fillRect(ax + i * 12 - 3, sy + ROAD_W / 2 - 4, 6, 8);
      }
    }
  }
}

function drawTree(ctx, t) {
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(t.x + 4, t.y + 5, t.r, t.r * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.palm ? '#3a9a5a' : '#2a7a3a';
  ctx.beginPath();
  ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.arc(t.x - t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuilding(ctx, b) {
  const h = b.height;
  const ox = h * 7; // sun from the south-east: shadows fall north-west
  const oy = -h * 7;
  // Shadow of the height.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(b.x - b.w / 2 + ox * 0.5, b.y - b.h / 2 + oy * 0.5, b.w, b.h);
  // Walls (the height is drawn as an offset slab).
  ctx.fillStyle = shade(b.color, -18);
  ctx.beginPath();
  ctx.moveTo(b.x - b.w / 2, b.y - b.h / 2);
  ctx.lineTo(b.x - b.w / 2 + ox, b.y - b.h / 2 + oy);
  ctx.lineTo(b.x + b.w / 2 + ox, b.y - b.h / 2 + oy);
  ctx.lineTo(b.x + b.w / 2, b.y - b.h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(b.color, -30);
  ctx.beginPath();
  ctx.moveTo(b.x + b.w / 2, b.y - b.h / 2);
  ctx.lineTo(b.x + b.w / 2 + ox, b.y - b.h / 2 + oy);
  ctx.lineTo(b.x + b.w / 2 + ox, b.y + b.h / 2 + oy);
  ctx.lineTo(b.x + b.w / 2, b.y + b.h / 2);
  ctx.closePath();
  ctx.fill();
  // Roof.
  ctx.fillStyle = b.roof;
  ctx.fillRect(b.x - b.w / 2 + ox, b.y - b.h / 2 + oy, b.w, b.h);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(b.x - b.w / 2 + ox, b.y - b.h / 2 + oy, b.w, b.h);
  // Roof details: vents, skylights, helipad on towers.
  if (h >= 3) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath();
    ctx.arc(b.x + ox, b.y + oy, Math.min(18, b.w / 4), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(b.x + ox, b.y + oy, Math.min(18, b.w / 4), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#1a2a4a';
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('H', b.x + ox, b.y + oy + 5);
  } else if (b.windows) {
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    const cols = Math.max(1, Math.floor(b.w / 26));
    const rows = Math.max(1, Math.floor(b.h / 26));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(
          b.x - b.w / 2 + ox + 8 + c * ((b.w - 16) / cols),
          b.y - b.h / 2 + oy + 8 + r * ((b.h - 16) / rows),
          8, 8,
        );
      }
    }
  }
}

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(((n >> 16) & 255) + amt, 0, 255);
  const g = clamp(((n >> 8) & 255) + amt, 0, 255);
  const b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  const m = car.model;
  const hl = m.len / 2;
  const hw = m.wid / 2;
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(2, 4, hl + 2, hw + 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = m.color;
  ctx.beginPath();
  ctx.roundRect(-hl, -hw, m.len, m.wid, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // Hood + trunk shading
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(hl - 14, -hw + 3, 11, m.wid - 6);
  // Cabin + windows
  ctx.fillStyle = '#1a2530';
  ctx.beginPath();
  ctx.roundRect(-hl * 0.35, -hw + 4, m.len * 0.42, m.wid - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(140,200,255,0.5)';
  ctx.fillRect(-hl * 0.3, -hw + 6, m.len * 0.16, m.wid - 12);
  // Headlights / taillights
  ctx.fillStyle = '#fff8c8';
  ctx.fillRect(hl - 3, -hw + 3, 3, 6);
  ctx.fillRect(hl - 3, hw - 9, 3, 6);
  ctx.fillStyle = '#ff3a3a';
  ctx.fillRect(-hl, -hw + 3, 3, 6);
  ctx.fillRect(-hl, hw - 9, 3, 6);
  // Taxi sign
  if (car.modelIdx === 4) {
    ctx.fillStyle = '#ffd23e';
    ctx.fillRect(-6, -hw - 2, 12, 5);
    ctx.fillStyle = '#111';
    ctx.font = 'bold 5px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, -hw + 2);
  }
  // Wreck smoke handled by effects; a wrecked car slumps.
  if (car.health <= 0) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(-hl, -hw, m.len, m.wid, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function drawObjectiveBeacon(ctx, game, time) {
  const obj = game.objective;
  if (!obj || obj.x === undefined) return;
  const pulse = 1 + Math.sin(time * 4) * 0.18;
  ctx.save();
  ctx.translate(obj.x, obj.y);
  // Ground ring
  ctx.strokeStyle = 'rgba(255, 210, 62, 0.9)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 210, 62, 0.18)';
  ctx.beginPath();
  ctx.arc(0, 0, 46 * pulse, 0, Math.PI * 2);
  ctx.fill();
  // Light pillar
  const g = ctx.createLinearGradient(0, -220, 0, 0);
  g.addColorStop(0, 'rgba(255, 210, 62, 0)');
  g.addColorStop(1, 'rgba(255, 210, 62, 0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(-14, -220, 28, 220);
  // Diamond marker
  const bob = Math.sin(time * 3) * 6;
  ctx.fillStyle = '#ffd23e';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -96 + bob);
  ctx.lineTo(12, -80 + bob);
  ctx.lineTo(0, -64 + bob);
  ctx.lineTo(-12, -80 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
