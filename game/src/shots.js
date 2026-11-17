// Staged scenes for screenshots: ?shot=cover|drive|foot|heist opens the game
// straight into a living moment — a police chase, a downtown drive, an
// on-foot shootout, the bank job — with the HUD, minimap and mission
// objective visible. The scenes use a fixed seed so they stage the same
// way every time. This is the game's own photo mode, not an edit.

import { makeRng, randInt } from './utils.js';
import { makeCar } from './vehicles.js';
import { makePed } from './pedestrians.js';
import { PLACES } from './city.js';
import { startMission } from './missions.js';

export const SHOT_MODES = ['cover', 'drive', 'foot', 'heist'];

export function stageShot(game, mode) {
  const rng = makeRng(20261117 + mode.length * 101);
  game.rng = rng;
  game.shotMode = mode;
  const p = game.player;
  const police = game.police;

  if (mode === 'cover') {
    // The chase: Jax in a Marlin GT down the downtown avenue, three
    // interceptors on his tail, three stars, the casino job running.
    // (Avenue 2640, so the run does not cross the casino marker itself.)
    const car = makeCar(2640, 1500, -Math.PI / 2, 1, { driver: 'player' });
    car.speed = 330;
    game.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.hasGun = true;
    p.ammo = 48;
    p.wanted = 3;
    startMission(game, 1); // The Pickup: deliver to the casino
    game.mission.step = 2; // already holding the package
    game.mission.bannerTimer = 0; // staged scene: skip the intro banner
    game.objective = { type: 'goto', x: PLACES.casino.x, y: PLACES.casino.y, label: 'Deliver to the Golden Anchor Casino' };
    // Interceptors trailing behind.
    for (let i = 0; i < 3; i++) {
      const pc = makeCar(2640 + (i - 1) * 52, 1500 + 280 + i * 80, -Math.PI / 2, 7, { driver: 'police' });
      pc.speed = 380;
      pc.wanted = true;
      police.cars.push(pc);
      game.cars.push(pc);
    }
    // One slow car ahead in the far lane to weave past.
    const tc = makeCar(2640 + 44, 1500 - 420, -Math.PI / 2, 2, { driver: 'traffic', vertical: true, dir: -1 });
    tc.speed = 120;
    game.cars.push(tc);
    game.camera.x = car.x;
    game.camera.y = car.y + 60;
    game.camera.zoom = 0.85;
  } else if (mode === 'drive') {
    // Downtown cruise at speed, traffic and palms, no heat.
    const car = makeCar(1840, 1740, Math.PI, 6, { driver: 'player' });
    car.speed = 300;
    game.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.money = 12840;
    p.respect = 25;
    p.missionsDone = 2;
    for (let i = 0; i < 7; i++) {
      const tc = makeCar(1840 + (randInt(rng, -1, 1)) * 42, 1740 + 240 + i * 150, 0, randInt(rng, 0, 6), { driver: 'traffic', vertical: false, dir: 1 });
      tc.speed = 120;
      game.cars.push(tc);
    }
    game.camera.x = car.x;
    game.camera.y = car.y;
    game.camera.zoom = 0.9;
  } else if (mode === 'foot') {
    // On foot at the Marina with the pistol out, pedestrians about,
    // the next job's marker glowing.
    p.x = 640;
    p.y = 1360;
    p.angle = Math.PI / 4;
    p.hasGun = true;
    p.ammo = 36;
    p.money = 3420;
    p.respect = 12;
    p.missionsDone = 1;
    for (let i = 0; i < 10; i++) {
      game.peds.push(makePed(640 + (rng() - 0.5) * 500, 1360 + (rng() - 0.5) * 300, rng));
    }
    game.objective = { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Reach Docklands Pier 9' };
    game.camera.x = p.x;
    game.camera.y = p.y;
    game.camera.zoom = 1;
  } else if (mode === 'heist') {
    // The Big Score mid-escape: five stars, the bank behind, interceptors
    // closing in, gang shootout smoke in the street.
    const car = makeCar(1840, 1180, Math.PI / 2, 1, { driver: 'player' });
    car.speed = 300;
    car.health = 62;
    game.cars.push(car);
    p.inCar = car;
    p.x = car.x;
    p.y = car.y;
    p.hasGun = true;
    p.ammo = 60;
    p.wanted = 5;
    p.money = 21480;
    p.respect = 60;
    p.missionsDone = 5;
    startMission(game, 5);
    game.mission.step = 2;
    game.mission.bannerTimer = 0; // staged scene: skip the intro banner
    game.objective = { type: 'escape', x: PLACES.airport.x, y: PLACES.airport.y, label: 'Escape to Solmar Airfield — lose the cops!' };
    for (let i = 0; i < 3; i++) {
      const pc = makeCar(1840 + (i - 1) * 56, 1180 + 360 + i * 90, Math.PI / 2, 7, { driver: 'police' });
      pc.speed = 340;
      pc.wanted = true;
      police.cars.push(pc);
      game.cars.push(pc);
    }
    for (let i = 0; i < 3; i++) {
      const g = makePed(1840 + (rng() - 0.5) * 200, 980 + (rng() - 0.5) * 120, rng, { gang: 'harbor', hasGun: true, state: 'fight' });
      game.peds.push(g);
    }
    game.effects.explosion(1840, 980);
    game.camera.x = car.x;
    game.camera.y = car.y + 40;
    game.camera.zoom = 0.85;
  }

  game.state = 'playing';
  game.shotAutoDrive = mode === 'cover' || mode === 'drive' || mode === 'heist';
}
