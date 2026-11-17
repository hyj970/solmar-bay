// Missions and side work. The story is a six-job arc from Vera Solano, the
// fixer who runs the garage: steal, deliver, shoot, drive, and finally the
// bank. Steps are data; updateMission() drives them against live game state.

import { dist, money } from './utils.js';
import { PLACES } from './city.js';
import { makePed, scarePeds } from './pedestrians.js';

export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    giver: 'Vera Solano',
    brief: 'Vera needs wheels. Steal any car on the street and bring it to her garage.',
    reward: 500,
    steps: [
      { type: 'steal', label: 'Steal a car (walk up to one and press E)' },
      { type: 'goto', x: PLACES.veraGarage.x, y: PLACES.veraGarage.y, label: "Drive to Vera's Garage" },
    ],
  },
  {
    id: 'the-pickup',
    title: 'The Pickup',
    giver: 'Vera Solano',
    brief: 'A package is waiting at Docklands Pier 9. Collect it and run it to the Golden Anchor Casino. The cops will not like the cargo.',
    reward: 1200,
    steps: [
      { type: 'goto', x: PLACES.docks.x, y: PLACES.docks.y, label: 'Reach Docklands Pier 9' },
      { type: 'hold', x: PLACES.docks.x, y: PLACES.docks.y, secs: 2, label: 'Collect the package (stand in the marker)' },
      { type: 'goto', x: PLACES.casino.x, y: PLACES.casino.y, label: 'Deliver to the Golden Anchor Casino' },
    ],
  },
  {
    id: 'hot-property',
    title: 'Hot Property',
    giver: 'Vera Solano',
    brief: 'A Marlin GT is parked at the Marina. Take it, shake the police, and bring it home. The blue ones are worth the most.',
    reward: 2000,
    steps: [
      { type: 'stealModel', modelIdx: 1, label: 'Steal a Marlin GT (blue sports car)' },
      { type: 'goto', x: PLACES.veraGarage.x, y: PLACES.veraGarage.y, label: "Bring the Marlin GT to Vera's Garage" },
    ],
  },
  {
    id: 'loud-and-clear',
    title: 'Loud and Clear',
    giver: 'Vera Solano',
    brief: 'The Harbor crew took our warehouse. Take it back. Six of them are inside — they shoot first. You have a pistol now; use it.',
    reward: 2500,
    steps: [
      { type: 'goto', x: PLACES.warehouse.x, y: PLACES.warehouse.y, label: 'Reach the Harbor Warehouse' },
      { type: 'kill', count: 6, label: 'Clear the warehouse (0/6 Harbor crew down)' },
      { type: 'goto', x: PLACES.veraGarage.x, y: PLACES.veraGarage.y, label: 'Report back to Vera' },
    ],
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    giver: 'Vera Solano',
    brief: 'Five checkpoints, one timer. The city is the track. Make it in 150 seconds and the crew will know your name.',
    reward: 3000,
    steps: [
      { type: 'timed', secs: 150, checkpoints: [
        { x: 640, y: 220, label: 'Checkpoint 1 — Old Town' },
        { x: 3040, y: 600, label: 'Checkpoint 2 — Hillside' },
        { x: 3360, y: 2120, label: 'Checkpoint 3 — Docklands' },
        { x: 640, y: 2500, label: 'Checkpoint 4 — South Park' },
        { x: PLACES.veraGarage.x, y: PLACES.veraGarage.y, label: 'Final — Vera\'s Garage' },
      ]},
    ],
  },
  {
    id: 'the-big-score',
    title: 'The Big Score',
    giver: 'Vera Solano',
    brief: 'Solmar National Bank. The vault, four seconds, then every cop in the city. Lose them at the airfield and we are done — kings of Solmar.',
    reward: 8000,
    steps: [
      { type: 'goto', x: PLACES.bank.x, y: PLACES.bank.y, label: 'Reach Solmar National Bank' },
      { type: 'hold', x: PLACES.bank.x, y: PLACES.bank.y, secs: 4, label: 'Crack the vault (stand in the marker)' },
      { type: 'escape', secs: 45, x: PLACES.airport.x, y: PLACES.airport.y, label: 'Escape to Solmar Airfield' },
    ],
  },
];

