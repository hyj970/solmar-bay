// Save and load: the player's money, respect, jobs, stats and position.
// Stored in localStorage under one key; a corrupt save is ignored, never fatal.

const SAVE_KEY = 'solmar-bay-save-v1';

export function saveGame(player, nextMission) {
  try {
    const data = {
      money: Math.round(player.money),
      respect: player.respect,
      missionsDone: player.missionsDone,
      nextMission,
      kills: player.kills,
      carsStolen: player.carsStolen,
      cashEarned: Math.round(player.cashEarned),
      hasGun: player.hasGun,
      ammo: player.ammo,
      x: Math.round(player.x),
      y: Math.round(player.y),
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.money !== 'number' || typeof data.nextMission !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

export function applySave(player, data) {
  player.money = data.money;
  player.respect = data.respect || 0;
  player.missionsDone = data.missionsDone || 0;
  player.kills = data.kills || 0;
  player.carsStolen = data.carsStolen || 0;
  player.cashEarned = data.cashEarned || 0;
  player.hasGun = !!data.hasGun;
  player.ammo = data.ammo || 0;
  if (typeof data.x === 'number' && typeof data.y === 'number') {
    player.x = data.x;
    player.y = data.y;
  }
}
