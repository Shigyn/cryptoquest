'use strict';
// Sauvegarde locale, migration entre versions, utilitaires, monnaies et historique.
CQ.SAVE_KEY = 'cryptoquest_v01'; // clé conservée : les parties V0.1 sont migrées sur place
CQ.SAVE_VERSION = 5;

CQ.newState = () => ({
  v: CQ.SAVE_VERSION,
  name: 'Aventurier',
  created: Date.now(),
  lastSeen: Date.now(),
  level: 1,
  xp: 0,
  cq: 300,
  fp: 40,
  crypto: 0,
  gems: 0, // diamants : monnaie premium (packs simulés, paliers, saisons d'arène)
  honor: 0, // monnaie d'arène
  zone: 0,
  nextId: 1,
  inventory: [],
  equipped: { weapon: null, helmet: null, armor: null, gloves: null, boots: null, ring: null, amulet: null },
  attrs: { force: 5, vit: 5, agi: 5, prec: 5, endu: 5, fort: 5 },
  talents: {},
  respecs: { attrs: 0, talents: 0 },
  train: { force: 0, vit: 0, agi: 0, prec: 0, endu: 0, fort: 0 }, // points d'attribut achetés à l'entraînement
  energy: { v: 1000, at: Date.now() }, // valeur stockée + horodatage, la recharge se calcule à la lecture
  auto: false, // combat en cours (le joueur le lance lui-même ; false = le héros garde son énergie)
  eguard: 0, // le combat s'arrête sous ce seuil d'énergie
  eday: { day: null, video: 0, potions: {} },
  chests: { bronze: 1, silver: 0, gold: 0, mythic: 0 },
  zoneKills: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  keys: { v: 6, at: Date.now() }, // clés de donjon
  dungeons: {}, // meilleur étage par zone et difficulté
  pantheon: { slots: [], done: 0 }, // quêtes du Panthéon
  guild: null, // guilde (membres et rivaux simulés dans le prototype)
  abyss: null, // Abysses : descente en cours, exclusions, victoires
  costume: null, titles: [],
  team: null, // arène d'équipe et mercenaires
  season: null, title: null, // passe de saison, titre affiché
  guildLeftAt: 0,
  bestiary: {},
  stats: { kills: 0, bosses: 0, dungeons: 0, deaths: 0, chests: 0, upgrades: 0, fusions: 0, crafts: 0, faucet: 0,
    fpEarned: 0, cqEarned: 0, cryptoEarned: 0, fpSacrificed: 0, poolDays: 0, bestRarity: -1, bestPlus: 0 },
  stakes: [],
  pool: null,
  poolHistory: [],
  faucetLast: 0,
  login: { last: null, streak: 0, best: 0 },
  quests: { day: null, prog: {}, claimed: {}, bonus: false },
  achievements: {},
  ladder: {},
  buffs: {},
  ptc: { day: null, done: {} },
  offers: {},
  settings: { sound: null, volume: 0.5, motion: 'auto', numbers: 'short', notif: false, tutorial: { step: 0, done: false } },
  premium: { until: 0, since: null, total: 0, chestAt: 0, respecMonth: null, autoSell: false, watch: {} }, // abonnement Légion
  loadouts: [], // jeux d'équipement mémorisés (Légion)
  mats: {}, // réserve de matériaux : { fer: [brut, raffiné, pur, ancestral, divin], … }
  recipes: { pre: {}, suf: {} }, // recettes de forge découvertes
  consumables: {}, // { idConsommable: quantité }
  mail: [], // boîte aux lettres : objets et monnaies à récupérer
  auction: { round: null, lots: [] }, // hôtel des ventes (lots du système)
  market: { mine: [], bought: {}, hist: {} }, // marché entre joueurs
  arena: { glory: 1000, best: 1000, tickets: 10, tAt: Date.now(), season: null, opps: [], bots: {}, fights: [], defenses: [], defAt: 0, vs: { day: null, n: {} }, wins: 0, losses: 0 },
  tx: [],
});

CQ.load = () => {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(CQ.SAVE_KEY)); } catch (e) { s = null; }
  const base = CQ.newState();
  if (!s || typeof s !== 'object') return base;
  // fusion superficielle pour tolérer les champs ajoutés entre versions
  for (const k of Object.keys(base)) {
    if (s[k] === undefined) s[k] = base[k];
    else if (base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) && typeof s[k] === 'object') s[k] = Object.assign({}, base[k], s[k]);
  }
  CQ.migrate(s);
  return s;
};

