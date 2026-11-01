'use strict';
// Socle d'interface : navigation, portefeuille, modales, notifications, actions déléguées.
CQ.PAGES = {};
CQ.A = {}; // actions déclenchées par data-act
CQ.ui = { page: 'dashboard', tab: {}, sel: {}, filter: { slot: 'all', rarity: 'all', sort: 'recent' } };
const $ = (sel, root = document) => root.querySelector(sel);
CQ.$ = $;

CQ.NAV = [
  ['Jeu', [
    ['town', '🏰', 'La Cité'], ['dashboard', '🏠', 'Tableau de bord'], ['combat', '⚔️', 'Combat'], ['hero', '🧝', 'Héros'], ['inventory', '🎒', 'Inventaire'], ['equipment', '🛡️', 'Équipement'],
    ['chests', '📦', 'Coffres'], ['forge', '🔨', 'Forge'], ['quests', '📜', 'Quêtes'], ['abyss', '👁️', 'Abysses'], ['season', '🎖️', 'Saison'],
  ]],
  ['Joueurs', [
    ['guild', '🏰', 'Guilde'], ['arena', '🏟️', 'Arène'], ['team', '🤝', 'Arène d’équipe'], ['auction', '⚖️', 'Hôtel des ventes'], ['market', '🏛️', 'Marché'], ['mail', '📬', 'Boîte aux lettres'],
  ]],
  ['Gains', [
    ['faucet', '💧', 'Faucet'], ['shop', '🛒', 'Boutique'], ['staking', '🔒', 'Staking'], ['pool', '🔥', 'Crypto Pool'], ['leaderboard', '🏆', 'Classements'],
  ]],
  ['Compte', [['profile', '👤', 'Profil'], ['history', '🧾', 'Historique'], ['premium', '🦅', 'Légion'], ['settings', '⚙️', 'Réglages']]],
];
CQ.BOTTOM = [['dashboard', '🏠', 'Accueil'], ['combat', '⚔️', 'Combat'], ['inventory', '🎒', 'Sac'], ['pool', '🔥', 'Pool']];

// pastilles « quelque chose à récupérer »
CQ.badges = () => {
  const s = CQ.state;
  const q = CQ.questsToday();
  return {
    dashboard: CQ.loginAvailable(),
    hero: CQ.attrPoints().free > 0 || CQ.talentPoints().free > 0,
    faucet: CQ.faucetReadyIn() === 0,
    quests: CQ.missionsClaimable() || (CQ.state.level >= CQ.FEATURE_LVL.pantheon && CQ.pqClaimable()) || CQ.QUESTS.some(CQ.questClaimable) || CQ.ACHIEVEMENTS.some(CQ.achClaimable) || (!q.bonus && CQ.QUESTS.every((x) => q.claimed[x.id])),
    chests: CQ.CHEST_KEYS.some((k) => s.chests[k] > 0),
    staking: s.stakes.some((st) => Date.now() >= st.end),
    mail: s.mail.length > 0,
    season: CQ.passClaimable(),
    arena: CQ.arenaOpen() && CQ.arenaTickets() >= CQ.ARENA.tickets,
  };
};

CQ.renderNav = () => {
  const b = CQ.badges();
  CQ.setHtml1('#nav', CQ.NAV.map(([g, items]) => `<div class="nav-group">${g}</div>` + items.map(([id, ic, label]) =>
    `<a href="#${id}" class="${CQ.ui.page === id ? 'active' : ''}" ${CQ.ui.page === id ? 'aria-current="page"' : ''}><span class="ni" aria-hidden="true">${ic}</span>${label}${b[id] ? '<span class="dot" aria-label="à récupérer"></span>' : ''}</a>`).join('')).join(''));
  CQ.setHtml1('#bottomnav', CQ.BOTTOM.map(([id, ic, label]) =>
    `<a href="#${id}" class="${CQ.ui.page === id ? 'active' : ''}"><span class="ni">${ic}</span>${label}</a>`).join('') +
    `<button data-act="openMenu"><span class="ni" aria-hidden="true">☰</span>Menu</button>`);
};
// n'écrit dans le DOM que si le contenu change (évite de recréer la barre 4 fois par seconde)
CQ.setHtml1 = (sel, html) => { const el = $(sel); if (el && el._html !== html) { el.innerHTML = html; el._html = html; } };

