'use strict';
// La Cité peinte : quand les illustrations existent (img/town/), la ville devient un plateau qu'on lit de gauche à droite.
// Le décor est répété en panneaux (un sur deux en miroir pour que les bords se raccordent), les bâtiments sont alignés par niveau d'ouverture (la ville grandit vers la droite).
// Un bâtiment sans illustration garde son dessin SVG ; un bâtiment pas encore ouvert est un chantier avec son niveau.

CQ.TOWN_IMG = {
  decor: 'img/town/decor-ville.webp', // un seul décor pour l'instant, utilisé à toutes les étapes
  blds: ['maison', 'forge', 'taverne'],
};
CQ.PANO = { w: 2000, h: 667, panels: 4, slots: [180, 530, 885, 1230, 1575, 1880], base: 470, size: 380 };

CQ.townScene = () => {
  const { w, h, panels, slots, base, size } = CQ.PANO;
  const order = CQ.TOWN.slice().sort((a, b) => CQ.bLvl(a) - CQ.bLvl(b) || (a.id === 'portes' ? -1 : b.id === 'portes' ? 1 : 0));
  const xs = Array.from({ length: panels }, (_, p) => slots.map((x) => p * w + x)).flat();
  const W = Math.min(w * panels, xs[order.length - 1] + 300); // le plateau s'arrête après le dernier terrain
  const panelsSvg = Array.from({ length: panels }, (_, p) => `<image href="${CQ.TOWN_IMG.decor}" x="${p * w}" y="0" width="${w}" height="${h}" preserveAspectRatio="none"${p % 2 ? ` transform="translate(${(2 * p + 1) * w} 0) scale(-1 1)"` : ''}/>`).join('');
  const blds = order.slice(0, xs.length).map((b, i) => {
    const x = xs[i], open = CQ.bOpen(b), sig = open && CQ.bSig(b), img = CQ.TOWN_IMG.blds.includes(b.id);
    const top = base - size + 14;
    const art = !open ? `<g transform="translate(0 ${base}) scale(2.6)">${CQ.chantier(b)}</g>`
      : img ? `<image href="img/town/${b.id}.webp" x="${-size / 2}" y="${top}" width="${size}" height="${size}"/>`
        : `<g class="town-svg night" transform="translate(0 ${base - 4}) scale(2.9)">${CQ.ART[b.art]()}</g>`;
    const label = open ? b.name : `Niveau ${CQ.bLvl(b)}`, lw = Math.max(110, label.length * 11 + 40), ry = open ? top - 6 : base - 230;
    return `<g class="pbld ${open ? 'open' : 'locked'} ${sig ? 'sig' : ''}" transform="translate(${x} 0)" ${open ? `data-act="townGo" data-arg="${b.page}" tabindex="0" role="link"` : `data-act="townLocked" data-arg="${b.id}"`} aria-label="${CQ.esc(open ? b.name : `Chantier : ${b.name}, niveau ${CQ.bLvl(b)}`)}">
      <title>${CQ.esc(open ? `${b.name} — ${b.npc}` : `${b.name} : ouvre au niveau ${CQ.bLvl(b)}`)}</title>
      <ellipse class="pshadow" cx="0" cy="${base - 4}" rx="${size * 0.42}" ry="16"/>${art}
      <g class="ribbon" transform="translate(0 ${ry})"><path d="M${-lw / 2 - 14} 4 L${-lw / 2} 4 L${-lw / 2} 30 L${-lw / 2 - 14} 30 L${-lw / 2 - 6} 17 Z M${lw / 2 + 14} 4 L${lw / 2} 4 L${lw / 2} 30 L${lw / 2 + 14} 30 L${lw / 2 + 6} 17 Z" class="rb-tail"/>
        <rect x="${-lw / 2}" y="0" width="${lw}" height="30" rx="5" class="rb-body"/><text x="0" y="21" text-anchor="middle">${CQ.esc(label)}</text></g>
      ${sig ? `<g transform="translate(${lw / 2 + 4} ${ry - 8})"><g class="pbang"><circle r="15"/><text y="7" text-anchor="middle">!</text></g></g>` : ''}</g>`;
  }).join('');
  return `<svg class="pano-svg" viewBox="0 0 ${W} ${h}" role="group" aria-label="La Cité">${panelsSvg}${blds}</svg>`;
};

