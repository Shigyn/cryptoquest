'use strict';
// V3-5 — Guildes. Prototype : les autres membres et les guildes rivales sont simulés, heure par heure,
// en attendant le serveur (lots C et D). Trésor en CQ uniquement : la guilde ne doit pas concentrer de FP.

CQ.GUILD = {
  minLevel: 10, cost: 25000, leaveCooldown: 24 * 3600000, maxLevel: 20,
  // bâtiments : coût de base (× 2^(niveau/2)), effet par niveau
  B: {
    hall: { icon: '🏛️', name: 'Grand Hall', base: 8000, desc: (l) => `${6 + 3 * l} places de membres` },
    treasury: { icon: '💰', name: 'Trésorerie', base: 9000, desc: (l) => `${2 * l} % du trésor protégé du pillage` },
    scriptorium: { icon: '📚', name: 'Scriptorium', base: 12000, desc: (l) => `${2 * l} parchemins de guilde stockés` },
    forge: { icon: '⚒️', name: 'Forge commune', base: 14000, desc: (l) => `−${(1.5 * l).toLocaleString('fr-FR')} % sur les coûts de forge` },
    camp: { icon: '🎯', name: 'Camp d’entraînement', base: 14000, desc: (l) => `−${2 * l} % sur l’entraînement` },
    cachots: { icon: '⛓️', name: 'Cachots', base: 16000, desc: (l) => `${l} boss capturés gardés, combattus sans clé` },
    sanctuary: { icon: '🕯️', name: 'Sanctuaire', base: 11000, desc: (l) => `prière quotidienne de ${l} h` },
    infirmary: { icon: '🩹', name: 'Infirmerie', base: 10000, desc: (l) => `+${l} % de PV soignés après chaque victoire` },
    comptoir: { icon: '🏪', name: 'Comptoir', base: 10000, desc: (l) => `commission du marché −${(2.5 * l).toLocaleString('fr-FR')} %` },
    warroom: { icon: '⚔️', name: 'Salle de guerre', base: 18000, desc: (l) => `${Math.min(10, l)} attaque${l > 1 ? 's' : ''} de guerre par jour` },
  },
  // parchemins de guilde : un officier en active un pour toute la guilde pendant 1 h (jamais de FP)
  SCROLLS: {
    sagesse: { icon: '📘', name: 'Sagesse', desc: '+30 % XP', buff: { xp: 30 } },
    pillage: { icon: '🗝️', name: 'Pillage', desc: '+40 % de chance de butin', buff: { drop: 40 } },
    or: { icon: '📒', name: 'Or', desc: '+30 % CQ', buff: { cq: 30 } },
    endurance: { icon: '⚡', name: 'Endurance', desc: '5 % d’attaques sans énergie', fx: { free: 5 } },
    fureur: { icon: '🔥', name: 'Fureur', desc: '+15 % de dégâts aux boss', fx: { bossDmg: 15 } },
  },
  PRAYERS: {
    souffle: { icon: '🌬️', name: 'Souffle', desc: '+10 % de recharge d’énergie' },
    savoir: { icon: '📖', name: 'Savoir', desc: '+10 % XP', buff: { xp: 10 } },
    fortune: { icon: '🍀', name: 'Fortune', desc: '+10 % de chance de butin', buff: { drop: 10 } },
  },
  RAID_TIERS: [25, 50, 75, 100],
};
CQ.GUILD_NAMES = [
  ['Les Lames Cendrées', 'LAC', '⚔️'], ['Ordre du Corbeau', 'ODC', '🐦‍⬛'], ['Légion d’Obsidienne', 'LOB', '🗿'], ['Fils de Malrith', 'FDM', '😈'],
  ['Garde du Givre', 'GDG', '❄️'], ['Sang-Roi', 'SNG', '🩸'], ['Veilleurs du Néant', 'VDN', '🌀'], ['Ronces Noires', 'RNO', '🌿'],
];
CQ.EMBLEMS = ['🛡️', '⚔️', '🐺', '🦅', '🐉', '🔥', '💀', '👑', '🌙', '🗡️', '🏹', '🦂'];
CQ.RANKS = { chef: 'Chef', bras: 'Bras droit', officier: 'Officier', veteran: 'Vétéran', membre: 'Membre', recrue: 'Recrue' };
CQ.EXTRA_NAMES = ['Arwen_Q', 'Bjorn', 'Calyx', 'Dorian', 'Erza', 'Faust', 'Gwen', 'Hadrien', 'Ilya', 'Jorah', 'Kira', 'Lothar', 'Maelis', 'Nox', 'Oriane', 'Perceval', 'Quill', 'Rhea', 'Soren', 'Talia'];

CQ.guild = () => CQ.state.guild;
CQ.gLvl = (b) => (CQ.guild() ? CQ.guild().b[b] || 0 : 0);
CQ.gIsStaff = () => { const g = CQ.guild(); return g && ['chef', 'bras', 'officier'].includes(g.myRank); };
CQ.gMembers = () => { const g = CQ.guild(); return g ? g.members.length + 1 : 0; };
CQ.gCap = () => 6 + 3 * CQ.gLvl('hall');
// chaque membre Légion actif réduit le coût des bâtiments de 2 %, jusqu'à 20 %
CQ.gLegionDiscount = () => { const g = CQ.guild(); if (!g) return 0; const n = g.members.filter((m) => m.legion).length + (CQ.isPremium() ? 1 : 0); return Math.min(20, 2 * n); };
CQ.gCost = (b) => { const l = CQ.gLvl(b); return Math.round(CQ.GUILD.B[b].base * Math.pow(2, l / 2) * (1 - CQ.gLegionDiscount() / 100)); };
CQ.gLog = (txt) => { const g = CQ.guild(); g.log.unshift({ t: Date.now(), txt }); if (g.log.length > 60) g.log.length = 60; };

// ---------- Guildes simulées ----------
CQ.botGuild = (i) => {
  const [name, tag, emblem] = CQ.GUILD_NAMES[i], r = CQ.seeded('guild' + tag), L = Math.max(10, CQ.state.level);
  const lvl = Math.round(L * (0.7 + r() * 0.6));
  const b = {};
  for (const k of Object.keys(CQ.GUILD.B)) b[k] = Math.max(1, Math.round((2 + r() * 10) * (lvl / 40 + 0.5)));
  b.hall = Math.max(b.hall, 3);
  const n = Math.min(6 + 3 * b.hall - 1, 8 + Math.floor(r() * 25));
  const pool = CQ.BOT_NAMES.concat(CQ.EXTRA_NAMES), members = [];
  for (let k = 0; k < n; k++) {
    members.push({ name: pool[Math.floor(r() * pool.length)] + (k > 30 ? k : ''), level: Math.max(5, Math.round(lvl + (r() - 0.5) * 20)), rank: k === 0 ? 'chef' : k < 3 ? 'officier' : k < 8 ? 'veteran' : 'membre',
      contrib: Math.round(r() * 200000), legion: r() < 0.2, tier: 1 + r() * 2 });
  }
  return { i, name, tag, emblem, motto: '', b, members, treasury: Math.round(50000 + r() * 2e6 * lvl / 30), power: 0 };
};
CQ.gPower = (g) => Math.round(Object.values(g.b).reduce((a, x) => a + x, 0) * 120 + g.members.reduce((a, m) => a + m.level * 8, 0));
CQ.rivalGuilds = () => CQ.GUILD_NAMES.map((x, i) => CQ.botGuild(i)).filter((g) => !CQ.guild() || CQ.guild().tag !== g.tag);

