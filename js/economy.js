'use strict';
// Économie partagée par l'hôtel des ventes, le marché et l'arène :
// consommables et parchemins, effets temporaires, objets liés, boîte aux lettres, diamants, prix de référence.

// ---------- Consommables ----------
// fp : mise de départ par unité à l'hôtel des ventes · gem : achat direct par unité
CQ.CONSUMABLES = {
  e1: { icon: '🧴', name: 'Fiole mineure', energy: 100, desc: '+100 énergie', fp: 8, gem: 6 },
  e2: { icon: '⚱️', name: 'Fiole majeure', energy: 500, desc: '+500 énergie', fp: 30, gem: 18 },
  e3: { icon: '🏺', name: 'Élixir de vigueur', energy: 1000, desc: '+1 000 énergie', fp: 55, gem: 32 },
  sDrop: { icon: '📜', name: 'Parchemin de Butin', buff: 'drop', val: 50, mins: 60, desc: '+50 % de chance de butin pendant 1 h', fp: 25, gem: 15 },
  sDrop2: { icon: '📜', name: 'Grand parchemin de Butin', buff: 'drop', val: 100, mins: 180, desc: '+100 % de chance de butin pendant 3 h', fp: 70, gem: 40 },
  sLuck: { icon: '🍀', name: 'Parchemin de Rareté', buff: 'luck', val: 30, mins: 60, desc: '+30 % Luck pendant 1 h', fp: 25, gem: 15 },
  sXp: { icon: '📘', name: 'Parchemin de Sagesse', buff: 'xp', val: 50, mins: 60, desc: '+50 % XP pendant 1 h', fp: 20, gem: 12 },
  sFp: { icon: '📕', name: 'Parchemin de Moisson', buff: 'fp', val: 30, mins: 60, desc: '+30 % Farm Power pendant 1 h', fp: 30, gem: 18 },
  sCq: { icon: '📒', name: 'Parchemin de Fortune', buff: 'cq', val: 50, mins: 60, desc: '+50 % CQ gagnés pendant 1 h', fp: 15, gem: 10 },
};
CQ.BUFF_NAMES = { drop: 'Butin', luck: 'Luck', xp: 'XP', fp: 'Farm Power', cq: 'CQ' };

// un effet plus fort remplace le plus faible, et la durée s'ajoute à celle qui reste
CQ.applyBuff = (stat, val, ms) => {
  const b = CQ.state.buffs[stat], now = Date.now(), on = b && b.until > now;
  CQ.state.buffs[stat] = { val: on ? Math.max(b.val, val) : val, until: (on ? b.until : now) + ms };
};
CQ.activeBuffs = () => Object.entries(CQ.state.buffs).filter(([, b]) => b.until > Date.now());
CQ.useConsumable = (id) => {
  const s = CQ.state, c = CQ.CONSUMABLES[id];
  if (!c || !s.consumables[id]) return false;
  s.consumables[id]--;
  if (!s.consumables[id]) delete s.consumables[id];
  if (c.energy) CQ.addEnergy(c.energy);
  if (c.buff) CQ.applyBuff(c.buff, c.val, c.mins * 60000);
  return true;
};

// ---------- Objets liés ----------
// Un objet équipé une fois est lié au compte : revente au marchand possible, marché impossible.
CQ.tradeBlock = (it) => (CQ.isEquipped(it) ? 'Équipé' : it.bound ? 'Lié au compte' : it.locked ? 'Verrouillé' : '');

// prix de référence au marché (CQ) : base de revente × 25, majoré pour la qualité et les améliorations
CQ.refPrice = (it) => Math.round(CQ.sellValue(it) * 25 * (it.good ? 1.4 : 1) * (it.set ? 1.3 : 1));

// comparaison avec l'objet porté au même emplacement (marché, enchères)
CQ.compareHtml = (it) => {
  const eqId = CQ.state.equipped[it.slot], cur = eqId && eqId !== it.id ? CQ.itemById(eqId) : null;
  if (!cur) return `<div class="small dim mt">Emplacement ${CQ.SLOT[it.slot].name.toLowerCase()} vide chez vous.</div>`;
  const a = CQ.itemStats(it), b = CQ.itemStats(cur);
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
  return `<div class="sep"></div><div class="small muted mb">Comparé à <span class="r${cur.rarity} rt">${CQ.esc(cur.name)}</span> (équipé) · puissance ${CQ.itemPower(it)} contre ${CQ.itemPower(cur)}</div><div class="rolls">${keys.map((k) => {
    const d = (a[k] || 0) - (b[k] || 0);
    if (Math.abs(d) < 0.05) return '';
    return `<div><span class="muted">${CQ.STATS[k].name}</span><span class="${d > 0 ? 'diff-up' : 'diff-down'}">${d > 0 ? '▲ +' : '▼ −'}${CQ.fmtStat(k, Math.abs(d))}</span></div>`;
  }).join('')}</div>`;
};

// ---------- Boîte aux lettres ----------
// payload : { items: [objet], cons: { id: n }, cq, fp, gems, honor, chest }
CQ.mailAdd = (title, payload, from = 'Système') => {
  const s = CQ.state;
  s.mail.unshift(Object.assign({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: Date.now(), title, from }, payload));
  if (s.mail.length > 80) s.mail.length = 80;
};
CQ.mailClaim = (id) => {
  const s = CQ.state, m = s.mail.find((x) => x.id === id);
  if (!m) return { ok: false };
  let kept = 0;
  if (m.items && m.items.length) {
    const rest = [];
    for (const it of m.items) {
      if (s.inventory.length >= CQ.INV_CAP) { rest.push(it); continue; }
      it.id = s.nextId++;
      CQ.addItem(it);
    }
    m.items = rest; kept = rest.length;
  }
  for (const cur of ['cq', 'fp', 'gems', 'honor']) if (m[cur]) { CQ.gain(cur, m[cur], m.title); m[cur] = 0; }
  if (m.cons) { CQ.grant({ cons: m.cons }); m.cons = null; }
  if (m.chest) { s.chests[m.chest]++; m.chest = null; }
  if (!kept) s.mail = s.mail.filter((x) => x.id !== id);
  return { ok: true, kept };
};
CQ.mailClaimAll = () => {
  let kept = 0;
  for (const m of CQ.state.mail.slice()) kept += CQ.mailClaim(m.id).kept;
  return kept;
};

// tirage pondéré avec un générateur donné (lots, vendeurs et adversaires reproductibles)
CQ.pickWeightedR = (weights, rnd) => {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
};
// FP rendus (enchère dépassée) : pas un gain, ne compte ni dans les FP gagnés ni dans les classements
CQ.refund = (cur, amt, why) => { CQ.state[cur] += amt; CQ.logTx(cur, amt, why); };

// ---------- Diamants (achat simulé) ----------
CQ.GEM_PACKS = [
  { id: 'g1', gems: 100, eur: 4.99 },
  { id: 'g2', gems: 220, eur: 9.99, tag: '+10 %' },
  { id: 'g3', gems: 480, eur: 19.99, tag: '+20 %' },
  { id: 'g4', gems: 1300, eur: 49.99, tag: '+30 %' },
];
CQ.buyGems = (id) => {
  const p = CQ.GEM_PACKS.find((x) => x.id === id);
  CQ.gain('gems', p.gems, `Boutique : ${p.gems} diamants (achat simulé ${p.eur.toFixed(2).replace('.', ',')} €)`);
  CQ.poolCycle().extra += p.eur * 1.08;
  return p;
};
