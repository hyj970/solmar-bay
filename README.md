# Solmar Bay — an open-world crime game

[![Make GTA 6](https://make.fun/badge/gta6-01.svg)](https://make.fun/c/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/hyj970/solmar-bay/rank.svg)](https://make.fun/c/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/hyj970/solmar-bay/reward.svg)](https://make.fun/c/gta6-01)

**Solmar Bay** is an original open-world crime game built for the
[make.fun "Make GTA 6" competition](https://make.fun/c/gta6-01). Explore the
sun-soaked fictional city of Port Solmar on foot and by car, steal vehicles,
outrun the Solmar Bay PD across a five-star wanted system, take taxi fares,
and work six story jobs for the fixer Vera Solano — from a first stolen car
to the Big Score at Solmar National Bank.

Play it free in a desktop browser: serve `game/` with any static server
(`node serve.ts`, then http://localhost:8080) and open `game/index.html`.
No build step, no network requests, no downloads — every script, sound and
pixel is a file in this repository.

## How to play

| Keys | Action |
| --- | --- |
| W A S D / arrows | Move on foot, drive the car |
| Shift | Sprint on foot / handbrake while driving |
| E | Enter a car, steal a parked car, pick up a fare |
| Mouse + click | Aim and fire the pistol (once you have one) |
| Space | Punch (unarmed) |
| J | Start the next story job |
| P / Esc | Pause |
| M | Mute |

The minimap (bottom right) shows the city, the police, and your objective
marker. The HUD tracks cash, respect, health, ammo and your wanted level.
Progress — money, respect, jobs done — saves automatically in the browser.

## What's in the city

- **Port Solmar** — six districts (Marina, Old Town, Downtown, Hillside,
  South Park, Docklands), a beach, a park with a pond, docks and boats.
- **Traffic & pedestrians** — cars cruise the road grid and turn at
  intersections; pedestrians stroll the sidewalks and flee gunfire.
- **Cars to steal** — eight original models, from the Sunny Coupe to the
  Marlin GT, with arcade handling, drift, damage and smoke.
- **Wanted system** — 0 to 5 stars. Foot cops chase and arrest; interceptor
  cars ram you. Stay clean and out of sight and the heat cools off.
- **Six story missions** — stealing, deliveries, a gang shootout, a timed
  checkpoint run across the city, and a five-star bank escape.
- **Side work** — drive a taxi (model: Anchor Taxi) and pick up waving fares.
- **Synthesized sound** — engine, sirens, gunfire, crashes and a street
  groove, all generated live with WebAudio. No audio files.
- **Save** — progress persists in localStorage; continue from the menu.

## Originality

Every name, character, place, vehicle, story beat, line of art and note of
music is original to this game. Nothing is taken from Rockstar Games, Grand
Theft Auto, or any other commercial game.

## Tech

- Plain static files under `game/` — one HTML page and ES modules, no
  framework, no build step, no network requests.
- `main.ts` (Node 22, standard library only) copies `game/` and
  `screenshots/` to `/output` and writes `dossier.json` with the vendored
  `vendor/makefun-game.ts` library.
- `game/src/` is split by job: `city.js` (the map), `vehicles.js` (cars and
  traffic), `pedestrians.js`, `police.js` (wanted system), `missions.js`
  (story + taxi), `player.js`, `render.js`, `hud.js` (HUD, minimap, menus),
  `audio.js` (synth sound), `effects.js`, `save.js`, `input.js`, `utils.js`,
  `shots.js` (staged photo scenes), `main.js` (game loop).

## Referral

Built with make.fun — if you enter a competition there, the referral code is
`xwk0pxbf`.

## License

MIT — see [LICENSE](LICENSE).