// V0.1 → V2 : « Réduction de recharge » devient Vitesse d'attaque, énergie pleine.
// Les attributs et talents partent à zéro, donc tous les points des niveaux déjà gagnés sont à répartir.
CQ.migrate = (s) => {
  if ((s.v || 1) < 2) {
    for (const it of s.inventory) for (const r of it.rolls) if (r.k === 'cdr') r.k = 'spd';
    s.energy = { v: CQ.ENERGY.max, at: Date.now() };
    s.migratedV2 = true;
  }
  // V3 : un objet équipé est lié au compte (plus vendable au marché)
  if ((s.v || 1) < 3) {
    for (const id of Object.values(s.equipped)) { const it = id && s.inventory.find((x) => x.id === id); if (it) it.bound = true; }
  }
  // V4 : tutoriel réservé aux nouvelles parties (rejouable depuis Réglages)
  if ((s.v || 1) < 4 && s.stats.kills > 0) s.settings.tutorial = { step: 0, done: true };
  // V5 : toucher, esquive, critique, vitesse et pénétration passent en notation.
  // Les anciennes valeurs (%) sont converties pour garder la même efficacité au niveau de l'objet.
  if ((s.v || 1) < 5) {
    const rated = ['hit', 'dodge', 'crit', 'spd', 'pen'], u = ['furie', 'colosse', 'avarice', 'souffle', 'bourreau', 'egide', 'sangsue', 'eclair'];
    const conv = (it) => {
      for (const r of it.rolls) if (rated.includes(r.k)) r.v = Math.round(r.v * (it.ilvl + 10));
      if (it.rarity === 5 && !it.unique) it.unique = u[Math.floor(Math.random() * u.length)];
    };
    s.inventory.forEach(conv);
    (s.mail || []).forEach((m) => (m.items || []).forEach(conv));
    ((s.market && s.market.mine) || []).forEach((l) => conv(l.item));
    if (s.auction) s.auction = { round: null, lots: (s.auction.lots || []).filter((l) => l.top === 'me' && !l.done) };
    s.migratedV5 = true;
  }
  while (s.zoneKills.length < CQ.ZONES.length) s.zoneKills.push(0); // nouvelles zones
  s.v = CQ.SAVE_VERSION;
};

CQ.save = () => {
  CQ.state.lastSeen = Date.now();
  if (CQ.energySync) CQ.energySync();
  try { localStorage.setItem(CQ.SAVE_KEY, JSON.stringify(CQ.state)); } catch (e) { /* stockage indisponible */ }
};

CQ.reset = () => {
  try { localStorage.removeItem(CQ.SAVE_KEY); } catch (e) { /* rien */ }
  CQ.state = CQ.newState();
};

// ---------- utilitaires ----------
CQ.rand = (a, b) => a + Math.random() * (b - a);
CQ.randInt = (a, b) => Math.floor(CQ.rand(a, b + 1));
CQ.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
CQ.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
CQ.pickWeighted = (weights) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
};
// arrondi probabiliste : 2.3 donne 2 (70 %) ou 3 (30 %)
CQ.probRound = (v) => Math.floor(v) + (Math.random() < v - Math.floor(v) ? 1 : 0);

CQ.hash = (str) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return (h >>> 0);
};
CQ.seeded = (str) => {
  let a = CQ.hash(str);
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};