// ---------- Créer, rejoindre, quitter ----------
CQ.gCanJoin = () => {
  const s = CQ.state;
  if (s.level < CQ.GUILD.minLevel) return `Niveau ${CQ.GUILD.minLevel} requis.`;
  if (s.guild) return 'Vous êtes déjà dans une guilde.';
  if (s.guildLeftAt && Date.now() - s.guildLeftAt < CQ.GUILD.leaveCooldown) return `Vous avez quitté une guilde récemment : encore ${CQ.fmtDur(CQ.GUILD.leaveCooldown - (Date.now() - s.guildLeftAt))}.`;
  return '';
};
CQ.gNew = (base, myRank) => Object.assign({
  myRank, created: Date.now(), joined: Date.now(), myContrib: 0, scrolls: [], active: null, prayer: null, log: [], simAt: Date.now(),
  raid: null, wars: { day: null, used: 0, hist: [] }, terr: { month: null, pts: {} }, gq: null, captives: [], recruitAt: Date.now() + 6 * 3600000,
}, base);
CQ.gCreate = (name, tag, emblem) => {
  const err = CQ.gCanJoin();
  if (err) { CQ.toast(err, 'red'); return false; }
  name = name.trim().slice(0, 24); tag = tag.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
  if (name.length < 3 || tag.length < 2) { CQ.toast('Nom de 3 caractères minimum, sigle de 2 à 4 lettres.', 'red'); return false; }
  if (!CQ.pay({ cq: CQ.GUILD.cost }, `Fondation de la guilde ${name}`)) return false;
  const b = {}; for (const k of Object.keys(CQ.GUILD.B)) b[k] = 0;
  b.hall = 1; b.treasury = 1;
  CQ.state.guild = CQ.gNew({ i: -1, name, tag, emblem, motto: '', b, members: [], treasury: 0 }, 'chef');
  CQ.gLog(`${CQ.state.name} fonde la guilde ${name} [${tag}].`);
  return true;
};
CQ.gJoin = (i) => {
  const err = CQ.gCanJoin();
  if (err) { CQ.toast(err, 'red'); return false; }
  const base = CQ.botGuild(i);
  if (base.members.length + 1 > 6 + 3 * base.b.hall) { CQ.toast('Cette guilde est complète.', 'red'); return false; }
  CQ.state.guild = CQ.gNew(base, 'recrue');
  CQ.gLog(`${CQ.state.name} rejoint la guilde.`);
  return true;
};
CQ.gLeave = () => {
  const s = CQ.state;
  if (!s.guild) return;
  s.guild = null; s.guildLeftAt = Date.now();
};

// ---------- Trésor et bâtiments ----------
CQ.gDonate = (n) => {
  const g = CQ.guild();
  n = Math.floor(n);
  if (!g || n < 100) { CQ.toast('Don minimum : 100 CQ.', 'red'); return false; }
  if (!CQ.pay({ cq: n }, `Don à la guilde ${g.name}`)) return false;
  g.treasury += n; g.myContrib += n;
  CQ.gLog(`${CQ.state.name} donne ${CQ.fmt(n)} CQ.`);
  return true;
};
CQ.gUpgrade = (b) => {
  const g = CQ.guild();
  if (!g || !CQ.gIsStaff()) { CQ.toast('Seuls le chef et les officiers construisent.', 'red'); return false; }
  if (CQ.gLvl(b) >= CQ.GUILD.maxLevel) return false;
  const cost = CQ.gCost(b);
  if (g.treasury < cost) { CQ.toast('Trésor insuffisant.', 'red'); return false; }
  g.treasury -= cost; g.b[b]++;
  CQ.gLog(`${CQ.GUILD.B[b].name} passe au niveau ${g.b[b]}.`);
  return true;
};

// ---------- Parchemins et prières ----------
CQ.gScrollDrop = (boss) => {
  const g = CQ.guild();
  if (!g || Math.random() > (boss ? 0.1 : 0.004)) return;
  if (g.scrolls.length >= 2 * CQ.gLvl('scriptorium')) return;
  const id = CQ.pick(Object.keys(CQ.GUILD.SCROLLS));
  g.scrolls.push(id);
  CQ.gLog(`${CQ.state.name} rapporte un parchemin de ${CQ.GUILD.SCROLLS[id].name}.`);
  CQ.toast(`📚 Parchemin de guilde trouvé : ${CQ.GUILD.SCROLLS[id].name}`, 'r4');
};
CQ.gScrollCost = () => Math.round(2000 * (1 + CQ.state.level / 10));
CQ.gActivate = (idx) => {
  const g = CQ.guild();
  if (!g || !CQ.gIsStaff()) { CQ.toast('Seuls le chef et les officiers activent les parchemins.', 'red'); return false; }
  const id = g.scrolls[idx], cost = CQ.gScrollCost();
  if (!id) return false;
  if (g.treasury < cost) { CQ.toast('Trésor insuffisant.', 'red'); return false; }
  g.treasury -= cost; g.scrolls.splice(idx, 1);
  g.active = { id, until: Math.max(Date.now(), (g.active && g.active.until) || 0) + 3600000 };
  CQ.gLog(`Parchemin de ${CQ.GUILD.SCROLLS[id].name} activé pour toute la guilde.`);
  return true;
};
CQ.gActive = () => { const g = CQ.guild(); return g && g.active && g.active.until > Date.now() ? CQ.GUILD.SCROLLS[g.active.id] : null; };
CQ.gPray = (id) => {
  const g = CQ.guild(), l = CQ.gLvl('sanctuary');
  if (!g || !l) { CQ.toast('Le Sanctuaire n’est pas construit.', 'red'); return false; }
  if (g.prayer && g.prayer.day === CQ.dayKey()) { CQ.toast('Une prière par jour.', 'red'); return false; }
  g.prayer = { day: CQ.dayKey(), id, until: Date.now() + l * 3600000 };
  return true;
};
CQ.gPrayer = () => { const g = CQ.guild(); return g && g.prayer && g.prayer.until > Date.now() ? CQ.GUILD.PRAYERS[g.prayer.id] : null; };

