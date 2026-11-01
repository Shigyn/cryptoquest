'use strict';
// Moteur : statistiques, objets, combat, coffres, forge, faucet, staking, pool, classements, quêtes.

// ---------- Personnage ----------
// Courbe calée sur l'énergie : ≈ 75 × niv^1.45 énergie par niveau au rendement d'un héros de référence
// (≈ 25 + 10 × niv de dégâts par coup). Simulé le 01/11 avec ~2 850 énergie par jour (recharge + connexion + quête) :
// niv. 6 à J1, 14 à J7, 28 à J30 ; joueur assidu (+ vidéos, fioles) 16 à J7, 32 à J30.
CQ.XP_PER_HP = 0.3;
CQ.CQ_PER_HP = 0.1;
CQ.xpNeed = (lvl) => Math.round(75 * Math.pow(lvl, 1.45) * CQ.XP_PER_HP * (25 + 10 * lvl));

CQ.itemById = (id) => CQ.state.inventory.find((i) => i.id === id);
CQ.isEquipped = (it) => CQ.state.equipped[it.slot] === it.id;

CQ.itemStats = (it) => {
  const out = {};
  const m = 1 + 0.1 * it.plus;
  for (const r of it.rolls) out[r.k] = (out[r.k] || 0) + r.v * m;
  return out;
};
CQ.statPower = (k, v) => v * (CQ.STATS[k] ? CQ.STATS[k].w : 1);
CQ.itemPower = (it) => Math.round(Object.entries(CQ.itemStats(it)).reduce((a, [k, v]) => a + CQ.statPower(k, v), 0));

CQ.stakeWeight = () => CQ.state.stakes.reduce((a, st) => a + st.amount * st.mult, 0);
CQ.stakeBonus = () => { const w = CQ.stakeWeight(); return w <= 0 ? 0 : Math.min(60, Math.round(9 * Math.log10(1 + w / 50) * 10) / 10); };

CQ.buffVal = (stat) => {
  const b = CQ.state.buffs[stat];
  return (b && b.until > Date.now() ? b.val : 0) + (CQ.eventBonus ? CQ.eventBonus(stat) : 0); // + événement du jour
};

// ---------- Attributs et talents ----------
CQ.attrPoints = () => {
  const s = CQ.state;
  const total = CQ.ATTR_PER_LEVEL * s.level;
  const spent = CQ.ATTRS.reduce((a, x) => a + s.attrs[x.id] - CQ.ATTR_START, 0);
  return { total, spent, free: total - spent };
};
CQ.allocateAttrs = (add) => {
  const n = Object.values(add).reduce((a, b) => a + b, 0);
  if (n <= 0 || n > CQ.attrPoints().free) return false;
  const cap = CQ.attrCap(CQ.state.level);
  if (Object.entries(add).some(([k, v]) => CQ.state.attrs[k] + v > cap)) { CQ.toast(`${cap} points au maximum dans un même attribut à ce niveau.`, 'red'); return false; }
  CQ.energySync();
  for (const [k, v] of Object.entries(add)) CQ.state.attrs[k] += v;
  return true;
};
CQ.respecAttrs = () => {
  const s = CQ.state, cost = CQ.attrRespecCost(s.respecs.attrs);
  if (cost && !CQ.pay({ cq: cost }, 'Réinitialisation des attributs')) return false;
  CQ.energySync();
  for (const a of CQ.ATTRS) s.attrs[a.id] = CQ.ATTR_START;
  s.respecs.attrs++;
  return true;
};

// entraînement : +1 point d'attribut contre des CQ, coût croissant, plafonné par niveau (puits de CQ sans fond)
CQ.trained = (id) => (CQ.state.train && CQ.state.train[id]) || 0;
CQ.trainNext = (id) => (CQ.trained(id) >= CQ.trainCap(CQ.state.level) ? 0 : CQ.trainCost(CQ.trained(id)));
CQ.train = (id) => {
  const s = CQ.state, cost = CQ.trainNext(id);
  if (!cost) { CQ.toast(`Entraînement au maximum pour votre niveau (${CQ.trainCap(s.level)}).`, 'red'); return false; }
  const name = CQ.ATTRS.find((a) => a.id === id).name;
  if (!CQ.pay({ cq: cost }, `Entraînement : ${name} ${CQ.trained(id) + 1}`)) return false;
  CQ.energySync();
  s.train[id] = CQ.trained(id) + 1;
  s.stats.trainSpent = (s.stats.trainSpent || 0) + cost;
  return true;
};

CQ.talentPoints = () => {
  const s = CQ.state;
  const total = Math.max(0, s.level - CQ.TALENT_START + 1);
  const spent = Object.values(s.talents).reduce((a, b) => a + b, 0);
  return { total, spent, free: total - spent };
};
CQ.branchSpent = (b) => CQ.TALENT_BRANCHES.find((x) => x.id === b).talents.reduce((a, t) => a + (CQ.state.talents[t.id] || 0), 0);
// raison du blocage, ou '' si le talent peut être appris
CQ.talentBlock = (id) => {
  const t = CQ.TALENTS[id], r = CQ.state.talents[id] || 0, spent = CQ.branchSpent(t.branch);
  if (r >= t.max) return 'Rang maximum';
  if (t.ult && spent < CQ.TALENT_ULT) return `${CQ.TALENT_ULT} points dans la branche requis (${spent})`;
  if (t.gate && spent < CQ.TALENT_GATE) return `${CQ.TALENT_GATE} points dans la branche requis (${spent})`;
  if (CQ.talentPoints().free < 1) return 'Aucun point disponible';
  return '';
};
CQ.learnTalent = (id) => {
  if (CQ.talentBlock(id)) return false;
  CQ.energySync();
  CQ.state.talents[id] = (CQ.state.talents[id] || 0) + 1;
  return true;
};
CQ.respecTalents = () => {
  const s = CQ.state;
  if (!CQ.pay({ fp: CQ.talentRespecCost(s.respecs.talents) }, 'Réinitialisation des talents')) return false;
  CQ.energySync();
  s.talents = {};
  s.respecs.talents++;
  return true;
};
CQ.addFx = (fx, add, mult = 1) => { for (const [k, v] of Object.entries(add)) fx[k] = (fx[k] || 0) + v * mult; return fx; };
CQ.talentFx = (talents = CQ.state.talents) => {
  const fx = {};
  for (const [id, r] of Object.entries(talents)) {
    const t = CQ.TALENTS[id];
    if (t && r) CQ.addFx(fx, t.fx, r);
  }
  return fx;
};
// pièces d'ensemble portées : { idEnsemble: nombre }
CQ.setCounts = (items) => {
  const n = {};
  for (const it of items) if (it.set) n[it.set] = (n[it.set] || 0) + 1;
  return n;
};
CQ.setFx = (items) => {
  const fx = {};
  for (const [id, n] of Object.entries(CQ.setCounts(items))) {
    const set = CQ.SETS[id];
    if (!set) continue;
    if (n >= 2) CQ.addFx(fx, set.b2);
    if (n >= 3) CQ.addFx(fx, set.b3);
  }
  return fx;
};

