// Port Solmar: the city itself. Roads on a grid, named districts, buildings,
// parks and the marina. Everything is generated once from a fixed seed so the
// map is identical every run; only the traffic and pedestrians move.

import { makeRng, pick, randFloat, randInt, circleHitsBox } from './utils.js';

export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const ROAD_W = 96;
export const SIDEWALK = 16;

// Avenues run north-south, streets east-west. Road centre lines.
export const AVENUES = [240, 640, 1040, 1440, 1840, 2240, 2640, 3040, 3360];
export const STREETS = [220, 600, 980, 1360, 1740, 2120, 2500];

export const DISTRICTS = [
  { name: 'Marina', x0: 0, y0: 0, x1: 460, y1: 2800, tint: '#7fc8d8' },
  { name: 'Old Town', x0: 460, y0: 0, x1: 1700, y1: 1100, tint: '#e8b06a' },
  { name: 'Downtown', x0: 1700, y0: 0, x1: 2900, y1: 1500, tint: '#8fb7e8' },
  { name: 'Hillside', x0: 2900, y0: 0, x1: 3600, y1: 1100, tint: '#a8d18d' },
  { name: 'South Park', x0: 460, y0: 1100, x1: 1700, y1: 2800, tint: '#9ccb8f' },
  { name: 'Docklands', x0: 1700, y0: 1500, x1: 3600, y1: 2800, tint: '#c9a37e' },
];

const BUILDING_PALETTE = [
  '#e8d8b8', '#d8b89a', '#c8a88a', '#b8c8d8', '#d8c8c8',
  '#e8c8a8', '#a8b8a8', '#d8d0b0', '#c8b8d0', '#e0c0a0',
];
const ROOF_PALETTE = ['#8a7a68', '#6a7a8a', '#7a6a5a', '#5a6a7a', '#9a8a72'];

// Named places missions and the HUD point at.
export const PLACES = {
  veraGarage: { name: "Vera's Garage", x: 1440, y: 600, label: 'GARAGE' },
  marina: { name: 'Solmar Marina', x: 240, y: 1360, label: 'MARINA' },
  docks: { name: 'Docklands Pier 9', x: 3360, y: 2500, label: 'DOCKS' },
  warehouse: { name: 'Harbor Warehouse', x: 2640, y: 2120, label: 'WAREHOUSE' },
  casino: { name: 'Golden Anchor Casino', x: 2240, y: 980, label: 'CASINO' },
  bank: { name: 'Solmar National Bank', x: 1840, y: 980, label: 'BANK' },
  park: { name: 'Palm Court Park', x: 1040, y: 1740, label: 'PARK' },
  hospital: { name: 'St. Anselm Hospital', x: 3040, y: 600, label: 'HOSPITAL' },
  dealership: { name: 'Apex Motors', x: 640, y: 2120, label: 'DEALER' },
  airport: { name: 'Solmar Airfield', x: 3360, y: 220, label: 'AIRFIELD' },
};

export class City {
  constructor(seed = 20261117) {
    this.rng = makeRng(seed);
    this.buildings = [];
    this.parks = [];
    this.trees = [];
    this.docks = [];
    this.generate();
  }

