'use strict';
// Lot B — confort et rétention : réglages, sons, notifications, événements de la semaine,
// tutoriel guidé, application installable.

// ---------- Réglages ----------
CQ.SET_DEFAULTS = { sound: null, volume: 0.5, motion: 'auto', numbers: 'short', notif: false, tutorial: { step: 0, done: false } };
CQ.settings = () => CQ.state.settings;
CQ.isMobile = () => window.matchMedia('(pointer: coarse)').matches;
// sons : coupés par défaut sur mobile, actifs (volume bas) sur ordinateur
CQ.soundOn = () => { const v = CQ.settings().sound; return v == null ? !CQ.isMobile() : v; };
CQ.applySettings = () => {
  const st = CQ.settings();
  document.body.classList.toggle('reduce', st.motion === 'on');
  document.body.classList.toggle('full-motion', st.motion === 'off');
};

// ---------- Sons (synthétisés : aucun fichier à charger) ----------
CQ.SFX = {
  crit: [[660, 0, 0.05, 'square'], [990, 0.04, 0.06, 'square']],
  loot: [[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.09], [1047, 0.24, 0.16]],
  level: [[392, 0, 0.12], [523, 0.11, 0.12], [659, 0.22, 0.12], [784, 0.33, 0.28]],
  coin: [[1319, 0, 0.05], [1760, 0.05, 0.09]],
  win: [[523, 0, 0.1], [784, 0.1, 0.1], [1047, 0.2, 0.25]],
  lose: [[392, 0, 0.14, 'sawtooth'], [311, 0.13, 0.14, 'sawtooth'], [247, 0.26, 0.3, 'sawtooth']],
  alert: [[880, 0, 0.08], [660, 0.1, 0.12]],
};
CQ.sfx = (name) => {
  if (!CQ.soundOn() || !CQ.SFX[name]) return;
  try {
    const ac = CQ._ac || (CQ._ac = new (window.AudioContext || window.webkitAudioContext)());
    if (ac.state === 'suspended') ac.resume();
    const vol = 0.12 * CQ.settings().volume, t0 = ac.currentTime + 0.01;
    for (const [f, at, dur, type] of CQ.SFX[name]) {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(vol, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(ac.destination);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.02);
    }
  } catch (e) { /* audio indisponible */ }
};
// branchements : on enveloppe les fonctions existantes plutôt que de semer des appels partout
(() => {
  const wrap = (name, after) => { const f = CQ[name]; CQ[name] = (...args) => { const r = f(...args); after(r, args); return r; }; };
  let lvl = 0;
  const gx = CQ.gainXp;
  CQ.gainXp = (amt) => { lvl = CQ.state.level; gx(amt); if (CQ.state.level > lvl) CQ.sfx('level'); };
  wrap('openChest', (r) => { if (r) CQ.sfx(r.items.some((it) => it.rarity >= 3) ? 'loot' : 'coin'); });
  wrap('aucWin', () => CQ.sfx('win'));
  wrap('arenaFight', (f) => { if (f) setTimeout(() => CQ.sfx(f.win ? 'win' : 'lose'), 300); });
  wrap('mailClaim', (r) => { if (r && r.ok) CQ.sfx('coin'); });
  CQ.on((type, d) => {
    if (type === 'pHit' && d.crit && CQ.ui.page === 'combat') CQ.sfx('crit');
    else if (type === 'kill' && d.drops.some((it) => it.rarity >= 3 || it.set)) CQ.sfx('loot');
  });
})();

