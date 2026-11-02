'use strict';
// Écran principal façon RPG idle : le combat est l'accueil, la scène reste fixe en haut,
// et un panneau « Progression » en dessous fait progresser le héros sans quitter le combat.
// Les règles et les coûts sont ceux de l'entraînement, de la forge et des quêtes existants.

CQ.home = () => 'combat';

// ---------- Panneau Progression ----------
CQ.IDLE_TABS = [['train', '💪', 'Entraînement'], ['gear', '🛡️', 'Équipement'], ['quests', '📜', 'Quêtes']];
CQ.idlePanel = () => {
  const tab = CQ.ui.idleTab || 'train', s = CQ.state, b = CQ.badges();
  const tabs = `<div class="idle-tabs">${CQ.IDLE_TABS.map(([id, ic, l]) => `<button class="it ${tab === id ? 'on' : ''}" data-act="idleTab" data-arg="${id}">${ic} ${l}${id === 'quests' && b.quests ? '<i class="bn-dot"></i>' : ''}</button>`).join('')}</div>`;
  let body = '';
  if (tab === 'train') {
    const cap = CQ.trainCap(s.level);
    body = `<div class="idle-list">${CQ.ATTRS.map((a) => {
      const t = CQ.trained(a.id), cost = CQ.trainNext(a.id);
      return `<div class="idle-row"><span class="ir-ico">${a.icon}</span><div class="ir-txt"><b>${a.name} <span class="ir-lvl">Niv. ${t}</span></b><small>${a.desc} · total ${s.attrs[a.id] + t}</small>
        <div class="ir-bar">${CQ.bar(100 * t / cap, 'gold')}</div></div>
        ${cost ? `<button class="btn gold sm ir-btn" data-act="idleTrain" data-arg="${a.id}:1" ${s.cq >= cost ? '' : 'disabled'}>+1<small>${CQ.fmt(cost)} CQ</small></button>
          <button class="btn sm ir-btn" data-act="idleTrain" data-arg="${a.id}:max" ${s.cq >= cost ? '' : 'disabled'}>Max</button>` : '<span class="chip gold">Max</span>'}</div>`;
    }).join('')}</div><div class="small dim mt">Entraînement plafonné à ${cap} par attribut au niveau ${s.level}. ${CQ.attrPoints().free + CQ.talentPoints().free ? `<a href="#hero" class="c-gold"><b>${CQ.attrPoints().free + CQ.talentPoints().free} points gratuits à répartir →</b></a>` : ''}</div>`;
  } else if (tab === 'gear') {
    body = `<div class="idle-gear">${CQ.SLOTS.map((sl) => { const it = CQ.itemById(s.equipped[sl.id]); return `<a href="#equipment" title="${it ? CQ.esc(it.name) : sl.name}">${it ? CQ.itemTile(it, { static: true }) : `<span class="item r0 empty-slot">${sl.icon}</span>`}</a>`; }).join('')}</div>
      <div class="idle-actions"><button class="btn gold" data-act="autoEquip">🛡️ Équiper le meilleur</button><button class="btn primary" data-act="autoForge">🔨 Forge auto</button><button class="btn" data-act="autoFuse">🔮 Fusion auto</button><a class="btn ghost" href="#forge">Forge →</a></div>
      <div class="small dim mt">Inventaire : ${s.inventory.length}/${CQ.INV_CAP}${s.inventory.length >= CQ.INV_CAP ? ' — <b style="color:var(--red-2)">plein, les nouveaux objets sont revendus</b>' : ''}</div>`;
  } else {
    body = `${CQ.claimAllReady() ? '<button class="btn gold block" data-act="claimAll">🎁 Tout récupérer</button>' : ''}<div class="todo mt">${P.dashboard.todos()}</div>`;
  }
  return tabs + `<div class="idle-body">${body}</div>`;
};
CQ.renderIdle = () => { const el = document.getElementById('idlePanel'); if (el) { const h = CQ.idlePanel(); if (el._html !== h) { el.innerHTML = h; el._html = h; } } };
A.idleTab = (t) => { CQ.ui.idleTab = t; CQ.renderIdle(); };
// on n'actualise que le panneau : la scène de combat continue sans être redessinée
A.idleTrain = (arg) => {
  const [id, n] = arg.split(':');
  let k = 0;
  for (let i = 0; i < (n === 'max' ? 500 : 1); i++) { const cost = CQ.trainNext(id); if (!cost || CQ.state.cq < cost || !CQ.train(id)) break; k++; }
  if (k) { CQ.sfx('coin'); CQ.toast(`💪 ${CQ.ATTRS.find((a) => a.id === id).name} +${k}`, 'green'); CQ.save(); }
  CQ.renderIdle(); CQ.renderWallet();
};

(() => {
  const render = P.combat.render;
  P.combat.render = () => {
    const t = document.createElement('template');
    t.innerHTML = render();
    const ar = t.content.querySelector('#arena'), map = t.content.querySelector('#worldmap');
    if (ar) {
      ar.classList.add('idle-stage');
      const panel = document.createElement('div');
      panel.id = 'idlePanel'; panel.className = 'idle-panel';
      ar.after(panel);
      if (map) panel.after(map); // la carte des zones passe sous le panneau
    }
    return t.innerHTML;
  };
  const mount = P.combat.mount;
  P.combat.mount = () => { mount(); CQ.renderIdle(); };
  const tick = P.combat.tick;
  P.combat.tick = () => { tick(); P.combat._it = (P.combat._it || 0) + 1; if (P.combat._it % 6 === 0) CQ.renderIdle(); };
  // sur l'écran principal, pas de bandeau d'habitant (sauf la première visite)
  const ih = CQ.interiorHtml;
  CQ.interiorHtml = (page) => (page === 'combat' && CQ.npcSeen().portes ? '' : ih(page));
  const r = CQ.render;
  CQ.render = CQ.refresh = () => { r(); document.body.classList.toggle('page-combat', CQ.ui.page === 'combat'); };
})();
