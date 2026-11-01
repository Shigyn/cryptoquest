'use strict';
// V3-3 — Clés et donjons à étages, collections (bestiaire à paliers), quêtes du Panthéon.

// ---------- Clés de donjon : second compteur de temps ----------
CQ.KEYS = { max: 6, legion: 8, ms: 4 * 3600000 };
CQ.keysMax = () => (CQ.isPremium() ? CQ.KEYS.legion : CQ.KEYS.max);
CQ.keysNow = () => {
  const k = CQ.state.keys, now = Date.now(), max = CQ.keysMax();
  if (k.v >= max) { k.at = now; return k.v; }
  const n = Math.floor((now - k.at) / CQ.KEYS.ms);
  if (n > 0) { k.v = Math.min(max, k.v + n); k.at = k.v >= max ? now : k.at + n * CQ.KEYS.ms; }
  return k.v;
};
CQ.keysNextIn = () => (CQ.keysNow() >= CQ.keysMax() ? 0 : CQ.state.keys.at + CQ.KEYS.ms - Date.now());

// ---------- Donjons à étages ----------
// Normal : 5 étages de 2 élites + un boss au 5e. Héroïque (après le Normal) : 10 étages de 3 élites, boss aux 5e et 10e.
CQ.DMODES = {
  normal: { name: 'Normal', floors: 5, per: 2, mult: 1, lvl: 0 },
  hero: { name: 'Héroïque', floors: 10, per: 3, mult: 1.3, lvl: 3 },
};
CQ.dungeonOf = (z) => { const d = CQ.state.dungeons; return d[z] || (d[z] = { normal: 0, hero: 0, clears: 0 }); };
CQ.dungeonOpen = (z, mode) => mode === 'normal' || CQ.dungeonOf(z).normal >= CQ.DMODES.normal.floors;
CQ.startDungeon = (mode = 'normal') => {
  const c = CQ.combat, D = CQ.DMODES[mode];
  if (c.mode !== 'farm' || c.deadUntil) return;
  if (!CQ.dungeonOpen(c.zone, mode)) { CQ.toast('Terminez d’abord le donjon en Normal.', 'red'); return; }
  if (CQ.keysNow() < 1) { CQ.toast(`Plus de clé de donjon (1 toutes les 4 h).`, 'red'); return; }
  const k = CQ.state.keys;
  if (k.v >= CQ.keysMax()) k.at = Date.now();
  k.v--;
  c.queue = [];
  for (let f = 1; f <= D.floors; f++) {
    for (let i = 0; i < D.per; i++) c.queue.push({ idx: CQ.randInt(0, 2), kind: 'elite', floor: f });
    if (f % 5 === 0) c.queue.push({ idx: 0, kind: 'dboss', floor: f });
  }
  c.mode = 'dungeon'; c.dmode = mode; c.floors = D.floors; c.floor = 1;
  c.wave = 0; c.waves = c.queue.length;
  c.php = CQ.playerStats().maxHp;
  CQ.addLog(`🗝️ Vous entrez dans <b>${CQ.ZONES[c.zone].dungeon}</b> (${D.name}). ${D.floors} étages, aucun soin complet entre les combats.`);
  CQ.spawn();
};
// monstre d'étage : plus fort à chaque étage, et en Héroïque
CQ.floorMonster = (z, q) => {
  const D = CQ.DMODES[CQ.combat.dmode || 'normal'], m = CQ.makeMonster(z, q.idx, q.kind);
  const sc = D.mult * (1 + 0.06 * (q.floor - 1));
  m.max = m.hp = Math.round(m.max * sc); m.atk *= sc; m.def *= sc;
  m.lvl += D.lvl + Math.floor((q.floor - 1) / 2);
  m.floor = q.floor;
  return m;
};
(() => {
  const spawn = CQ.spawn;
  CQ.spawn = () => {
    const c = CQ.combat;
    if (c.mode !== 'dungeon') return spawn();
    const next = c.queue.shift();
    if (!next) return CQ.dungeonWin();
    c.wave++; c.floor = next.floor;
    c.m = CQ.floorMonster(c.zone, next);
    c.mT = 0; c.undyingUsed = false;
    CQ.emit('spawn');
  };
  const onKill = CQ.onKill;
  CQ.onKill = (m, ps) => {
    const c = CQ.combat, inDungeon = c.mode === 'dungeon';
    onKill(m, ps);
    if (inDungeon && c.mode === 'dungeon' && (!c.queue.length || c.queue[0].floor !== m.floor)) CQ.floorCleared(m.floor);
  };
})();
CQ.floorCleared = (f) => {
  const c = CQ.combat, s = CQ.state, z = c.zone, mode = c.dmode, d = CQ.dungeonOf(z);
  d[mode] = Math.max(d[mode], f);
  s.stats.floors = (s.stats.floors || 0) + 1;
  // butin d'étage : matériaux de qualité croissante, CQ, quelques FP
  const q = Math.min(4, Math.floor(f / 3) + (mode === 'hero' ? 1 : 0) + (z >= 5 ? 1 : 0));
  const m = CQ.pick(Object.keys(CQ.MATS)), n = 3 + f + z;
  CQ.matAdd(m, q, n);
  const fp = Math.round((1 + z) * (mode === 'hero' ? 3 : 2));
  CQ.gain('fp', fp, '', true);
  CQ.addLog(`🗝️ Étage ${f} terminé · ${CQ.matLabel(m, q)} × ${n} · <span class="c-fp">+${fp} FP</span>`);
  if (f % 5 === 0) {
    s.captured = (s.captured || []).concat([{ z, mode, floor: f, at: Date.now() }]).slice(-20); // pour les cachots de guilde
  }
};
CQ.dungeonWin = () => {
  const c = CQ.combat, s = CQ.state, z = c.zone, hero = c.dmode === 'hero';
  const chest = hero ? (z >= 4 ? 'mythic' : 'gold') : z <= 1 ? 'silver' : 'gold';
  s.chests[chest]++;
  const fp = 40 * (z + 1) * (hero ? 2 : 1);
  CQ.gain('fp', fp, `Donjon terminé : ${CQ.ZONES[z].dungeon} (${CQ.DMODES[c.dmode].name})`);
  if (Math.random() < (hero ? 0.6 : 0.25)) { const it = CQ.makeSetPiece(CQ.zoneSet(z), CQ.ZONES[z].lvl + 6, CQ.playerStats().luck); CQ.addItem(it, 'drop'); }
  s.stats.dungeons++;
  CQ.dungeonOf(z).clears++;
  CQ.addLog(`🏰 Donjon terminé ! <b>${CQ.CHESTS[chest].name}</b> + ${fp} FP`);
  CQ.toast(`🏰 ${CQ.ZONES[z].dungeon} (${CQ.DMODES[c.dmode].name}) terminé : ${CQ.CHESTS[chest].name} et ${fp} FP`, 'r4');
  c.mode = 'farm';
  CQ.spawn();
};
CQ.dungeonEnergy = (z, ps = CQ.playerStats(), mode = 'normal') => {
  const D = CQ.DMODES[mode], dm = CQ.combat.dmode;
  CQ.combat.dmode = mode;
  let n = 0;
  for (let f = 1; f <= D.floors; f++) {
    n += D.per * CQ.attacksToKill(ps, CQ.floorMonster(z, { idx: 1, kind: 'elite', floor: f }));
    if (f % 5 === 0) n += CQ.attacksToKill(ps, CQ.floorMonster(z, { idx: 0, kind: 'dboss', floor: f }));
  }
  CQ.combat.dmode = dm;
  return Math.ceil(n);
};