// ---------- Événements de la semaine ----------
// jour de la semaine (0 = dimanche) → bonus. Les bonus de stats passent par CQ.buffVal (même colonne que les élixirs).
CQ.EVENTS = [
  { days: [1], icon: '🔨', name: 'Jour du forgeron', desc: '−25 % sur l’amélioration, la fusion et la création', forge: 25 },
  { days: [3], icon: '🗝️', name: 'Chasse au trésor', desc: '+50 % de chance de butin', bonus: { drop: 50 } },
  { days: [5], icon: '🏟️', name: 'Vendredi des gladiateurs', desc: '+50 % d’Honneur à l’arène', honor: 50 },
  { days: [6, 0], icon: '🩸', name: 'Nuit de sang', desc: '+50 % Farm Power tout le week-end', bonus: { fp: 50 } },
];
CQ.eventNow = (d = new Date()) => CQ.EVENTS.find((e) => e.days.includes(d.getDay())) || null;
CQ.eventNext = () => {
  const d = new Date();
  for (let i = 1; i <= 7; i++) {
    const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i);
    const e = CQ.eventNow(n);
    if (e && e !== CQ.eventNow()) return { e, at: n.getTime() };
  }
  return null;
};
CQ.eventBonus = (stat) => { const e = CQ.eventNow(); return e && e.bonus && e.bonus[stat] ? e.bonus[stat] : 0; };
CQ.eventChip = () => {
  const e = CQ.eventNow();
  return e ? `<span class="chip red event-chip" title="${CQ.esc(e.desc)}">${e.icon} ${e.name} · ${e.desc}</span>` : '';
};
CQ.eventBanner = () => {
  const e = CQ.eventNow(), n = CQ.eventNext();
  if (!e && !n) return '';
  return `<div class="event-banner ${e ? 'on' : ''}"><span class="ev-ico">${e ? e.icon : n.e.icon}</span><div>
    ${e ? `<b>Événement du jour : ${e.name}</b><div class="small">${e.desc}. Jusqu’à minuit${e.days.length > 1 && new Date().getDay() === 6 ? ' dimanche' : ''}.</div>`
      : `<b>Prochain événement : ${n.e.name}</b><div class="small muted">${n.e.desc} · dans ${CQ.fmtDur(n.at - Date.now())}</div>`}</div></div>`;
};
(() => {
  const dash = P.dashboard.render;
  P.dashboard.render = () => CQ.eventBanner() + dash();
  const ch = P.combat.challenges;
  P.combat.challenges = () => { ch(); const el = CQ.$('#challenges'), c = CQ.eventChip(); if (el && c) el.insertAdjacentHTML('afterbegin', `<div class="mb">${c}</div>`); };
})();
(() => {
  const forge = (name) => { const f = CQ[name]; CQ[name] = (...a) => { const e = CQ.eventNow(); return Math.round(f(...a) * (1 - (e && e.forge ? e.forge : 0) / 100)); }; };
  forge('upgradeCost'); forge('fusionCost'); forge('craftCost');
  const gain = CQ.gain;
  CQ.gain = (cur, amt, why, silent) => {
    const e = CQ.eventNow();
    if (cur === 'honor' && amt > 0 && e && e.honor && /^Arène :/.test(why || '')) amt = Math.round(amt * (1 + e.honor / 100));
    return gain(cur, amt, why, silent);
  };
})();