const pad = (n) => String(n).padStart(2, '0');
CQ.dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
CQ.weekKey = (d = new Date()) => {
  const t = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (t.getDay() + 6) % 7; // lundi = 0
  t.setDate(t.getDate() - day);
  return 'S' + CQ.dayKey(t);
};
CQ.monthKey = (d = new Date()) => `M${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
CQ.nextMidnight = (t = Date.now()) => { const d = new Date(t); d.setHours(24, 0, 0, 0); return d.getTime(); };
CQ.yesterdayKey = () => { const d = new Date(); d.setDate(d.getDate() - 1); return CQ.dayKey(d); };

CQ.fmt = (n) => {
  n = Number(n) || 0;
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(2).replace('.', ',') + ' Md';
  if (a >= 1e6) return (n / 1e6).toFixed(2).replace('.', ',') + ' M';
  if (CQ.state && CQ.state.settings && CQ.state.settings.numbers === 'full') return Math.floor(n).toLocaleString('fr-FR');
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace('.', ',') + ' k';
  return Math.floor(n).toLocaleString('fr-FR');
};
CQ.fmtUsd = (n, d = 4) => (Number(n) || 0).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' $';
CQ.fmtDur = (ms) => {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h >= 24) return `${Math.floor(h / 24)} j ${h % 24} h`;
  if (h > 0) return `${h} h ${pad(m)} min`;
  return `${pad(m)}:${pad(sec)}`;
};
CQ.fmtClock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};
CQ.fmtDate = (t) => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
// valeur d'une statistique avec son unité (12 · 4,5 % · 8,2/h)
CQ.fmtStat = (k, v) => {
  const u = CQ.STATS[k] ? CQ.STATS[k].u : '';
  if (!u) return CQ.fmt(Math.round(v));
  if (u === 'pts') return `${CQ.fmt(Math.round(v))} pts`;
  const n = (Math.round(v * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
  return u === '%' ? `${n} %` : `${n}${u}`;
};
// valeur d'une stat du héros (en notation, c'est le % obtenu contre un adversaire de son niveau)
CQ.fmtPs = (k, v) => {
  if (!(CQ.STATS[k] && CQ.STATS[k].rt)) return CQ.fmtStat(k, v);
  return `${(Math.round(v * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`;
};
CQ.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- monnaies ----------
CQ.CUR = {
  cq: { name: 'CQ', ico: '<i class="ic ic-cq"></i>', cls: 'c-cq' },
  fp: { name: 'FP', ico: '<i class="ic ic-fp"></i>', cls: 'c-fp' },
  crypto: { name: 'USDT', ico: '<i class="ic ic-usd"></i>', cls: 'c-usd' },
  gems: { name: 'diamants', ico: '<i class="ic ic-gem"></i>', cls: 'c-gem' },
  honor: { name: 'Honneur', ico: '<i class="ic ic-hon"></i>', cls: 'c-hon' },
  energy: { name: 'énergie', ico: '<i class="ic ic-en"></i>', cls: 'c-en' }, // pas une monnaie : jamais dans l'historique
};
CQ.money = (cur, amt) => {
  const c = CQ.CUR[cur];
  const v = cur === 'crypto' ? CQ.fmtUsd(amt) : CQ.fmt(amt);
  return `<span class="row" style="display:inline-flex;gap:5px">${c.ico}<b class="${c.cls} tnum">${v}</b>${cur === 'crypto' ? '' : ` <span class="dim small">${c.name}</span>`}</span>`;
};
CQ.costHtml = (cost) => Object.entries(cost).map(([k, v]) => CQ.money(k, v)).join(' ');

CQ.logTx = (cur, amt, why) => {
  const s = CQ.state;
  s.tx.unshift({ t: Date.now(), cur, amt, why });
  if (s.tx.length > 400) s.tx.length = 400;
};

// gain : met à jour solde, statistiques et classements. silent = regroupé dans l'historique (combats)
CQ.gain = (cur, amt, why, silent) => {
  if (!amt) return;
  const s = CQ.state;
  s[cur] += amt;
  if (cur === 'fp') { s.stats.fpEarned += amt; CQ.ladderScore(amt); }
  if (cur === 'cq') s.stats.cqEarned += amt;
  if (cur === 'crypto') s.stats.cryptoEarned += amt;
  if (silent) { CQ.pendingTx[cur] = (CQ.pendingTx[cur] || 0) + amt; return; }
  CQ.logTx(cur, amt, why);
};
CQ.pendingTx = { kills: 0 };
CQ.flushTx = () => {
  const p = CQ.pendingTx;
  if (!p.kills && !p.cq && !p.fp) return;
  const why = `Combats — ${p.kills} victoire${p.kills > 1 ? 's' : ''}`;
  if (p.cq) CQ.logTx('cq', p.cq, why);
  if (p.fp) CQ.logTx('fp', p.fp, why);
  CQ.pendingTx = { kills: 0 };
};

CQ.canPay = (cost) => Object.entries(cost).every(([k, v]) => CQ.state[k] >= v);
CQ.pay = (cost, why) => {
  if (!CQ.canPay(cost)) { CQ.toast('Fonds insuffisants.', 'red'); return false; }
  for (const [k, v] of Object.entries(cost)) { CQ.state[k] -= v; CQ.logTx(k, -v, why); }
  return true;
};
CQ.grant = (reward, why) => {
  for (const [k, v] of Object.entries(reward)) {
    if (k === 'chest') { CQ.state.chests[v] = (CQ.state.chests[v] || 0) + 1; continue; }
    if (k === 'energy') { CQ.addEnergy(v); continue; }
    if (k === 'cons') { for (const [id, n] of Object.entries(v)) CQ.state.consumables[id] = (CQ.state.consumables[id] || 0) + n; continue; }
    CQ.gain(k, v, why);
  }
};
CQ.energyHtml = (v) => `<span class="row" style="display:inline-flex;gap:5px"><i class="ic ic-en"></i><b class="c-en tnum">${CQ.fmt(v)}</b> <span class="dim small">énergie</span></span>`;
CQ.rewardHtml = (r) => Object.entries(r).map(([k, v]) => (k === 'chest' ? `<span class="chip gold">${CQ.CHESTS[v].icon} ${CQ.CHESTS[v].name}</span>`
  : k === 'energy' ? CQ.energyHtml(v)
  : k === 'cons' ? Object.entries(v).map(([id, n]) => `<span class="chip">${CQ.CONSUMABLES[id].icon} ${CQ.CONSUMABLES[id].name}${n > 1 ? ' ×' + n : ''}</span>`).join(' ')
  : CQ.money(k, v))).join(' ');