export function missionById(id) {
  return MISSIONS.find((m) => m.id === id);
}

/** Start a mission: reset its step state and announce it. */
export function startMission(game, idx) {
  const def = MISSIONS[idx];
  game.mission = {
    def, idx,
    step: 0,
    stepData: {},
    startedAt: game.time,
    banner: def.title,
    bannerTimer: 3.5,
    holdTimer: 0,
    timer: 0,
    checkpoint: 0,
    killCount: 0,
  };
  game.objective = currentObjective(game);
  game.sounds.blip(660, 0.15, 'triangle', 0.3);
  game.sounds.blip(880, 0.2, 'triangle', 0.3);
  return game.mission;
}

export function currentStep(game) {
  if (!game.mission) return null;
  return game.mission.def.steps[game.mission.step] ?? null;
}

export function currentObjective(game) {
  const step = currentStep(game);
  if (!step) return null;
  return { ...step };
}

function advanceStep(game) {
  game.mission.step++;
  game.mission.stepData = {};
  game.mission.holdTimer = 0;
  const step = currentStep(game);
  if (!step) {
    completeMission(game);
    return;
  }
  game.objective = currentObjective(game);
  game.sounds.pickup();
  if (step.type === 'kill') spawnGang(game, step.count);
}

function completeMission(game) {
  const m = game.mission;
  const reward = m.def.reward;
  game.player.money += reward;
  game.player.cashEarned += reward;
  game.player.respect += 10;
  game.player.missionsDone++;
  game.sounds.missionDone();
  game.effects.floatText(game.player.x, game.player.y - 40, '+' + money(reward), '#ffd23e');
  game.missionComplete = { title: m.def.title, reward, timer: 4 };
  game.mission = null;
  game.objective = null;
  game.saveProgress();
}

export function failMission(game, reason) {
  game.sounds.missionFail();
  game.missionFailed = { title: game.mission ? game.mission.def.title : 'Job', reason, timer: 4 };
  game.mission = null;
  game.objective = null;
  // The player keeps the job: it can be retried from the pause menu.
}

function spawnGang(game, count) {
  const cx = PLACES.warehouse.x;
  const cy = PLACES.warehouse.y;
  for (let i = 0; i < count; i++) {
    const p = makePed(cx + (Math.random() - 0.5) * 220, cy + (Math.random() - 0.5) * 160, game.rng, {
      gang: 'harbor', hasGun: true, state: 'fight',
    });
    p.hp = 68;
    game.peds.push(p);
  }
  scarePeds(game.peds, cx, cy, 300);
}

function playerPos(game) {
  const p = game.player;
  return p.inCar ? { x: p.inCar.x, y: p.inCar.y } : { x: p.x, y: p.y };
}

