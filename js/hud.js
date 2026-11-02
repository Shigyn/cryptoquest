'use strict';
// UI-3 — Barre du haut (portrait et anneau d'XP, fiole d'énergie, bourses, livre de bord), parchemin des objectifs,
// cérémonie de passage de niveau et gains qui s'envolent vers les bourses. Les règles du jeu ne changent pas.

// ---------- Barre du haut ----------
CQ.renderWallet = () => {
  const s = CQ.state, ps = CQ.playerStats(), en = CQ.energyNow(ps), need = CQ.xpNeed(s.level);
  const xpPct = Math.min(1, s.xp / need), C = 2 * Math.PI * 19;
  const enPct = Math.min(1, en / ps.emax), over = en > ps.emax, empty = en < 1 + s.eguard;
  const tip = en >= ps.emax ? (over ? 'Surcharge : la recharge reprend sous le maximum' : 'Énergie pleine')
    : `+1 dans ${Math.ceil(CQ.energyNextIn(ps) / 1000)} s · pleine dans ${CQ.fmtDur(CQ.energyFullIn(ps))}`;
  const pts = CQ.attrPoints().free + CQ.talentPoints().free;
  const purse = (cur, val, cls, title, opt) => `<span class="purse ${opt ? 'opt' : ''}" data-cur="${cur}" title="${title}">${CQ.CUR[cur].ico}<b class="${cls}">${cur === 'crypto' ? CQ.fmtUsd(val, 2) : CQ.fmt(val)}</b></span>`;
  CQ.setHtml1('#wallet',
    `<a class="hud-portrait ${pts ? 'pts' : ''}" href="#hero" title="Niveau ${s.level} · ${CQ.fmt(s.xp)} / ${CQ.fmt(need)} XP${pts ? ` · ${pts} point${pts > 1 ? 's' : ''} à répartir` : ''}">
      <svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="19" class="ring-bg"/><circle cx="22" cy="22" r="19" class="ring" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - xpPct)).toFixed(1)}"/></svg>
      <span class="hp-face">🧝</span><span class="hp-lvl">${s.level}</span></a>` +
    `<button class="flask ${empty ? 'empty' : ''} ${over ? 'over' : ''}" data-act="energyInfo" title="Énergie — ${tip}" data-cur="energy">
      <svg viewBox="0 0 24 32" aria-hidden="true"><defs><clipPath id="flaskClip"><rect x="0" y="${(32 - 26 * Math.min(1, enPct)).toFixed(1)}" width="24" height="32"/></clipPath></defs>
        <path class="fl-glass" d="M9 2 h6 v7 l6 12 a5 5 0 0 1 -4.5 9 h-9 a5 5 0 0 1 -4.5 -9 l6 -12 z"/>
        <path class="fl-liquid" clip-path="url(#flaskClip)" d="M9 2 h6 v7 l6 12 a5 5 0 0 1 -4.5 9 h-9 a5 5 0 0 1 -4.5 -9 l6 -12 z"/></svg>
      <b class="c-en">${CQ.fmt(Math.floor(en))}</b><small class="en-max">/ ${CQ.fmt(ps.emax)}</small></button>` +
    purse('cq', s.cq, 'c-cq', 'CQ — monnaie du jeu') + purse('fp', s.fp, 'c-fp', 'Farm Points') +
    purse('gems', s.gems, 'c-gem', 'Diamants', true) + purse('crypto', s.crypto, 'c-usd', 'Crypto Balance (simulée)', true) +
    `<button class="book-btn" data-act="bookOpen" aria-label="Livre de bord" title="Livre de bord">📖</button>`);
  $('#xpfill').style.width = (100 * xpPct).toFixed(1) + '%';
};

