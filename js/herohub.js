'use strict';
// Maison du héros façon RPG mobile : vitrine du héros (portrait, Puissance, équipement porté)
// et répartition automatique des attributs et des talents selon un style de jeu. Les règles ne changent pas :
// la répartition passe par les mêmes fonctions que les boutons « + » (plafonds et paliers respectés).

CQ.STYLES = {
  equil: { name: 'Équilibré', icon: '⚖️', split: { force: .3, vit: .25, prec: .2, agi: .15, endu: .1 }, branches: ['lame', 'rempart', 'moisson'] },
  atk: { name: 'Attaque', icon: '⚔️', split: { force: .45, prec: .25, agi: .15, vit: .15 }, branches: ['lame', 'moisson', 'rempart'] },
  def: { name: 'Survie', icon: '🛡️', split: { vit: .45, force: .25, agi: .15, prec: .15 }, branches: ['rempart', 'lame', 'moisson'] },
  farm: { name: 'Farm', icon: '🌾', split: { endu: .3, fort: .25, force: .25, prec: .2 }, branches: ['moisson', 'lame', 'rempart'] },
};
CQ.heroStyle = () => CQ.state.settings.heroStyle || 'equil';

// attributs : chaque point va à l'attribut le plus en retard sur sa part cible, sans dépasser le plafond
CQ.autoAttrs = (style = CQ.heroStyle()) => {
  const s = CQ.state, split = CQ.STYLES[style].split, cap = CQ.attrCap(s.level), add = {};
  let free = CQ.attrPoints().free;
  const val = (k) => s.attrs[k] + (add[k] || 0);
  while (free > 0) {
    const tot = CQ.ATTRS.reduce((a, x) => a + val(x.id), 0) + 1;
    const pick = CQ.ATTRS.filter((x) => (split[x.id] || 0) > 0 && val(x.id) < cap)
      .sort((a, b) => (val(a.id) - split[a.id] * tot) - (val(b.id) - split[b.id] * tot))[0]
      || CQ.ATTRS.filter((x) => val(x.id) < cap)[0];
    if (!pick) break;
    add[pick.id] = (add[pick.id] || 0) + 1; free--;
  }
  const n = Object.values(add).reduce((a, b) => a + b, 0);
  return n && CQ.allocateAttrs(add) ? n : 0;
};
// talents : branche principale d'abord (rangée 1, puis rangée 2, puis l'ultime), ensuite les autres branches
CQ.autoTalents = (style = CQ.heroStyle()) => {
  let n = 0;
  const lists = CQ.STYLES[style].branches.map((b) => {
    const ts = CQ.TALENT_BRANCHES.find((x) => x.id === b).talents;
    return [...ts.filter((t) => !t.gate && !t.ult), ...ts.filter((t) => t.gate), ...ts.filter((t) => t.ult)];
  });
  // Équilibré : on alterne les deux premières branches ; sinon une branche après l'autre
  const order = style === 'equil' ? [...lists[0].flatMap((t, i) => [t, lists[1][i]].filter(Boolean)), ...lists[2]] : lists.flat();
  for (let guard = 0; guard < 500 && CQ.talentPoints().free > 0; guard++) {
    if (style === 'equil') {
      // un rang par talent et par tour, pour répartir entre les deux branches
      let moved = false;
      for (const t of order) if (CQ.talentPoints().free > 0 && !CQ.talentBlock(t.id) && CQ.learnTalent(t.id)) { n++; moved = true; }
      if (!moved) break;
      continue;
    }
    const t = order.find((x) => !CQ.talentBlock(x.id));
    if (!t || !CQ.learnTalent(t.id)) break;
    n++;
  }
  return n;
};
A.heroStyle = (k) => { CQ.state.settings.heroStyle = k; CQ.save(); CQ.refresh(); };
A.autoPoints = () => {
  CQ.ui.pend = {};
  const a = CQ.autoAttrs(), t = CQ.autoTalents();
  if (!a && !t) { CQ.toast('Aucun point à répartir.', ''); return; }
  CQ.toast(`⚡ ${a ? `${a} point${a > 1 ? 's' : ''} d’attribut` : ''}${a && t ? ' et ' : ''}${t ? `${t} talent${t > 1 ? 's' : ''}` : ''} répartis (${CQ.STYLES[CQ.heroStyle()].name}).`, 'green');
  CQ.save(); CQ.refresh();
};

// ---------- Vitrine du héros ----------
CQ.heroShowcase = () => {
  const s = CQ.state, ps = CQ.playerStats(), free = CQ.attrPoints().free + CQ.talentPoints().free;
  const slots = CQ.SLOTS.map((sl) => {
    const it = CQ.itemById(s.equipped[sl.id]);
    return `<a class="hs-slot" href="#equipment" title="${it ? CQ.esc(it.name) : sl.name + ' : vide'}">${it ? CQ.itemTile(it, { static: true }) : `<span class="item r0 empty-slot">${sl.icon}</span>`}</a>`;
  });
  return `<div class="hero-show">
    <div class="hs-col">${slots.slice(0, 4).join('')}</div>
    <div class="hs-mid"><div class="hs-sprite">${HERO}</div><div class="hs-name">${CQ.heroName(s.name)}</div>
      <div class="hs-lvl">Niveau ${s.level}</div><div class="hs-power"><span>Puissance</span><b>${CQ.fmt(ps.power)}</b></div></div>
    <div class="hs-col">${slots.slice(4).join('')}</div></div>
    ${free ? `<div class="auto-pts"><div><b>⚡ ${free} point${free > 1 ? 's' : ''} à répartir</b><div class="small muted">Choisissez un style, le jeu répartit attributs et talents pour vous.</div>
      <div class="row wrap mt" style="gap:6px">${Object.entries(CQ.STYLES).map(([k, st]) => `<button class="chip ${CQ.heroStyle() === k ? 'gold' : ''}" data-act="heroStyle" data-arg="${k}">${st.icon} ${st.name}</button>`).join('')}</div></div>
      <button class="btn gold" data-act="autoPoints">Tout répartir</button></div>` : ''}`;
};
(() => {
  const ih = CQ.interiorHtml;
  CQ.interiorHtml = (page) => { const h = ih(page); return h && page === 'hero' ? h + CQ.heroShowcase() : h; };
})();