// ---------- Statistiques d'un héros ----------
// Chaque stat = base + attributs + équipement + autres (staking, élixirs) + talents et ensembles, puis plafond.
// parts garde le détail par source pour l'écran Héros.
// statsFor sert aussi aux adversaires de l'arène : h = { level, attrs, talents, items, stake, buff }.
CQ.ROUND_STATS = ['atk', 'def', 'hp', 'emax'];
CQ.equippedItems = () => Object.values(CQ.state.equipped).map((id) => id && CQ.itemById(id)).filter(Boolean);
// attributs effectifs = points répartis + points entraînés
CQ.effAttrs = (s = CQ.state) => { const a = {}; for (const x of CQ.ATTRS) a[x.id] = s.attrs[x.id] + ((s.train && s.train[x.id]) || 0); return a; };
CQ.uniqueFx = (items) => { const fx = {}; for (const it of items) if (it.unique && CQ.UNIQUES[it.unique]) CQ.addFx(fx, CQ.UNIQUES[it.unique].fx); return fx; };
CQ.playerStats = () => {
  const s = CQ.state;
  return CQ.statsFor({ level: s.level, attrs: CQ.effAttrs(s), talents: s.talents, items: CQ.equippedItems(), stake: CQ.stakeBonus(),
    buff: { fp: CQ.buffVal('fp'), xp: CQ.buffVal('xp'), luck: CQ.buffVal('luck') } });
};
CQ.statsFor = (h) => {
  const L = h.level, fx = CQ.addFx(CQ.addFx(CQ.talentFx(h.talents || {}), CQ.setFx(h.items)), CQ.uniqueFx(h.items));
  const g = {}, A = {};
  for (const k of CQ.STAT_KEYS) { g[k] = 0; A[k] = 0; }
  for (const it of h.items) for (const [k, v] of Object.entries(CQ.itemStats(it))) if (k in g) g[k] += v;
  for (const a of CQ.ATTRS) for (const [k, v] of Object.entries(a.per)) A[k] += h.attrs[a.id] * v;
  const sb = h.stake || 0, bf = h.buff || {};
  const base = { atk: 10 + L * 3, def: 3 + L * 1.5, hp: 100 + (L - 1) * 18, hit: 90, dodge: 3, crit: 5, parry: 0, resil: 0, critd: 150, spd: 0, pen: 0,
    emax: CQ.ENERGY.max, eregen: CQ.ENERGY.regen, fp: 0, luck: 0, xp: 0 };
  const other = { fp: sb + (bf.fp || 0), xp: sb + (bf.xp || 0), luck: bf.luck || 0 };
  const tAdd = {};
  for (const k of CQ.STAT_KEYS) tAdd[k] = fx[k] || 0;
  const tMul = { atk: fx.atkPct, def: fx.defPct, hp: fx.hpPct, eregen: fx.eregenPct };
  const st = { parts: {}, gear: g, stake: sb, fx, level: L, rt: {}, fl: {} };
  for (const k of CQ.STAT_KEYS) {
    if (CQ.STATS[k].rt) {
      // notation : points (attributs + équipement) convertis en % contre un adversaire de votre niveau ;
      // en combat, la conversion se fait contre le niveau réel de l'adversaire (CQ.vs)
      const pts = A[k] + g[k], flat = base[k] + (other[k] || 0) + tAdd[k], conv = 1 / (L + 10);
      const v = Math.min(CQ.CAPS[k], flat + pts * conv);
      st[k] = v; st.rt[k] = pts; st.fl[k] = flat;
      st.parts[k] = { base: base[k], attr: A[k] * conv, gear: g[k] * conv, other: other[k] || 0, talent: tAdd[k], total: v, cap: CQ.CAPS[k], pts };
      continue;
    }
    const gear = k === 'hp' ? g.hp + g.def * 2 : g[k];
    const pre = base[k] + A[k] + gear + (other[k] || 0);
    const talent = (tAdd[k] || 0) + (pre + (tAdd[k] || 0)) * (tMul[k] || 0) / 100;
    let v = pre + talent;
    if (CQ.CAPS[k] != null) v = Math.min(CQ.CAPS[k], v);
    if (CQ.ROUND_STATS.includes(k)) v = Math.round(v);
    st[k] = v;
    st.parts[k] = { base: base[k], attr: A[k], gear, other: other[k] || 0, talent, total: v, cap: CQ.CAPS[k] };
  }
  st.maxHp = st.hp;
  st.power = Math.round(st.atk * 1.2 + st.def + st.hp / 10 + (st.fp + st.luck + st.xp) * 2.2 + st.spd * 2.5 + (st.hit - 90) * 2.5
    + st.dodge * 3 + st.crit * 2.5 + st.parry * 2 + st.resil * 1.5 + (st.critd - 150) * 0.6 + st.pen * 3 + (st.emax - CQ.ENERGY.max) * 0.12 + (st.eregen - CQ.ENERGY.regen) * 1.2);
  return st;
};
// chance (%) d'une stat en notation contre un adversaire de niveau oppLvl
CQ.vs = (ps, k, oppLvl) => (ps.rt && k in ps.rt ? Math.min(CQ.CAPS[k], ps.fl[k] + ps.rt[k] / (oppLvl + 10)) : ps[k]);

// ---------- Énergie ----------
// Seules la valeur et l'heure du dernier calcul sont stockées : la recharge se déduit du temps écoulé.
// Au-dessus du maximum (surcharge par fioles et bonus), la recharge naturelle s'arrête.
CQ.energyNow = (ps = CQ.playerStats(), t = Date.now()) => {
  const e = CQ.state.energy;
  if (e.v >= ps.emax) return e.v;
  return Math.min(ps.emax, e.v + ps.eregen * Math.max(0, t - e.at) / 3600000);
};
CQ.energySync = (ps = CQ.playerStats()) => {
  const e = CQ.state.energy;
  e.v = CQ.energyNow(ps);
  e.at = Date.now();
};
CQ.spendEnergy = (n, ps) => {
  CQ.energySync(ps);
  const e = CQ.state.energy;
  if (e.v < n) return false;
  e.v -= n;
  CQ.state.stats.energySpent = (CQ.state.stats.energySpent || 0) + n;
  return true;
};
CQ.addEnergy = (n) => {
  const ps = CQ.playerStats();
  CQ.energySync(ps);
  const e = CQ.state.energy, cap = ps.emax * CQ.ENERGY.overcap;
  const add = Math.max(0, Math.min(n, cap - e.v));
  e.v += add;
  CQ.wake();
  return add;
};
CQ.energyFullIn = (ps = CQ.playerStats()) => {
  const cur = CQ.energyNow(ps);
  return cur >= ps.emax ? 0 : (ps.emax - cur) / ps.eregen * 3600000;
};
CQ.energyNextIn = (ps = CQ.playerStats()) => {
  const cur = CQ.energyNow(ps);
  if (cur >= ps.emax) return 0;
  return (1 - (cur - Math.floor(cur))) / ps.eregen * 3600000;
};
CQ.eDay = () => {
  const d = CQ.state.eday, k = CQ.dayKey();
  if (d.day !== k) { d.day = k; d.video = 0; d.potions = {}; }
  return d;
};
CQ.buyPotion = (id) => {
  const p = CQ.POTIONS.find((x) => x.id === id), d = CQ.eDay();
  if ((d.potions[id] || 0) >= p.perDay) { CQ.toast('Limite du jour atteinte.', 'red'); return 0; }
  if (!CQ.pay(p.cost(), `Boutique : ${p.name}`)) return 0;
  d.potions[id] = (d.potions[id] || 0) + 1;
  return CQ.addEnergy(p.val);
};
CQ.energyVideoLeft = () => CQ.ENERGY.videoPerDay - CQ.eDay().video;
CQ.claimEnergyVideo = () => {
  if (CQ.energyVideoLeft() <= 0) return 0;
  CQ.eDay().video++;
  return CQ.addEnergy(CQ.ENERGY.video);
};
// le héros au repos reprend dès qu'il peut payer une attaque (après une fiole, une vidéo, un réglage)
CQ.wake = () => {
  const c = CQ.combat, s = CQ.state;
  if (c && c.resting && s.auto && CQ.energyNow() >= s.eguard + 1) c.resting = false;
};
CQ.isResting = () => !CQ.state.auto || CQ.combat.resting;