// le plateau s'ouvre sur la Maison du héros
// ---------- Hub plein écran ----------
// Le plateau prend tout l'écran ; titre, bonus du héraut et dock de raccourcis flottent par-dessus.
CQ.DOCK = [['hero', '🧝', 'Héros', 'desk'], ['inventory', '🎒', 'Inventaire', 'desk'], ['forge', '🔨', 'Forge'], ['quests', '📜', 'Quêtes'], ['chests', '📦', 'Coffres'], ['mail', '📬', 'Courrier'], ['season', '🎖️', 'Saison'], ['leaderboard', '🏆', 'Gloire']];
CQ.townDock = () => {
  const b = CQ.badges();
  return `<nav class="town-dock" aria-label="Raccourcis">${CQ.DOCK.filter(([id]) => CQ.unlocked(id)).map(([id, ic, l, only]) =>
    `<a class="dk ${only === 'desk' ? 'dk-desk' : ''}" href="#${id}"><span class="dk-ico">${ic}${b[id] ? '<i class="dk-dot"></i>' : ''}</span><span class="dk-l">${l}</span></a>`).join('')}</nav>`;
};
(() => {
  const render = P.town.render;
  P.town.render = () => {
    const t = document.createElement('template');
    t.innerHTML = render();
    const wr = t.content.querySelector('#townWrap');
    if (wr && wr.querySelector('.pano-svg')) {
      const stage = document.createElement('div');
      stage.className = 'town-stage';
      wr.replaceWith(stage);
      stage.append(wr);
      const head = t.content.querySelector('.town-head'), crier = t.content.querySelector('.town-crier');
      if (head) stage.append(head);
      // le bonus du héraut devient un médaillon cadeau (la bannière cachait les rubans)
      if (crier) { crier.remove(); stage.insertAdjacentHTML('beforeend', `<button class="hub-gift" data-act="claimLogin" title="Bonus de connexion du jour"><span class="dk-ico">🎁<i class="dk-dot"></i></span><span class="dk-l">Bonus du jour</span></button>`); }
      stage.insertAdjacentHTML('beforeend', CQ.townDock());
    }
    return t.innerHTML;
  };
  const mount = P.town.mount;
  P.town.mount = () => {
    const wr = CQ.$('#townWrap'), m = wr && wr.querySelector('.pbld[data-arg="hero"]');
    if (!m) return mount();
    wr.classList.add('pano');
    // le hub occupe exactement la hauteur sous la barre du haut
    document.documentElement.style.setProperty('--hub-top', Math.round(CQ.$('#xpbar').getBoundingClientRect().bottom + scrollY) + 'px');
    // on garde la position quand la ville se redessine ; à la première ouverture, on montre la Maison du héros
    wr.scrollLeft = P.town._x != null ? P.town._x : m.getBoundingClientRect().left - wr.getBoundingClientRect().left - wr.clientWidth / 3;
    wr.addEventListener('scroll', () => { P.town._x = wr.scrollLeft; }, { passive: true });
    // molette verticale = défilement horizontal du plateau
    wr.addEventListener('wheel', (e) => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { wr.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
  };
  // marque la page pour la mise en page plein écran
  const r = CQ.render;
  CQ.render = CQ.refresh = () => { r(); document.body.classList.toggle('page-town', CQ.ui.page === 'town' && !!document.querySelector('.town-stage')); };
})();
document.addEventListener('keydown', (e) => {
  const el = e.target.closest && e.target.closest('.pbld.open');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); A.townGo(el.dataset.arg); }
});
