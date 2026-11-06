# FoxKarts Grand Prix

A kart racing game that teaches English (Starter, A1, A2) while you race. Built with three.js, running in the browser; it is live at **https://www.fugio.co/kart/**.

Foxino and friends race on five maps (Alpine Peaks, Beach Island, Robo City, Gold Mines and Star Loop, where everyone flies a starship). Pit stops, gates on the formation lap and the finish line ask quick English questions; right answers give boosts and coins.

## Run it locally

The game is plain static files (no build step). Serve the repository root and open `/kart/`:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000/kart/ (add `?nointro` to skip the intro story).

`kart/index.html` loads `/shared/pack-picker.js` (the curriculum-package picker shared with the other Fugio games), which is why the repository root has to be the web root.

## What's where

| Path | What it is |
|---|---|
| `kart/game.js` | The whole game: tracks, racing, pit stops, garage, menus, results |
| `kart/learn.js` | The English questions, levels and spaced repetition |
| `kart/kart-skin.js`, `kart/karts.js`, `kart/models.js`, `kart/racers.js` | The kart and the racers |
| `kart/party.js` | Party races with friends (PeerJS) |
| `kart/packages.js`, `shared/pack-picker.js` | Curriculum packages and the picker |
| `kart/models/` | GLB models: pit garages, crew, tyres, the menu garage |
| `kart/ui/`, `kart/img/`, `kart/chars/`, `kart/video/`, `kart/audio/` | Art, portraits, cutscenes and sound |
| `kart/tools/` | Blender scripts and reference images used to make the assets |
| `kart/lib/` | three.js and its loaders |

## Progression

- **Map points:** every race on any map gives points by place (100 / 60 / 40 / 30 / 25). Maps open at 200, 450, 750 and 1,100 points.
- **Kart level 1–25:** every upgrade bought (speed, start, handling, grip, turbo, magnet; 4 levels each) is one level; level 25 is the golden kart. The starship has its own levels.
- **Driving licence:** stamps for wins on each map (bronze, silver, gold, diamond).