// ---------- Cachots : boss capturés en donjon, combattus sans clé ----------
CQ.gCaptives = () => {
  const s = CQ.state, g = CQ.guild();
  if (!g) return [];
  // les boss capturés par le joueur rejoignent les cachots, dans la limite des places
  while ((s.captured || []).length && g.captives.length < CQ.gLvl('cachots')) {
    const c = s.captured.shift();
    g.captives.push({ id: 'C' + Date.now().toString(36) + g.captives.length, z: c.z, mode: c.mode, floor: c.floor, hp: null, by: s.name });
  }
  return g.captives;
};
CQ.gFightCaptive = (id) => {
  const c = CQ.combat, g = CQ.guild(), cap = g && g.captives.find((x) => x.id === id);
  if (!cap || c.mode !== 'farm' || c.deadUntil) return false;
  if (CQ.state.level < CQ.ZONES[cap.z].lvl) { CQ.toast(`Niveau ${CQ.ZONES[cap.z].lvl} requis.`, 'red'); return false; }
  c.mode = 'captive'; c.captive = cap; c.zone = cap.z;
  c.php = CQ.playerStats().maxHp;
  CQ.addLog(`⛓️ Vous descendez aux cachots affronter <b>${CQ.ZONES[cap.z].boss[0]}</b> (gardé par la guilde).`);
  CQ.spawn();
  return true;
};
(() => {
  const spawn = CQ.spawn;
  CQ.spawn = () => {
    const c = CQ.combat;
    if (c.mode !== 'captive') return spawn();
    if (!c.captive) { c.mode = 'farm'; c.zone = CQ.state.zone; return spawn(); }
    const cap = c.captive, dm = c.dmode;
    c.dmode = cap.mode;
    c.m = CQ.floorMonster(cap.z, { idx: 0, kind: 'dboss', floor: cap.floor });
    c.dmode = dm;
    if (cap.hp) c.m.hp = cap.hp;
    c.mT = 0; c.undyingUsed = false;
    CQ.emit('spawn');
  };
  const onDeath = CQ.onDeath;
  CQ.onDeath = () => {
    const c = CQ.combat;
    if (c.mode === 'captive' && c.captive && c.m) { c.captive.hp = c.m.hp; c.captive = null; c.zone = CQ.state.zone; CQ.addLog('⛓️ Le boss reste aux cachots, blessé. Revenez l’achever.'); }
    onDeath();
  };
  const onKill = CQ.onKill;
  CQ.onKill = (m, ps) => {
    const c = CQ.combat, g = CQ.guild();
    if (c.mode === 'captive' && c.captive && g) {
      g.captives = g.captives.filter((x) => x !== c.captive);
      CQ.gLog(`${CQ.state.name} achève ${m.name} aux cachots.`);
      c.captive = null;
    }
    onKill(m, ps);
    if (g) {
      CQ.gScrollDrop(CQ.isBoss(m));
      const T = g.terr;
      if (T.month === CQ.monthKey()) T.pts[m.z] = (T.pts[m.z] || 0) + 1;
      if (g.gq) g.gq.mine.kills++;
      // infirmerie : soin en plus après chaque victoire
      const l = CQ.gLvl('infirmary');
      if (l) c.php = Math.min(ps.maxHp, c.php + ps.maxHp * l / 100);
    }
  };
})();

// ---------- Raid de la semaine ----------
CQ.RAID_BOSSES = [['Colosse d’Airain', '🗿'], ['Hydre des Marais', '🐉'], ['Titan de Cendre', '🌋'], ['Léviathan', '🐋'], ['Golem du Néant', '🌑']];
CQ.gRaid = () => {
  const g = CQ.guild(), wk = CQ.weekKey();
  if (!g) return null;
  if (!g.raid || g.raid.week !== wk) {
    const [name, icon] = CQ.RAID_BOSSES[CQ.hash(wk) % CQ.RAID_BOSSES.length];
    const lvl = Math.max(10, Math.round((CQ.state.level + g.members.reduce((a, m) => a + m.level, 0)) / CQ.gMembers()));
    g.raid = { week: wk, name, icon, lvl, max: Math.round(CQ.gMembers() * 2.5e6 * (1 + lvl / 40)), dmg: 0, mine: 0, claimed: {} };
  }
  return g.raid;
};
CQ.raidMonster = (r) => ({ name: r.name, lvl: r.lvl, max: r.max, hp: r.max - r.dmg, def: r.lvl * 1.4, dodge: 10, hit: 100, crit: 10, kind: 'boss', z: 0 });
CQ.gRaidAttack = (energy) => {
  const r = CQ.gRaid(), ps = CQ.playerStats();
  if (!r) return 0;
  energy = Math.floor(energy);
  if (energy < 10 || CQ.energyNow(ps) < energy) { CQ.toast('Pas assez d’énergie.', 'red'); return 0; }
  CQ.spendEnergy(energy, ps);
  const m = CQ.raidMonster(r);
  const dmg = Math.round(energy * CQ.expectedHit(ps, m) * CQ.hitChance(ps, m) * CQ.rand(0.9, 1.1));
  r.dmg = Math.min(r.max, r.dmg + dmg); r.mine += dmg;
  if (CQ.guild().gq) CQ.guild().gq.mine.raid += dmg;
  CQ.gLog(`${CQ.state.name} inflige ${CQ.fmt(dmg)} dégâts au ${r.name}.`);
  return dmg;
};
CQ.raidTierReward = (t) => ({ cq: Math.round(1500 * (1 + CQ.state.level / 5) * (t / 25)), honor: 10 * (t / 25), cons: { [t >= 75 ? 'sDrop2' : 'sDrop']: 1 }, chest: t === 100 ? 'gold' : t >= 50 ? 'silver' : null });
CQ.gRaidClaim = (t) => {
  const r = CQ.gRaid();
  if (!r || r.claimed[t] || 100 * r.dmg / r.max < t) return false;
  if (r.mine < r.max * 0.01) { CQ.toast('Participez au raid (1 % des PV au moins) pour toucher les récompenses.', 'red'); return false; }
  r.claimed[t] = true;
  const rew = CQ.raidTierReward(t);
  if (!rew.chest) delete rew.chest;
  CQ.grant(rew, `Raid : palier ${t} %`);
  CQ.matAdd(CQ.pick(CQ.MAT_KEYS), Math.min(4, Math.floor(t / 25)), 5 + CQ.state.level / 5);
  return true;
};

