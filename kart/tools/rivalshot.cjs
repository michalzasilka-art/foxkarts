// close-ups of a rival racer (and the player for comparison) rendered in the game page, saved as PNGs
const { chromium } = require('/Users/kroupek/Documents/Práce/Claud/Claude Folder/Fillwise/node_modules/playwright-core');
const fs = require('fs'), path = require('path');
const OUT = '/private/tmp/claude-501/-Users-kroupek-Documents-Pr-ce-Claud-Claude-Folder/ffc6138d-be8f-40ca-936e-6716a8abe2c0/scratchpad/kshots';
(async () => {
  const patch = process.argv[2] ? JSON.parse(process.argv[2]) : null;
  const ids = (process.argv[3] || 'stella').split(',');
  const b = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 700 } });
  const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error' || /racing driver/.test(m.text())) errs.push(m.text()); });
  await p.goto('http://localhost:5201/kart/?t=' + Date.now());
  await p.waitForFunction(() => window.FK && window.FK.ready, null, { timeout: 120000 });
  const info = await p.evaluate((patch) => window.FK.rival(patch || undefined), patch);
  console.log('rival', JSON.stringify(info));
  const views = [['front', [0.9, 1.25, 2.6]], ['side', [2.6, 1.1, 0.1]], ['top', [0.35, 2.6, 0.9]], ['back', [0.8, 1.6, -2.4]], ['wheel', [0.75, 1.05, 0.95]], ['grip', [0.5, 1.45, -0.7]]];
  for (const id of ids) {
    for (const player of (process.env.BOTH ? [false, true] : [false])) {
      const shots = await p.evaluate(async ([id, player, views, ship]) => {
        const FK = window.FK, THREE = FK.THREE, r = FK.renderer, m = FK.racerModel(id, player, ship);
        const sc = new THREE.Scene(); sc.environment = FK.ENV(); sc.background = new THREE.Color('#cfd8e6');
        sc.add(new THREE.HemisphereLight(0xffffff, 0x8899bb, 1.2)); const d = new THREE.DirectionalLight(0xffffff, 2); d.position.set(2, 4, 3); sc.add(d);
        sc.add(m.root); const out = {};
        const cv = r.domElement, W = cv.width, H = cv.height;
        for (const [name, pos] of views) {
          const cam = new THREE.PerspectiveCamera(name === 'wheel' ? 30 : 32, W / H, .05, 50); cam.position.set(...pos); if (name === 'grip') cam.lookAt(0, .62, .12); else cam.lookAt(0, name === 'wheel' ? .62 : .55, name === 'wheel' ? .0 : -.1);
          r.render(sc, cam); out[name] = cv.toDataURL('image/png');
        }
        // steering turned hard, to see the gloves go with the rim
        if (m.dmesh) { const I = m.dmesh.morphTargetInfluences; I.fill(0); I[3] = 1; m.steer.rotateOnAxis(m.steerAxis, 0.52); const cam = new THREE.PerspectiveCamera(30, W / H, .05, 50); cam.position.set(...views[5][1]); cam.lookAt(0, .62, .12); r.render(sc, cam); out.turned = cv.toDataURL('image/png'); }
        return out;
      }, [id, player, views, !!process.env.SHIP]);
      for (const [k, v] of Object.entries(shots)) fs.writeFileSync(path.join(OUT, `${id}-${player ? 'player' : 'rival'}${process.env.SHIP ? '-ship' : ''}-${k}.png`), Buffer.from(v.split(',')[1], 'base64'));
    }
  }
  console.log('errors', errs.length ? errs : 'none');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
