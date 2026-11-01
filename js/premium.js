'use strict';
// V3-4 — Abonnement Premium « Légion » (achat simulé).
// Principe : du confort, du temps et un bénéfice collectif. Jamais de FP en plus, jamais de puissance de combat,
// aucun avantage au Crypto Pool ni à l'arène (voir PLAN-V3 §6 et §8).

CQ.LEGION = {
  plans: [
    { id: 'm1', days: 30, eur: 4.99, label: '1 mois' },
    { id: 'm3', days: 91, eur: 12.99, label: '3 mois', tag: '−13 %' },
    { id: 'm12', days: 365, eur: 44.99, label: '12 mois', tag: '−25 %' },
  ],
  gemPlan: { days: 14, gems: 250, label: '14 jours' },
  regen: 15, // % de recharge d'énergie en plus
  overcap: 2.5, // surcharge maximale (au lieu de 2 ×)
  offline: 0.85, // rendement hors ligne (au lieu de 75 %)
  tickets: 12, inv: 20, mktMax: 15, mktTtl: 72 * 3600000, loadouts: 3,
  chest: { cons: { e3: 1, sDrop: 1, sXp: 1, sLuck: 1 }, chest: 'gold' }, // coffre mensuel
};
CQ.isPremium = () => !!(CQ.state && CQ.state.premium && CQ.state.premium.until > Date.now());

// ---------- Limites qui dépendent du statut (getters : le reste du code lit les mêmes constantes) ----------
(() => {
  const L = CQ.LEGION, P = () => CQ.isPremium();
  Object.defineProperty(CQ, 'INV_CAP', { configurable: true, get: () => 80 + (P() ? L.inv : 0) });
  Object.defineProperty(CQ.ARENA, 'tickets', { configurable: true, get: () => (P() ? L.tickets : 10) });
  Object.defineProperty(CQ.MKT, 'max', { configurable: true, get: () => (P() ? L.mktMax : 10) });
  Object.defineProperty(CQ.MKT, 'ttl', { configurable: true, get: () => (P() ? L.mktTtl : 48 * 3600000) });
  Object.defineProperty(CQ.ENERGY, 'overcap', { configurable: true, get: () => (P() ? L.overcap : 2) });
  Object.defineProperty(CQ.ENERGY, 'offline', { configurable: true, get: () => (P() ? L.offline : 0.75) });
  // frais de mise en vente offerts (la commission de 5 % reste)
  const fee = CQ.mktFee;
  CQ.mktFee = (price) => (P() ? 0 : fee(price));
  // recharge d'énergie +15 %
  const stats = CQ.playerStats;
  CQ.playerStats = () => {
    const st = stats();
    if (P()) {
      const v = Math.min(CQ.CAPS.eregen, st.eregen * (1 + L.regen / 100));
      st.parts.eregen.other += v - st.eregen;
      st.parts.eregen.total = v;
      st.eregen = v;
    }
    return st;
  };
  // pas de publicité
  const ad = CQ.adBanner;
  CQ.adBanner = (f) => (P() ? '' : ad(f));
  // récompenses doublées sans vidéo : la « vidéo » est validée tout de suite
  const watch = CQ.watch;
  CQ.watch = (opts, done) => (P() && opts.reward ? done() : watch(opts, done));
  // une réinitialisation d'attributs offerte par mois
  const rc = CQ.attrRespecCost;
  CQ.legionFreeRespec = () => P() && CQ.state.premium.respecMonth !== CQ.monthKey();
  CQ.attrRespecCost = (n) => (CQ.legionFreeRespec() ? 0 : rc(n));
  const ra = CQ.respecAttrs;
  CQ.respecAttrs = () => { const free = CQ.legionFreeRespec(); const ok = ra(); if (ok && free) CQ.state.premium.respecMonth = CQ.monthKey(); return ok; };
  // revente automatique des objets Communs trouvés en combat (réglable)
  const add = CQ.addItem;
  CQ.addItem = (it, source) => {
    if (P() && CQ.state.premium.autoSell && source === 'drop' && it.rarity === 0) { CQ.gain('cq', CQ.sellValue(it), '', true); return null; }
    return add(it, source);
  };
})();

