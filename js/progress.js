'use strict';
// Progression du joueur : contenu débloqué au fil des niveaux, quêtes secondaires (missions uniques),
// et appareil reconnu sans compte (la connexion reste conseillée pour ne pas perdre sa partie).

// ---------- Déblocages par niveau ----------
// page → niveau requis et ce qu'elle apporte (affiché tant qu'elle est verrouillée)
CQ.UNLOCKS = {
  faucet: { lvl: 2, what: 'Des Farm Points gratuits toutes les 30 minutes.' },
  hero: { lvl: 2, what: 'Répartir vos points d’attribut, puis les talents au niveau 5.' },
  chests: { lvl: 3, what: 'Ouvrir et acheter des coffres d’équipement.' },
  season: { lvl: 3, what: 'Le passe de saison et ses récompenses.' },
  forge: { lvl: 4, what: 'Améliorer, fusionner, fondre et forger vos objets.' },
  pool: { lvl: 5, what: 'Le Crypto Pool : sacrifier des FP contre une part des revenus du jour.' },
  auction: { lvl: 6, what: 'L’hôtel des ventes : équipement de qualité supérieure et consommables.' },
  leaderboard: { lvl: 6, what: 'Les classements quotidien, hebdomadaire et mensuel.' },
  staking: { lvl: 8, what: 'Bloquer des FP pour un bonus de Farm Power et d’XP.' },
  market: { lvl: 8, what: 'Vendre et acheter de l’équipement entre joueurs.' },
  arena: { lvl: 10, what: 'Affronter les héros des autres joueurs.' },
  guild: { lvl: 10, what: 'Fonder ou rejoindre une guilde.' },
  team: { lvl: 40, what: 'L’arène d’équipe, avec vos mercenaires.' },
  abyss: { lvl: 100, what: 'Les Abysses, le défi de fin de jeu.' },
};
CQ.FEATURE_LVL = { dungeon: 8, pantheon: 6 }; // fonctions dans une page déjà ouverte
CQ.unlocked = (page) => !CQ.UNLOCKS[page] || CQ.state.level >= CQ.UNLOCKS[page].lvl;
CQ.navLabel = (id) => (CQ.NAV.flatMap(([, items]) => items).find((x) => x[0] === id) || [id, '', id]);
// page verrouillée : écran d'attente à la place du contenu
(() => {
  for (const [id, u] of Object.entries(CQ.UNLOCKS)) {
    const p = CQ.PAGES[id];
    if (!p) continue;
    const r = p.render, t = p.tick, m = p.mount;
    p.render = () => (CQ.unlocked(id) ? r.call(p) : `<div class="locked-page"><div class="lp-ico">${CQ.navLabel(id)[1]}</div><h2>${CQ.navLabel(id)[2]}</h2>
      <div class="chip red">🔒 Se débloque au niveau ${u.lvl}</div><p class="muted">${u.what}</p>
      ${CQ.bar(100 * CQ.state.level / u.lvl, 'gold')}<div class="small dim mt">Niveau ${CQ.state.level} / ${u.lvl}</div>
      <a class="btn primary mt" href="#combat">Gagner de l’expérience</a></div>`);
    if (t) p.tick = () => (CQ.unlocked(id) ? t.call(p) : null);
    if (m) p.mount = () => (CQ.unlocked(id) ? m.call(p) : null);
  }
  // navigation : cadenas et niveau requis sur les pages verrouillées, pastille « Nouveau » une fois débloquées
  const rn = CQ.renderNav;
  CQ.renderNav = () => {
    rn();
    const seen = CQ.state.seenUnlocks || (CQ.state.seenUnlocks = {});
    for (const a of document.querySelectorAll('#nav a[href^="#"]')) {
      const id = a.getAttribute('href').slice(1), u = CQ.UNLOCKS[id];
      if (!u) continue;
      if (!CQ.unlocked(id)) { a.classList.add('nav-locked'); if (!a.querySelector('.lockl')) a.insertAdjacentHTML('beforeend', `<span class="lockl">🔒 ${u.lvl}</span>`); }
      else if (!seen[id] && !a.querySelector('.newb')) a.insertAdjacentHTML('beforeend', '<span class="newb">Nouveau</span>');
    }
  };
  const route = CQ.route;
  CQ.route = () => { route(); const id = CQ.ui.page; if (CQ.UNLOCKS[id] && CQ.unlocked(id)) { const seen = CQ.state.seenUnlocks || (CQ.state.seenUnlocks = {}); if (!seen[id]) { seen[id] = 1; CQ.renderNav(); } } };
  // annonce des déblocages au passage de niveau
  const gx = CQ.gainXp;
  CQ.gainXp = (amt) => {
    const before = CQ.state.level;
    gx(amt);
    const now = CQ.state.level;
    if (now > before) for (const [id, u] of Object.entries(CQ.UNLOCKS)) if (u.lvl > before && u.lvl <= now) CQ.toast(`🔓 Nouveau : ${CQ.navLabel(id)[1]} ${CQ.navLabel(id)[2]} — ${u.what}`, 'r4');
  };
})();
// une partie déjà avancée a déjà vu tout ce qu'elle a débloqué
CQ.seedSeen = () => {
  const s = CQ.state;
  if (s.seenUnlocks) return;
  s.seenUnlocks = {};
  if (s.stats.kills > 0) for (const id of Object.keys(CQ.UNLOCKS)) if (CQ.unlocked(id)) s.seenUnlocks[id] = 1;
};