// ---------- Collections : le bestiaire donne des bonus permanents ----------
CQ.COLL_TIERS = [1000, 5000, 25000];
CQ.zoneKillsTotal = (z) => [0, 1, 2, 'b'].reduce((a, i) => a + (CQ.state.bestiary[`${z}-${i}`] || 0), 0);
CQ.collTier = (z) => CQ.COLL_TIERS.filter((t) => CQ.zoneKillsTotal(z) >= t).length;
CQ.collBonus = (z) => CQ.collTier(z); // +1 % de dégâts et d'XP par palier, dans cette zone

// ---------- Quêtes du Panthéon ----------
// 8 emplacements. Une quête récupérée laisse sa place vide 30 min. La progression se mesure par rapport
// à un compteur relevé à la création de la quête (pas besoin de brancher chaque action).
CQ.PANTHEON = { slots: 8, refill: 30 * 60000 };
CQ.PQ = {
  kills: { icon: '⚔️', name: (g) => `Vaincre ${g} monstres`, count: (s) => s.stats.kills, goal: () => CQ.randInt(4, 12) * 10, w: 3 },
  zone: { icon: '🗺️', name: (g, q) => `Vaincre ${g} monstres : ${CQ.ZONES[q.z].name}`, count: (s, q) => CQ.zoneKillsTotal(q.z), goal: () => CQ.randInt(3, 8) * 10, w: 3 },
  boss: { icon: '👑', name: (g) => `Vaincre ${g} boss`, count: (s) => s.stats.bosses, goal: () => CQ.randInt(1, 2), w: 1 },
  floors: { icon: '🗝️', name: (g) => `Terminer ${g} étages de donjon`, count: (s) => s.stats.floors || 0, goal: () => CQ.randInt(3, 6), w: 2 },
  forge: { icon: '🔨', name: (g) => `Utiliser la forge ${g} fois`, count: (s) => s.stats.upgrades + s.stats.crafts + s.stats.fusions + (s.stats.smelted || 0), goal: () => CQ.randInt(2, 5), w: 2 },
  smelt: { icon: '🔥', name: (g) => `Fondre ${g} objets`, count: (s) => s.stats.smelted || 0, goal: () => CQ.randInt(5, 15), w: 1 },
  energy: { icon: '⚡', name: (g) => `Dépenser ${g} énergie`, count: (s) => s.stats.energySpent || 0, goal: () => CQ.randInt(3, 8) * 100, w: 2 },
  arena: { icon: '🏟️', name: (g) => `Gagner ${g} combats d’arène`, count: (s) => s.arena.wins, goal: () => CQ.randInt(2, 3), w: 1, min: 10 },
  chests: { icon: '📦', name: (g) => `Ouvrir ${g} coffres`, count: (s) => s.stats.chests, goal: () => CQ.randInt(1, 3), w: 1 },
};
CQ.pqNew = () => {
  const s = CQ.state, types = Object.keys(CQ.PQ).filter((t) => !CQ.PQ[t].min || s.level >= CQ.PQ[t].min);
  const t = types[CQ.pickWeighted(types.map((x) => CQ.PQ[x].w))], d = CQ.PQ[t];
  const unlocked = CQ.ZONES.map((z, i) => i).filter((i) => s.level >= CQ.ZONES[i].lvl);
  const q = { t, z: unlocked[Math.max(0, unlocked.length - 1 - CQ.randInt(0, 1))] || 0, goal: d.goal(), at: Date.now() };
  q.base = d.count(s, q);
  // récompense : CQ selon le niveau, plus un bonus tiré au sort
  const L = s.level, diff = 1 + (d.w === 1 ? 0.6 : 0);
  q.reward = { cq: Math.round(300 * (1 + L / 5) * diff) };
  const r = Math.random();
  if (r < 0.05) q.reward.gems = CQ.randInt(5, 10);
  else if (r < 0.3) q.reward.fp = CQ.randInt(10, 30);
  else if (r < 0.5 && L >= 10) q.reward.honor = CQ.randInt(20, 40);
  else if (r < 0.75) q.reward.cons = { [CQ.pick(Object.keys(CQ.CONSUMABLES))]: 1 };
  else q.mat = [CQ.pick(Object.keys(CQ.MATS)), Math.min(4, Math.floor(L / 25)), 4 + Math.floor(L / 8)];
  return q;
};
CQ.pantheon = () => {
  const p = CQ.state.pantheon, now = Date.now();
  while (p.slots.length < CQ.PANTHEON.slots) p.slots.push(null);
  p.slots = p.slots.map((q) => (!q ? CQ.pqNew() : q.refillAt ? (now >= q.refillAt ? CQ.pqNew() : q) : q));
  return p.slots;
};
CQ.pqProgress = (q) => Math.min(q.goal, Math.max(0, CQ.PQ[q.t].count(CQ.state, q) - q.base));
CQ.pqClaim = (i) => {
  const p = CQ.state.pantheon, q = p.slots[i];
  if (!q || q.refillAt || CQ.pqProgress(q) < q.goal) return false;
  CQ.grant(q.reward, `Panthéon : ${CQ.PQ[q.t].name(q.goal, q)}`);
  if (q.mat) CQ.matAdd(q.mat[0], q.mat[1], q.mat[2]);
  p.done = (p.done || 0) + 1;
  p.slots[i] = { refillAt: Date.now() + CQ.PANTHEON.refill };
  return true;
};
CQ.pqClaimable = () => CQ.pantheon().some((q) => q && !q.refillAt && CQ.pqProgress(q) >= q.goal);

