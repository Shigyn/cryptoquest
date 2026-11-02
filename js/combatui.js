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
(() => {
  const render = P.combat.render;
  P.combat.render = () => `${render()}<button class="fight-fab" id="fightFab" data-act="toggleAuto"></button>`;
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
  P.combat.tick = () => { tick(); CQ.fabSync(); };
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
