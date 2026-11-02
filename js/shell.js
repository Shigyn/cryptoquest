'use strict';
// Interface 100 % mobile : plus de menu latéral. La ville sert de menu, la barre du bas (toutes tailles d'écran)
// porte les écrans principaux avec Combat au centre, et « Plus » ouvre une feuille de médaillons avec tout le reste.

CQ.navMode = () => 'ville';
CQ.BOTTOM_SHELL = [['town', '🏰', 'Ville'], ['hero', '🧝', 'Héros'], ['combat', '⚔️', 'Combat', 'big'], ['inventory', '🎒', 'Inventaire'], ['more', '✨', 'Plus']];
CQ.inBottom = (id) => CQ.BOTTOM_SHELL.some(([b]) => b === id);

(() => {
  const rn = CQ.renderNav;
  CQ.renderNav = () => {
    rn();
    const b = CQ.badges(), page = CQ.ui.page;
    // « Plus » s'allume quand un écran rangé dedans a quelque chose à récupérer
    const moreDot = CQ.NAV.some(([, items]) => items.some(([id]) => !CQ.inBottom(id) && b[id] && CQ.unlocked(id)));
    CQ.setHtml1('#bottomnav', CQ.BOTTOM_SHELL.map(([id, ic, label, big]) => {
      const on = id === 'more' ? !!document.getElementById('moreSheet') : page === id || (id === 'hero' && (page === 'equipment')) || (id === 'inventory' && page === 'forge');
      const dot = id === 'more' ? moreDot : b[id];
      const attrs = id === 'more' ? 'data-act="moreOpen" role="button"' : `href="#${id}"`;
      return `<a ${attrs} class="bn ${big ? 'big' : ''} ${on ? 'active' : ''}"><span class="ni">${ic}${dot ? '<i class="bn-dot"></i>' : ''}</span><span class="bl">${label}</span></a>`;
    }).join(''));
  };
})();

// ---------- Feuille « Plus » ----------
CQ.MORE_GROUPS = [
  ['Aventure', ['quests', 'chests', 'forge', 'equipment', 'season', 'abyss']],
  ['Joueurs', ['guild', 'arena', 'team', 'auction', 'market', 'mail', 'leaderboard']],
  ['Richesses', ['faucet', 'shop', 'staking', 'pool', 'premium']],
  ['Compte', ['dashboard', 'profile', 'history', 'settings']],
];
A.moreOpen = () => {
  const old = document.getElementById('moreSheet');
  if (old) { A.moreClose(); return; }
  const b = CQ.badges(), lab = (id) => { const f = CQ.NAV.flatMap(([, it]) => it).find(([x]) => x === id); return id === 'staking' ? ['🏦', 'Banque'] : f ? [f[1], f[2]] : ['•', id]; };
  const el = document.createElement('div');
  el.id = 'moreSheet'; el.className = 'more-sheet';
  el.innerHTML = `<div class="ms-bg" data-act="moreClose"></div><div class="ms-panel" role="dialog" aria-label="Tous les écrans"><div class="ms-grip"></div>
    ${CQ.MORE_GROUPS.map(([g, ids]) => `<div class="ms-group">${g}</div><div class="ms-grid">${ids.map((id) => {
      const [ic, l] = lab(id), ok = CQ.unlocked(id), lvl = CQ.UNLOCKS[id] && CQ.UNLOCKS[id].lvl;
      return ok ? `<a class="dk" href="#${id}" data-act="moreClose"><span class="dk-ico">${ic}${b[id] ? '<i class="dk-dot"></i>' : ''}</span><span class="dk-l">${l}</span></a>`
        : `<span class="dk locked" title="Niveau ${lvl}"><span class="dk-ico">🔒</span><span class="dk-l">${l}<small>niv. ${lvl}</small></span></span>`;
    }).join('')}</div>`).join('')}</div>`;
  document.body.appendChild(el);
  CQ.renderNav();
};
// le lien suit son cours (navigation) ; on ne fait que fermer la feuille
A.moreClose = (arg, el, e) => {
  const s = document.getElementById('moreSheet');
  if (s) { s.classList.add('out'); setTimeout(() => { s.remove(); CQ.renderNav(); }, 180); }
  if (el && el.getAttribute('href')) location.hash = el.getAttribute('href').slice(1);
};
CQ.A.bookOpen = A.moreOpen; // le livre de bord ouvre la même feuille
window.addEventListener('hashchange', () => { const s = document.getElementById('moreSheet'); if (s) s.remove(); });

// ---------- « Tout récupérer » ----------
// Récupère d'un coup tout ce qui est prêt : quêtes du jour et leur bonus, quêtes secondaires, Panthéon,
// succès et paliers du passe de saison. Chaque récompense passe par sa fonction habituelle.
CQ.claimAll = () => {
  let n = 0;
  for (const q of CQ.QUESTS) if (CQ.questClaimable(q) && CQ.claimQuest(q.id)) n++;
  if (CQ.claimQuestBonus()) n++;
  for (const m of CQ.MISSIONS) if (CQ.missionReady(m) && CQ.claimMission(m.id)) n++;
  if (CQ.state.level >= CQ.FEATURE_LVL.pantheon && CQ.state.pantheon) CQ.state.pantheon.slots.forEach((q, i) => { if (CQ.pqClaim(i)) n++; });
  for (const a of CQ.ACHIEVEMENTS) if (CQ.achClaimable(a) && CQ.claimAch(a.id)) n++;
  if (CQ.seasonLvl) for (let l = 1; l <= CQ.seasonLvl(); l++) { if (CQ.passClaim(l, false)) n++; if (CQ.passClaim(l, true)) n++; }
  return n;
};
CQ.claimAllReady = () => CQ.badges().quests || CQ.badges().season;
A.claimAll = () => {
  const n = CQ.claimAll();
  if (!n) { CQ.toast('Rien à récupérer pour le moment.', ''); return; }
  CQ.sfx('loot');
  CQ.toast(`🎁 ${n} récompense${n > 1 ? 's' : ''} récupérée${n > 1 ? 's' : ''} !`, 'r4');
  CQ.save(); CQ.refresh();
};
(() => {
  const qr = P.quests.render;
  P.quests.render = () => (CQ.claimAllReady() ? `<button class="btn gold block claim-all" data-act="claimAll">🎁 Tout récupérer</button>` : '') + qr();
})();