// ---------- Notifications ----------
// Page ouverte en arrière-plan uniquement : les vraies notifications « application fermée » demandent le serveur (lot D).
CQ.notifState = () => (!('Notification' in window) ? 'absent' : Notification.permission);
CQ.notify = (title, body, tag) => {
  if (!CQ.settings().notif || CQ.notifState() !== 'granted' || !document.hidden) return;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then((r) => r.showNotification(title, opts)).catch(() => {});
  else try { new Notification(title, opts); } catch (e) { /* refusé par le navigateur */ }
  CQ.sfx('alert');
};
CQ._watch = {};
CQ.watchTick = () => {
  const s = CQ.state, w = CQ._watch, ps = CQ.playerStats();
  const edge = (key, now, title, body) => { if (now && w[key] === false) CQ.notify(title, body, key); w[key] = !!now; };
  edge('energy', CQ.energyNow(ps) >= ps.emax, '⚡ Énergie pleine', `Votre héros a ${CQ.fmt(ps.emax)} énergie : la recharge est à l’arrêt.`);
  edge('faucet', CQ.faucetReadyIn() === 0, '💧 Faucet prêt', `+${CQ.faucetAmount()} FP à récupérer.`);
  const p = CQ.poolCycle();
  edge('pool' + p.id, p.end - Date.now() < 3600000, '🔥 Le Crypto Pool ferme dans 1 h', p.mine ? `Vous avez sacrifié ${CQ.fmt(p.mine)} FP.` : 'Il est encore temps de sacrifier des FP.');
  if (CQ.arenaOpen()) edge('tickets', CQ.arenaTickets() >= CQ.ARENA.tickets, '🏟️ Billets d’arène au maximum', 'Les prochains billets seraient perdus.');
  // enchères : surenchéri, ou fin proche sur un lot que vous menez
  for (const l of s.auction.lots) {
    if (l.done) continue;
    const lead = l.top === 'me';
    if (w['lead' + l.id] && !lead) CQ.notify('⚖️ Vous êtes surenchéri', `${CQ.aucName(l)} : ${CQ.fmt(l.bid)} FP.`, 'auc' + l.id);
    w['lead' + l.id] = lead;
    edge('end' + l.id, lead && l.end - Date.now() < 5 * 60000, '⚖️ Fin d’enchère dans 5 min', `Vous menez sur ${CQ.aucName(l)}.`);
  }
};
CQ.A.notifToggle = () => {
  const st = CQ.settings();
  if (st.notif) { st.notif = false; CQ.save(); CQ.refresh(); return; }
  if (CQ.notifState() === 'absent') { CQ.toast('Ce navigateur ne gère pas les notifications.', 'red'); return; }
  Notification.requestPermission().then((perm) => {
    st.notif = perm === 'granted';
    if (!st.notif) CQ.toast('Notifications refusées par le navigateur.', 'red');
    CQ.save(); CQ.refresh();
  });
};