// ---------- Abonnement ----------
CQ.legionExtend = (days, why) => {
  const p = CQ.state.premium, now = Date.now(), was = CQ.isPremium();
  p.until = Math.max(now, p.until || 0) + days * 86400000;
  if (!p.since) p.since = now;
  if (!was) p.chestAt = 0; // coffre de bienvenue tout de suite
  CQ.legionTick();
  CQ.$('#adSlot').innerHTML = CQ.adBanner('Bannière 220×120');
  p.log = (p.log || []).concat([{ t: now, why }]).slice(-20);
};
CQ.buyLegion = (id) => {
  const plan = CQ.LEGION.plans.find((x) => x.id === id);
  CQ.state.premium.total = (CQ.state.premium.total || 0) + plan.eur;
  CQ.poolCycle().extra += plan.eur * 1.08; // l'abonnement compte dans les revenus du jour (70 % au pool)
  CQ.legionExtend(plan.days, `Légion ${plan.label} (achat simulé ${plan.eur.toFixed(2).replace('.', ',')} €)`);
};
CQ.buyLegionGems = () => {
  const g = CQ.LEGION.gemPlan;
  if (!CQ.pay({ gems: g.gems }, `Légion ${g.label} en diamants`)) return false;
  CQ.legionExtend(g.days, `Légion ${g.label}`);
  return true;
};
// coffre Légion : à l'activation puis tous les 30 jours d'abonnement actif
CQ.legionTick = () => {
  const p = CQ.state.premium;
  if (!CQ.isPremium() || Date.now() < (p.chestAt || 0)) return;
  p.chestAt = Date.now() + 30 * 86400000;
  CQ.mailAdd('Coffre Légion du mois', JSON.parse(JSON.stringify(CQ.LEGION.chest)), 'Légion');
  CQ.toast('🦅 Coffre Légion disponible dans la boîte aux lettres.', 'r4');
};

// ---------- Jeux d'équipement mémorisés ----------
CQ.loadoutSave = (i) => {
  const s = CQ.state;
  s.loadouts[i] = { name: `Jeu ${i + 1}`, items: Object.assign({}, s.equipped), at: Date.now() };
};
CQ.loadoutApply = (i) => {
  const s = CQ.state, lo = s.loadouts[i];
  if (!lo) return 0;
  let n = 0;
  for (const [slot, id] of Object.entries(lo.items)) {
    const it = id && CQ.itemById(id);
    if (it && CQ.canWear(it) && s.equipped[slot] !== id) { CQ.equip(id); n++; }
  }
  return n;
};

// ---------- Suivi d'enchères ----------
CQ.aucWatched = (id) => !!CQ.state.premium.watch[id];
CQ.watchBtn = (lot) => (lot.done ? '' : `<button class="btn sm ghost star ${CQ.aucWatched(lot.id) ? 'on' : ''}" data-act="aucWatch" data-arg="${lot.id}"
  title="${CQ.isPremium() ? 'Suivre ce lot : alerte 5 minutes avant la fin' : 'Liste de suivi : avantage Légion'}" aria-label="Suivre ce lot">${CQ.aucWatched(lot.id) ? '★' : '☆'}</button>`);
CQ.legionWatchTick = () => {
  if (!CQ.isPremium()) return;
  const w = CQ.state.premium.watch;
  for (const l of CQ.state.auction.lots) {
    if (!w[l.id]) continue;
    if (l.done) { delete w[l.id]; continue; }
    if (w[l.id] === 1 && l.end - Date.now() < 5 * 60000) {
      w[l.id] = 2;
      const msg = `${CQ.aucName(l)} : ${l.top === 'me' ? 'vous menez' : `enchère à ${CQ.fmt(l.bid || l.start)} FP`}.`;
      CQ.toast(`⭐ Fin dans 5 min · ${CQ.esc(msg)}`, 'r4');
      CQ.notify('⭐ Lot suivi : fin dans 5 min', msg, 'watch' + l.id);
    }
  }
};

/* =========================================================
   Page : Légion
   ========================================================= */