CQ.renderWallet = () => {
  const s = CQ.state, ps = CQ.playerStats(), en = CQ.energyNow(ps);
  const full = CQ.energyFullIn(ps);
  const tip = en >= ps.emax ? (en > ps.emax ? 'Surcharge : la recharge reprend sous le maximum' : 'Énergie pleine')
    : `+1 dans ${Math.ceil(CQ.energyNextIn(ps) / 1000)} s · pleine dans ${CQ.fmtDur(full)}`;
  CQ.setHtml1('#wallet',
    `<span class="wpill opt" title="Niveau"><span class="lvl">Nv ${s.level}</span></span>` +
    `<button class="wpill en ${en < 1 + s.eguard ? 'empty' : ''} ${en > ps.emax ? 'over' : ''}" data-act="energyInfo" title="Énergie — ${tip}">${CQ.CUR.energy.ico}<span class="c-en">${CQ.fmt(Math.floor(en))}</span><span class="dim en-max">/ ${CQ.fmt(ps.emax)}</span><i class="en-fill" style="width:${Math.min(100, 100 * en / ps.emax).toFixed(1)}%"></i></button>` +
    `<span class="wpill" title="CQ — monnaie du jeu">${CQ.CUR.cq.ico}<span class="c-cq">${CQ.fmt(s.cq)}</span></span>` +
    `<span class="wpill" title="Farm Points">${CQ.CUR.fp.ico}<span class="c-fp">${CQ.fmt(s.fp)}</span></span>` +
    `<a class="wpill opt" href="#shop" title="Diamants — achat direct à l’hôtel des ventes">${CQ.CUR.gems.ico}<span class="c-gem">${CQ.fmt(s.gems)}</span></a>` +
    `<span class="wpill opt" title="Crypto Balance (simulée)">${CQ.CUR.crypto.ico}<span class="c-usd">${CQ.fmtUsd(s.crypto, 2)}</span></span>`);
  $('#xpfill').style.width = (100 * s.xp / CQ.xpNeed(s.level)).toFixed(1) + '%';
};

CQ.render = () => {
  const p = CQ.PAGES[CQ.ui.page] || CQ.PAGES.dashboard;
  $('#pageTitle').textContent = p.title;
  document.title = `${p.title} · CryptoQuest`;
  $('#view').innerHTML = p.render();
  if (p.mount) p.mount();
  CQ.renderNav();
  CQ.renderWallet();
};
CQ.refresh = CQ.render;

CQ.route = () => {
  const id = location.hash.slice(1) || (CQ.home ? CQ.home() : 'dashboard');
  const changed = CQ.ui.page !== id;
  CQ.ui.page = CQ.PAGES[id] ? id : (CQ.home ? CQ.home() : 'dashboard');
  document.body.classList.remove('menu-open');
  CQ.render();
  if (changed) window.scrollTo(0, 0);
};
CQ.go = (id) => { if (location.hash === '#' + id) CQ.route(); else location.hash = id; };