// ---------- Tutoriel ----------
CQ.TUTO = [
  { page: 'combat', sel: '#arena', title: 'Le combat', text: 'Votre héros combat seul. Chaque attaque coûte 1 énergie, rendue au rythme de 100 par heure, même hors ligne. Plus la zone est haute, plus chaque énergie rapporte, tant que vous y survivez.' },
  { page: 'equipment', sel: '[data-act="autoEquip"]', title: 'L’équipement', text: 'Les monstres laissent tomber des objets. « Équiper le meilleur » choisit pour vous dans chaque emplacement. Un objet équipé devient lié : il ne se vend plus au marché.' },
  { page: 'chests', sel: '.chest-card', title: 'Les coffres', text: 'Vous avez un coffre de Bronze offert. Les probabilités de chaque rareté sont affichées. La Luck les améliore.' },
  { page: 'hero', sel: '.attr-row', title: 'Attributs et talents', text: 'Chaque niveau donne 5 points d’attribut, et un point de talent dès le niveau 5. La Précision évite de gaspiller de l’énergie, l’Endurance en donne davantage.' },
  { page: 'faucet', sel: '#faucetBtn', title: 'Le faucet', text: 'Toutes les 30 minutes, des Farm Points gratuits. Une vidéo double la récompense.' },
  { page: 'pool', sel: '.pool-hero', title: 'Le Crypto Pool', text: 'Chaque jour, 70 % des revenus sont redistribués entre ceux qui sacrifient des FP, au prorata. Les FP sacrifiés sont consommés. Ici, tout est simulé.' },
];
CQ.tutoActive = () => { const t = CQ.settings().tutorial; return !t.done && t.step < CQ.TUTO.length; };
CQ.tutoDraw = () => {
  document.querySelectorAll('.tut-focus').forEach((el) => el.classList.remove('tut-focus'));
  let box = document.getElementById('tuto');
  if (!CQ.tutoActive()) { if (box) box.remove(); return; }
  const i = CQ.settings().tutorial.step, st = CQ.TUTO[i];
  if (!box) { box = document.createElement('div'); box.id = 'tuto'; box.className = 'tuto'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Tutoriel'); document.body.appendChild(box); }
  box.innerHTML = `<div class="kicker">Tutoriel · ${i + 1}/${CQ.TUTO.length}</div><b>${st.title}</b><p>${st.text}</p>
    <div class="row between wrap" style="gap:8px"><button class="btn ghost sm" data-act="tutoSkip">Passer le tutoriel</button>
      <div class="row" style="gap:6px">${i ? '<button class="btn sm" data-act="tutoPrev">Précédent</button>' : ''}<button class="btn primary sm" data-act="tutoNext">${i === CQ.TUTO.length - 1 ? 'Terminer' : 'Suivant'}</button></div></div>`;
  if (CQ.ui.page !== st.page) return;
  const el = document.querySelector(st.sel);
  if (el) { el.classList.add('tut-focus'); el.scrollIntoView({ block: 'center', behavior: document.body.classList.contains('reduce') ? 'auto' : 'smooth' }); }
};
CQ.tutoGo = (step) => {
  const t = CQ.settings().tutorial;
  t.step = step;
  if (step >= CQ.TUTO.length) t.done = true;
  CQ.save();
  if (CQ.tutoActive() && CQ.ui.page !== CQ.TUTO[step].page) CQ.go(CQ.TUTO[step].page);
  else CQ.tutoDraw();
};
CQ.A.tutoNext = () => CQ.tutoGo(CQ.settings().tutorial.step + 1);
CQ.A.tutoPrev = () => CQ.tutoGo(Math.max(0, CQ.settings().tutorial.step - 1));
CQ.A.tutoSkip = () => { CQ.settings().tutorial.done = true; CQ.save(); CQ.tutoDraw(); };
CQ.A.tutoRestart = () => { CQ.settings().tutorial = { step: 0, done: false }; CQ.tutoGo(0); };

// ---------- Application installable ----------
CQ.installEvt = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); CQ.installEvt = e; if (CQ.ui.page === 'settings') CQ.refresh(); });
window.addEventListener('appinstalled', () => { CQ.installEvt = null; CQ.toast('📲 CryptoQuest est installé.', 'green'); });
CQ.isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
CQ.registerSW = () => {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch(() => {});
};
CQ.A.install = () => {
  if (!CQ.installEvt) return;
  CQ.installEvt.prompt();
  CQ.installEvt.userChoice.finally(() => { CQ.installEvt = null; CQ.refresh(); });
};

// le tutoriel se redessine après chaque rendu de page
(() => { const r = CQ.render; CQ.render = CQ.refresh = () => { r(); CQ.tutoDraw(); }; })();

