'use strict';
// Écran de combat façon RPG mobile (bouton flottant Combattre / Pause) et défi automatique du boss :
// une fois un boss de zone battu à la main, il est redéfié tout seul dès les 15 victoires atteintes ;
// une défaite contre lui coupe le défi automatique de cette zone jusqu'à ce que le joueur le relance.

CQ.bossAuto = () => CQ.state.bossAuto || (CQ.state.bossAuto = {}); // zone → 'on' | 'off' (absent : jamais battu)
CQ.bossAutoOn = (z) => CQ.bossAuto()[z] === 'on';

(() => {
  const kill = CQ.onKill;
  CQ.onKill = (m, ps) => {
    const c = CQ.combat, z = c.zone, wasBoss = c.mode === 'boss';
    const r = kill(m, ps);
    // première victoire (ou nouvelle victoire) contre le boss de la zone : le défi automatique s'active
    if (wasBoss && CQ.bossAuto()[z] == null) { CQ.bossAuto()[z] = 'on'; CQ.addLog('🔁 Défi automatique du boss activé pour cette zone.'); }
    // 15 victoires atteintes en farm : on relance le boss tout seul
    if (!wasBoss && c.mode === 'farm' && CQ.bossAutoOn(z) && CQ.state.auto && CQ.state.zoneKills[z] >= CQ.BOSS_KILLS) {
      setTimeout(() => {
        if (c.mode === 'farm' && !c.deadUntil && c.zone === z && CQ.state.auto && CQ.state.zoneKills[z] >= CQ.BOSS_KILLS) {
          CQ.startBoss();
          CQ.toast(`🔁 Défi automatique : ${CQ.ZONES[z].boss[0]}`, 'gold');
          if (CQ.ui.page === 'combat') CQ.refresh();
        }
      }, 400);
    }
    return r;
  };
  const death = CQ.onDeath;
  CQ.onDeath = () => {
    const c = CQ.combat, z = c.zone;
    if (c.mode === 'boss' && CQ.bossAutoOn(z)) {
      CQ.bossAuto()[z] = 'off';
      CQ.addLog('⛔ Défi automatique du boss coupé après la défaite.');
      CQ.toast('⛔ Défi auto du boss coupé : renforcez-vous, puis relancez-le.', 'red');
    }
    return death();
  };
})();
A.bossAuto = () => {
  const z = CQ.combat.zone, b = CQ.bossAuto();
  if (b[z] == null) { CQ.toast('Battez d’abord ce boss une fois à la main.', 'red'); return; }
  b[z] = b[z] === 'on' ? 'off' : 'on';
  CQ.save(); CQ.refresh();
};

// ---------- Écran de combat ----------
CQ.ZONE_IMG = []; // zones qui ont leur décor peint (index de CQ.ZONES)
(() => {
  const render = P.combat.render;
  // route qui défile sous les combattants
  P.combat.render = () => `${render().replace('<div class="arena-mode" id="arenaMode"></div>', '<div class="road" aria-hidden="true"></div><div class="boss-prog" id="bossProg"></div><div class="arena-mode" id="arenaMode"></div>')}<button class="fight-fab" id="fightFab" data-act="toggleAuto"></button>`;
  // l'ennemi qui apparaît arrive du bout de la route
  const mon = P.combat.monster;
  P.combat.monster = () => { mon(); if (CQ.combat.m) CQ.ui.spawnT = Date.now(); };
  const ch = P.combat.challenges;
  P.combat.challenges = () => {
    ch();
    const el = CQ.$('#challenges .challenge .ch');
    if (!el) return;
    const z = CQ.combat.zone, st = CQ.bossAuto()[z];
    el.insertAdjacentHTML('afterend', `<label class="boss-auto ${st == null ? 'off' : ''}" title="${st == null ? 'Disponible après une première victoire contre ce boss' : ''}">
      <input type="checkbox" data-act="bossAuto" ${st === 'on' ? 'checked' : ''} ${st == null ? 'disabled' : ''}>
      🔁 Défier le boss automatiquement à ${CQ.BOSS_KILLS} victoires${st == null ? ' <span class="dim">(après une première victoire)</span>' : st === 'off' ? ' <span class="dim">(coupé)</span>' : ''}</label>`);
  };
  const tick = P.combat.tick;
  P.combat.tick = () => {
    tick(); CQ.fabSync();
    // le héros marche entre deux combats et pendant l'arrivée de l'ennemi (pur visuel : le moteur ne change pas)
    const ar = document.getElementById('arena'), c = CQ.combat;
    // décor peint de la zone, quand l'illustration existe (img/zones/zN.webp)
    if (ar && ar._z !== c.zone) { ar._z = c.zone; const img = CQ.ZONE_IMG.includes(c.zone); ar.classList.toggle('has-img', img); if (img) ar.style.setProperty('--zimg', `url(img/zones/z${c.zone}.webp)`); }
    CQ.bossProgSync();
    if (ar) ar.classList.toggle('walking', !!CQ.state.auto && !c.deadUntil && !CQ.isResting() && (!c.m || Date.now() - (CQ.ui.spawnT || 0) < 700));
  };
})();
CQ.fabSync = () => {
  const f = document.getElementById('fightFab');
  if (!f) return;
  const on = !!CQ.state.auto, k = on ? 'on' : 'off';
  if (f._k === k) return;
  f._k = k;
  f.classList.toggle('on', on);
  f.innerHTML = on ? '<span class="ff-ico">⏸</span><span class="ff-l">Pause</span>' : '<span class="ff-ico">⚔️</span><span class="ff-l">Combattre</span>';
};

// ---------- Barre de progression vers le boss ----------
CQ.bossProgSync = () => {
  const el = document.getElementById('bossProg');
  if (!el) return;
  const c = CQ.combat, z = CQ.ZONES[c.zone], k = CQ.state.zoneKills[c.zone], n = CQ.BOSS_KILLS;
  const html = c.mode === 'boss' ? `<span class="bp-boss on">${z.boss[1]}</span><b>${CQ.esc(z.boss[0])}</b>`
    : c.mode !== 'farm' ? '' : `<span class="bp-boss ${k >= n ? 'on' : ''}">${z.boss[1]}</span><div class="bp-bar"><i style="width:${(100 * k / n).toFixed(0)}%"></i></div><b>${k}/${n}</b>${CQ.bossAutoOn(c.zone) ? '<span title="Défi automatique">🔁</span>' : ''}`;
  if (el._h !== html) { el._h = html; el.innerHTML = html; el.hidden = !html; }
};

// ---------- Impacts : éclat au coup, flash au critique, secousse contre un boss ----------
CQ.on((type, d) => {
  if (CQ.ui.page !== 'combat' || document.body.classList.contains('reduce')) return;
  const ar = document.getElementById('arena');
  if (!ar) return;
  const fx = (sel, cls, ms) => { const t = CQ.$(sel); if (!t) return; const sp = document.createElement('span'); sp.className = cls; t.appendChild(sp); setTimeout(() => sp.remove(), ms); };
  if (type === 'pHit' && !d.miss) {
    fx('#fM', 'spark' + (d.crit ? ' crit' : ''), 400);
    if (d.crit) { ar.classList.remove('flash'); void ar.offsetWidth; ar.classList.add('flash'); }
  } else if (type === 'mHit' && !d.dodge) {
    fx('#fP', 'spark hurt', 400);
    if (CQ.combat.m && CQ.isBoss(CQ.combat.m)) { ar.classList.remove('shake'); void ar.offsetWidth; ar.classList.add('shake'); }
  }
});