// ---------- Livre de bord (profil, historique, réglages…) ----------
CQ.A.bookOpen = () => {
  let el = document.getElementById('bookMenu');
  if (el) { el.remove(); return; }
  el = document.createElement('div');
  el.id = 'bookMenu'; el.className = 'book-menu'; el.setAttribute('role', 'menu');
  el.innerHTML = [['profile', '👤', 'Profil'], ['history', '🧾', 'Historique'], ['dashboard', '🏠', 'Tableau de bord'], ['premium', '🦅', 'Légion'], ['settings', '⚙️', 'Réglages']]
    .map(([id, ic, l]) => `<a href="#${id}" role="menuitem"><span>${ic}</span>${l}</a>`).join('');
  document.body.appendChild(el);
  setTimeout(() => document.addEventListener('click', function close(e) { if (!e.target.closest('#bookMenu, .book-btn')) { el.remove(); document.removeEventListener('click', close); } }), 0);
};
window.addEventListener('hashchange', () => { const el = document.getElementById('bookMenu'); if (el) el.remove(); });

// ---------- Parchemin des objectifs ----------
// Les 3 prochaines choses à faire (mêmes règles que la liste « À faire »), repliable, mémorisé par appareil.
// sans choix mémorisé : replié (ouvert, il cacherait des boutons)
CQ.objOpen = () => { let v = null; try { v = localStorage.getItem('cq_obj'); } catch (e) { /* rien */ } return v === null ? false : v !== '0'; };
CQ.renderObjectives = () => {
  let el = document.getElementById('objectives');
  const hide = CQ.ui.page === 'town' || CQ.ui.page === 'dashboard' || (CQ.tutoActive && CQ.tutoActive()) || document.getElementById('modalRoot').classList.contains('on');
  if (hide) { if (el) el.remove(); return; }
  const tmp = document.createElement('div');
  tmp.innerHTML = P.dashboard.todos();
  const items = [...tmp.querySelectorAll('.todo-item')].slice(0, 3).map((it) => {
    const a = it.querySelector('a'), b = it.querySelector('b'), sub = it.querySelector('.tt span'), ic = it.querySelector('.ti');
    return `<a class="obj" href="${a ? a.getAttribute('href') : '#'}"><span class="oi">${ic ? ic.textContent : '•'}</span><span><b>${b ? b.textContent : ''}</b><small>${sub ? sub.textContent : ''}</small></span></a>`;
  });
  if (!items.length) { if (el) el.remove(); return; }
  const html = `<button class="obj-head" data-act="objToggle" aria-expanded="${CQ.objOpen()}"><span>📜 Objectifs</span><span>${CQ.objOpen() ? '▾' : '▸'}</span></button>${CQ.objOpen() ? `<div class="obj-list">${items.join('')}</div>` : ''}`;
  if (!el) { el = document.createElement('div'); el.id = 'objectives'; el.className = 'objectives'; document.body.appendChild(el); }
  if (el._html !== html) { el.innerHTML = html; el._html = html; }
};
CQ.A.objToggle = () => { const open = CQ.objOpen(); try { localStorage.setItem('cq_obj', open ? '0' : '1'); } catch (e) { /* rien */ } CQ.renderObjectives(); };