CQ.gainXp = (amt) => {
  const s = CQ.state;
  s.xp += amt;
  let up = 0;
  while (s.xp >= CQ.xpNeed(s.level)) { s.xp -= CQ.xpNeed(s.level); s.level++; up++; }
  if (up) {
    const ps = CQ.playerStats();
    CQ.combat.php = ps.maxHp;
    if (ps.fx.fullRefill) CQ.addEnergy(Math.max(0, ps.emax - CQ.energyNow(ps)));
    else CQ.addEnergy(CQ.ENERGY.levelUp * up);
    CQ.toast(`⭐ Niveau ${s.level} atteint ! +${CQ.ATTR_PER_LEVEL * up} points d’attribut${s.level >= CQ.TALENT_START ? ' · +' + Math.min(up, s.level - CQ.TALENT_START + 1) + ' talent' : ''}`, 'green');
    const nz = CQ.ZONES.findIndex((z) => z.lvl === s.level);
    if (nz > 0) CQ.toast(`🗺️ Nouvelle zone débloquée : ${CQ.ZONES[nz].name}`, 'r4');
  }
};

// ---------- Objets ----------
CQ.rollRarity = (weights, luck = 0) => {
  const w = weights.map((v, i) => (i >= 2 ? v * Math.pow(1 + luck / 100, i - 1) : v));
  return CQ.pickWeighted(w);
};

CQ.rollStat = (k, ilvl, rarity, factor, rnd = Math.random) => {
  const d = CQ.STATS[k];
  const v = (d.base + d.per * ilvl) * CQ.RARITIES[rarity].mult * factor * (0.85 + rnd() * 0.3);
  return Math.round(v * 10) / 10;
};

// opts.rnd : tirage déterministe (adversaires d'arène, vendeurs simulés) · opts.id : identifiant imposé
// opts.set : pièce d'ensemble · les objets d'ensemble « liés » ne s'échangent pas au marché
CQ.makeItem = (slotId, rarity, ilvl, opts = {}) => {
  const s = CQ.state, rnd = opts.rnd || Math.random;
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const slot = CQ.SLOT[slotId];
  // opts.good (hôtel des ventes) : valeurs dans le haut de la fourchette, un affixe de plus, affixes utiles d'abord
  const rv = opts.good ? () => 0.65 + 0.35 * rnd() : rnd;
  const rolls = slot.main.map((k) => ({ k, v: CQ.rollStat(k, ilvl, rarity, 1, rv), main: true }));
  let pool = CQ.STAT_KEYS.filter((k) => !slot.main.includes(k) && (CQ.STATS[k].minR || 0) <= rarity);
  const n = Math.min(CQ.RARITIES[rarity].affixes + (opts.good ? 1 : 0), pool.length);
  for (let i = 0; i < n; i++) {
    const useful = opts.good ? pool.filter((k) => CQ.STATS[k].w >= 1.2) : [];
    const from = useful.length ? useful : pool;
    const k = from[Math.floor(rnd() * from.length)];
    pool = pool.filter((x) => x !== k);
    rolls.push({ k, v: CQ.rollStat(k, ilvl, rarity, 0.55, rv) });
  }
  const set = opts.set && CQ.SETS[opts.set];
  const name = set ? `${CQ.SET_PIECE[slotId]} ${set.of}`
    : rarity === 5 && rnd() < 0.5 ? pick(CQ.MYTHIC_NAMES[slotId]) : `${pick(slot.bases)} ${pick(CQ.SUFFIXES)}`;
  const it = { id: opts.id != null ? opts.id : s.nextId++, slot: slotId, rarity, ilvl: Math.max(1, Math.round(ilvl)), plus: 0, rolls, name, locked: false, at: Date.now() };
  if (set) { it.set = opts.set; if (set.bound) it.bound = true; }
  if (opts.good) it.good = true;
  if (rarity === 5) { const u = Object.keys(CQ.UNIQUES); it.unique = u[Math.floor(rnd() * u.length)]; }
  return it;
};
// pièce d'ensemble au hasard (boss, donjons) : Rare minimum
CQ.makeSetPiece = (setId, ilvl, luck = 0) => {
  const set = CQ.SETS[setId];
  return CQ.makeItem(CQ.pick(set.slots), Math.max(2, CQ.rollRarity(CQ.BOSS_WEIGHTS, luck)), ilvl, { set: setId });
};
CQ.zoneSet = (z) => Object.keys(CQ.SETS).find((k) => CQ.SETS[k].zone === z);

CQ.addItem = (it, source) => {
  const s = CQ.state;
  if (s.inventory.length >= CQ.INV_CAP) {
    const cq = CQ.sellValue(it);
    CQ.gain('cq', cq, 'Revente automatique (inventaire plein)');
    CQ.toast(`Inventaire plein : ${it.name} revendu ${cq} CQ.`, 'red');
    return null;
  }
  s.inventory.push(it);
  if (it.rarity > s.stats.bestRarity) s.stats.bestRarity = it.rarity;
  if ((it.rarity >= 3 || it.set) && source) CQ.toast(`${CQ.SLOT[it.slot].icon} ${CQ.RARITIES[it.rarity].name} : <b>${CQ.esc(it.name)}</b>`, 'r' + it.rarity);
  return it;
};

CQ.sellValue = (it) => Math.round(CQ.RARITIES[it.rarity].sell * (1 + it.ilvl / 10) * (1 + it.plus * 0.25));

CQ.reqLevel = (it) => Math.max(1, it.ilvl - CQ.REQ_MARGIN);
CQ.canWear = (it) => CQ.state.level >= CQ.reqLevel(it);
CQ.equip = (id) => {
  const it = CQ.itemById(id);
  if (!it) return;
  if (!CQ.canWear(it)) { CQ.toast(`Niveau ${CQ.reqLevel(it)} requis pour porter cet objet.`, 'red'); return; }
  CQ.state.equipped[it.slot] = it.id;
  it.bound = true; // équipé une fois = lié au compte
  CQ.combat.php = Math.min(CQ.combat.php ?? 0, CQ.playerStats().maxHp);
};
CQ.unequip = (slot) => { CQ.state.equipped[slot] = null; };

CQ.sell = (ids) => {
  const s = CQ.state;
  let total = 0, n = 0;
  for (const id of ids) {
    const it = CQ.itemById(id);
    if (!it || it.locked || CQ.isEquipped(it)) continue;
    total += CQ.sellValue(it); n++;
    s.inventory = s.inventory.filter((x) => x.id !== id);
  }
  if (n) CQ.gain('cq', total, `Revente de ${n} objet${n > 1 ? 's' : ''}`);
  return { n, total };
};

// ---------- Forge ----------
CQ.upgradeCost = (it) => Math.round(80 * Math.pow(it.plus + 1, 1.7) * (1 + it.rarity * 0.6) * (1 + it.ilvl / 15));
CQ.upgrade = (id) => {
  const it = CQ.itemById(id);
  if (!it || it.plus >= CQ.MAX_PLUS) return null;
  if (!CQ.pay({ cq: CQ.upgradeCost(it) }, `Forge : amélioration ${it.name} +${it.plus + 1}`)) return null;
  CQ.questProgress('forge');
  CQ.state.stats.upgrades++;
  const ok = Math.random() * 100 < CQ.UPGRADE_CHANCE[it.plus];
  if (ok) { it.plus++; CQ.state.stats.bestPlus = Math.max(CQ.state.stats.bestPlus, it.plus); }
  return ok;
};

