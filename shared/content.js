// Fugio content choice (2026-11-25, the user: "before you select any of the student games you need to select A1 or A2 or whatever we got or
// there will be button under it called Specific Package and there will be all the content packages we have and user can select what he want").
// The Student library asks for the English first and opens the game with it in the address:
//   ?lv=A1            every package of that level (A0 / A1 / A2)
//   ?pk=A1-G05,A2-V03 just those packages
// A game frame inside another one (the Foxino Sports lobby → a sport) takes it from the frame above.
// Loaded right after packages.js: it narrows window.GUMMY_PACKAGES to ONE package made of the chosen content, so every game plays exactly
// that (their own package buttons then show only it). Without ?lv / ?pk nothing changes. window.FUGIO_CONTENT = {lv, ids, title} when on.
(function () {
  const LV = { A0: 'Pre-A1', A1: 'Beginner', A2: 'Elementary' };
  function find(w) {
    for (let k = 0; k < 4 && w; k++) {
      try { const q = new URLSearchParams(w.location.search); if (q.get('lv') && LV[q.get('lv')]) return { lv: q.get('lv') }; if (q.get('pk')) return { ids: q.get('pk').split(',').filter(Boolean).slice(0, 40) }; } catch (e) { return null; }
      if (w.parent === w) break; w = w.parent;
    }
    return null;
  }
  const c = find(window), all = window.GUMMY_PACKAGES || [];
  if (!c || !all.length) return;
  const ps = c.lv ? all.filter((p) => p.level === c.lv) : all.filter((p) => c.ids.includes(p.id));
  if (!ps.length) return;
  const levels = [...new Set(ps.map((p) => p.level))].sort();
  const title = c.lv ? `All ${c.lv} · ${LV[c.lv]}` : ps.length === 1 ? ps[0].title : `${ps.length} packages mixed`;
  const one = ps.length === 1 ? ps[0] : {
    id: c.lv ? `fugio-all-${c.lv}` : `fugio-mix-${ps.map((p) => p.id).join('+')}`.slice(0, 120), level: levels.join('/'), kind: 'Mix', n: 0, title,
    subtitle: c.lv ? `${ps.length} topics mixed` : ps.map((p) => p.title.split(' – ')[0]).join(' · '), count: ps.reduce((s, p) => s + (p.count || 0), 0),
    rounds: [0, 1, 2].map((r) => ps.flatMap((p) => (p.rounds && p.rounds[r]) || [])), parts: ps.map((p) => p.id) };
  window.GUMMY_PACKAGES = [one];
  window.FUGIO_CONTENT = { lv: c.lv || null, ids: ps.map((p) => p.id), title, level: levels.join('/') };
})();
