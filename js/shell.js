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

// ---------- Écran de chargement ----------
window.addEventListener('load', () => {
  const sp = document.getElementById('splash');
  if (sp) setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 600); }, 500);
  // récompense du jour : le calendrier s'ouvre tout seul une fois par jour, comme dans les jeux mobiles
  setTimeout(() => {
    if (CQ.loginAvailable() && !(CQ.tutoActive && CQ.tutoActive()) && !document.getElementById('modalRoot').classList.contains('on')) A.claimLogin();
  }, 1600);
});

// ---------- Calendrier de connexion (7 jours) ----------
(() => {
  const claim = A.claimLogin;
  A.claimLogin = () => {
    if (!CQ.loginAvailable()) return;
    const next = CQ.loginNextStreak(), start = Math.floor((next - 1) / 7) * 7 + 1;
    const days = Array.from({ length: 7 }, (_, i) => start + i);
    CQ.openModal(`<div class="cal"><div class="kicker">Récompense de connexion</div><h2>Jour ${next}</h2>
      <div class="cal-grid">${days.map((d) => {
        const r = CQ.loginReward(d), st = d < next ? 'done' : d === next ? 'today' : '';
        return `<div class="cal-day ${st} ${d % 7 === 0 ? 'big' : ''}"><div class="cd-n">Jour ${d}</div><div class="cd-ico">${d % 7 === 0 ? '🎁' : '💰'}</div>
          <div class="cd-r">${CQ.fmt(r.cq)} CQ<br>${r.fp} FP</div>${st === 'done' ? '<div class="cd-ok">✓</div>' : ''}</div>`;
      }).join('')}</div>
      <div class="small muted mt">Revenez chaque jour : la récompense grandit avec la série. Une journée manquée remet la série à 1.</div>
      <div class="actions"><button class="btn gold block" data-act="claimLoginNow">Récupérer</button></div></div>`);
  };
  A.claimLoginNow = () => { CQ.closeModal(); claim(); CQ.sfx && CQ.sfx('loot'); };
})();

// ---------- Coffres : tout ouvrir d'un coup ----------
A.openAllChests = (k) => {
  const c = CQ.CHESTS[k], items = [];
  let cq = 0, energy = 0, stones = 0, n = 0;
  while (CQ.state.chests[k] > 0 && n < 200) {
    const res = CQ.openChest(k);
    if (!res) break;
    n++; items.push(...res.items); cq += res.cq; energy += res.energy || 0; stones += res.stones || 0;
  }
  if (!n) return;
  CQ.save();
  items.sort((a, b) => b.rarity - a.rarity);
  CQ.openModal(`<h2>${c.icon} ${n} × ${c.name}</h2>
    <div class="kv"><span>CQ</span><span class="c-cq">+${CQ.fmt(cq)}</span>${energy ? `<span>Énergie</span><span class="c-en">+${CQ.fmt(energy)}</span>` : ''}${stones ? `<span>Pierres de protection</span><span>💠 +${stones}</span>` : ''}<span>Objets</span><span>${items.length}</span></div>
    <div class="items mt">${items.map((it) => CQ.itemTile(it)).join('')}</div>
    <div class="actions"><button class="btn primary" data-act="closeModal">Continuer</button></div>`, { wide: true, onClose: () => CQ.refresh() });
};

// ---------- Messages regroupés : inventaire plein ----------
// Un seul message qui compte les objets revendus, au lieu d'un message par objet.
(() => {
  const toast = CQ.toast;
  let agg = null;
  CQ.toast = (html, kind) => {
    const m = /^Inventaire plein : .* revendu (\d+) CQ\.$/.exec(String(html));
    if (!m) return toast(html, kind);
    if (agg && agg.el.isConnected && Date.now() - agg.t < 3000) {
      agg.n++; agg.cq += Number(m[1]); agg.t = Date.now();
      agg.el.innerHTML = `🎒 Inventaire plein : ${agg.n} objets revendus (+${CQ.fmt(agg.cq)} CQ). Faites de la place à la forge.`;
      return;
    }
    toast(`🎒 Inventaire plein : 1 objet revendu (+${CQ.fmt(Number(m[1]))} CQ). Faites de la place à la forge.`, 'red');
    const box = document.getElementById('toasts');
    agg = { el: box && box.lastElementChild, n: 1, cq: Number(m[1]), t: Date.now() };
  };
})();

// le calendrier de connexion attend qu'une autre fenêtre (rapport d'absence, mise à jour…) soit fermée
(() => {
  const close = CQ.closeModal;
  CQ.closeModal = (...a) => {
    const r = close(...a);
    if (CQ._calWait && CQ.loginAvailable()) { CQ._calWait = false; setTimeout(() => { if (!document.getElementById('modalRoot').classList.contains('on')) A.claimLogin(); }, 350); }
    return r;
  };
})();
window.addEventListener('load', () => setTimeout(() => { if (CQ.loginAvailable() && document.getElementById('modalRoot').classList.contains('on')) CQ._calWait = true; }, 1700));
