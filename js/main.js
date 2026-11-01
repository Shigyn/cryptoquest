'use strict';
// Démarrage et boucles de jeu.
(() => {
  CQ.state = CQ.load();
  const s = CQ.state;
  CQ.combat.zone = s.zone;
  CQ.combat.session = CQ.newSession();
  CQ.poolCycle();
  CQ.slowTick(); // clôtures de pool / classements survenues pendant l'absence
  CQ.aucTick(); CQ.marketTick(); CQ.arenaTick(); // enchères, ventes et défenses survenues pendant l'absence

  // premier lancement : un premier objet pour démarrer
  if (!s.inventory.length && s.stats.kills === 0) {
    const w = CQ.addItem(CQ.makeItem('weapon', 1, 1));
    CQ.equip(w.id);
    CQ.logTx('cq', 300, 'Bienvenue dans CryptoQuest');
    CQ.logTx('fp', 40, 'Bienvenue dans CryptoQuest');
  }

  CQ.seedSeen(); CQ.device();
  const off = CQ.offlineGains();
  s.auto = false; // le combat ne repart pas tout seul : le joueur clique « Commencer à combattre »
  CQ.$('#adSlot').innerHTML = CQ.adBanner('Bannière 220×120');
  window.addEventListener('hashchange', CQ.route);
  CQ.applySettings();
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', CQ.applySettings);
  CQ.route();
  CQ.registerSW();
  CQ.cloudInit(); // compte en ligne, si js/cloud-config.js est rempli

  if (s.migratedV5 && !s.migratedV2) {
    delete s.migratedV5;
    CQ.openModal(`<h2>Mise à jour : statistiques en points</h2>
      <div class="muted">Toucher, Esquive, Critique, Vitesse et Pénétration se donnent désormais en <b>points</b>, convertis en % selon le niveau de l’adversaire : points ÷ (niveau + 10). Un bon objet reste utile bien plus longtemps, et les plafonds ne sont plus atteints par simple accumulation. Vos objets ont été convertis sans perte.</div>
      <div class="kv mt"><span>Nouvelles stats</span><span>Parade (bloque la moitié d’un coup) · Résilience (contre les critiques)</span>
      <span>Objets Mythiques</span><span>un affixe unique chacun</span>
      <span>Attributs</span><span>plafond de ${CQ.attrCap(s.level)} points par attribut · entraînement en CQ</span></div>
      <div class="actions"><button class="btn ghost" data-act="closeModal">Fermer</button><button class="btn primary" data-act="goClose" data-arg="hero">Voir mon héros</button></div>`);
  } else if (s.migratedV2) {
    delete s.migratedV5;
    delete s.migratedV2;
    const ap = CQ.attrPoints().free, tp = CQ.talentPoints().free;
    CQ.openModal(`<h2>CryptoQuest passe en V2</h2>
      <div class="muted">Le combat consomme désormais de l’énergie : 1 énergie par attaque, ${CQ.ENERGY.regen} rendues par heure, même hors ligne. Votre réserve est pleine.</div>
      <div class="kv mt"><span>Points d’attribut à répartir</span><span><b class="c-cq">${ap}</b></span><span>Points de talent</span><span><b class="c-cq">${tp}</b></span>
      <span>Nouvel emplacement</span><span>📿 Amulette (énergie)</span><span>Nouvelles stats</span><span>Toucher, Esquive, Critique, Vitesse…</span></div>
      <div class="actions"><button class="btn ghost" data-act="closeModal">Plus tard</button><button class="btn primary" data-act="goClose" data-arg="hero">Répartir mes points</button></div>`);
  } else if (off) {
    const tail = off.kills ? '' : '<div class="small dim mt">Pas assez d’énergie pour terminer un combat.</div>';
    CQ.openModal(`<h2>Pendant votre absence</h2>
      <div class="muted">Votre héros a combattu pendant votre absence (${CQ.fmtDur(off.away)}), à ${Math.round(off.eff * 100)} % de son rendement, tant qu’il avait de l’énergie.</div>
      <div class="kv mt"><span>Énergie dépensée</span><span class="c-en">${CQ.fmt(off.attacks)}</span><span>Victoires</span><span>${CQ.fmt(off.kills)}</span><span>Expérience</span><span>+${CQ.fmt(off.xp)} XP${off.levels ? ` · +${off.levels} niveau${off.levels > 1 ? 'x' : ''}` : ''}</span>
      <span>CQ</span><span class="c-cq">+${CQ.fmt(off.cq)}</span><span>Farm Points</span><span class="c-fp">+${CQ.fmt(off.fp)}</span>
      <span>Énergie restante</span><span>${CQ.fmt(Math.floor(CQ.energyNow()))} / ${CQ.fmt(CQ.playerStats().emax)}</span></div>${tail}
      <div class="actions"><button class="btn primary" data-act="closeModal">Reprendre l'aventure</button></div>`);
  } else if (CQ.loginAvailable()) {
    CQ.toast('📅 Votre bonus de connexion vous attend sur l’accueil.', 'r4');
  }
  CQ.save();
  if (CQ.tutoActive()) CQ.tutoGo(CQ.settings().tutorial.step); // nouvelle partie : tutoriel guidé

  // boucle rapide : combat (100 ms) et affichage (250 ms)
  let last = performance.now(), uiAcc = 0, slowAcc = 0, saveAcc = 0, flushAcc = 0;
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min(5000, now - last);
    last = now;
    CQ.updateCombat(dt);
    uiAcc += dt; slowAcc += dt; saveAcc += dt; flushAcc += dt;
    if (uiAcc >= 250) {
      uiAcc = 0;
      const p = CQ.PAGES[CQ.ui.page];
      if (p && p.tick) p.tick();
      CQ.renderWallet();
    }
    if (slowAcc >= 1000) {
      slowAcc = 0;
      CQ.slowTick();
      CQ.aucTick(); CQ.marketTick(); CQ.arenaTick();
      CQ.watchTick(); CQ.legionTick(); CQ.legionWatchTick(); CQ.guildTick();
      CQ.renderNav();
    }
    if (flushAcc >= 60000) { flushAcc = 0; CQ.flushTx(); }
    if (saveAcc >= 10000) { saveAcc = 0; CQ.save(); }
  }, 100);

  window.addEventListener('beforeunload', () => { CQ.flushTx(); CQ.save(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { CQ.flushTx(); CQ.save(); } });
})();