// ---------- Modales ----------
CQ.openModal = (html, opts = {}) => {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-bg" data-act="${opts.locked ? '' : 'closeModal'}"></div><div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${opts.locked ? '' : '<button class="x" data-act="closeModal" aria-label="Fermer">✕</button>'}${html}</div>`;
  root.classList.add('on');
  CQ.ui.modalClose = opts.onClose || null;
  const first = root.querySelector('.modal .actions .btn, .modal input, .modal .btn:not(.x)');
  if (first) first.focus({ preventScroll: true });
};
CQ.closeModal = () => {
  const root = $('#modalRoot');
  root.classList.remove('on');
  root.innerHTML = '';
  const fn = CQ.ui.modalClose; CQ.ui.modalClose = null;
  if (fn) fn();
};
CQ.confirm = (title, body, okLabel, onOk, danger) => {
  CQ.openModal(`<h2>${title}</h2><div class="muted">${body}</div><div class="actions"><button class="btn ghost" data-act="closeModal">Annuler</button><button class="btn ${danger ? 'primary' : 'gold'}" data-act="confirmOk">${okLabel}</button></div>`);
  CQ.ui.confirmOk = onOk;
};
CQ.A.confirmOk = () => { const fn = CQ.ui.confirmOk; CQ.ui.confirmOk = null; CQ.closeModal(); if (fn) fn(); };
CQ.A.closeModal = () => CQ.closeModal();

// ---------- Notifications ----------
CQ.toast = (html, kind = '') => {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = html;
  box.appendChild(el);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, 3600);
};

// ---------- Vidéo récompensée / visionnage simulé ----------
CQ.watch = ({ title, secs, label }, onDone) => {
  let left = secs, done = false;
  CQ.openModal(`<h2>${title}</h2>
    <div class="video-sim"><div class="vt">${label}<div class="small dim mt">Publicité simulée — prototype</div></div><div class="bar gold"><i id="vidbar"></i></div></div>
    <div class="row between mt"><span class="muted small">Restez sur cette fenêtre jusqu'à la fin.</span><b class="tnum" id="vidleft">${secs} s</b></div>`,
  { onClose: () => { clearInterval(timer); if (!done) CQ.toast('Visionnage interrompu, aucune récompense.', 'red'); } });
  const timer = setInterval(() => {
    left -= 0.25;
    const bar = $('#vidbar'), lab = $('#vidleft');
    if (bar) bar.style.width = (100 * (1 - left / secs)) + '%';
    if (lab) lab.textContent = Math.ceil(Math.max(0, left)) + ' s';
    if (left <= 0) { done = true; clearInterval(timer); CQ.closeModal(); onDone(); }
  }, 250);
};