CQ.fusionCost = (r) => Math.round(250 * Math.pow(r + 1, 2.2));
CQ.fuse = (ids) => {
  const items = ids.map(CQ.itemById).filter(Boolean);
  if (items.length !== 3) return null;
  const r = items[0].rarity;
  if (r >= 5 || items.some((i) => i.rarity !== r || i.locked || CQ.isEquipped(i))) return null;
  if (!CQ.pay({ cq: CQ.fusionCost(r) }, `Forge : fusion ${CQ.RARITIES[r].name} → ${CQ.RARITIES[r + 1].name}`)) return null;
  const slot = items.every((i) => i.slot === items[0].slot) ? items[0].slot : CQ.pick(items).slot;
  const ilvl = Math.max(...items.map((i) => i.ilvl));
  CQ.state.inventory = CQ.state.inventory.filter((x) => !ids.includes(x.id));
  CQ.state.stats.fusions++;
  CQ.questProgress('forge');
  return CQ.addItem(CQ.makeItem(slot, r + 1, ilvl), 'fusion');
};

CQ.craftCost = () => Math.round(450 * (1 + CQ.state.level / 8));
CQ.craft = (slot) => {
  if (!CQ.pay({ cq: CQ.craftCost() }, `Forge : création (${CQ.SLOT[slot].name})`)) return null;
  CQ.state.stats.crafts++;
  CQ.questProgress('forge');
  const r = CQ.rollRarity(CQ.CRAFT_WEIGHTS, CQ.playerStats().luck);
  return CQ.addItem(CQ.makeItem(slot, r, CQ.state.level + 1), 'forge');
};

// ---------- Coffres ----------
CQ.openChest = (key) => {
  const s = CQ.state, c = CQ.CHESTS[key];
  if (!s.chests[key]) return null;
  s.chests[key]--;
  s.stats.chests++;
  CQ.questProgress('chests');
  const luck = CQ.playerStats().luck;
  const items = [];
  for (let i = 0; i < c.items; i++) {
    const it = CQ.makeItem(CQ.pick(CQ.SLOTS).id, CQ.rollRarity(c.weights, luck), Math.max(s.level, 1) + CQ.randInt(0, 3));
    if (CQ.addItem(it)) items.push(it);
  }
  const cq = CQ.randInt(c.cq[0], c.cq[1]);
  CQ.gain('cq', cq, `Ouverture : ${c.name}`);
  const energy = CQ.ENERGY.chest[key] ? CQ.addEnergy(CQ.ENERGY.chest[key]) : 0;
  return { items, cq, energy };
};
CQ.chestCost = (key) => (key === 'bronze' ? { cq: Math.round(400 * (1 + CQ.state.level / 8)) } : CQ.CHESTS[key].cost);
CQ.buyChest = (key) => {
  const c = CQ.CHESTS[key];
  if (!CQ.pay(CQ.chestCost(key), `Achat : ${c.name}`)) return false;
  CQ.state.chests[key]++;
  return true;
};

// ---------- Combat ----------
CQ.combat = { mode: 'farm', zone: 0, m: null, php: null, pT: 0, mT: 0, deadUntil: 0, queue: [], wave: 0, waves: 0, log: [], session: null, listeners: [] };
CQ.on = (fn) => CQ.combat.listeners.push(fn);
CQ.emit = (type, data) => { for (const fn of CQ.combat.listeners) { try { fn(type, data); } catch (e) { console.error(e); } } };

CQ.KINDS = {
  normal: { hp: 1, atk: 1, rew: 1, lvl: 0 },
  elite: { hp: 1.5, atk: 1.15, rew: 2.2, lvl: 2 },
  boss: { hp: 5.5, atk: 1.35, rew: 10, lvl: 4 },
  dboss: { hp: 6.5, atk: 1.45, rew: 14, lvl: 5 },
};

CQ.isBoss = (m) => m.kind === 'boss' || m.kind === 'dboss';
CQ.makeMonster = (z, idx, kind = 'normal') => {
  const zone = CQ.ZONES[z], k = CQ.KINDS[kind];
  const isBoss = kind === 'boss' || kind === 'dboss';
  const L = zone.lvl + (isBoss ? 0 : idx) + k.lvl;
  const [name, icon, mods = {}] = isBoss ? zone.boss : zone.monsters[idx];
  // récompenses proportionnelles aux PV : chaque énergie rapporte à peu près vos dégâts par coup,
  // donc la meilleure zone est la plus haute où l'on survit (pas celle où l'on tue en un coup)
  const hpBase = 30 + L * 20 + Math.pow(L, 1.7) * 3;
  const hp = Math.round(hpBase * k.hp);
  return {
    z, idx: isBoss ? 'b' : idx, kind, name: kind === 'elite' ? `${name} élite` : name, icon, lvl: L, hp, max: hp,
    atk: (4 + L * 2.4 + Math.pow(L, 1.35)) * k.atk * (mods.atk || 1),
    def: L * 1.1 * (mods.def || 1),
    dodge: zone.cs.dodge + (mods.dodge || 0) + (isBoss ? 2 : 0),
    hit: zone.cs.hit + (isBoss ? 3 : 0),
    crit: zone.cs.crit + (isBoss ? 4 : 0),
    xp: hpBase * CQ.XP_PER_HP * k.rew * zone.rew,
    cq: hpBase * CQ.CQ_PER_HP * k.rew * zone.rew,
  };
};

CQ.newSession = () => ({ start: Date.now(), kills: 0, xp: 0, cq: 0, fp: 0, items: 0, energy: 0 });

CQ.addLog = (html) => {
  const c = CQ.combat;
  c.log.unshift(html);
  if (c.log.length > 40) c.log.length = 40;
  CQ.emit('log');
};

CQ.spawn = () => {
  const c = CQ.combat;
  if (c.mode === 'farm') c.m = CQ.makeMonster(c.zone, CQ.pickWeighted([45, 35, 20]));
  else if (c.mode === 'boss') c.m = CQ.makeMonster(c.zone, 0, 'boss');
  else {
    const next = c.queue.shift();
    if (!next) return CQ.dungeonWin();
    c.wave++;
    c.m = CQ.makeMonster(c.zone, next.idx, next.kind);
  }
  c.mT = 0;
  c.undyingUsed = false;
  CQ.emit('spawn');
};

CQ.setZone = (z) => {
  const zone = CQ.ZONES[z];
  if (!zone || CQ.state.level < zone.lvl) { CQ.toast(`Niveau ${zone.lvl} requis.`, 'red'); return; }
  CQ.state.zone = z;
  const c = CQ.combat;
  c.zone = z; c.mode = 'farm'; c.queue = []; c.session = CQ.newSession();
  CQ.spawn();
};

CQ.startBoss = () => {
  const s = CQ.state, c = CQ.combat;
  if (c.mode !== 'farm' || c.deadUntil) return;
  if (s.zoneKills[c.zone] < CQ.BOSS_KILLS) { CQ.toast(`Encore ${CQ.BOSS_KILLS - s.zoneKills[c.zone]} victoires avant le boss.`, 'red'); return; }
  s.zoneKills[c.zone] = 0;
  c.mode = 'boss';
  c.php = CQ.playerStats().maxHp;
  CQ.addLog(`<b>${CQ.ZONES[c.zone].boss[0]}</b> sort de l'ombre…`);
  CQ.spawn();
};

CQ.dungeonCost = (z) => Math.round(300 * Math.pow(z + 1, 1.6));
CQ.startDungeon = () => {
  const c = CQ.combat;
  if (c.mode !== 'farm' || c.deadUntil) return;
  const zone = CQ.ZONES[c.zone];
  if (!CQ.pay({ cq: CQ.dungeonCost(c.zone) }, `Entrée : donjon ${zone.dungeon}`)) return;
  c.mode = 'dungeon';
  c.queue = [0, 1, 2, CQ.randInt(0, 2)].map((idx) => ({ idx, kind: 'elite' })).concat([{ idx: 0, kind: 'dboss' }]);
  c.wave = 0; c.waves = c.queue.length;
  c.php = CQ.playerStats().maxHp;
  CQ.addLog(`Vous pénétrez dans <b>${zone.dungeon}</b>. Aucun soin entre les vagues.`);
  CQ.spawn();
};

