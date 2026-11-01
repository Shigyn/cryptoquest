'use strict';
// UI-4 — Carte du monde : le choix de zone de la page Combat devient un chemin qui part de la Cité.
// Zones fermées dans le brouillard, couronne du boss, clé du donjon, bannière du héros sur la zone en cours.
// Le combat lui-même ne change pas : un clic sur une zone fait exactement ce que faisait le bouton.

// position des étapes (viewBox 1000 × 250) et teinte de chaque région
CQ.WM_POS = [[120, 180], [210, 95], [305, 170], [395, 80], [490, 160], [585, 75], [675, 165], [770, 85], [860, 170], [945, 80]];
CQ.WM_TINT = ['#2f5a2c', '#4d5a24', '#4a4a66', '#6b2a16', '#6b1620', '#3d5f7a', '#1f4f5f', '#4b2f5f', '#7a6640', '#2a0f3d'];
CQ.WM_TOWN = [40, 120];

CQ.worldMap = () => {
  const s = CQ.state, c = CQ.combat, ps = CQ.playerStats();
  const pts = [CQ.WM_TOWN, ...CQ.WM_POS];
  const open = (i) => s.level >= CQ.ZONES[i].lvl;
  const nextLocked = CQ.ZONES.findIndex((z, i) => !open(i));
  // chemin lissé de la Cité à la dernière zone ; la partie ouverte est dorée
  const seg = (a, b) => { const [x1, y1] = pts[a], [x2, y2] = pts[b], mx = (x1 + x2) / 2; return `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`; };
  const road = pts.slice(1).map((p, i) => `<path class="wm-road ${open(i) ? 'open' : ''}" d="${seg(i, i + 1)}"/>`).join('');
  const regions = CQ.WM_POS.map(([x, y], i) => `<ellipse cx="${x}" cy="${y}" rx="70" ry="60" fill="${CQ.WM_TINT[i]}" opacity="${open(i) ? 0.45 : 0.18}"/>`).join('');
  const fog = CQ.WM_POS.map(([x, y], i) => (open(i) ? '' : `<ellipse class="wm-fog" cx="${x}" cy="${y}" rx="62" ry="44" style="animation-delay:${-i * 1.7}s"/>`)).join('');
  const nodes = CQ.ZONES.map((z, i) => {
    const [x, y] = CQ.WM_POS[i], on = i === c.zone, ok = open(i);
    const known = ok || i === nextLocked;
    const risk = ok ? CQ.riskLabel(CQ.zoneYield(i, ps).risk) : null;
    const boss = ok && s.zoneKills[i] >= CQ.BOSS_KILLS, d = ok && CQ.dungeonOf(i);
    const tip = ok ? `${z.name} — niveau ${z.lvl}+ · ${risk[0]}` : `${known ? z.name : 'Terres inconnues'} — ouvre au niveau ${z.lvl}`;
    return `<g class="wm-node ${on ? 'on' : ''} ${ok ? '' : 'locked'} ${risk ? 'r-' + risk[1] : ''}" transform="translate(${x} ${y})" data-act="zone" data-arg="${i}" role="button" tabindex="0" aria-label="${CQ.esc(tip)}">
      <title>${CQ.esc(tip)}</title>
      <circle class="wm-ring" r="24"/><text class="wm-ico" y="8" text-anchor="middle">${ok ? z.icon : '🔒'}</text>
      ${ok ? `<g class="wm-boss ${boss ? 'ready' : ''}" transform="translate(20 -20)"><circle r="10"/><text y="4" text-anchor="middle">👑</text></g>` : ''}
      ${ok && d.normal > 0 ? `<g class="wm-key" transform="translate(-21 -20)"><circle r="10"/><text y="4" text-anchor="middle">🗝️</text></g>` : ''}
      ${on ? `<g class="wm-banner"><path d="M0 -26 V-62"/><path class="wm-flag" d="M0 -62 L22 -56 L0 -48 Z"/></g>` : ''}
      <text class="wm-name" y="42" text-anchor="middle">${known ? CQ.esc(z.name) : '???'}</text>
      <text class="wm-lvl" y="55" text-anchor="middle">${ok ? risk[0] : `niveau ${z.lvl}`}</text></g>`;
  }).join('');
  const [tx, ty] = CQ.WM_TOWN;
  return `<div class="worldmap" id="worldmap"><svg viewBox="0 0 1000 250" class="wm-svg" role="group" aria-label="Carte du monde">
    <defs><filter id="wmBlur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter></defs>
    <g filter="url(#wmBlur)">${regions}</g>${road}
    <g class="wm-town" transform="translate(${tx} ${ty})" data-act="goTown" role="button" tabindex="0" aria-label="Retour à la Cité"><title>La Cité</title>
      <path d="M-18 0 V-18 L-12 -24 L-6 -18 V-10 H6 V-18 L12 -24 L18 -18 V0 Z"/><text y="-30" text-anchor="middle">La Cité</text></g>
    ${nodes}<g filter="url(#wmBlur)">${fog}</g></svg></div>`;
};

// la carte remplace la rangée de boutons de zones
(() => {
  const r = P.combat.render;
  P.combat.render = () => {
    const t = document.createElement('template');
    t.innerHTML = r();
    const z = t.content.querySelector('.zones');
    if (z) { const m = document.createElement('template'); m.innerHTML = CQ.worldMap(); z.replaceWith(m.content); }
    return t.innerHTML;
  };
  // sur téléphone la carte défile : on la centre sur la zone en cours
  const mount = P.combat.mount;
  P.combat.mount = () => {
    mount();
    const w = document.getElementById('worldmap'), on = w && w.querySelector('.wm-node.on');
    if (w && on && w.scrollWidth > w.clientWidth) w.scrollLeft = on.getBoundingClientRect().left - w.getBoundingClientRect().left - w.clientWidth / 2;
  };
})();
// clavier : Entrée ou Espace sur une étape de la carte
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.wm-svg [data-act]')) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