P.premium = {
  title: 'Légion',
  render() {
    const s = S(), p = s.premium, on = CQ.isPremium(), L = CQ.LEGION;
    const rows = [
      ['Publicités', 'Bannières', '<b>Aucune</b>'],
      ['Doubler une récompense (faucet, Second souffle)', 'Regarder une vidéo', '<b>Immédiat, sans vidéo</b>'],
      ['Recharge d’énergie', '100 %', `<b>+${L.regen} %</b>`],
      ['Surcharge d’énergie', '2 ×', `<b>${String(L.overcap).replace('.', ',')} ×</b>`],
      ['Rendement hors ligne', '75 %', `<b>${L.offline * 100} %</b>`],
      ['Billets d’arène', '10', `<b>${L.tickets}</b>`],
      ['Ventes au marché', '10, 48 h, frais 2 %', `<b>${L.mktMax}, 72 h, frais offerts</b>`],
      ['Sac', '80 places', `<b>${80 + L.inv} places</b>`],
      ['Jeux d’équipement mémorisés', '—', `<b>${L.loadouts}</b>`],
      ['Liste de suivi aux enchères', '—', '<b>Alerte 5 min avant la fin</b>'],
      ['Revente automatique des Communs', '—', '<b>Au choix</b>'],
      ['Réinitialisation d’attributs', 'Payante', '<b>Une offerte par mois</b>'],
      ['Coffre Légion', '—', '<b>Chaque mois</b> : coffre d’Or, élixir, 3 parchemins'],
      ['Titre, cadre et aura du héros', '—', '<b>« Légionnaire »</b>'],
      ['Guilde', '—', '<b>−2 % sur les bâtiments par Légionnaire, jusqu’à −20 %</b> (avec les guildes)'],
    ];
    return `<div class="legion-hero ${on ? 'on' : ''}">
        <div class="legion-crest">🦅</div>
        <div><div class="kicker">Abonnement</div><h2>Légion</h2>
          ${on ? `<div class="chip gold">Actif jusqu’au ${new Date(p.until).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · encore ${CQ.fmtDur(p.until - Date.now())}</div>`
            : '<div class="muted">Le confort sans publicité, pour vous et pour votre future guilde.</div>'}</div>
      </div>
      <div class="grid g4 mt">${L.plans.map((pl) => `<div class="card pack ${pl.tag ? 'glow' : ''}">${pl.tag ? `<span class="chip red ribbon">${pl.tag}</span>` : ''}
        <div class="pa">${pl.label}</div><div class="big c-cq" style="font-size:24px">${pl.eur.toFixed(2).replace('.', ',')} €</div>
        <div class="small muted">${(pl.eur / (pl.days / 30.4)).toFixed(2).replace('.', ',')} € par mois</div>
        <button class="btn primary block mt" data-act="buyLegion" data-arg="${pl.id}">${on ? 'Prolonger' : 'S’abonner'} (simulation)</button></div>`).join('')}
        <div class="card pack"><div class="pa">${L.gemPlan.label}</div><div class="big c-gem" style="font-size:24px">${L.gemPlan.gems} 💎</div>
        <div class="small muted">Pour essayer, sans abonnement</div>
        <button class="btn gem block mt" data-act="buyLegionGems" ${s.gems >= L.gemPlan.gems ? '' : 'disabled'}>${on ? 'Prolonger' : 'Activer'}</button></div>
      </div>
      <div class="card mt"><h3>Ce que comprend la Légion</h3><div class="tbl-wrap"><table class="tbl legion-tbl">
        <tr><th>Avantage</th><th>Sans Légion</th><th>Avec Légion</th></tr>
        ${rows.map(([a, b, c]) => `<tr><td>${a}</td><td class="dim">${b}</td><td>${c}</td></tr>`).join('')}
      </table></div></div>
      ${on ? `<div class="card mt"><h3>Réglages Légion</h3>
        <div class="set-row"><span>Revendre automatiquement les objets Communs trouvés en combat</span><button class="btn sm ${p.autoSell ? 'gold' : ''}" data-act="legionAutoSell">${p.autoSell ? 'Activée' : 'Désactivée'}</button></div>
        <div class="set-row"><span>Réinitialisation d’attributs offerte ce mois-ci</span><span class="${CQ.legionFreeRespec() ? 'c-green' : 'dim'}">${CQ.legionFreeRespec() ? 'disponible' : 'déjà utilisée'}</span></div>
        <div class="set-row"><span>Prochain coffre Légion</span><span>${CQ.fmtDate(p.chestAt)}</span></div></div>` : ''}
      <div class="note mt"><b>Ce que la Légion ne donne pas</b> : ni FP, ni Farm Power, ni statistiques de combat, ni avantage au Crypto Pool ou à l’arène. Les abonnements comptent dans les revenus du jour : 70 % reviennent au pool, au profit de tous les participants.</div>
      <div class="note mt"><b>Prototype : aucun paiement réel.</b> À la mise en ligne : résiliation en trois clics, rappel avant chaque renouvellement annuel, conditions affichées avant paiement.</div>`;
  },
};
A.buyLegion = (id) => {
  const pl = CQ.LEGION.plans.find((x) => x.id === id);
  CQ.confirm('Abonnement simulé', `Légion pour <b>${pl.label}</b> (${pl.eur.toFixed(2).replace('.', ',')} €). <b>Aucun paiement n’est effectué</b> dans ce prototype.`, 'Confirmer (simulation)', () => {
    CQ.buyLegion(id); CQ.sfx('win'); CQ.toast('🦅 Bienvenue dans la Légion !', 'r4'); CQ.save(); CQ.refresh();
  });
};
A.buyLegionGems = () => CQ.confirm('Légion 14 jours ?', `${CQ.LEGION.gemPlan.gems} diamants pour 14 jours de Légion.`, 'Activer', () => {
  if (CQ.buyLegionGems()) { CQ.sfx('win'); CQ.toast('🦅 Légion activée pour 14 jours.', 'r4'); CQ.save(); CQ.refresh(); }
});
A.legionAutoSell = () => { const p = S().premium; p.autoSell = !p.autoSell; CQ.save(); CQ.refresh(); };
A.aucWatch = (id) => {
  if (!CQ.isPremium()) { CQ.toast('La liste de suivi fait partie de la Légion.', 'red'); return; }
  const w = S().premium.watch;
  if (w[id]) delete w[id]; else w[id] = 1;
  CQ.save(); CQ.refresh();
};
A.loadoutSave = (i) => { if (!CQ.isPremium()) return; CQ.loadoutSave(Number(i)); CQ.toast('Jeu d’équipement enregistré.', 'green'); CQ.save(); CQ.refresh(); };
A.loadoutApply = (i) => { const n = CQ.loadoutApply(Number(i)); CQ.toast(n ? `${n} emplacement${n > 1 ? 's' : ''} changé${n > 1 ? 's' : ''}.` : 'Déjà équipé (ou objets introuvables).', n ? 'green' : ''); CQ.save(); CQ.refresh(); };

// jeux d'équipement : carte ajoutée sous la page Équipement
(() => {
  const r = P.equipment.render;
  P.equipment.render = () => {
    const s = S(), on = CQ.isPremium();
    const slots = Array.from({ length: CQ.LEGION.loadouts }, (_, i) => {
      const lo = s.loadouts[i];
      return `<div class="loadout"><b>${lo ? lo.name : `Jeu ${i + 1}`}</b><span class="small muted">${lo ? `${Object.values(lo.items).filter(Boolean).length} objets · ${CQ.fmtDate(lo.at)}` : 'vide'}</span>
        <div class="row" style="gap:6px"><button class="btn sm" data-act="loadoutSave" data-arg="${i}" ${on ? '' : 'disabled'}>Enregistrer l’actuel</button>
        <button class="btn sm gold" data-act="loadoutApply" data-arg="${i}" ${on && lo ? '' : 'disabled'}>Équiper</button></div></div>`;
    }).join('');
    return r() + `<div class="card mt"><h3>🦅 Jeux d’équipement<span class="right">${on ? 'Légion' : '<a href="#premium">avantage Légion</a>'}</span></h3><div class="loadouts">${slots}</div>
      <div class="note mt">Un jeu pour le farm, un pour l’arène, un pour les boss : on change en un clic.</div></div>`;
  };
})();
// titre et aura du héros
CQ.heroName = (name) => `${CQ.esc(name)}${CQ.isPremium() ? ' <span class="legion-title">Légionnaire</span>' : ''}`;