CQ.dungeonWin = () => {
  const c = CQ.combat, s = CQ.state, z = c.zone;
  const chest = z <= 1 ? 'silver' : 'gold';
  s.chests[chest]++;
  const fp = 40 * (z + 1);
  CQ.gain('fp', fp, `Donjon terminé : ${CQ.ZONES[z].dungeon}`);
  s.stats.dungeons++;
  CQ.addLog(`🏰 Donjon terminé ! <b>${CQ.CHESTS[chest].name}</b> + ${fp} FP`);
  CQ.toast(`🏰 Donjon terminé : ${CQ.CHESTS[chest].name} et ${fp} FP`, 'r4');
  c.mode = 'farm';
  CQ.spawn();
};

CQ.abandon = () => {
  const c = CQ.combat;
  if (c.mode === 'farm') return;
  CQ.addLog(c.mode === 'boss' ? 'Vous fuyez le boss.' : 'Vous quittez le donjon.');
  c.mode = 'farm'; c.queue = [];
  CQ.spawn();
};

CQ.onKill = (m, ps) => {
  const s = CQ.state, c = CQ.combat, ses = c.session;
  const isBoss = m.kind === 'boss' || m.kind === 'dboss';
  const gap = CQ.gapMult(s.level, m.lvl);
  const xp = Math.round(m.xp * gap * (1 + ps.xp / 100) * (1 + CQ.collBonus(m.z) / 100));
  const cq = Math.round(m.cq * gap * (1 + ps.fp / 200) * (1 + ((ps.fx.cqPct || 0) + CQ.buffVal('cq')) / 100) * CQ.rand(0.85, 1.15));
  let fp = 0;
  if (isBoss) fp = Math.round((10 + m.lvl) * (1 + ps.fp / 100));
  else if (Math.random() < 0.12 * (1 + ps.fp / 100) * (m.kind === 'elite' ? 2.5 : 1)) fp = CQ.probRound((1 + m.lvl * 0.08) * (1 + ps.fp / 200));

  s.stats.kills++;
  CQ.pendingTx.kills++;
  CQ.gainXp(xp);
  CQ.gain('cq', cq, '', true);
  if (fp) CQ.gain('fp', fp, '', true);
  ses.kills++; ses.xp += xp; ses.cq += cq; ses.fp += fp;
  const bk = `${m.z}-${m.idx}`;
  s.bestiary[bk] = (s.bestiary[bk] || 0) + 1;
  CQ.questProgress('kills');
  if (c.mode === 'farm') s.zoneKills[m.z] = Math.min(CQ.BOSS_KILLS, s.zoneKills[m.z] + 1);

  // butin
  const drops = [];
  if (isBoss) {
    drops.push(CQ.makeItem(CQ.pick(CQ.SLOTS).id, CQ.rollRarity(CQ.BOSS_WEIGHTS, ps.luck), m.lvl));
    if (Math.random() < 0.5) drops.push(CQ.makeItem(CQ.pick(CQ.SLOTS).id, CQ.rollRarity(CQ.DROP_WEIGHTS, ps.luck), m.lvl));
    if (Math.random() < CQ.SET_DROP[m.kind]) drops.push(CQ.makeSetPiece(CQ.zoneSet(m.z), m.lvl, ps.luck));
    s.stats.bosses++;
    CQ.questProgress('boss');
  } else if (Math.random() < (m.kind === 'elite' ? 0.18 : 0.05) * (1 + ps.luck / 100) * (1 + CQ.buffVal('drop') / 100)) {
    drops.push(CQ.makeItem(CQ.pick(CQ.SLOTS).id, CQ.rollRarity(CQ.DROP_WEIGHTS, ps.luck), m.lvl));
  }
  for (const it of drops) if (CQ.addItem(it, 'drop')) ses.items++;

  let line = `<b>${CQ.esc(m.name)}</b> vaincu · +${xp} XP · +${cq} CQ${fp ? ` · <span class="c-fp">+${fp} FP</span>` : ''}`;
  for (const it of drops) line += ` · <span class="r${it.rarity} rt">${CQ.SLOT[it.slot].icon} ${CQ.esc(it.name)}</span>`;
  CQ.addLog(line);
  CQ.emit('kill', { m, xp, cq, fp, drops });

  if (c.mode === 'boss') {
    CQ.toast(`👑 ${m.name} est tombé !`, 'r4');
    c.mode = 'farm';
  }
  // soin léger entre deux combats (+ Second vent)
  c.php = Math.min(ps.maxHp, c.php + ps.maxHp * ((c.mode === 'dungeon' ? 0.06 : 0.14) + (ps.fx.regenWin || 0) / 100));
  if (ps.fx.rage) c.rageUntil = Date.now() + 10000;
  c.m = null;
  c.spawnAt = Date.now() + 450;
};

CQ.onDeath = () => {
  const c = CQ.combat;
  CQ.state.stats.deaths++;
  c.deadUntil = Date.now() + 3000;
  const msg = c.mode === 'dungeon' ? `Vous tombez à la vague ${c.wave}/${c.waves}. Donjon échoué.`
    : c.mode === 'boss' ? 'Le boss vous terrasse. Revenez plus fort.' : 'Vous êtes vaincu. Retour au camp…';
  CQ.addLog(`💀 ${msg}`);
  if (c.mode !== 'farm') CQ.toast(msg, 'red');
  c.mode = 'farm'; c.queue = [];
  CQ.emit('death');
};

CQ.updateCombat = (dt) => {
  const c = CQ.combat, now = Date.now();
  const ps = CQ.playerStats();
  if (c.php == null) c.php = ps.maxHp;
  c.php = Math.min(c.php, ps.maxHp);
  // garde-fou si l'horloge système recule : on ne reste pas bloqué
  if (c.spawnAt - now > 2000) c.spawnAt = now;
  if (c.deadUntil - now > 5000) c.deadUntil = now;
  if (c.deadUntil) {
    if (now < c.deadUntil) return;
    c.deadUntil = 0; c.php = ps.maxHp; c.pT = 0;
    CQ.spawn();
    return;
  }
  if (!c.m) { if (!c.spawnAt || now >= c.spawnAt) { c.spawnAt = 0; CQ.spawn(); } return; }

  // repos : plus d'énergie (ou combat auto coupé). Le combat est figé et le héros récupère ses PV.
  const s = CQ.state;
  if (!s.auto || c.resting) {
    if (s.auto && CQ.energyNow(ps) >= s.eguard + CQ.ENERGY.resume) c.resting = false;
    else { c.php = Math.min(ps.maxHp, c.php + ps.maxHp * dt / 30000); c.mT = 0; return; }
  }

  const fx = ps.fx;
  const pInt = CQ.attackInterval(ps);
  const mInt = CQ.isBoss(c.m) ? 1500 : 1700;
  c.pT += dt; c.mT += dt;
  let guard = 0;
  while (c.m && c.pT >= pInt && guard++ < 6) {
    if (!CQ.payAttack(ps)) {
      c.resting = true; c.pT = 0;
      CQ.addLog(s.eguard ? `⏸ Réserve de ${s.eguard} énergie atteinte : votre héros s’arrête.` : '🔥 Plus d’énergie : votre héros se repose près du feu.');
      CQ.emit('rest');
      return;
    }
    c.pT -= pInt;
    CQ.strike(ps);
    if (c.m && fx.double && Math.random() * 100 < fx.double) CQ.strike(ps, 'double');
  }
  guard = 0;
  while (c.m && c.mT >= mInt && guard++ < 6) {
    c.mT -= mInt;
    const m = c.m;
    if (Math.random() * 100 >= CQ.clamp(m.hit - CQ.vs(ps, 'dodge', m.lvl), 40, 100)) {
      CQ.emit('mHit', { dodge: true });
      if (fx.riposte && Math.random() * 100 < fx.riposte) CQ.strike(ps, 'riposte');
      continue;
    }
    let dmg = CQ.dmgFormula(m.atk, ps.def) * CQ.rand(0.9, 1.1);
    const crit = Math.random() * 100 < m.crit - CQ.vs(ps, 'resil', m.lvl);
    if (crit) dmg *= 1.5;
    if (CQ.isBoss(m) && fx.bossRed) dmg *= 1 - fx.bossRed / 100;
    const block = Math.random() * 100 < CQ.vs(ps, 'parry', m.lvl);
    if (block) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    c.php -= dmg;
    CQ.emit('mHit', { dmg, crit, block });
    if (c.php <= 0) {
      if (fx.undying && !c.undyingUsed) {
        c.undyingUsed = true; c.php = 1;
        CQ.addLog('🩸 <b>Refus de mourir</b> : vous restez debout avec 1 PV.');
        continue;
      }
      c.php = 0; CQ.onDeath(); break;
    }
  }
};