// ---------- Guerres ----------
CQ.npcHero = (name, level, tier) => {
  const key = `npc:${name}:${level}:${Math.round(tier * 2)}`;
  if (CQ._botCache[key]) return CQ._botCache[key];
  const rnd = CQ.seeded(key), arch = CQ.ARENA.ARCH[Math.floor(rnd() * CQ.ARENA.ARCH.length)], pts = 5 * level, attrs = {}, talents = {};
  for (const at of CQ.ATTRS) attrs[at.id] = Math.min(CQ.attrCap(level), 5 + Math.round(pts * (arch.split[at.id] || 0))) + Math.round(level * 0.2 * tier / 1.5);
  let tp = Math.max(0, level - CQ.TALENT_START + 1);
  for (const t of CQ.TALENT_BRANCHES.find((b) => b.id === arch.branch).talents) { if (t.ult) continue; const n = Math.min(t.max, tp); if (n) talents[t.id] = n; tp -= n; }
  const items = CQ.SLOTS.map((sl) => CQ.makeItem(sl.id, CQ.clamp(Math.round(tier + rnd() * 1.5 - 0.5), 1, 5), level, { rnd, id: 'b' }));
  const h = { name, level, ps: CQ.statsFor({ level, attrs, talents, items }), icon: arch.icon };
  CQ._botCache[key] = h;
  return h;
};
CQ.gChampions = (members, me) => {
  const list = members.slice().sort((a, b) => b.level - a.level).slice(0, me ? 4 : 5).map((m) => CQ.npcHero(m.name, m.level, m.tier || 1.5));
  if (me) list.unshift({ name: CQ.state.name, level: CQ.state.level, ps: CQ.playerStats(), icon: '🧝', me: true });
  return list;
};
CQ.gWarsLeft = () => {
  const w = CQ.guild().wars, k = CQ.dayKey();
  if (w.day !== k) { w.day = k; w.used = 0; }
  return Math.min(10, CQ.gLvl('warroom')) - w.used;
};
CQ.gWar = (i) => {
  const g = CQ.guild();
  if (!g || !CQ.gIsStaff()) { CQ.toast('Seuls le chef et les officiers déclarent les guerres.', 'red'); return null; }
  if (CQ.gWarsLeft() < 1) { CQ.toast('Plus d’attaque de guerre aujourd’hui (Salle de guerre).', 'red'); return null; }
  const foe = CQ.botGuild(i), avg = (gg) => gg.members.reduce((a, m) => a + m.level, 0) / Math.max(1, gg.members.length);
  if (Math.abs(avg(foe) - CQ.state.level) > 15) { CQ.toast('Écart de niveau trop grand avec cette guilde.', 'red'); return null; }
  g.wars.used++;
  const ours = CQ.gChampions(g.members, true), theirs = CQ.gChampions(foe.members, false);
  const duels = ours.map((a, k) => { const b = theirs[k] || theirs[0]; const r = CQ.duel(a.ps, b.ps, 'war' + Date.now() + k); return { a: a.name, b: b.name, win: r.win }; });
  const wins = duels.filter((d) => d.win).length, win = wins >= 3;
  const loot = win ? Math.round(foe.treasury * 0.1 * (1 - Math.min(40, 2 * foe.b.treasury) / 100)) : 0;
  if (win) g.treasury += loot;
  const rec = { t: Date.now(), foe: `${foe.name} [${foe.tag}]`, win, wins, loot, duels, attack: true };
  g.wars.hist.unshift(rec); g.wars.hist.length = Math.min(g.wars.hist.length, 20);
  CQ.gLog(`Guerre contre ${foe.name} : ${win ? `victoire ${wins}-${5 - wins}, ${CQ.fmt(loot)} CQ pillés` : `défaite ${wins}-${5 - wins}`}.`);
  return rec;
};

// ---------- Territoires (saison mensuelle) ----------
CQ.gTerritories = () => {
  const g = CQ.guild(), mk = CQ.monthKey();
  if (!g) return [];
  if (g.terr.month !== mk) g.terr = { month: mk, pts: {} };
  const prog = CQ.periodProgress('monthly');
  return CQ.ZONES.map((z, zi) => {
    const rivals = CQ.GUILD_NAMES.map(([name, tag], i) => ({ name, tag, pts: Math.round(CQ.seeded(mk + tag + zi)() * 900 * (zi + 1) * prog * (CQ.botGuild(i).members.length / 15)) }))
      .filter((r) => r.tag !== g.tag);
    const us = { name: g.name, tag: g.tag, pts: g.terr.pts[zi] || 0, me: true };
    const all = rivals.concat([us]).sort((a, b) => b.pts - a.pts);
    return { z, zi, leader: all[0], us, second: all[1] };
  });
};
CQ.gHolds = (zi) => { const t = CQ.guild() ? CQ.gTerritories()[zi] : null; return !!(t && t.leader.me && t.us.pts > 0); };

// ---------- Quêtes de guilde (semaine) ----------
CQ.gQuests = () => {
  const g = CQ.guild(), wk = CQ.weekKey();
  if (!g) return null;
  if (!g.gq || g.gq.week !== wk) {
    const n = CQ.gMembers();
    g.gq = { week: wk, goals: { kills: 1500 * n, raid: 0.75, forge: 40 * n }, team: { kills: 0, forge: 0 }, mine: { kills: 0, raid: 0, forge: 0 }, claimed: false, forgeBase: CQ.gForgeCount() };
  }
  return g.gq;
};
CQ.gForgeCount = () => { const st = CQ.state.stats; return st.upgrades + st.crafts + st.fusions + (st.smelted || 0); };
CQ.gqProgress = () => {
  const q = CQ.gQuests(), r = CQ.gRaid();
  q.mine.forge = CQ.gForgeCount() - q.forgeBase;
  return { kills: Math.min(1, (q.team.kills + q.mine.kills) / q.goals.kills), raid: Math.min(1, r.dmg / r.max / q.goals.raid), forge: Math.min(1, (q.team.forge + q.mine.forge) / q.goals.forge) };
};
CQ.gqClaim = () => {
  const q = CQ.gQuests(), p = CQ.gqProgress();
  if (q.claimed || p.kills < 1 || p.raid < 1 || p.forge < 1) return false;
  q.claimed = true;
  CQ.mailAdd('Quêtes de guilde de la semaine accomplies', { cq: Math.round(5000 * (1 + CQ.state.level / 5)), honor: 60, chest: 'gold', cons: { sDrop2: 1, e3: 1 } }, CQ.guild().name);
  return true;
};

