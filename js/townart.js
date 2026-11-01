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
(() => {
  const mount = P.town.mount;
  P.town.mount = () => {
    const wr = CQ.$('#townWrap'), m = wr && wr.querySelector('.pbld[data-arg="hero"]');
    if (!m) return mount();
    wr.classList.add('pano');
    wr.scrollLeft = m.getBoundingClientRect().left - wr.getBoundingClientRect().left - wr.clientWidth / 3;
  };
})();
document.addEventListener('keydown', (e) => {
  const el = e.target.closest && e.target.closest('.pbld.open');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); A.townGo(el.dataset.arg); }
});