// dégâts = A² / (A + D) : la Défense réduit sans jamais annuler
CQ.dmgFormula = (atk, def) => (atk * atk) / (atk + Math.max(0, def));
CQ.attackInterval = (ps) => {
  const rage = CQ.combat.rageUntil > Date.now() ? ps.fx.rage || 0 : 0;
  return 1200 * (1 - Math.min(CQ.CAPS.spd, ps.spd + rage) / 100);
};
// 1 énergie par attaque, touchée ou ratée (sauf talent Économe)
CQ.payAttack = (ps) => {
  if (CQ.energyNow(ps) < CQ.state.eguard + 1) return false;
  if (ps.fx.free && Math.random() * 100 < ps.fx.free) { CQ.emit('free'); return true; }
  if (!CQ.spendEnergy(1, ps)) return false;
  CQ.combat.session.energy++;
  return true;
};
CQ.strike = (ps, tag) => {
  const c = CQ.combat, m = c.m, fx = ps.fx;
  if (Math.random() * 100 >= CQ.clamp(CQ.vs(ps, 'hit', m.lvl) - m.dodge, 40, 100)) { CQ.emit('pHit', { miss: true, tag }); return; }
  const crit = Math.random() * 100 < CQ.vs(ps, 'crit', m.lvl);
  let dmg = CQ.dmgFormula(ps.atk, m.def * (1 - ps.pen / 100)) * CQ.rand(0.9, 1.1);
  if (crit) dmg *= ps.critd / 100;
  if (c.bleed) { dmg *= 1 + (fx.bleed || 0) / 100; c.bleed = false; }
  if (crit && fx.bleed) c.bleed = true;
  if (CQ.isBoss(m) && fx.bossDmg) dmg *= 1 + fx.bossDmg / 100;
  dmg *= 1 + CQ.collBonus(m.z) / 100; // collection de la zone
  dmg = Math.max(1, Math.round(dmg));
  m.hp -= dmg;
  if (fx.leech) c.php = Math.min(ps.maxHp, c.php + dmg * fx.leech / 100);
  let exec = false;
  if (m.hp > 0 && fx.execute && m.kind === 'normal' && m.hp / m.max < fx.execute / 100) { m.hp = 0; exec = true; }
  CQ.emit('pHit', { dmg, crit, tag, exec });
  if (m.hp <= 0) { m.hp = 0; CQ.onKill(m, ps); c.pT = 0; }
};

// ---------- Estimations (aide à la décision, gains hors ligne) ----------
CQ.hitChance = (ps, m) => CQ.clamp(CQ.vs(ps, 'hit', m.lvl) - m.dodge, 40, 100) / 100;
// dégâts moyens d'un coup qui touche (critiques compris)
CQ.expectedHit = (ps, m) => {
  const critF = 1 + (CQ.vs(ps, 'crit', m.lvl) / 100) * (ps.critd / 100 - 1);
  const boss = CQ.isBoss(m) ? 1 + (ps.fx.bossDmg || 0) / 100 : 1;
  return CQ.dmgFormula(ps.atk, m.def * (1 - ps.pen / 100)) * critF * boss;
};
// un coup ne tue jamais plus d'un monstre : au mieux 1 attaque réussie par victoire
CQ.attacksToKill = (ps, m) => Math.max(1, m.max / CQ.expectedHit(ps, m)) / CQ.hitChance(ps, m);
// marge de survie : temps pour mourir / temps pour tuer (au-dessus de 1, on gagne en moyenne)
CQ.survival = (ps, m) => {
  const mHit = CQ.dmgFormula(m.atk, ps.def) * (1 + Math.max(0, m.crit - CQ.vs(ps, 'resil', m.lvl)) / 100 * 0.5) * CQ.clamp(m.hit - CQ.vs(ps, 'dodge', m.lvl), 40, 100) / 100
    * (1 - CQ.vs(ps, 'parry', m.lvl) / 200)
    * (CQ.isBoss(m) ? 1 - (ps.fx.bossRed || 0) / 100 : 1);
  const ttd = ps.maxHp / mHit * (CQ.isBoss(m) ? 1500 : 1700);
  const ttk = CQ.attacksToKill(ps, m) * CQ.attackInterval(ps);
  return ttd / ttk;
};
CQ.riskLabel = (r) => (r >= 4 ? ['Sûr', 'green'] : r >= 1.6 ? ['Tenable', 'gold'] : ['Dangereux', 'red']);
CQ.FARM_WEIGHTS = [45, 35, 20];
// gains moyens pour 100 énergie dans une zone
CQ.zoneYield = (z, ps = CQ.playerStats()) => {
  let apk = 0, xp = 0, cq = 0, fp = 0, risk = Infinity;
  CQ.FARM_WEIGHTS.forEach((w, i) => {
    const m = CQ.makeMonster(z, i), f = w / 100;
    apk += f * CQ.attacksToKill(ps, m);
    const gap = CQ.gapMult(CQ.state.level, m.lvl);
    xp += f * m.xp * gap; cq += f * m.cq * gap * (1 + CQ.buffVal('cq') / 100); fp += f * 0.12 * (1 + m.lvl * 0.08);
    risk = Math.min(risk, CQ.survival(ps, m));
  });
  const kills = 100 / apk;
  return {
    apk, kills, risk,
    xp: kills * xp * (1 + ps.xp / 100),
    cq: kills * cq * (1 + ps.fp / 200) * (1 + (ps.fx.cqPct || 0) / 100),
    fp: kills * fp * (1 + ps.fp / 100) * (1 + ps.fp / 200),
  };
};
CQ.bossEnergy = (z, ps = CQ.playerStats()) => Math.ceil(CQ.attacksToKill(ps, CQ.makeMonster(z, 0, 'boss')));
CQ.dungeonEnergy = (z, ps = CQ.playerStats()) => Math.ceil([0, 1, 2, 1].reduce((a, i) => a + CQ.attacksToKill(ps, CQ.makeMonster(z, i, 'elite')), 0)
  + CQ.attacksToKill(ps, CQ.makeMonster(z, 0, 'dboss')));

