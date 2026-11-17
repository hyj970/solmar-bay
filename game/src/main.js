// Solmar Bay — the game itself. Boot, the main loop, the state machine
// (menu / playing / paused / game over), combat, stealing cars, the camera,
// and the glue between the city's systems.

import { City, PLACES, WORLD_W, WORLD_H } from './city.js';
import { SoundBank } from './audio.js';
import { Input } from './input.js';
import { Effects } from './effects.js';
import { Hud, drawMenu, drawPause, drawGameOver } from './hud.js';
import { drawWorld, drawCar, drawObjectiveBeacon } from './render.js';
import { makePlayer, updatePlayerOnFoot, playerPunch, playerShoot, drawPlayer, PLAYER_RADIUS } from './player.js';
import {
  makeCar, drivePlayerCar, updateTrafficCar, maintainTraffic,
  spawnParkedCars, collideCars, CAR_MODELS,
} from './vehicles.js';
import { makePed, updatePed, maintainPeds, scarePeds, drawPed } from './pedestrians.js';
import { Police } from './police.js';
import { MISSIONS, startMission, updateMission, updateTaxi, startTaxiFare } from './missions.js';
import { saveGame, loadGame, applySave, clearSave } from './save.js';
import { stageShot, SHOT_MODES } from './shots.js';
import { clamp, dist, makeRng, randInt } from './utils.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