// ---------- Simulation heure par heure (membres, rivaux) ----------
CQ.guildTick = () => {
  const g = CQ.guild();
  if (!g) return;
  CQ.gRaid(); CQ.gQuests();
  const H = 3600000;
  let n = 0;
  while (Date.now() - g.simAt >= H && n++ < 24 * 7) {
    g.simAt += H;
    const t = g.simAt;
    for (const m of g.members) {
      const act = 0.6 + (CQ.hash(m.name + Math.floor(t / 86400000)) % 40) / 100; // présence du jour
      g.treasury += Math.round(m.level * 60 * act); m.contrib += Math.round(m.level * 60 * act);
      if (g.raid && g.raid.week === CQ.weekKey(new Date(t))) g.raid.dmg = Math.min(g.raid.max, g.raid.dmg + Math.round(m.level * 900 * act * (m.tier || 1.5)));
      if (g.gq) { g.gq.team.kills += Math.round(4 * act); if (Math.random() < 0.08) g.gq.team.forge++; }
      if (g.terr.month === CQ.monthKey(new Date(t))) { const zs = CQ.ZONES.map((z, i) => i).filter((i) => m.level >= CQ.ZONES[i].lvl); const z = zs[zs.length - 1] || 0; g.terr.pts[z] = (g.terr.pts[z] || 0) + Math.round(3 * act); }
      if (Math.random() < 0.002 && g.scrolls.length < 2 * CQ.gLvl('scriptorium')) g.scrolls.push(CQ.pick(Object.keys(CQ.GUILD.SCROLLS)));
    }
    if (g.myRank !== 'chef') {
      // les officiers simulés construisent et activent les parchemins
      const order = ['hall', 'treasury', 'scriptorium', 'sanctuary', 'forge', 'camp', 'cachots', 'infirmary', 'warroom', 'comptoir'];
      const b = order.find((k) => CQ.gLvl(k) < CQ.GUILD.maxLevel && g.treasury >= CQ.gCost(k) * 1.5);
      if (b) { g.treasury -= CQ.gCost(b); g.b[b]++; CQ.gLog(`${CQ.GUILD.B[b].name} passe au niveau ${g.b[b]} (officiers).`); }
      if (g.scrolls.length && !CQ.gActive() && Math.random() < 0.15 && g.treasury >= CQ.gScrollCost()) {
        const id = g.scrolls.shift(); g.treasury -= CQ.gScrollCost(); g.active = { id, until: t + H };
        CQ.gLog(`Parchemin de ${CQ.GUILD.SCROLLS[id].name} activé (officiers).`);
      }
      // promotion après une semaine de dons réguliers
      if (g.myRank === 'recrue' && t - g.joined > 3 * 86400000) { g.myRank = 'membre'; CQ.gLog(`${CQ.state.name} devient Membre.`); }
      if (g.myRank === 'membre' && g.myContrib > 50000 * (1 + CQ.state.level / 10)) { g.myRank = 'officier'; CQ.gLog(`${CQ.state.name} est promu Officier.`); CQ.toast('🏰 Vous êtes promu Officier de la guilde !', 'r4'); }
    }
    // recrues pour une guilde fondée par le joueur
    if (g.myRank === 'chef' && t >= g.recruitAt && g.members.length + 1 < CQ.gCap()) {
      const pool = CQ.BOT_NAMES.concat(CQ.EXTRA_NAMES).filter((x) => !g.members.some((m) => m.name === x));
      const m = { name: CQ.pick(pool), level: Math.max(10, CQ.state.level + CQ.randInt(-8, 4)), rank: 'recrue', contrib: 0, legion: Math.random() < 0.2, tier: 1 + Math.random() * 1.5 };
      g.members.push(m); g.recruitAt = t + (12 + Math.random() * 24) * H;
      CQ.gLog(`${m.name} (niveau ${m.level}) rejoint la guilde.`);
    }
    // une guilde rivale attaque parfois
    if (Math.random() < 1 / 60 && CQ.gLvl('warroom')) {
      const i = CQ.randInt(0, CQ.GUILD_NAMES.length - 1), foe = CQ.botGuild(i);
      if (foe.tag !== g.tag) {
        const ours = CQ.gChampions(g.members, true), theirs = CQ.gChampions(foe.members, false);
        const wins = ours.filter((a, k) => CQ.duel((theirs[k] || theirs[0]).ps, a.ps, 'def' + t + k).win === false).length;
        const lost = wins < 3 ? Math.round(g.treasury * 0.1 * (1 - Math.min(40, 2 * CQ.gLvl('treasury')) / 100)) : 0;
        g.treasury -= lost;
        g.wars.hist.unshift({ t, foe: `${foe.name} [${foe.tag}]`, win: wins >= 3, wins, loot: -lost, attack: false });
        g.wars.hist.length = Math.min(g.wars.hist.length, 20);
        CQ.gLog(`${foe.name} attaque la guilde : ${wins >= 3 ? 'attaque repoussée' : `${CQ.fmt(lost)} CQ pillés`}.`);
      }
    }
  }
};

// ---------- Effets de la guilde sur le héros ----------
(() => {
  const bv = CQ.buffVal;
  CQ.buffVal = (stat) => {
    let v = bv(stat);
    const sc = CQ.gActive(), pr = CQ.gPrayer();
    if (sc && sc.buff && sc.buff[stat]) v += sc.buff[stat];
    if (pr && pr.buff && pr.buff[stat]) v += pr.buff[stat];
    return v;
  };
  const stats = CQ.playerStats;
  CQ.playerStats = () => {
    const st = stats(), sc = CQ.gActive(), pr = CQ.gPrayer();
    if (sc && sc.fx) for (const [k, v] of Object.entries(sc.fx)) st.fx[k] = (st.fx[k] || 0) + v;
    if (pr && pr === CQ.GUILD.PRAYERS.souffle) { const v = Math.min(CQ.CAPS.eregen, st.eregen * 1.1); st.parts.eregen.other += v - st.eregen; st.eregen = v; }
    return st;
  };
  const disc = (name, b, per) => { const f = CQ[name]; CQ[name] = (...a) => Math.round(f(...a) * (1 - per * CQ.gLvl(b) / 100)); };
  disc('upgradeCost', 'forge', 1.5); disc('fusionCost', 'forge', 1.5); disc('craftCost', 'forge', 1.5); disc('trainCost', 'camp', 2);
  const rc = CQ.recipeCost;
  CQ.recipeCost = (...a) => { const c = rc(...a); c.cq = Math.round(c.cq * (1 - 1.5 * CQ.gLvl('forge') / 100)); return c; };
  Object.defineProperty(CQ.MKT, 'tax', { configurable: true, get: () => 0.05 * (1 - 0.025 * CQ.gLvl('comptoir')) });
  // territoires tenus : +5 % de dégâts et d'XP dans la zone (s'ajoute aux collections)
  const cb = CQ.collBonus;
  CQ.collBonus = (z) => cb(z) + (CQ.guild() && CQ.gHoldsCached(z) ? 5 : 0);
})();
// les territoires changent lentement : on garde le calcul une minute
CQ.gHoldsCached = (z) => {
  const now = Date.now();
  if (!CQ._holds || now - CQ._holds.t > 60000) CQ._holds = { t: now, v: CQ.gTerritories().map((x) => x.leader.me && x.us.pts > 0) };
  return CQ._holds.v[z];
};

/* =========================================================
   Page : Guilde
   ========================================================= */