// ---------- Cérémonie de passage de niveau ----------
CQ.ceremony = null;
CQ.showLevelUp = (from, to) => {
  const old = document.getElementById('levelUp');
  if (old) old.remove();
  const n = to - from, el = document.createElement('div');
  const talents = Math.max(0, to - Math.max(from, CQ.TALENT_START - 1));
  el.id = 'levelUp'; el.className = 'levelup'; el.setAttribute('role', 'status');
  el.innerHTML = `<div class="lu-rays"></div><div class="lu-box"><div class="kicker">Niveau supérieur</div><div class="lu-num">${to}</div>
    <div class="lu-gains"><span>+${CQ.ATTR_PER_LEVEL * n} points d’attribut</span>${talents ? `<span>+${talents} talent${talents > 1 ? 's' : ''}</span>` : ''}<span>+${CQ.ENERGY.levelUp * n} énergie</span></div>
    <div class="small dim">Touchez pour continuer</div></div>`;
  el.addEventListener('click', () => CQ.hideLevelUp());
  document.body.appendChild(el);
  CQ.ceremony = setTimeout(CQ.hideLevelUp, 2800);
};
CQ.hideLevelUp = () => {
  clearTimeout(CQ.ceremony); CQ.ceremony = null;
  const el = document.getElementById('levelUp');
  if (el) { el.classList.add('out'); setTimeout(() => el.remove(), 350); }
};
(() => {
  const gx = CQ.gainXp;
  CQ.gainXp = (amt) => {
    const before = CQ.state.level;
    gx(amt);
    if (CQ.state.level > before) CQ.showLevelUp(before, CQ.state.level);
  };
  // la cinématique de construction attend la fin de la cérémonie
  const sb = CQ.showBuild;
  if (sb) CQ.showBuild = () => (CQ.ceremony ? setTimeout(CQ.showBuild, 700) : sb());
})();

// le parchemin suit la page affichée, et se met à jour chaque seconde
(() => { const r = CQ.render; CQ.render = CQ.refresh = () => { r(); CQ.renderObjectives(); }; })();
setInterval(() => { if (CQ.state) CQ.renderObjectives(); }, 1000);

// ---------- Gains qui s'envolent vers les bourses ----------
// Point de départ : le dernier clic (une récompense qu'on récupère), sinon le centre de l'écran.
CQ.lastClick = { x: 0, y: 0, t: 0 };
document.addEventListener('pointerdown', (e) => { CQ.lastClick = { x: e.clientX, y: e.clientY, t: Date.now() }; }, true);
CQ.flyTo = (cur, n = 5) => {
  if (document.body.classList.contains('reduce') || (window.matchMedia('(prefers-reduced-motion: reduce)').matches && !document.body.classList.contains('full-motion'))) return;
  const target = document.querySelector(`#wallet [data-cur="${cur}"]`);
  if (!target || !target.offsetParent) return;
  const t = target.getBoundingClientRect(), tx = t.left + 14, ty = t.top + t.height / 2;
  const recent = Date.now() - CQ.lastClick.t < 1500;
  const sx = recent ? CQ.lastClick.x : innerWidth / 2, sy = recent ? CQ.lastClick.y : innerHeight / 2;
  const ico = CQ.CUR[cur] ? CQ.CUR[cur].ico : '⚡';
  for (let i = 0; i < n; i++) {
    const c = document.createElement('span');
    c.className = 'fly'; c.innerHTML = ico;
    c.style.left = sx + 'px'; c.style.top = sy + 'px';
    document.body.appendChild(c);
    const dx = (Math.random() - 0.5) * 80, dy = -30 - Math.random() * 50;
    const anim = c.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.2)`, opacity: 1, offset: 0.3 },
      { transform: `translate(calc(-50% + ${tx - sx}px), calc(-50% + ${ty - sy}px)) scale(.7)`, opacity: 0.9 },
    ], { duration: 750 + i * 70, easing: 'cubic-bezier(.5,0,.6,1)' });
    anim.onfinish = () => { c.remove(); target.classList.remove('bump'); void target.offsetWidth; target.classList.add('bump'); };
  }
};
(() => {
  const g = CQ.gain;
  CQ.gain = (cur, amt, why, silent) => {
    const r = g(cur, amt, why, silent);
    if (!silent && amt > 0 && ['cq', 'fp', 'gems', 'crypto'].includes(cur)) CQ.flyTo(cur, Math.min(8, 3 + Math.floor(Math.log10(amt + 1))));
    return r;
  };
  const ae = CQ.addEnergy;
  CQ.addEnergy = (n) => { const r = ae(n); if (r > 0 && Date.now() - CQ.lastClick.t < 1500) CQ.flyTo('energy', 4); return r; };
})();