/* =========================================================
   Interface
   ========================================================= */
// onglet Panthéon des Quêtes
P.quests.pantheon = () => {
  const slots = CQ.pantheon();
  return `<div class="grid g2">${slots.map((q, i) => {
    if (q.refillAt) return `<div class="quest pq empty"><span class="qi">⏳</span><div class="qb"><b>Nouvelle quête</b><div class="small muted">dans <span class="tnum" data-refill="${q.refillAt}">${CQ.fmtDur(q.refillAt - Date.now())}</span></div></div></div>`;
    const d = CQ.PQ[q.t], p = CQ.pqProgress(q), ok = p >= q.goal;
    const rew = CQ.rewardHtml(q.reward) + (q.mat ? ' ' + CQ.matLabel(q.mat[0], q.mat[1]) + ' × ' + q.mat[2] : '');
    return `<div class="quest pq ${ok ? 'ready' : ''}" style="margin:0"><span class="qi">${d.icon}</span><div class="qb"><b>${d.name(q.goal, q)}</b>${CQ.bar(100 * p / q.goal, 'gold')}<div class="row wrap" style="gap:5px;margin-top:5px">${rew}</div></div>
      <div class="qr"><div class="dim">${CQ.fmt(p)}/${CQ.fmt(q.goal)}</div></div>
      <button class="btn sm ${ok ? 'gold' : ''}" data-act="pqClaim" data-arg="${i}" ${ok ? '' : 'disabled'}>Récupérer</button></div>`;
  }).join('')}</div>
  <div class="note mt">Le tableau du Panthéon se renouvelle : chaque quête récupérée est remplacée 30 minutes plus tard. ${CQ.state.pantheon.done || 0} quête${(CQ.state.pantheon.done || 0) > 1 ? 's' : ''} accomplie${(CQ.state.pantheon.done || 0) > 1 ? 's' : ''} depuis le début.</div>`;
};
A.pqClaim = (i) => { if (CQ.pqClaim(Number(i))) { CQ.sfx('coin'); CQ.toast('🏛️ Quête du Panthéon accomplie !', 'green'); CQ.save(); CQ.refresh(); } };
(() => {
  const t = P.quests.tick;
  P.quests.tick = () => {
    if (t) t();
    for (const el of document.querySelectorAll('[data-refill]')) {
      const left = Number(el.dataset.refill) - Date.now();
      if (left <= 0) { CQ.refresh(); return; }
      el.textContent = CQ.fmtDur(left);
    }
  };
  // collections dans le bestiaire
  const b = P.quests.bestiary;
  P.quests.bestiary = () => {
    const coll = CQ.ZONES.map((z, i) => {
      const n = CQ.zoneKillsTotal(i), t = CQ.collTier(i), next = CQ.COLL_TIERS[t];
      return `<div class="list-row"><span style="font-size:22px">${z.icon}</span><div class="lr"><b>${z.name}</b><span>${CQ.fmt(n)} victoires · palier ${t}/3${t ? ` · +${t} % de dégâts et d’XP dans la zone` : ''}</span>
        ${next ? `<div class="mt" style="margin-top:5px">${CQ.bar(100 * n / next, 'gold')}</div><span>prochain palier à ${CQ.fmt(next)}</span>` : '<span class="c-cq">Collection complète</span>'}</div></div>`;
    }).join('');
    return `<div class="card mb"><h3>📚 Collections<span class="right">paliers à ${CQ.COLL_TIERS.map(CQ.fmt).join(' · ')} victoires</span></h3>${coll}</div>` + b();
  };
})();