P.guild = {
  title: 'Guilde',
  render() {
    const s = S(), g = CQ.guild();
    if (!g) return P.guild.none();
    CQ.guildTick();
    const tab = CQ.tabOf('guild', 'fort');
    return `<div class="guild-head"><span class="g-emblem">${g.emblem}</span><div style="min-width:0;flex:1"><div class="kicker">[${CQ.esc(g.tag)}] · ${CQ.gMembers()}/${CQ.gCap()} membres</div>
        <h2>${CQ.esc(g.name)}</h2><div class="small muted">Vous : ${CQ.RANKS[g.myRank]} · ${CQ.fmt(g.myContrib)} CQ donnés · puissance de guilde ${CQ.fmt(CQ.gPower(g))}</div></div>
        <div class="g-treasury"><div class="kicker">Trésor</div><div class="big c-cq">${CQ.fmt(g.treasury)}</div><div class="small dim">${2 * CQ.gLvl('treasury')} % protégé</div></div></div>
      ${CQ.tabs('guild', [['fort', '🏰 Fort'], ['members', '👥 Membres'], ['rites', '📚 Rituels'], ['raid', '🐉 Raid'], ['war', '⚔️ Guerre'], ['terr', '🗺️ Territoires'], ['rank', '🏆 Classement'], ['log', '📜 Journal']])}
      ${P.guild[tab]()}`;
  },
  none() {
    const s = S(), err = CQ.gCanJoin();
    const list = CQ.rivalGuilds().sort((a, b) => CQ.gPower(b) - CQ.gPower(a));
    return `<div class="grid g-side"><div class="card"><h3>Rejoindre une guilde</h3>
      ${list.map((g) => { const full = g.members.length + 1 > 6 + 3 * g.b.hall, avg = Math.round(g.members.reduce((a, m) => a + m.level, 0) / g.members.length);
        return `<div class="list-row"><span style="font-size:24px">${g.emblem}</span><div class="lr"><b>${g.name} [${g.tag}]</b><span>${g.members.length}/${6 + 3 * g.b.hall} membres · niveau moyen ${avg} · puissance ${CQ.fmt(CQ.gPower(g))}</span></div>
          <button class="btn sm" data-act="gJoin" data-arg="${g.i}" ${err || full ? 'disabled' : ''}>${full ? 'Complète' : 'Rejoindre'}</button></div>`; }).join('')}
      ${err ? `<div class="note mt">${err}</div>` : ''}</div>
      <div class="card gold"><h3>Fonder une guilde</h3>
        <div class="field"><label>Nom</label><input class="input" id="gName" maxlength="24" placeholder="Les Veilleurs d’Ombre"></div>
        <div class="field mt"><label>Sigle (2 à 4 lettres)</label><input class="input" id="gTag" maxlength="4" placeholder="VDO"></div>
        <div class="field mt"><label>Blason</label><div class="row wrap" style="gap:6px">${CQ.EMBLEMS.map((e, i) => `<button class="btn sm ${(CQ.ui.gEmb || 0) === i ? 'gold' : 'ghost'}" data-act="gEmb" data-arg="${i}">${e}</button>`).join('')}</div></div>
        <button class="btn primary block mt" data-act="gCreate" ${err ? 'disabled' : ''}>Fonder · ${CQ.money('cq', CQ.GUILD.cost)}</button>
        <div class="note mt">Fondateur, vous êtes chef : vous construisez, activez les parchemins et déclarez les guerres. Des recrues vous rejoignent au fil des jours.</div></div></div>
      <div class="note mt">Prototype : les autres membres et les guildes rivales sont simulés. Ils seront remplacés par de vrais joueurs avec le serveur.</div>`;
  },
  fort() {
    const g = CQ.guild(), staff = CQ.gIsStaff(), disc = CQ.gLegionDiscount();
    return `<div class="card mb row between wrap" style="gap:10px"><div class="field" style="margin:0;flex:1;min-width:220px"><label>Donner des CQ au trésor (solde ${CQ.fmt(S().cq)})</label>
        <div class="row"><input class="input" id="gGift" type="number" min="100" step="100" placeholder="Montant"><button class="btn gold" data-act="gDonate">Donner</button></div></div>
        <div class="small muted" style="max-width:340px">${disc ? `🦅 Légion : −${disc} % sur les bâtiments grâce aux Légionnaires de la guilde.` : 'Chaque membre Légion actif réduit le coût des bâtiments de 2 % (jusqu’à −20 %).'}</div></div>
      <div class="buildings">${Object.entries(CQ.GUILD.B).map(([k, b]) => {
        const l = CQ.gLvl(k), max = l >= CQ.GUILD.maxLevel, cost = CQ.gCost(k);
        return `<div class="building ${l ? '' : 'off'}"><div class="row" style="gap:10px"><span class="b-ico">${b.icon}</span><div style="min-width:0"><b>${b.name}</b> <span class="chip">${l}/${CQ.GUILD.maxLevel}</span>
          <div class="small muted">${l ? b.desc(l) : 'Pas encore construit'}</div>${max ? '' : `<div class="small dim">Niveau ${l + 1} : ${b.desc(l + 1)}</div>`}</div></div>
          ${max ? '<div class="chip gold mt">Niveau maximum</div>' : `<button class="btn sm block mt ${staff ? 'primary' : ''}" data-act="gUp" data-arg="${k}" ${staff && g.treasury >= cost ? '' : 'disabled'}>${l ? 'Améliorer' : 'Construire'} · ${CQ.fmt(cost)} CQ</button>`}</div>`;
      }).join('')}</div>
      ${staff ? '' : '<div class="note mt">Le chef et les officiers décident des constructions. Vos dons financent le trésor, et les dons réguliers mènent à la promotion.</div>'}
      <div class="row mt"><button class="btn ghost sm" data-act="gLeave">Quitter la guilde</button></div>`;
  },
  members() {
    const g = CQ.guild();
    const rows = [{ name: S().name, level: S().level, rank: g.myRank, contrib: g.myContrib, legion: CQ.isPremium(), me: true }].concat(g.members)
      .sort((a, b) => Object.keys(CQ.RANKS).indexOf(a.rank) - Object.keys(CQ.RANKS).indexOf(b.rank) || b.contrib - a.contrib);
    return `<div class="card"><h3>Membres<span class="right">${CQ.gMembers()}/${CQ.gCap()}</span></h3><div class="tbl-wrap"><table class="tbl"><tr><th>Membre</th><th>Rang</th><th class="r">Niveau</th><th class="r">Dons</th></tr>
      ${rows.map((m) => `<tr class="${m.me ? 'me' : ''}"><td>${CQ.esc(m.name)}${m.me ? ' (vous)' : ''}${m.legion ? ' <span class="legion-title">Légion</span>' : ''}</td><td>${CQ.RANKS[m.rank]}</td><td class="r">${m.level}</td><td class="r">${CQ.fmt(m.contrib)}</td></tr>`).join('')}
    </table></div></div>`;
  },
  rites() {
    const g = CQ.guild(), act = CQ.gActive(), pr = CQ.gPrayer(), staff = CQ.gIsStaff(), cap = 2 * CQ.gLvl('scriptorium');
    return `<div class="grid g2"><div class="card"><h3>📚 Scriptorium<span class="right">${g.scrolls.length}/${cap} parchemins</span></h3>
      ${act ? `<div class="chip green mb">${act.icon} ${act.name} actif pour toute la guilde · ${act.desc} · encore ${CQ.fmtDur(g.active.until - Date.now())}</div>` : ''}
      ${cap ? (g.scrolls.length ? g.scrolls.map((id, i) => { const sc = CQ.GUILD.SCROLLS[id]; return `<div class="list-row"><span style="font-size:22px">${sc.icon}</span><div class="lr"><b>${sc.name}</b><span>${sc.desc} · 1 h pour tous</span></div>
        <button class="btn sm gold" data-act="gActivate" data-arg="${i}" ${staff && g.treasury >= CQ.gScrollCost() ? '' : 'disabled'}>Activer · ${CQ.fmt(CQ.gScrollCost())} CQ</button></div>`; }).join('') : '<div class="empty">Aucun parchemin. Les membres en trouvent en combattant (les boss en lâchent plus souvent).</div>')
        : '<div class="empty">Construisez le Scriptorium pour stocker les parchemins trouvés.</div>'}</div>
      <div class="card"><h3>🕯️ Sanctuaire<span class="right">${CQ.gLvl('sanctuary') ? `prière de ${CQ.gLvl('sanctuary')} h` : 'non construit'}</span></h3>
      ${pr ? `<div class="chip green mb">${pr.icon} ${pr.name} · ${pr.desc} · encore ${CQ.fmtDur(g.prayer.until - Date.now())}</div>` : ''}
      ${Object.entries(CQ.GUILD.PRAYERS).map(([k, p]) => `<div class="list-row"><span style="font-size:22px">${p.icon}</span><div class="lr"><b>${p.name}</b><span>${p.desc}</span></div>
        <button class="btn sm" data-act="gPray" data-arg="${k}" ${CQ.gLvl('sanctuary') && !(g.prayer && g.prayer.day === CQ.dayKey()) ? '' : 'disabled'}>Prier</button></div>`).join('')}
      <div class="note mt">Une prière par jour, pour vous seul. Elle dure autant d’heures que le niveau du Sanctuaire.</div></div></div>
      <div class="card mt"><h3>⛓️ Cachots<span class="right">${CQ.gCaptives().length}/${CQ.gLvl('cachots')} boss</span></h3>
      ${CQ.gCaptives().length ? CQ.gCaptives().map((c) => { const z = CQ.ZONES[c.z]; return `<div class="list-row"><span style="font-size:22px">${z.boss[1]}</span><div class="lr"><b>${z.boss[0]}</b><span>${CQ.DMODES[c.mode].name} · étage ${c.floor} · capturé par ${CQ.esc(c.by)}${c.hp ? ' · déjà blessé' : ''}</span></div>
        <button class="btn sm primary" data-act="gCaptive" data-arg="${c.id}" ${S().level >= z.lvl && CQ.combat.mode === 'farm' ? '' : 'disabled'}>Affronter</button></div>`; }).join('')
        : `<div class="empty">${CQ.gLvl('cachots') ? 'Les boss vaincus aux étages 5 et 10 des donjons sont capturés et gardés ici.' : 'Construisez les Cachots pour garder les boss capturés en donjon.'}</div>`}
      <div class="note mt">Un boss captif se combat sans clé, avec votre énergie. S’il vous bat, il reste blessé et on peut revenir l’achever.</div></div>`;
  },
  raid() {
    const r = CQ.gRaid(), pct = 100 * r.dmg / r.max, en = Math.floor(CQ.energyNow());
    return `<div class="card raid"><div class="row" style="gap:16px"><span class="raid-ico">${r.icon}</span><div style="flex:1;min-width:0"><div class="kicker">Raid de la semaine · niveau ${r.lvl} · fin dans ${CQ.fmtDur(CQ.periodEnd('weekly') - Date.now())}</div>
      <h2 style="margin:4px 0">${r.name}</h2>${CQ.bar(100 - pct, 'hp big')}<div class="small muted mt">${CQ.fmt(r.max - r.dmg)} / ${CQ.fmt(r.max)} PV · ${pct.toFixed(1).replace('.', ',')} % infligés · vous : ${CQ.fmt(r.mine)} (${(100 * r.mine / Math.max(1, r.dmg)).toFixed(1).replace('.', ',')} % des dégâts)</div></div></div>
      <div class="row wrap mt" style="gap:8px">${[100, 250, 500].map((n) => `<button class="btn ${n === 250 ? 'primary' : ''}" data-act="gRaid" data-arg="${n}" ${en >= n ? '' : 'disabled'}>Attaquer · ${n} ⚡</button>`).join('')}<span class="small muted">≈ ${CQ.fmt(CQ.expectedHit(CQ.playerStats(), CQ.raidMonster(r)) * CQ.hitChance(CQ.playerStats(), CQ.raidMonster(r)) * 100)} dégâts pour 100 énergie</span></div></div>
      <div class="grid g4 mt">${CQ.GUILD.RAID_TIERS.map((t) => { const ok = pct >= t, got = r.claimed[t]; return `<div class="card ${ok ? 'gold' : ''}"><b>Palier ${t} %</b><div class="row wrap mt" style="gap:5px">${CQ.rewardHtml(Object.fromEntries(Object.entries(CQ.raidTierReward(t)).filter(([, v]) => v)))}</div>
        <button class="btn sm block mt ${ok && !got ? 'gold' : ''}" data-act="gRaidClaim" data-arg="${t}" ${ok && !got ? '' : 'disabled'}>${got ? 'Récupéré' : 'Récupérer'}</button></div>`; }).join('')}</div>
      <div class="note mt">Tous les membres frappent le même colosse avec leur énergie. Pour toucher les paliers, il faut avoir infligé au moins 1 % de ses PV.</div>
      ${P.guild.quests()}`;
  },
  quests() {
    const q = CQ.gQuests(), p = CQ.gqProgress();
    const rows = [['⚔️', `Vaincre ${CQ.fmt(q.goals.kills)} monstres`, p.kills, `vous : ${CQ.fmt(q.mine.kills)}`], ['🐉', `Infliger ${q.goals.raid * 100} % des PV du raid`, p.raid, `vous : ${CQ.fmt(q.mine.raid)}`], ['🔨', `Utiliser la forge ${CQ.fmt(q.goals.forge)} fois`, p.forge, `vous : ${q.mine.forge}`]];
    const all = p.kills >= 1 && p.raid >= 1 && p.forge >= 1;
    return `<div class="card mt"><h3>📜 Quêtes de guilde de la semaine</h3>${rows.map(([i, n, v, me]) => `<div class="quest ${v >= 1 ? 'done' : ''}"><span class="qi">${i}</span><div class="qb"><b>${n}</b>${CQ.bar(100 * v, 'gold')}</div><div class="qr"><div class="dim">${Math.round(100 * v)} %</div><div class="small dim">${me}</div></div></div>`).join('')}
      <button class="btn block mt ${all && !q.claimed ? 'gold' : ''}" data-act="gqClaim" ${all && !q.claimed ? '' : 'disabled'}>${q.claimed ? 'Récompense reçue' : 'Récompense commune : coffre d’Or, Honneur, CQ, parchemin'}</button></div>`;
  },
  war() {
    const g = CQ.guild(), left = CQ.gWarsLeft(), staff = CQ.gIsStaff();
    return `<div class="card mb"><h3>⚔️ Déclarer une guerre<span class="right">${CQ.gLvl('warroom') ? `${left} attaque${left > 1 ? 's' : ''} aujourd’hui` : 'Salle de guerre à construire'}</span></h3>
      ${CQ.rivalGuilds().map((f) => { const avg = Math.round(f.members.reduce((a, m) => a + m.level, 0) / f.members.length), ok = Math.abs(avg - S().level) <= 15;
        return `<div class="list-row"><span style="font-size:24px">${f.emblem}</span><div class="lr"><b>${f.name} [${f.tag}]</b><span>niveau moyen ${avg} · trésor ≈ ${CQ.fmt(f.treasury)} CQ (${Math.min(40, 2 * f.b.treasury)} % protégé)</span></div>
          <button class="btn sm primary" data-act="gWar" data-arg="${f.i}" ${staff && left > 0 && ok ? '' : 'disabled'} title="${ok ? '' : 'Écart de niveau trop grand'}">Attaquer</button></div>`; }).join('')}
      <div class="note mt">Une guerre oppose vos 5 meilleurs combattants (vous compris) aux 5 meilleurs de l’autre guilde, en duels. 3 victoires sur 5 : vous pillez 10 % de leur trésor non protégé. Les guildes rivales attaquent aussi : la Trésorerie protège une part du trésor.</div></div>
      <div class="card"><h3>Historique</h3>${g.wars.hist.length ? g.wars.hist.map((h) => `<div class="list-row"><span style="font-size:20px">${h.attack ? '⚔️' : '🛡️'}</span><div class="lr"><b>${h.attack ? 'Attaque contre' : 'Défense contre'} ${CQ.esc(h.foe)}</b>
        <span>${CQ.fmtDate(h.t)} · <span class="${h.win ? 'c-green' : 'c-fp'}">${h.win ? 'victoire' : 'défaite'} ${h.wins}-${5 - h.wins}</span>${h.loot ? ` · ${h.loot > 0 ? '+' : '−'}${CQ.fmt(Math.abs(h.loot))} CQ` : ''}</span>
        ${h.duels ? `<span class="small dim">${h.duels.map((d) => `${CQ.esc(d.a)} ${d.win ? '✔' : '✘'} ${CQ.esc(d.b)}`).join(' · ')}</span>` : ''}</div></div>`).join('') : '<div class="empty">Aucune guerre pour l’instant.</div>'}</div>`;
  },
  terr() {
    const t = CQ.gTerritories(), s = S();
    return `<div class="card"><h3>🗺️ Territoires · saison de ${new Date().toLocaleDateString('fr-FR', { month: 'long' })}<span class="right">fin dans ${CQ.fmtDur(CQ.periodEnd('monthly') - Date.now())}</span></h3>
      ${t.map((x) => `<div class="list-row"><span style="font-size:22px">${x.z.icon}</span><div class="lr"><b>${x.z.name}</b><span>Gardien : ${x.leader.me ? `<b class="c-green">${CQ.esc(x.leader.name)} (vous)</b>` : CQ.esc(x.leader.name)} · ${CQ.fmt(x.leader.pts)} points · votre guilde : ${CQ.fmt(x.us.pts)}${x.leader.me && x.second ? ` · 2e : ${CQ.esc(x.second.name)} (${CQ.fmt(x.second.pts)})` : ''}</span></div>
        ${x.leader.me && x.us.pts ? '<span class="chip green">+5 %</span>' : s.level >= x.z.lvl ? '' : `<span class="chip">niv. ${x.z.lvl}</span>`}</div>`).join('')}
      <div class="note mt">Chaque victoire d’un membre dans une zone rapporte 1 point à la guilde. La guilde gardienne d’une zone donne à ses membres +5 % de dégâts et d’XP dans cette zone. Les points repartent à zéro chaque mois.</div></div>`;
  },
  rank() {
    const g = CQ.guild(), rows = CQ.rivalGuilds().concat([g]).map((x) => ({ x, p: CQ.gPower(x) })).sort((a, b) => b.p - a.p);
    return `<div class="card"><h3>🏆 Classement des guildes</h3><div class="tbl-wrap"><table class="tbl"><tr><th>Rang</th><th>Guilde</th><th class="r">Membres</th><th class="r">Puissance</th></tr>
      ${rows.map(({ x, p }, i) => `<tr class="${x === g ? 'me' : ''}"><td><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span></td><td>${x.emblem} ${CQ.esc(x.name)} [${CQ.esc(x.tag)}]</td><td class="r">${x.members.length + (x === g ? 1 : 0)}</td><td class="r">${CQ.fmt(p)}</td></tr>`).join('')}
    </table></div><div class="small dim mt">Puissance = niveaux des bâtiments et des membres.</div></div>`;
  },
  log() {
    const g = CQ.guild();
    return `<div class="card"><h3>📜 Journal</h3>${g.log.map((l) => `<div class="list-row"><div class="lr"><span>${CQ.fmtDate(l.t)}</span><b style="font-weight:500">${CQ.esc(l.txt)}</b></div></div>`).join('') || '<div class="empty">Rien pour l’instant.</div>'}</div>`;
  },
};
A.gEmb = (i) => { CQ.ui.gEmb = Number(i); CQ.refresh(); };
A.gCreate = () => {
  const name = CQ.$('#gName').value, tag = CQ.$('#gTag').value;
  if (CQ.gCreate(name, tag, CQ.EMBLEMS[CQ.ui.gEmb || 0])) { CQ.sfx('win'); CQ.toast('🏰 Guilde fondée !', 'r4'); CQ.save(); CQ.refresh(); }
};
A.gJoin = (i) => { if (CQ.gJoin(Number(i))) { CQ.sfx('win'); CQ.toast('🏰 Bienvenue dans la guilde !', 'r4'); CQ.save(); CQ.refresh(); } };
A.gLeave = () => CQ.confirm('Quitter la guilde ?', 'Vous perdez votre rang et vos dons restent au trésor. Il faudra attendre 24 h avant de rejoindre une autre guilde.', 'Quitter', () => { CQ.gLeave(); CQ.save(); CQ.refresh(); }, true);
A.gDonate = () => { if (CQ.gDonate(Number(CQ.$('#gGift').value))) { CQ.sfx('coin'); CQ.save(); CQ.refresh(); } };
A.gUp = (b) => { if (CQ.gUpgrade(b)) { CQ.sfx('level'); CQ.save(); CQ.refresh(); } };
A.gActivate = (i) => { if (CQ.gActivate(Number(i))) { CQ.sfx('loot'); CQ.save(); CQ.refresh(); } };
A.gPray = (id) => { if (CQ.gPray(id)) { CQ.sfx('coin'); CQ.toast(`🕯️ Prière : ${CQ.GUILD.PRAYERS[id].desc}`, 'green'); CQ.save(); CQ.refresh(); } };
A.gCaptive = (id) => { if (CQ.gFightCaptive(id)) { CQ.save(); CQ.go('combat'); } };
A.gRaid = (n) => { const d = CQ.gRaidAttack(Number(n)); if (d) { CQ.sfx('crit'); CQ.toast(`🐉 ${CQ.fmt(d)} dégâts au colosse`, 'green'); CQ.save(); CQ.refresh(); } };
A.gRaidClaim = (t) => { if (CQ.gRaidClaim(Number(t))) { CQ.sfx('loot'); CQ.toast(`🐉 Palier ${t} % récupéré`, 'r4'); CQ.save(); CQ.refresh(); } };
A.gqClaim = () => { if (CQ.gqClaim()) { CQ.sfx('win'); CQ.toast('📜 Récompense de guilde dans la boîte aux lettres', 'r4'); CQ.save(); CQ.refresh(); } };
A.gWar = (i) => {
  const r = CQ.gWar(Number(i));
  if (!r) return;
  CQ.sfx(r.win ? 'win' : 'lose'); CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>${r.win ? 'Victoire' : 'Défaite'} contre ${CQ.esc(r.foe)}</h2><div class="kv">${r.duels.map((d) => `<span>${CQ.esc(d.a)} contre ${CQ.esc(d.b)}</span><span class="${d.win ? 'c-green' : 'c-fp'}">${d.win ? 'victoire' : 'défaite'}</span>`).join('')}</div>
    <div class="result ${r.win ? 'win' : 'lose'} mt">${r.wins} – ${5 - r.wins}${r.loot ? ` · ${CQ.fmt(r.loot)} CQ pillés` : ''}</div><div class="actions"><button class="btn primary" data-act="closeModal">Continuer</button></div>`);
};