export class Game {
  constructor() {
    this.city = new City();
    this.rng = makeRng((Math.random() * 1e9) | 0);
    this.sounds = new SoundBank();
    this.input = new Input(canvas);
    this.effects = new Effects();
    this.hud = new Hud();
    this.police = new Police(this.city);
    this.player = makePlayer(1440, 700);
    this.cars = [];
    this.peds = [];
    this.bullets = [];
    this.camera = { x: this.player.x, y: this.player.y, zoom: 1 };
    this.viewW = 1280;
    this.viewH = 720;
    this.state = 'menu';
    this.time = 0;
    this.nextMission = 0;
    this.mission = null;
    this.objective = null;
    this.taxi = null;
    this.prompt = null;
    this.missionComplete = null;
    this.missionFailed = null;
    this.overTitle = '';
    this.overText = '';
    this.shotMode = null;
    this.shotAutoDrive = false;
    this.saveTimer = 0;
    this.taxiSpawnTimer = 8;
    this.menuSel = 0;
    this.pauseSel = 0;
    this.menuItems = [];
    this.pauseItems = [
      { label: 'Resume', action: () => { this.state = 'playing'; } },
      { label: 'Retry current job', action: () => this.retryMission() },
      { label: 'Sound: on', action: () => this.toggleSound() },
      { label: 'Save & quit to menu', action: () => this.quitToMenu() },
    ];
    this.saved = loadGame();
    this.nextMission = this.saved ? (this.saved.nextMission ?? this.saved.missionsDone ?? 0) : 0;
    this.buildMenu();
    this.input.onFirstGesture = () => {
      this.sounds.ensure();
      this.sounds.startMusic();
    };
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  buildMenu() {
    this.menuItems = [];
    if (this.saved) {
      this.menuItems.push({ label: 'Continue — ' + this.saved.missionsDone + '/6 jobs done', action: () => this.continueGame() });
    }
    this.menuItems.push({ label: 'New game', action: () => this.newGame() });
    const next = MISSIONS[this.nextMission];
    if (next) this.menuItems.push({ label: 'Start job: ' + next.title, action: () => this.startStory() });
    this.menuItems.push({ label: 'Free roam', action: () => this.freeRoam() });
    this.menuSel = 0;
  }

  resize() {
    this.viewW = window.innerWidth;
    this.viewH = window.innerHeight;
    canvas.width = this.viewW;
    canvas.height = this.viewH;
  }

  // ------------------------------------------------------------ state changes

  newGame() {
    clearSave();
    this.saved = null;
    this.player = makePlayer(1440, 700);
    this.nextMission = 0;
    this.resetWorld();
    this.state = 'playing';
    this.hud.message('Welcome to Port Solmar. Press J to start the first job.', '#ffd76a', 6);
    this.sounds.ensure();
    this.sounds.startMusic();
  }

  continueGame() {
    const data = this.saved;
    this.player = makePlayer(data.x ?? 1440, data.y ?? 700);
    applySave(this.player, data);
    this.nextMission = data.nextMission ?? data.missionsDone ?? 0;
    this.resetWorld();
    this.state = 'playing';
    this.hud.message('Welcome back to Port Solmar.', '#ffd76a', 4);
    this.sounds.ensure();
    this.sounds.startMusic();
  }

  freeRoam() {
    if (this.saved) this.continueGame();
    else this.newGame();
  }

  startStory() {
    if (this.state === 'menu') {
      if (this.saved) this.continueGame();
      else this.newGame();
    }
    if (this.mission) return;
    if (this.nextMission >= MISSIONS.length) {
      this.hud.message('All six jobs are done. Port Solmar is yours — free roam, taxi fares and chaos await.', '#7ac74f', 5);
      return;
    }
    // Give the player a gun from the second job on.
    if (this.nextMission >= 2 && !this.player.hasGun) {
      this.player.hasGun = true;
      this.player.ammo = Math.max(this.player.ammo, 36);
    }
    startMission(this, this.nextMission);
    this.nextMission++;
    this.state = 'playing';
  }

  retryMission() {
    if (this.nextMission === 0) return;
    // Restart the current job (or the last one, if it just failed).
    const idx = this.nextMission - 1;
    this.mission = null;
    this.objective = null;
    this.nextMission = idx;
    this.state = 'playing';
    startMission(this, this.nextMission);
    this.nextMission++;
  }

  quitToMenu() {
    this.saveProgress();
    this.saved = loadGame();
    this.buildMenu();
    this.state = 'menu';
    this.mission = null;
    this.objective = null;
    this.taxi = null;
  }

  toggleSound() {
    this.sounds.ensure();
    this.sounds.setMuted(!this.sounds.muted);
    this.pauseItems[2].label = this.sounds.muted ? 'Sound: off' : 'Sound: on';
    this.hud.message(this.sounds.muted ? 'Sound off' : 'Sound on', '#fff', 2);
  }

  saveProgress() {
    saveGame(this.player, this.nextMission);
    this.saved = loadGame();
  }

  resetWorld() {
    this.cars = [];
    this.peds = [];
    this.bullets = [];
    this.police = new Police(this.city);
    this.effects = new Effects();
    this.mission = null;
    this.objective = null;
    this.taxi = null;
    this.missionComplete = null;
    this.missionFailed = null;
    this.player.inCar = null;
    this.player.wanted = 0;
    this.player.hp = this.player.maxHp;
    spawnParkedCars(this.cars, this.city, this.rng, 26);
    maintainTraffic(this.cars, this.city, this.player.x, this.player.y, 14, this.rng);
    maintainPeds(this.peds, this.city, this.player.x, this.player.y, 40, this.rng);
    this.camera.x = this.player.x;
    this.camera.y = this.player.y;
  }

  // ------------------------------------------------------------ the loop

  frame(now) {
    const dt = Math.min(0.05, (now - (this._last ?? now)) / 1000 || 0.016);
    this._last = now;
    this.time += dt;
    this.update(dt);
    this.render();
    this.input.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  update(dt) {
    if (this.state === 'menu') {
      this.updateMenu(dt);
      return;
    }
    if (this.state === 'paused') {
      this.updatePause(dt);
      return;
    }
    if (this.state === 'over') {
      if (this.input.wasPressed('Enter')) {
        this.respawn();
      }
      return;
    }
    // playing
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      this.state = 'paused';
      this.pauseSel = 0;
      return;
    }
    if (this.input.wasPressed('KeyM')) this.toggleSound();
    if (this.input.wasPressed('KeyJ') && !this.mission && this.nextMission < MISSIONS.length) {
      this.startStory();
    }

    const p = this.player;
    if (this.shotAutoDrive) this.input.keys.add('KeyW');

    // Timers on banners.
    if (this.mission) this.mission.bannerTimer = Math.max(0, this.mission.bannerTimer - dt);
    if (this.missionComplete) {
      this.missionComplete.timer -= dt;
      if (this.missionComplete.timer <= 0) this.missionComplete = null;
    }
    if (this.missionFailed) {
      this.missionFailed.timer -= dt;
      if (this.missionFailed.timer <= 0) this.missionFailed = null;
    }

    // Player: driving or on foot.
    if (p.inCar) this.updateDriving(dt);
    else this.updateOnFoot(dt);

    // Traffic, pedestrians, police, bullets, missions.
    this.updateTraffic(dt);
    this.updatePeds(dt);
    this.police.maintain(p, this.cars);
    const busted = this.police.update(dt, p, this.cars, this.peds, this.effects, this.sounds);
    if (busted === 'busted') return this.gameOver('BUSTED', 'The Solmar Bay PD caught up with you. The garage posted your bail.');
    this.updateBullets(dt);
    this.updateGang(dt);
    updateMission(this, dt);
    updateTaxi(this, dt);
    this.updateTaxiSpawns(dt);
    this.effects.update(dt);
    this.hud.update(dt);

    // Camera follows the player, easing behind.
    const tx = p.inCar ? p.inCar.x : p.x;
    const ty = p.inCar ? p.inCar.y : p.y;
    const look = p.inCar ? 0.14 : 0.1;
    this.camera.x += (tx + (p.inCar ? Math.cos(p.inCar.angle) * 60 : 0) - this.camera.x) * Math.min(1, 5 * dt);
    this.camera.y += (ty + (p.inCar ? Math.sin(p.inCar.angle) * 60 : 0) - this.camera.y) * Math.min(1, 5 * dt);
    const targetZoom = p.inCar ? clamp(1.05 - Math.abs(p.inCar.speed) / 1400, 0.8, 1.05) : 1;
    this.camera.zoom += (targetZoom - this.camera.zoom) * Math.min(1, 2 * dt);

    // Sound follows the action.
    const speed01 = p.inCar ? clamp(Math.abs(p.inCar.speed) / 400, 0, 1) : 0;
    this.sounds.setEngine(speed01, !!p.inCar);
    this.sounds.setSiren(this.police.sirenLevel(tx, ty) * (p.wanted > 0 ? 1 : 0.4));

    // Slow health regen out of trouble.
    if (p.hp < p.maxHp && p.wanted === 0 && p.hurtTimer <= 0) p.hp = Math.min(p.maxHp, p.hp + 2 * dt);

    // Autosave.
    this.saveTimer += dt;
    if (this.saveTimer > 30) {
      this.saveTimer = 0;
      this.saveProgress();
    }

    // Wasted?
    if (p.hp <= 0) {
      this.gameOver('WASTED', 'Port Solmar chewed you up. The hospital patched you up — for a fee.');
    }
  }

  updateMenu(dt) {
    const items = this.menuItems;
    if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
      this.menuSel = (this.menuSel - 1 + items.length) % items.length;
      this.sounds.ensure();
      this.sounds.blip(440, 0.06, 'sine', 0.15);
    }
    if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
      this.menuSel = (this.menuSel + 1) % items.length;
      this.sounds.ensure();
      this.sounds.blip(440, 0.06, 'sine', 0.15);
    }
    if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      items[this.menuSel].action();
    }
  }

  updatePause(dt) {
    const items = this.pauseItems;
    if (this.input.wasPressed('ArrowUp') || this.input.wasPressed('KeyW')) {
      this.pauseSel = (this.pauseSel - 1 + items.length) % items.length;
    }
    if (this.input.wasPressed('ArrowDown') || this.input.wasPressed('KeyS')) {
      this.pauseSel = (this.pauseSel + 1) % items.length;
    }
    if (this.input.wasPressed('Enter') || this.input.wasPressed('Space')) {
      items[this.pauseSel].action();
    }
    if (this.input.wasPressed('KeyP') || this.input.wasPressed('Escape')) {
      this.state = 'playing';
    }
  }

  updateOnFoot(dt) {
    const p = this.player;
    updatePlayerOnFoot(p, this.input, dt, this.city, this);
    // Punch.
    if (this.input.wasPressed('Space') && !p.hasGun) {
      if (playerPunch(p, this.peds, this.police.cops, this.effects, this.sounds)) {
        this.police.addWanted(p, 1, 'assault');
        scarePeds(this.peds, p.x, p.y, 300);
      }
    }
    // Shoot with the mouse.
    if (p.hasGun && this.input.mouseDown) {
      const b = playerShoot(p, this.input, this, this.effects, this.sounds);
      if (b) {
        this.bullets.push(b);
        scarePeds(this.peds, p.x, p.y, 420);
        if (p.wanted < 1) this.police.addWanted(p, 1, 'gunfire');
      }
    }
    // Enter a car / pick up a fare.
    this.prompt = null;
    const near = this.nearestCar(p.x, p.y, 56);
    if (near) {
      this.prompt = `Press E — steal the ${near.model.name}`;
      if (this.input.wasPressed('KeyE')) this.enterCar(near);
    } else if (this.taxi && !this.taxi.pickedUp) {
      const d = dist(p.x, p.y, this.taxi.ped.x, this.taxi.ped.y);
      if (d < 60) this.prompt = 'Press E — pick up the fare';
    }
  }

  updateDriving(dt) {
    const p = this.player;
    const car = p.inCar;
    const result = drivePlayerCar(car, this.input, dt, this.city, this.effects, this.sounds);
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    if (result === 'wrecked') {
      this.explodeCar(car);
      this.exitCar(true);
      p.hp -= 25;
      p.hurtTimer = 0.5;
      return;
    }
    // Exit the car.
    if (this.input.wasPressed('KeyE')) this.exitCar(false);
    // Drive-by shooting is not in: keep the pistol for on-foot fights.
    this.prompt = null;
  }

  enterCar(car) {
    const p = this.player;
    if (car.driver === 'traffic') {
      // The driver bails and runs.
      const driver = makePed(car.x, car.y, this.rng);
      driver.state = 'flee';
      this.peds.push(driver);
      this.police.addWanted(p, 1, 'carjacking');
      this.hud.message(`Stole a ${car.model.name} — the cops noticed.`, '#ff8a5a', 3);
    } else if (car.driver === 'parked') {
      this.police.addWanted(p, 1, 'grand theft auto');
      this.hud.message(`Stole a ${car.model.name}.`, '#ffd76a', 3);
    }
    car.driver = 'player';
    car.speed = 0;
    car.vx = 0;
    car.vy = 0;
    p.inCar = car;
    p.carsStolen++;
    this.sounds.blip(220, 0.1, 'square', 0.2);
  }

  exitCar(wrecked) {
    const p = this.player;
    const car = p.inCar;
    if (!car) return;
    car.driver = 'parked';
    const side = Math.cos(car.angle + Math.PI / 2);
    const sideY = Math.sin(car.angle + Math.PI / 2);
    p.x = car.x + side * 30;
    p.y = car.y + sideY * 30;
    const fixed = this.city.resolveCollision(p.x, p.y, PLAYER_RADIUS);
    p.x = fixed.x;
    p.y = fixed.y;
    p.inCar = null;
    car.speed = 0;
    if (wrecked) this.hud.message('Your car is wrecked!', '#ff5a3c', 3);
  }

  nearestCar(x, y, radius) {
    let best = null;
    let bestD = radius;
    for (const c of this.cars) {
      if (c.driver === 'player' || c.driver === 'police') continue;
      if (c.health <= 0) continue;
      const d = dist(x, y, c.x, c.y);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  updateTraffic(dt) {
    const p = this.player;
    maintainTraffic(this.cars, this.city, p.x, p.y, 14, this.rng);
    for (const car of this.cars) {
      if (car.driver === 'traffic') updateTrafficCar(car, dt, this.city, this.cars, p.x, p.y);
    }
    // Car-car collisions (skip pairs far apart).
    for (let i = 0; i < this.cars.length; i++) {
      for (let j = i + 1; j < this.cars.length; j++) {
        const a = this.cars[i];
        const b = this.cars[j];
        if (Math.abs(a.x - b.x) > 60 || Math.abs(a.y - b.y) > 60) continue;
        collideCars(a, b, this.effects, this.sounds);
      }
    }
    // Wrecked cars explode.
    for (let i = this.cars.length - 1; i >= 0; i--) {
      const car = this.cars[i];
      if (car.health <= 0 && car.driver !== 'player') {
        this.explodeCar(car);
        this.cars.splice(i, 1);
        const pi = this.police.cars.indexOf(car);
        if (pi >= 0) this.police.cars.splice(pi, 1);
      }
    }
  }

  explodeCar(car) {
    this.effects.explosion(car.x, car.y);
    this.sounds.explosion();
    scarePeds(this.peds, car.x, car.y, 500);
  }

  updatePeds(dt) {
    const p = this.player;
    maintainPeds(this.peds, this.city, p.x, p.y, 40, this.rng);
    const danger = { x: p.x, y: p.y };
    for (const ped of this.peds) {
      if (ped.state === 'fight') continue;
      updatePed(ped, dt, this.city, this.rng, danger);
    }
    // The player's car can run pedestrians over.
    if (p.inCar && Math.abs(p.inCar.speed) > 60) {
      for (const ped of this.peds) {
        if (ped.state === 'dead') continue;
        if (dist(ped.x, ped.y, p.inCar.x, p.inCar.y) < 26) {
          ped.state = 'dead';
          ped.deadTimer = 0;
          ped.hp = 0;
          p.kills++;
          this.effects.blood(ped.x, ped.y);
          this.police.addWanted(p, 1, 'vehicular manslaughter');
          this.sounds.crash();
          scarePeds(this.peds, ped.x, ped.y, 400);
        }
      }
    }
  }

  updateBullets(dt) {
    const p = this.player;
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      // Buildings stop bullets.
      if (!dead && this.city.buildingAt(b.x, b.y)) {
        this.effects.burst(b.x, b.y, 4, '#c8c8c8', 100, 0.25, 2);
        dead = true;
      }
      if (!dead && (b.x < 0 || b.y < 0 || b.x > WORLD_W || b.y > WORLD_H)) dead = true;
      if (!dead) {
        // Hit a pedestrian or a cop.
        for (const ped of this.peds) {
          if (ped.state === 'dead') continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 14) {
            ped.hp -= b.damage;
            this.effects.blood(ped.x, ped.y);
            if (ped.hp <= 0) {
              ped.state = 'dead';
              ped.deadTimer = 0;
              if (b.from === 'player') {
                p.kills++;
                if (ped.gang !== 'harbor') this.police.addWanted(p, 1, 'murder');
              }
            } else if (ped.gang === 'harbor') {
              ped.state = 'fight';
            } else {
              ped.state = 'flee';
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const cop of this.police.cops) {
          if (cop.down) continue;
          if (dist(b.x, b.y, cop.x, cop.y) < 14) {
            cop.hp -= b.damage;
            this.effects.burst(cop.x, cop.y, 6, '#ff5a3c', 120, 0.3, 3);
            if (cop.hp <= 0) {
              cop.down = true;
              p.kills++;
              this.police.addWanted(p, 1, 'killing an officer');
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        // Hit a car.
        for (const car of this.cars) {
          if (car.health <= 0) continue;
          if (Math.abs(b.x - car.x) < car.model.len / 2 && Math.abs(b.y - car.y) < car.model.wid / 2) {
            car.health -= b.damage * 0.6;
            this.effects.burst(b.x, b.y, 4, '#ffd23e', 100, 0.25, 2);
            dead = true;
            break;
          }
        }
      }
      if (!dead && b.from === 'enemy' && !p.inCar && dist(b.x, b.y, p.x, p.y) < 14) {
        p.hp -= b.damage * 0.4;
        p.hurtTimer = 0.4;
        this.effects.blood(p.x, p.y);
        dead = true;
      }
      if (dead) this.bullets.splice(i, 1);
    }
  }

  updateGang(dt) {
    const p = this.player;
    for (const ped of this.peds) {
      if (ped.state !== 'fight' || ped.gang !== 'harbor') continue;
      const d = dist(ped.x, ped.y, p.x, p.y);
      if (d > 520) continue;
      ped.angle = Math.atan2(p.y - ped.y, p.x - ped.x);
      if (d > 160) {
        // Close in.
        const nx = ped.x + Math.cos(ped.angle) * 120 * dt;
        const ny = ped.y + Math.sin(ped.angle) * 120 * dt;
        if (!this.city.collides(nx, ny, 10)) {
          ped.x = nx;
          ped.y = ny;
        }
      } else {
        ped.shootTimer -= dt;
        if (ped.shootTimer <= 0) {
          ped.shootTimer = randInt(this.rng, 1, 2) + Math.random();
          this.sounds.gunshot();
          const a = ped.angle + (Math.random() - 0.5) * 0.22;
          this.effects.muzzle(ped.x + Math.cos(a) * 16, ped.y + Math.sin(a) * 16, a);
          this.bullets.push({
            x: ped.x + Math.cos(a) * 20, y: ped.y + Math.sin(a) * 20,
            vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
            life: 0.9, from: 'enemy', damage: 12,
          });
        }
      }
    }
  }

  updateTaxiSpawns(dt) {
    const p = this.player;
    // Fares only appear while the player drives a taxi.
    if (!p.inCar || p.inCar.modelIdx !== 4 || this.taxi || this.mission) return;
    this.taxiSpawnTimer -= dt;
    if (this.taxiSpawnTimer > 0) return;
    this.taxiSpawnTimer = 14;
    // Find a waving pedestrian near the player.
    const near = this.peds.filter((q) => q.state === 'walk' && dist(q.x, q.y, p.x, p.y) < 500);
    if (near.length === 0) return;
    const fare = near[Math.floor(Math.random() * near.length)];
    fare.taxi = true;
    startTaxiFare(this, fare);
    this.hud.message('A fare is waving you down — follow the yellow marker.', '#ffd23e', 4);
  }

  gameOver(title, text) {
    const p = this.player;
    this.overTitle = title;
    this.overText = text;
    this.state = 'over';
    this.sounds.setEngine(0, false);
    this.sounds.missionFail();
    const fine = Math.min(p.money, title === 'BUSTED' ? 150 : 200);
    p.money -= fine;
    this.hud.message(`You lost ${fine} in fines and fees.`, '#ff8a5a', 4);
    this.saveProgress();
  }

  respawn() {
    const p = this.player;
    p.hp = p.maxHp;
    p.wanted = 0;
    p.wantedTimer = 0;
    if (p.inCar) {
      p.inCar.driver = 'parked';
      p.inCar = null;
    }
    p.x = PLACES.hospital.x;
    p.y = PLACES.hospital.y;
    this.police.cops = [];
    for (const car of this.police.cars) {
      const i = this.cars.indexOf(car);
      if (i >= 0) this.cars.splice(i, 1);
    }
    this.police.cars = [];
    this.camera.x = p.x;
    this.camera.y = p.y;
    this.state = 'playing';
    this.hud.message('Back on your feet. Stay out of trouble — or don\'t.', '#7ac74f', 4);
  }

  // ------------------------------------------------------------ render

  render() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.viewW, this.viewH);
    if (this.state === 'menu') {
      drawMenu(ctx, this);
      return;
    }
    const cam = this.camera;
    ctx.save();
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + this.effects.shakeX, -cam.y + this.effects.shakeY);
    drawWorld(ctx, this);
    drawObjectiveBeacon(ctx, this, this.time);
    // Cars under the player, sorted by y for a hint of depth.
    const cars = this.cars.slice().sort((a, b) => a.y - b.y);
    for (const car of cars) drawCar(ctx, car, this.time);
    for (const ped of this.peds) drawPed(ctx, ped, this.time);
    this.police.draw(ctx, this.time);
    drawPlayer(ctx, this.player, this.time);
    // Bullets
    ctx.strokeStyle = '#ffe98a';
    ctx.lineWidth = 3;
    for (const b of this.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    this.effects.draw(ctx);
    ctx.restore();
    this.hud.draw(ctx, this);
    if (this.state === 'paused') drawPause(ctx, this);
    if (this.state === 'over') drawGameOver(ctx, this);
  }
}

// Boot.
const game = new Game();
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot && SHOT_MODES.includes(shot)) {
  game.resetWorld();
  stageShot(game, shot);
  game.sounds.ensure();
}
window.__solmar = game;
window.__solmarReady = false;
requestAnimationFrame((t) => {
  game.frame(t);
  window.__solmarReady = true;
});