// ---------- Appareil ----------
// L'appareil est reconnu sans compte (nom modifiable), mais la partie n'existe que dans ce navigateur.
CQ.deviceName = () => {
  const ua = navigator.userAgent;
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
  const o = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : 'appareil';
  return `${b} · ${o}`;
};
CQ.device = () => {
  let d = null;
  try { d = JSON.parse(localStorage.getItem('cq_device')); } catch (e) { d = null; }
  if (!d) { d = { id: 'D' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: CQ.deviceName(), at: Date.now() }; try { localStorage.setItem('cq_device', JSON.stringify(d)); } catch (e) { /* stockage indisponible */ } }
  return d;
};
CQ.setDeviceName = (n) => { const d = CQ.device(); d.name = n.trim().slice(0, 30) || CQ.deviceName(); localStorage.setItem('cq_device', JSON.stringify(d)); };
CQ.accountSafe = () => !!(CQ.cloud && CQ.cloud.user);

// ---------- Quêtes secondaires : missions uniques ----------
CQ.MISSIONS = [
  { id: 'compte', icon: '🛡️', name: 'Sécuriser votre compte', desc: 'Connectez-vous (Profil → Compte en ligne) : votre partie est sauvegardée en ligne et vous la retrouvez sur tous vos appareils.', ok: () => CQ.accountSafe(), reward: { gems: 30, chest: 'gold' }, go: 'profile' },
  { id: 'combat', icon: '⚔️', name: 'Premier sang', desc: 'Lancez le combat et vainquez 10 monstres.', ok: (s) => s.stats.kills >= 10, reward: { cq: 300, energy: 100 }, go: 'combat' },
  { id: 'equipe', icon: '🛡️', name: 'Paré pour la guerre', desc: 'Portez un objet dans chacun des 7 emplacements.', ok: (s) => Object.values(s.equipped).every(Boolean), reward: { chest: 'silver' }, go: 'equipment' },
  { id: 'attributs', icon: '💪', name: 'Choisir sa voie', desc: 'Répartissez tous vos points d’attribut.', ok: (s) => s.level >= 2 && CQ.attrPoints().free === 0, reward: { cq: 1000 }, go: 'hero', lvl: 2 },
  { id: 'coffre', icon: '📦', name: 'Chasseur de trésors', desc: 'Ouvrez votre premier coffre.', ok: (s) => s.stats.chests >= 1, reward: { cq: 500 }, go: 'chests', lvl: 3 },
  { id: 'faucet', icon: '💧', name: 'Source de pouvoir', desc: 'Récupérez le faucet.', ok: (s) => s.stats.faucet >= 1, reward: { fp: 10 }, go: 'faucet', lvl: 2 },
  { id: 'talent', icon: '🌳', name: 'Premier talent', desc: 'Apprenez un talent.', ok: () => CQ.talentPoints().spent >= 1, reward: { cons: { sXp: 1 } }, go: 'hero', lvl: 5 },
  { id: 'forge3', icon: '🔨', name: 'Main de forgeron', desc: 'Améliorez un objet jusqu’à +3.', ok: (s) => s.stats.bestPlus >= 3, reward: { cq: 1500 }, go: 'forge', lvl: 4 },
  { id: 'fonte', icon: '🔥', name: 'Rien ne se perd', desc: 'Fondez 10 objets à la Forge.', ok: (s) => (s.stats.smelted || 0) >= 10, reward: { cons: { sDrop: 1 } }, go: 'forge', lvl: 4 },
  { id: 'pool', icon: '🔥', name: 'Premier sacrifice', desc: 'Sacrifiez des FP dans le Crypto Pool.', ok: (s) => s.stats.fpSacrificed > 0, reward: { cq: 800 }, go: 'pool', lvl: 5 },
  { id: 'donjon', icon: '🗝️', name: 'Explorateur', desc: 'Terminez un donjon en Normal.', ok: (s) => s.stats.dungeons >= 1, reward: { chest: 'gold' }, go: 'combat', lvl: 8 },
  { id: 'arene', icon: '🏟️', name: 'Gladiateur', desc: 'Gagnez un combat d’arène.', ok: (s) => s.arena.wins >= 1, reward: { honor: 100 }, go: 'arena', lvl: 10 },
  { id: 'guilde', icon: '🏰', name: 'Frères d’armes', desc: 'Fondez ou rejoignez une guilde.', ok: (s) => !!s.guild, reward: { gems: 20 }, go: 'guild', lvl: 10 },
  { id: 'notif', icon: '🔔', name: 'Toujours prévenu', desc: 'Activez les notifications (Réglages).', ok: (s) => !!s.settings.notif, reward: { cons: { e2: 1 } }, go: 'settings' },
  { id: 'appli', icon: '📲', name: 'Toujours sous la main', desc: 'Installez CryptoQuest comme application.', ok: () => CQ.isStandalone(), reward: { gems: 10 }, go: 'settings' },
  { id: 'niv10', icon: '⭐', name: 'Aguerri', desc: 'Atteignez le niveau 10.', ok: (s) => s.level >= 10, reward: { chest: 'silver', gems: 5 } },
  { id: 'niv25', icon: '⭐', name: 'Vétéran', desc: 'Atteignez le niveau 25.', ok: (s) => s.level >= 25, reward: { chest: 'gold', gems: 10 } },
  { id: 'niv50', icon: '⭐', name: 'Légende', desc: 'Atteignez le niveau 50.', ok: (s) => s.level >= 50, reward: { chest: 'mythic', gems: 25 } },
];
CQ.missions = () => CQ.state.missions || (CQ.state.missions = {});
CQ.missionVisible = (m) => !m.lvl || CQ.state.level >= m.lvl;
CQ.missionReady = (m) => !CQ.missions()[m.id] && CQ.missionVisible(m) && m.ok(CQ.state);
CQ.missionsClaimable = () => CQ.MISSIONS.some(CQ.missionReady);
CQ.claimMission = (id) => {
  const m = CQ.MISSIONS.find((x) => x.id === id);
  if (!m || !CQ.missionReady(m)) return false;
  CQ.missions()[id] = Date.now();
  CQ.grant(m.reward, `Quête secondaire : ${m.name}`);
  return true;
};
P.quests.secondary = () => {
  const done = CQ.missions(), list = CQ.MISSIONS.filter(CQ.missionVisible);
  const n = list.filter((m) => done[m.id]).length;
  return `<div class="card"><h3>🧭 Quêtes secondaires<span class="right">${n}/${list.length} accomplies</span></h3>
    ${list.sort((a, b) => (!!done[a.id] - !!done[b.id]) || (CQ.missionReady(b) - CQ.missionReady(a))).map((m) => {
      const ready = CQ.missionReady(m), got = done[m.id];
      return `<div class="quest ${got ? 'done' : ''} ${m.id === 'compte' && !got ? 'highlight' : ''}"><span class="qi">${m.icon}</span><div class="qb"><b>${m.name}</b><div class="small muted">${m.desc}</div><div class="row wrap" style="gap:5px;margin-top:5px">${CQ.rewardHtml(m.reward)}</div></div>
        ${got ? '<button class="btn sm" disabled>✓</button>' : ready ? `<button class="btn sm gold" data-act="claimMission" data-arg="${m.id}">Récupérer</button>` : m.go ? `<a class="btn sm ghost" href="#${m.go}">Y aller</a>` : ''}</div>`;
    }).join('')}
    <div class="note mt">Des missions uniques, à faire une seule fois. D’autres apparaissent quand vous montez de niveau.</div></div>`;
};
A.claimMission = (id) => { if (CQ.claimMission(id)) { CQ.sfx('loot'); CQ.toast('🧭 Quête secondaire accomplie !', 'r4'); CQ.save(); CQ.refresh(); } };