/** Drive one mission step. Called every frame while a mission is active. */
export function updateMission(game, dt) {
  const m = game.mission;
  if (!m) return;
  const step = currentStep(game);
  if (!step) return;
  const p = game.player;
  const pos = playerPos(game);

  if (step.type === 'steal') {
    if (p.inCar) advanceStep(game);
  } else if (step.type === 'stealModel') {
    if (p.inCar && p.inCar.modelIdx === step.modelIdx) advanceStep(game);
  } else if (step.type === 'goto') {
    if (dist(pos.x, pos.y, step.x, step.y) < 70) advanceStep(game);
  } else if (step.type === 'hold') {
    if (dist(pos.x, pos.y, step.x, step.y) < 70) {
      m.holdTimer += dt;
      if (m.holdTimer >= step.secs) {
        if (m.def.id === 'the-pickup') {
          game.police.addWanted(p, 1, 'stolen cargo');
          game.effects.floatText(p.x, p.y - 40, 'Package secured — run!', '#ff8a5a');
        }
        if (m.def.id === 'the-big-score') {
          game.police.addWanted(p, 5, 'bank robbery');
          game.effects.explosion(step.x, step.y);
          game.sounds.explosion();
          game.effects.floatText(p.x, p.y - 40, 'VAULT OPEN — RUN!', '#ff5a5a');
        }
        advanceStep(game);
      }
    } else {
      m.holdTimer = Math.max(0, m.holdTimer - dt * 2);
    }
  } else if (step.type === 'kill') {
    const remaining = game.peds.filter((q) => q.gang === 'harbor' && q.state !== 'dead').length;
    m.killCount = step.count - remaining;
    game.objective = { ...step, label: `Clear the warehouse (${m.killCount}/${step.count} Harbor crew down)` };
    if (remaining <= 0) advanceStep(game);
  } else if (step.type === 'timed') {
    m.timer += dt;
    const cps = step.checkpoints;
    const cp = cps[m.checkpoint];
    game.objective = { ...step, x: cp.x, y: cp.y, label: cp.label + '  —  ' + Math.max(0, step.secs - m.timer).toFixed(0) + 's left' };
    if (dist(pos.x, pos.y, cp.x, cp.y) < 80) {
      game.sounds.pickup();
      game.effects.floatText(cp.x, cp.y - 30, 'CHECKPOINT!', '#7ac74f');
      m.checkpoint++;
      if (m.checkpoint >= cps.length) advanceStep(game);
    } else if (m.timer > step.secs) {
      failMission(game, 'Out of time on the getaway run.');
    }
  } else if (step.type === 'escape') {
    m.timer += dt;
    const reached = dist(pos.x, pos.y, step.x, step.y) < 90;
    const cooled = p.wanted === 0;
    game.objective = {
      ...step,
      label: cooled
        ? 'You lost them — reach the airfield'
        : `Lose the cops, then reach the airfield (${Math.max(0, step.secs - m.timer).toFixed(0)}s)`,
    };
    if (reached && cooled) advanceStep(game);
    else if (m.timer > step.secs && !cooled && p.wanted > 0) {
      // The clock ran out but the heat is still on: keep running, no fail yet.
      m.timer = step.secs;
    }
  }
}

// ---------------------------------------------------------------- taxi side job

export function startTaxiFare(game, ped) {
  const dest = game.city.randomRoadPoint(game.rng);
  game.taxi = {
    ped, dest,
    fare: Math.round(40 + dist(ped.x, ped.y, dest.x, dest.y) / 12),
    timer: 0,
    pickedUp: false,
  };
  game.objective = { type: 'taxi', x: ped.x, y: ped.y, label: 'Pick up the fare' };
}

export function updateTaxi(game, dt) {
  const t = game.taxi;
  if (!t) return;
  const p = game.player;
  const pos = playerPos(game);
  if (!t.pickedUp) {
    game.objective = { type: 'taxi', x: t.ped.x, y: t.ped.y, label: 'Pick up the fare (stop beside them, press E)' };
    if (p.inCar && dist(pos.x, pos.y, t.ped.x, t.ped.y) < 60 && game.input.wasPressed('KeyE')) {
      t.pickedUp = true;
      game.sounds.pickup();
      game.effects.floatText(t.ped.x, t.ped.y - 30, 'Fare aboard!', '#7ac74f');
    }
    // The fare gives up after a while.
    t.timer += dt;
    if (t.timer > 60) {
      game.taxi = null;
      if (!game.mission) game.objective = null;
    }
    return;
  }
  game.objective = { type: 'taxi', x: t.dest.x, y: t.dest.y, label: `Drop the fare off — ${money(t.fare)}` };
  if (dist(pos.x, pos.y, t.dest.x, t.dest.y) < 70) {
    p.money += t.fare;
    p.cashEarned += t.fare;
    game.sounds.missionDone();
    game.effects.floatText(pos.x, pos.y - 40, '+' + money(t.fare), '#ffd23e');
    game.taxi = null;
    if (!game.mission) game.objective = null;
    game.saveProgress();
  }
}