  generate() {
    const rng = this.rng;
    // Buildings fill every block between roads, except the park and marina strip.
    for (let ai = 0; ai < AVENUES.length - 1; ai++) {
      for (let si = 0; si < STREETS.length - 1; si++) {
        const x0 = AVENUES[ai] + ROAD_W / 2 + SIDEWALK;
        const x1 = AVENUES[ai + 1] - ROAD_W / 2 - SIDEWALK;
        const y0 = STREETS[si] + ROAD_W / 2 + SIDEWALK;
        const y1 = STREETS[si + 1] - ROAD_W / 2 - SIDEWALK;
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        // Palm Court Park occupies one whole block.
        if (Math.abs(cx - 1040) < 200 && Math.abs(cy - 1740) < 200) {
          this.parks.push({ x: cx, y: cy, w: x1 - x0, h: y1 - y0 });
          for (let t = 0; t < 26; t++) {
            this.trees.push({ x: randFloat(rng, x0 + 20, x1 - 20), y: randFloat(rng, y0 + 20, y1 - 20), r: randFloat(rng, 7, 13) });
          }
          continue;
        }
        // Downtown blocks get towers; elsewhere low blocks. Split big blocks.
        const downtown = cx > 1700 && cx < 2900 && cy < 1500;
        const cols = downtown ? 1 : (x1 - x0 > 260 ? 2 : 1);
        const rows = downtown ? 1 : (y1 - y0 > 260 ? 2 : 1);
        for (let c = 0; c < cols; c++) {
          for (let r = 0; r < rows; r++) {
            const bw = (x1 - x0) / cols - 18;
            const bh = (y1 - y0) / rows - 18;
            const bx = x0 + (c + 0.5) * ((x1 - x0) / cols);
            const by = y0 + (r + 0.5) * ((y1 - y0) / rows);
            const tall = downtown && rng() < 0.75;
            this.buildings.push({
              x: bx, y: by, w: bw, h: bh,
              height: tall ? randInt(rng, 3, 6) : randInt(rng, 1, 2),
              color: pick(rng, BUILDING_PALETTE),
              roof: pick(rng, ROOF_PALETTE),
              windows: rng() < 0.8,
            });
          }
        }
      }
    }
    // Marina strip: piers and boats along the west edge.
    for (let i = 0; i < 6; i++) {
      this.docks.push({ x: 120, y: 300 + i * 420, w: 150, h: 26 });
    }
    // Scattered palms along sidewalks.
    for (let i = 0; i < 90; i++) {
      const ax = pick(rng, AVENUES);
      const sy = randFloat(rng, 120, WORLD_H - 120);
      this.trees.push({ x: ax + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + SIDEWALK / 2), y: sy, r: randFloat(rng, 6, 10), palm: true });
    }
  }

  districtAt(x, y) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
    }
    return DISTRICTS[0];
  }

  /** Is this point on a road (drivable)? */
  onRoad(x, y) {
    for (const ax of AVENUES) {
      if (Math.abs(x - ax) < ROAD_W / 2) return true;
    }
    for (const sy of STREETS) {
      if (Math.abs(y - sy) < ROAD_W / 2) return true;
    }
    return false;
  }

  /** Nearest road centre coordinate to (x, y), snapped to the closest axis. */
  nearestRoadPoint(x, y) {
    let bestAx = AVENUES[0];
    let bestAy = STREETS[0];
    for (const ax of AVENUES) if (Math.abs(x - ax) < Math.abs(x - bestAx)) bestAx = ax;
    for (const sy of STREETS) if (Math.abs(y - sy) < Math.abs(y - bestAy)) bestAy = sy;
    if (Math.abs(x - bestAx) < Math.abs(y - bestAy)) return { x: bestAx, y, vertical: true };
    return { x, y: bestAy, vertical: false };
  }

  /** Building whose box contains the point, or null. */
  buildingAt(x, y) {
    for (const b of this.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 && Math.abs(y - b.y) < b.h / 2) return b;
    }
    return null;
  }

  /** Does a circle of radius r at (x, y) hit any building or the world edge? */
  collides(x, y, r) {
    if (x < r + 8 || y < r + 8 || x > WORLD_W - r - 8 || y > WORLD_H - r - 8) return true;
    for (const b of this.buildings) {
      if (circleHitsBox(x, y, r, b)) return true;
    }
    return false;
  }

  /** Push a circle out of buildings; returns the corrected position. */
  resolveCollision(x, y, r) {
    for (const b of this.buildings) {
      const nx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
      const ny = Math.max(b.y - b.h / 2, Math.min(y, b.y + b.h / 2));
      const dx = x - nx;
      const dy = y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = nx + (dx / d) * r;
        y = ny + (dy / d) * r;
      } else if (d2 <= 0.0001) {
        // Centre inside the box: push out along the smallest overlap axis.
        const ox = b.w / 2 + r - Math.abs(x - b.x);
        const oy = b.h / 2 + r - Math.abs(y - b.y);
        if (ox < oy) x += (x < b.x ? -ox : ox);
        else y += (y < b.y ? -oy : oy);
      }
    }
    x = Math.max(r + 8, Math.min(WORLD_W - r - 8, x));
    y = Math.max(r + 8, Math.min(WORLD_H - r - 8, y));
    return { x, y };
  }

  /** A random point on a road, for spawning traffic and pedestrians. */
  randomRoadPoint(rng) {
    if (rng() < 0.5) {
      const ax = pick(rng, AVENUES);
      return { x: ax + randFloat(rng, -ROAD_W / 4, ROAD_W / 4), y: randFloat(rng, 100, WORLD_H - 100), vertical: true };
    }
    const sy = pick(rng, STREETS);
    return { x: randFloat(rng, 100, WORLD_W - 100), y: sy + randFloat(rng, -ROAD_W / 4, ROAD_W / 4), vertical: false };
  }

  /** A random sidewalk point, for pedestrians. */
  randomSidewalkPoint(rng) {
    const p = this.randomRoadPoint(rng);
    const off = ROAD_W / 2 + SIDEWALK / 2 + randFloat(rng, -4, 4);
    if (p.vertical) return { x: p.x + (rng() < 0.5 ? -off : off), y: p.y };
    return { x: p.x, y: p.y + (rng() < 0.5 ? -off : off) };
  }
}