// ---------- Fragments réutilisables ----------
CQ.itemTile = (it, opts = {}) => {
  const eq = CQ.isEquipped(it);
  // opts.static : simple vignette (dans un autre bouton, un bouton imbriqué casserait la mise en page)
  const tag = opts.static ? 'span' : 'button';
  return `<${tag} class="item r${it.rarity} ${opts.sel ? 'sel' : ''} ${CQ.canWear(it) ? '' : 'toohigh'}" ${opts.static ? '' : `data-act="${opts.act || 'itemInfo'}" data-arg="${it.id}"`} title="${CQ.esc(it.name)} — ${CQ.RARITIES[it.rarity].name}">
    ${CQ.SLOT[it.slot].icon}${it.plus ? `<span class="plus">+${it.plus}</span>` : ''}<span class="il">Nv ${it.ilvl}</span>${eq ? '<span class="eq" title="Équipé">🟢</span>' : it.locked ? '<span class="eq" title="Verrouillé">🔒</span>' : it.bound ? '<span class="eq" title="Lié au compte">🔗</span>' : ''}${it.set ? '<span class="setmark" title="Pièce d’ensemble">◆</span>' : ''}</${tag}>`;
};
CQ.statLine = (k, v) => `${CQ.STATS[k].name}</span><span>+${CQ.fmtStat(k, v)}${CQ.STATS[k].rt ? ` <span class="dim">≈ ${CQ.fmtPs(k, v / (CQ.state.level + 10))}</span>` : ''}`;
CQ.rollsHtml = (it) => `<div class="rolls">${it.rolls.map((r) => {
  const v = r.v * (1 + 0.1 * it.plus);
  return `<div class="${r.main ? 'main' : 'aff'}"><span>${CQ.statLine(r.k, v)}</span></div>`;
}).join('')}${it.unique && CQ.UNIQUES[it.unique] ? `<div class="unique"><span>✦ ${CQ.UNIQUES[it.unique].name}</span><span>${CQ.UNIQUES[it.unique].desc}</span></div>` : ''}</div>${it.set ? CQ.setHtml(it.set) : ''}`;
// bonus d'ensemble, avec le nombre de pièces portées
CQ.setHtml = (id) => {
  const set = CQ.SETS[id], n = CQ.setCounts(CQ.equippedItems())[id] || 0;
  return `<div class="set-box"><b>◆ ${set.name}</b> <span class="small dim">${n}/3 portées · ${set.slots.map((sl) => CQ.SLOT[sl].name).join(', ')}</span>
    <div class="small ${n >= 2 ? 'c-green' : 'dim'}">2 pièces : ${CQ.fxText(set.b2)}</div><div class="small ${n >= 3 ? 'c-green' : 'dim'}">3 pièces : ${CQ.fxText(set.b3)}</div></div>`;
};
CQ.itemHead = (it) => `<div class="ih r${it.rarity}">${CQ.itemTile(it, { act: 'noop' })}<div>
  <div class="iname">${CQ.esc(it.name)}${it.plus ? ` +${it.plus}` : ''}</div>
  <div class="small muted">${CQ.RARITIES[it.rarity].name} · ${CQ.SLOT[it.slot].name} · niveau ${it.ilvl} · <span class="${CQ.canWear(it) ? '' : 'c-fp'}">requis ${CQ.reqLevel(it)}</span></div>
  <div class="row wrap" style="gap:4px;margin-top:3px"><span class="small dim">Puissance ${CQ.itemPower(it)}</span>${it.good ? '<span class="chip gold">Qualité supérieure</span>' : ''}${it.bound ? '<span class="chip">🔗 Lié</span>' : ''}</div></div></div>`;
CQ.A.noop = () => {};

CQ.bar = (pct, cls = '', id = '') => `<div class="bar ${cls}"><i ${id ? `id="${id}"` : ''} style="width:${CQ.clamp(pct, 0, 100).toFixed(1)}%"></i></div>`;
CQ.tabs = (key, list) => {
  const cur = CQ.ui.tab[key] || list[0][0];
  return `<div class="tabs">${list.map(([id, label]) => `<button class="tab ${cur === id ? 'on' : ''}" data-act="tab" data-arg="${key}:${id}">${label}</button>`).join('')}</div>`;
};
CQ.tabOf = (key, def) => CQ.ui.tab[key] || def;
CQ.A.tab = (arg) => { const [k, v] = arg.split(':'); CQ.ui.tab[k] = v; CQ.refresh(); };

CQ.adBanner = (format = 'Bannière 300×100') => `<div class="ad"><b>Emplacement publicitaire</b>${format} · régie branchée en V0.4</div>`;

// ---------- Délégation d'évènements ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !el.dataset.act) return;
  const fn = CQ.A[el.dataset.act];
  if (!fn) return;
  e.preventDefault();
  fn(el.dataset.arg, el, e);
  CQ.renderWallet();
});
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (el && CQ.A[el.dataset.change]) CQ.A[el.dataset.change](el.value, el, e);
});
document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (el && CQ.A[el.dataset.input]) CQ.A[el.dataset.input](el.value, el, e);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#modalRoot').classList.contains('on') && !$('#modalRoot .modal-bg[data-act=""]')) CQ.closeModal(); });

CQ.A.openMenu = () => document.body.classList.add('menu-open');
CQ.A.closeMenu = () => document.body.classList.remove('menu-open');
CQ.A.go = (id) => CQ.go(id);
CQ.A.goClose = (id) => { CQ.closeModal(); CQ.go(id); };