// ---------- Page Réglages ----------
P.settings = {
  title: 'Réglages',
  render() {
    const st = CQ.settings(), s = S(), np = CQ.notifState();
    const seg = (act, cur, list) => `<div class="tabs seg" style="margin:0">${list.map(([v, l]) => `<button class="tab ${cur === v ? 'on' : ''}" data-act="${act}" data-arg="${v}">${l}</button>`).join('')}</div>`;
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const install = CQ.isStandalone() ? '<span class="chip green">Application installée</span>'
      : CQ.installEvt ? '<button class="btn gold" data-act="install">📲 Installer CryptoQuest</button>'
      : !/^https?:$/.test(location.protocol) ? '<div class="small muted">L’installation demande que le jeu soit servi par un site (https), pas ouvert comme un fichier. Elle sera disponible une fois le jeu en ligne.</div>'
      : ios ? '<div class="small muted">Sur iPhone : bouton Partager de Safari, puis « Sur l’écran d’accueil ».</div>'
      : '<div class="small muted">Votre navigateur propose l’installation dans son menu (« Installer l’application » ou « Ajouter à l’écran d’accueil »).</div>';
    return `<div class="grid g2">
      <div class="card"><h3>🔊 Sons</h3>
        <div class="set-row"><span>Effets sonores<div class="small dim">Critiques, butin rare, niveaux, enchères, arène. Coupés par défaut sur téléphone.</div></span>${seg('setSound', CQ.soundOn() ? 'on' : 'off', [['on', 'Activés'], ['off', 'Coupés']])}</div>
        <div class="set-row"><span>Volume</span><input type="range" min="0" max="1" step="0.1" value="${st.volume}" data-change="setVolume" aria-label="Volume" ${CQ.soundOn() ? '' : 'disabled'}></div>
        <button class="btn ghost sm" data-act="sfxTest" ${CQ.soundOn() ? '' : 'disabled'}>Écouter un exemple</button>
      </div>
      <div class="card"><h3>🔔 Notifications</h3>
        <div class="set-row"><span>Alertes quand le jeu est en arrière-plan<div class="small dim">Énergie pleine, faucet prêt, pool qui ferme dans 1 h, billets d’arène au maximum, enchère dépassée ou sur le point de finir.</div></span>
          <button class="btn sm ${st.notif ? 'gold' : ''}" data-act="notifToggle" ${np === 'absent' || np === 'denied' ? 'disabled' : ''}>${st.notif ? 'Activées' : 'Activer'}</button></div>
        <div class="small muted">${np === 'denied' ? 'Bloquées dans les réglages du navigateur.' : np === 'absent' ? 'Non prises en charge par ce navigateur.' : 'Le jeu doit rester ouvert (même réduit). Les alertes application fermée arriveront avec les comptes en ligne.'}</div>
      </div>
      <div class="card"><h3>✨ Affichage</h3>
        <div class="set-row"><span>Animations<div class="small dim">« Auto » suit le réglage de l’appareil.</div></span>${seg('setMotion', st.motion, [['auto', 'Auto'], ['on', 'Réduites'], ['off', 'Complètes']])}</div>
        <div class="set-row"><span>Grands nombres<div class="small dim">Exemple : ${st.numbers === 'short' ? '12,3 k' : '12 345'}</div></span>${seg('setNumbers', st.numbers, [['short', 'Abrégés'], ['full', 'Complets']])}</div>
      </div>
      <div class="card"><h3>⚡ Énergie</h3>
        <div class="set-row"><span>Le combat s’arrête à<div class="small dim">Garde une réserve pour un boss ou un donjon.</div></span>
          <select class="input sm" data-change="eguard">${CQ.ENERGY_GUARDS.map((g) => `<option value="${g}" ${s.eguard === g ? 'selected' : ''}>${g} énergie</option>`).join('')}</select></div>
        <div class="set-row"><span>Combat automatique</span><button class="btn sm ${s.auto ? '' : 'gold'}" data-act="toggleAuto">${s.auto ? 'En marche' : 'En pause'}</button></div>
      </div>
      <div class="card"><h3>📲 Application</h3>${install}
        <div class="small dim mt">Installé, le jeu s’ouvre en plein écran depuis une icône, comme une application.</div></div>
      <div class="card"><h3>🎓 Aide</h3>
        <div class="set-row"><span>Tutoriel en ${CQ.TUTO.length} étapes</span><button class="btn sm" data-act="tutoRestart">Revoir le tutoriel</button></div>
        <div class="set-row"><span>Événements de la semaine</span><span class="small muted">${CQ.EVENTS.map((e) => `${e.icon} ${e.name}`).join(' · ')}</span></div>
        <div class="set-row"><span>Sauvegarde, export, remise à zéro</span><a class="btn sm ghost" href="#profile">Profil</a></div></div>
    </div>`;
  },
};
A.setSound = (v) => { CQ.settings().sound = v === 'on'; CQ.save(); CQ.refresh(); if (v === 'on') CQ.sfx('coin'); };
A.setVolume = (v) => { CQ.settings().volume = Number(v); CQ.save(); CQ.sfx('coin'); };
A.sfxTest = () => CQ.sfx('loot');
A.setMotion = (v) => { CQ.settings().motion = v; CQ.applySettings(); CQ.save(); CQ.refresh(); };
A.setNumbers = (v) => { CQ.settings().numbers = v; CQ.save(); CQ.refresh(); };