// gains hors ligne : le héros combat tant qu'il a de l'énergie (réserve au départ + recharge pendant l'absence),
// à 75 % du rendement (+ talent Rêveur). Plus de plafond horaire : l'énergie borne déjà.
CQ.offlineGains = () => {
  const s = CQ.state, now = Date.now();
  const away = now - (s.lastSeen || now);
  if (away < 120000 || !s.auto) return null;
  const ps = CQ.playerStats(), e = s.energy;
  const start = e.v; // synchronisée à chaque sauvegarde
  const pool = start + ps.eregen * Math.max(0, now - e.at) / 3600000;
  const attacks = Math.floor(Math.max(0, Math.min(pool - s.eguard, away / CQ.attackInterval(ps))));
  if (attacks < 1) return null;
  e.v = Math.min(Math.max(ps.emax, start), pool - attacks);
  e.at = now;
  s.stats.energySpent = (s.stats.energySpent || 0) + attacks;
  const eff = CQ.ENERGY.offline + (ps.fx.offline || 0) / 100;
  const y = CQ.zoneYield(s.zone, ps);
  const kills = Math.floor(attacks / y.apk * eff);
  if (kills < 1) return { away, attacks, kills: 0, xp: 0, cq: 0, fp: 0, levels: 0, eff };
  const k = kills / y.kills; // nombre de « tranches de 100 énergie » réellement converties
  const xp = Math.round(y.xp * k), cq = Math.round(y.cq * k), fp = Math.round(y.fp * k);
  const lvl0 = s.level;
  s.stats.kills += kills;
  CQ.gain('cq', cq, `Farm hors ligne (${kills} victoires)`);
  CQ.gain('fp', fp, `Farm hors ligne (${kills} victoires)`);
  CQ.gainXp(xp);
  return { away, attacks, kills, xp, cq, fp, levels: s.level - lvl0, eff };
};

// ---------- Faucet, vidéo, PTC, offerwall ----------
CQ.faucetAmount = () => 12 + Math.floor(CQ.state.level / 2) + Math.min(10, CQ.state.login.streak);
CQ.faucetReadyIn = () => Math.max(0, CQ.state.faucetLast + CQ.FAUCET_MS - Date.now());
CQ.claimFaucet = () => {
  if (CQ.faucetReadyIn() > 0) return 0;
  const amt = CQ.faucetAmount();
  CQ.state.faucetLast = Date.now();
  CQ.state.stats.faucet++;
  CQ.gain('fp', amt, 'Faucet');
  CQ.questProgress('faucet');
  return amt;
};

CQ.ptcToday = () => {
  const p = CQ.state.ptc, k = CQ.dayKey();
  if (p.day !== k) { p.day = k; p.done = {}; }
  return p;
};

// ---------- Connexion quotidienne ----------
CQ.loginAvailable = () => CQ.state.login.last !== CQ.dayKey();
CQ.loginNextStreak = () => (CQ.state.login.last === CQ.yesterdayKey() ? CQ.state.login.streak + 1 : 1);
CQ.loginReward = (streak) => ({ cq: Math.min(1500, 100 + streak * 50), fp: Math.min(40, 5 + streak * 2), energy: CQ.ENERGY.login });
CQ.claimLogin = () => {
  const l = CQ.state.login;
  if (!CQ.loginAvailable()) return null;
  const streak = CQ.loginNextStreak();
  l.streak = streak; l.last = CQ.dayKey(); l.best = Math.max(l.best, streak);
  const r = CQ.loginReward(streak);
  CQ.grant(r, `Bonus de connexion — jour ${streak}`);
  const ms = CQ.STREAK_MILESTONES[streak];
  if (ms) {
    CQ.state.chests[ms.chest]++;
    if (ms.fp) CQ.gain('fp', ms.fp, `Palier de série : jour ${streak}`);
    if (ms.gems) CQ.gain('gems', ms.gems, `Palier de série : jour ${streak}`);
  }
  return { streak, r, ms };
};

// ---------- Élixirs ----------
CQ.buyElixir = (id) => {
  const e = CQ.ELIXIRS.find((x) => x.id === id);
  if (!CQ.pay(e.cost, `Boutique : ${e.name}`)) return false;
  const b = CQ.state.buffs[e.stat];
  const from = b && b.until > Date.now() ? b.until : Date.now();
  CQ.state.buffs[e.stat] = { val: e.val, until: from + CQ.ELIXIR_MS };
  return true;
};

// achat simulé : alimente aussi les revenus du pool du jour (comme le ferait un vrai achat encaissé)
CQ.buyPack = (id) => {
  const p = CQ.FP_PACKS.find((x) => x.id === id);
  CQ.gain('fp', p.fp, `Boutique : pack ${p.fp} FP (achat simulé ${p.eur.toFixed(2).replace('.', ',')} €)`);
  CQ.poolCycle().extra += p.eur * 1.08; // ≈ conversion EUR → USD
  return p;
};

// ---------- Staking ----------
CQ.stake = (amount, days) => {
  const plan = CQ.STAKE_PLANS.find((p) => p.days === days);
  amount = Math.floor(amount);
  if (!plan || amount < 10) { CQ.toast('Minimum 10 FP.', 'red'); return false; }
  if (!CQ.pay({ fp: amount }, `Staking : blocage ${plan.label}`)) return false;
  const now = Date.now();
  CQ.state.stakes.push({ id: CQ.state.nextId++, amount, days, mult: plan.mult, start: now, end: now + days * 86400000 });
  return true;
};
CQ.unstake = (id) => {
  const s = CQ.state, st = s.stakes.find((x) => x.id === id);
  if (!st || Date.now() < st.end) return false;
  s.stakes = s.stakes.filter((x) => x.id !== id);
  s.fp += st.amount;
  CQ.logTx('fp', st.amount, 'Staking : déblocage');
  return true;
};

// ---------- Crypto Pool ----------
// Revenus et participants simulés de façon déterministe à partir du cycle.
CQ.poolCycle = () => {
  const s = CQ.state;
  if (!s.pool) {
    const now = Date.now();
    s.pool = { id: 1, start: now, end: CQ.nextMidnight(now), mine: 0, extra: 0 };
  }
  return s.pool;
};
CQ.poolSim = (p = CQ.poolCycle(), at = Date.now()) => {
  const rnd = CQ.seeded('pool' + p.start + ':' + p.id);
  const baseRev = 160 + rnd() * 340;
  const botTarget = Math.round(70000 + rnd() * 110000);
  const players = Math.round(350 + rnd() * 900);
  const full = 86400000;
  // la progression se mesure sur une journée complète, même si le cycle a commencé en cours de journée
  const prog = CQ.clamp(1 - (p.end - at) / full, 0, 1);
  const curve = Math.pow(prog, 0.85);
  const rev = baseRev * curve + p.extra;
  const bots = Math.round(botTarget * curve);
  return {
    prog,
    revenue: rev,
    revenueFinal: baseRev + p.extra,
    breakdown: [['Publicités', 0.34], ['Offerwall', 0.27], ['PTC', 0.09], ['Boutique FP', 0.3]].map(([n, f]) => [n, baseRev * curve * f]),
    distributed: rev * CQ.POOL_SHARE,
    distributedFinal: (baseRev + p.extra) * CQ.POOL_SHARE,
    bots, botsFinal: botTarget,
    total: bots + p.mine,
    totalFinal: botTarget + p.mine,
    players: Math.round(players * curve) + (p.mine ? 1 : 0),
  };
};
CQ.poolEstimate = (extraFp = 0) => {
  const p = CQ.poolCycle(), sim = CQ.poolSim(p);
  const mine = p.mine + extraFp;
  if (!mine) return { share: 0, reward: 0 };
  const share = mine / (sim.botsFinal + mine);
  return { share, reward: share * sim.distributedFinal };
};
CQ.poolDeposit = (amount) => {
  amount = Math.floor(amount);
  if (amount < 1) return false;
  if (!CQ.pay({ fp: amount }, 'Crypto Pool : FP sacrifiés')) return false;
  const p = CQ.poolCycle();
  p.mine += amount;
  CQ.state.stats.fpSacrificed += amount;
  CQ.questProgress('pool');
  return true;
};
CQ.settlePool = () => {
  const s = CQ.state, p = CQ.poolCycle();
  const sim = CQ.poolSim(p, p.end);
  const share = p.mine ? p.mine / (sim.botsFinal + p.mine) : 0;
  const reward = Math.floor(share * sim.distributedFinal * 1e6) / 1e6;
  s.poolHistory.unshift({ id: p.id, start: p.start, end: p.end, mine: p.mine, total: sim.totalFinal, revenue: sim.revenueFinal, distributed: sim.distributedFinal, share, reward, players: sim.players });
  if (s.poolHistory.length > 60) s.poolHistory.length = 60;
  if (p.mine) {
    s.stats.poolDays++;
    CQ.gain('crypto', reward, `Crypto Pool n°${p.id} — ${(share * 100).toFixed(3).replace('.', ',')} % du pool`);
    CQ.toast(`🔥 Crypto Pool n°${p.id} clôturé : +${CQ.fmtUsd(reward)}`, 'r4');
  }
  const now = Date.now();
  s.pool = { id: p.id + 1, start: now, end: CQ.nextMidnight(now), mine: 0, extra: 0 };
};
// clôture anticipée (outil de test du prototype)
CQ.forcePoolClose = () => { CQ.poolCycle().end = Date.now(); CQ.settlePool(); };