// carte « Cet appareil » sur le Profil, avant le compte en ligne
(() => {
  const r = P.profile.render;
  P.profile.render = () => {
    const d = CQ.device(), safe = CQ.accountSafe();
    return r().replace('<div class="card mt"><h3>☁️ Compte en ligne', `<div class="card mt ${safe ? '' : 'warn-card'}"><h3>💻 Cet appareil</h3>
      <div class="row wrap" style="gap:8px"><input class="input" id="devName" maxlength="30" value="${CQ.esc(d.name)}" style="max-width:260px"><button class="btn sm" data-act="saveDevice">Renommer</button></div>
      <div class="small ${safe ? 'muted' : 'c-fp'} mt">${safe ? 'Partie sauvegardée en ligne : vous la retrouvez sur vos autres appareils.' : '⚠️ Sans compte, votre partie n’existe que dans ce navigateur, sur cet appareil. Si vous videz le navigateur ou changez d’appareil, elle est perdue. Connectez-vous ci-dessous (quête secondaire « Sécuriser votre compte » : 30 diamants et un coffre d’Or).'}</div></div>
      <div class="card mt"><h3>☁️ Compte en ligne`);
  };
})();
A.saveDevice = () => { CQ.setDeviceName((CQ.$('#devName') || {}).value || ''); CQ.toast('Appareil renommé.', 'green'); CQ.refresh(); };