// ---------- Classements ----------
CQ.PERIODS = {
  daily: { name: 'Quotidien', key: CQ.dayKey, fee: 25, scale: 1, prizes: [1000, 600, 400], top10: 150, top25: 50 },
  weekly: { name: 'Hebdomadaire', key: CQ.weekKey, fee: 100, scale: 7, prizes: [4000, 2400, 1600], top10: 600, top25: 200 },
  monthly: { name: 'Mensuel', key: CQ.monthKey, fee: 300, scale: 30, prizes: [12000, 7000, 5000], top10: 1800, top25: 600 },
};
CQ.periodProgress = (period) => {
  const now = new Date();
  if (period === 'daily') { const st = new Date(now); st.setHours(0, 0, 0, 0); return (now - st) / 86400000; }
  if (period === 'weekly') { const st = new Date(now); st.setHours(0, 0, 0, 0); st.setDate(st.getDate() - ((st.getDay() + 6) % 7)); return (now - st) / (7 * 86400000); }
  const st = new Date(now.getFullYear(), now.getMonth(), 1), en = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return (now - st) / (en - st);
};
CQ.periodEnd = (period) => {
  const now = new Date(), d = new Date(now); d.setHours(0, 0, 0, 0);
  if (period === 'daily') d.setDate(d.getDate() + 1);
  else if (period === 'weekly') d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 7);
  else return new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
  return d.getTime();
};
CQ.ladder = (period) => {
  const L = CQ.state.ladder, k = CQ.PERIODS[period].key();
  if (!L[period] || L[period].key !== k) L[period] = { key: k, score: 0, registered: false };
  return L[period];
};
CQ.ladderScore = (fp) => {
  for (const p of Object.keys(CQ.PERIODS)) { const l = CQ.ladder(p); if (l.registered) l.score += fp; }
};
CQ.botScores = (period, key, prog) => {
  const P = CQ.PERIODS[period];
  return CQ.BOT_NAMES.map((name, i) => {
    const r = CQ.seeded(period + key + name);
    const skill = Math.pow(r(), 2.4);
    const final = Math.round((80 + skill * 3800) * P.scale * (0.8 + r() * 0.4));
    return { name, score: Math.round(final * Math.pow(prog, 0.95)), level: 5 + Math.round(skill * 50), bot: true, i };
  });
};
CQ.ladderRows = (period) => {
  const l = CQ.ladder(period);
  const rows = CQ.botScores(period, l.key, CQ.periodProgress(period));
  if (l.registered) rows.push({ name: CQ.state.name, score: l.score, level: CQ.state.level, me: true });
  rows.sort((a, b) => b.score - a.score);
  return rows;
};
CQ.prizeFor = (period, rank) => {
  const P = CQ.PERIODS[period];
  if (rank <= 3) return P.prizes[rank - 1];
  if (rank <= 10) return P.top10;
  if (rank <= 25) return P.top25;
  return 0;
};
CQ.registerLadder = (period) => {
  const l = CQ.ladder(period), P = CQ.PERIODS[period];
  if (l.registered) return false;
  if (!CQ.pay({ fp: P.fee }, `Classement ${P.name.toLowerCase()} : inscription`)) return false;
  l.registered = true;
  return true;
};
// clôture des classements dont la période est terminée
CQ.checkLadders = () => {
  const L = CQ.state.ladder;
  for (const period of Object.keys(CQ.PERIODS)) {
    const old = L[period], k = CQ.PERIODS[period].key();
    if (!old || old.key === k) continue;
    if (old.registered) {
      const rows = CQ.botScores(period, old.key, 1);
      rows.push({ me: true, score: old.score });
      rows.sort((a, b) => b.score - a.score);
      const rank = rows.findIndex((r) => r.me) + 1;
      const prize = CQ.prizeFor(period, rank);
      if (prize) CQ.gain('fp', prize, `Classement ${CQ.PERIODS[period].name.toLowerCase()} : ${rank}e place`);
      CQ.toast(`🏆 Classement ${CQ.PERIODS[period].name.toLowerCase()} terminé : ${rank}e${prize ? ` · +${prize} FP` : ''}`, 'r4');
    }
    L[period] = { key: k, score: 0, registered: false };
  }
};

// ---------- Quêtes et succès ----------
CQ.questsToday = () => {
  const q = CQ.state.quests, k = CQ.dayKey();
  if (q.day !== k) { q.day = k; q.prog = {}; q.claimed = {}; q.bonus = false; }
  return q;
};
CQ.questProgress = (id, n = 1) => { const q = CQ.questsToday(); q.prog[id] = (q.prog[id] || 0) + n; };
CQ.questClaimable = (qd) => { const q = CQ.questsToday(); return !q.claimed[qd.id] && (q.prog[qd.id] || 0) >= qd.goal; };
CQ.claimQuest = (id) => {
  const qd = CQ.QUESTS.find((x) => x.id === id), q = CQ.questsToday();
  if (!qd || !CQ.questClaimable(qd)) return false;
  q.claimed[id] = true;
  CQ.grant(qd.reward, `Quête : ${qd.name}`);
  return true;
};
CQ.claimQuestBonus = () => {
  const q = CQ.questsToday();
  if (q.bonus || !CQ.QUESTS.every((x) => q.claimed[x.id])) return false;
  q.bonus = true;
  CQ.grant(CQ.QUEST_BONUS, 'Quêtes du jour : bonus de complétion');
  return true;
};
CQ.achClaimable = (a) => !CQ.state.achievements[a.id] && a.val(CQ.state) >= a.goal;
CQ.claimAch = (id) => {
  const a = CQ.ACHIEVEMENTS.find((x) => x.id === id);
  if (!a || !CQ.achClaimable(a)) return false;
  CQ.state.achievements[id] = Date.now();
  CQ.grant(a.reward, `Succès : ${a.name}`);
  return true;
};

// ---------- Boucle de fond (1 s) ----------
CQ.slowTick = () => {
  const s = CQ.state, p = CQ.poolCycle();
  if (Date.now() >= p.end) CQ.settlePool();
  CQ.checkLadders();
  CQ.questsToday();
  for (const [k, b] of Object.entries(s.buffs)) if (b.until <= Date.now()) delete s.buffs[k];
};
