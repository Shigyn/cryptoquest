'use strict';
// Pierres de protection et forge simplifiée.
// - Risque d'amélioration : un échec à partir de +7 fait perdre un palier, à partir de +10 l'objet se brise.
//   Une pierre de protection absorbe l'échec (elle n'est consommée que si la tentative rate).
// - Pierres : fabriquées à la forge avec les matériaux de fonte (une fonte rapporte plus selon la rareté),
//   trouvées sur les monstres (rare, plus souvent sur les boss) et dans les coffres, échangées au marché.
// - Forge simplifiée : trois boutons automatiques ; les anciens onglets restent dans le mode avancé.

CQ.STONE = {
  pts: 300, cq: 250, ref: 1200, // fabrication : 300 points de matériaux + 250 CQ ; prix de référence au marché
  qw: [1, 4, 15, 50, 150], // valeur d'une unité de matériau selon sa qualité (brut … divin)
  kill: { normal: 0.0015, elite: 0.015, boss: 0.12 },
  chest: { bronze: 0.05, silver: 0.15, gold: 0.35, mythic: 1 },
};
CQ.stones = () => CQ.state.stones || 0;
CQ.addStones = (n) => { CQ.state.stones = Math.max(0, CQ.stones() + n); };
CQ.useStone = () => CQ.state.settings.useStone !== false;

// ---------- Risque d'amélioration ----------
CQ.upRisk = (plus) => (plus >= 10 ? 'break' : plus >= 7 ? 'down' : '');
(() => {
  const up = CQ.upgrade;
  CQ.upgrade = (id) => {
    const it = CQ.itemById(id);
    if (!it) return null;
    const risk = CQ.upRisk(it.plus), prot = !!risk && CQ.useStone() && CQ.stones() > 0;
    const ok = up(id);
    CQ.lastUp = { risk, saved: false, down: false, broke: false };
    if (ok === false && risk) {
      if (prot) { CQ.addStones(-1); CQ.lastUp.saved = true; }
      else if (risk === 'down') { it.plus--; CQ.lastUp.down = true; }
      else {
        const s = CQ.state;
        if (CQ.isEquipped(it)) s.equipped[it.slot] = null;
        s.inventory = s.inventory.filter((x) => x.id !== it.id);
        CQ.lastUp.broke = true;
      }
    }
    return ok;
  };
})();
CQ.upRiskHtml = (it) => {
  const r = CQ.upRisk(it.plus);
  const txt = r === 'break' ? '<b style="color:var(--red-2)">l’objet se brise</b>' : r === 'down' ? '<b style="color:var(--red-2)">l’objet perd un palier</b>' : 'l’objet reste intact';
  return `<div class="note mt">En cas d’échec, les CQ${CQ.upgradeMats(it) ? ' et la Cendre' : ''} sont perdus et ${txt}.
    ${r ? `<label class="row mt" style="gap:8px"><input type="checkbox" data-act="toggleStone" ${CQ.useStone() ? 'checked' : ''}> 💠 Protéger avec une pierre (${CQ.stones()} en réserve)${CQ.useStone() && !CQ.stones() ? ' — <span style="color:var(--red-2)">aucune pierre</span>' : ''}</label>` : ''}</div>`;
};
A.toggleStone = () => { CQ.state.settings.useStone = !CQ.useStone(); CQ.save(); CQ.refresh(); };
A.doUpgrade = () => {
  const it = CQ.itemById(CQ.ui.sel.up), name = it && it.name;
  const ok = CQ.upgrade(CQ.ui.sel.up);
  if (ok === null) return;
  const l = CQ.lastUp;
  if (ok) CQ.toast(`🔨 Réussite : ${CQ.esc(name)} +${it.plus}`, 'green');
  else if (l.saved) CQ.toast('💠 Échec absorbé par une pierre de protection. L’objet est intact.', 'gold');
  else if (l.down) CQ.toast(`💥 Échec : ${CQ.esc(name)} retombe à +${it.plus}.`, 'red');
  else if (l.broke) { CQ.toast(`💥 Échec : ${CQ.esc(name)} s’est brisé.`, 'red'); CQ.ui.sel.up = null; }
  else CQ.toast('💥 Échec de la forge. L’objet est intact.', 'red');
  CQ.save(); CQ.refresh();
};

// ---------- Fabrication ----------
CQ.matPoints = () => {
  let p = 0;
  for (const m of CQ.MAT_KEYS) if (m !== 'cendre') for (let q = 0; q < 5; q++) p += CQ.matCount(m, q) * CQ.STONE.qw[q];
  return p;
};
CQ.stonesCraftable = () => Math.min(Math.floor(CQ.matPoints() / CQ.STONE.pts), Math.floor(CQ.state.cq / CQ.STONE.cq));
// consomme d'abord les matériaux de basse qualité (la Cendre est gardée pour les paliers +11 à +15)
CQ.craftStones = (n) => {
  n = Math.min(n, CQ.stonesCraftable());
  if (n <= 0) return 0;
  let need = n * CQ.STONE.pts;
  for (let q = 0; q < 5 && need > 0; q++) {
    for (const m of CQ.MAT_KEYS) {
      if (m === 'cendre' || need <= 0) continue;
      const take = Math.min(CQ.matCount(m, q), Math.ceil(need / CQ.STONE.qw[q]));
      CQ.matAdd(m, q, -take); need -= take * CQ.STONE.qw[q];
    }
  }
  CQ.pay({ cq: n * CQ.STONE.cq }, `Forge : ${n} pierre${n > 1 ? 's' : ''} de protection`);
  CQ.addStones(n);
  return n;
};
A.craftStones = (n) => {
  const k = CQ.craftStones(n === 'max' ? 999 : Number(n));
  if (!k) { CQ.toast('Matériaux ou CQ insuffisants.', 'red'); return; }
  CQ.toast(`💠 +${k} pierre${k > 1 ? 's' : ''} de protection`, 'green');
  CQ.save(); CQ.refresh();
};

// ---------- Butin : monstres et coffres ----------
(() => {
  const kill = CQ.onKill;
  CQ.onKill = (m, ps) => {
    const r = kill(m, ps);
    const ch = CQ.isBoss(m) ? CQ.STONE.kill.boss : m.kind === 'elite' ? CQ.STONE.kill.elite : CQ.STONE.kill.normal;
    if (Math.random() < ch * (1 + (ps.luck || 0) / 200)) { CQ.addStones(1); CQ.addLog('💠 <b>Pierre de protection</b> trouvée !'); CQ.toast('💠 Pierre de protection trouvée !', 'gold'); }
    return r;
  };
  const open = CQ.openChest;
  CQ.openChest = (key) => {
    const res = open(key);
    if (res) {
      const ch = CQ.STONE.chest[key] || 0, n = Math.random() < ch ? (key === 'mythic' ? CQ.randInt(1, 2) : 1) : 0;
      if (n) { CQ.addStones(n); res.stones = n; CQ.toast(`💠 +${n} pierre${n > 1 ? 's' : ''} de protection dans le coffre`, 'gold'); }
    }
    return res;
  };
})();

// ---------- Marché des pierres ----------
CQ.stoneOffers = () => {
  const s = CQ.state, slot = CQ.mktSlot(), rnd = CQ.seeded('stones' + slot);
  const bought = s.market.stoneBought || (s.market.stoneBought = {});
  return Array.from({ length: 4 }, (_, i) => ({ id: `S${slot}-${i}`, n: 1 + Math.floor(rnd() * 4), price: Math.round(CQ.STONE.ref * (0.8 + rnd() * 0.6)), seller: CQ.BOT_NAMES[Math.floor(rnd() * CQ.BOT_NAMES.length)] }))
    .filter((o) => !bought[o.id]);
};
CQ.stoneLots = () => CQ.state.market.stoneLots || (CQ.state.market.stoneLots = []);
A.stoneBuy = (id) => {
  const s = CQ.state, o = CQ.stoneOffers().find((x) => x.id === id);
  if (!o || !CQ.pay({ cq: o.n * o.price }, `Marché : ${o.n} pierre${o.n > 1 ? 's' : ''} (${o.seller})`)) return;
  for (const k of Object.keys(s.market.stoneBought)) if (!k.startsWith('S' + CQ.mktSlot() + '-')) delete s.market.stoneBought[k];
  s.market.stoneBought[o.id] = 1;
  CQ.addStones(o.n);
  CQ.toast(`💠 +${o.n} pierre${o.n > 1 ? 's' : ''}`, 'green');
  CQ.save(); CQ.refresh();
};
A.stoneList = () => {
  const n = Math.floor(Number(CQ.$('#stN').value)), price = Math.floor(Number(CQ.$('#stP').value));
  const lo = Math.ceil(CQ.STONE.ref * CQ.MKT.floor), hi = Math.floor(CQ.STONE.ref * CQ.MKT.ceil);
  if (!(n >= 1 && n <= CQ.stones())) { CQ.toast('Quantité invalide.', 'red'); return; }
  if (!(price >= lo && price <= hi)) { CQ.toast(`Prix par pierre : entre ${CQ.fmt(lo)} et ${CQ.fmt(hi)} CQ.`, 'red'); return; }
  if (CQ.stoneLots().length >= 5) { CQ.toast('5 lots de pierres au maximum.', 'red'); return; }
  if (!CQ.pay({ cq: CQ.mktFee(n * price) }, 'Marché : frais de mise en vente (pierres)')) return;
  CQ.addStones(-n);
  const now = Date.now();
  CQ.stoneLots().push({ id: 'P' + now.toString(36), n, price, end: now + CQ.MKT.ttl, checked: now });
  CQ.toast(`📋 ${n} pierre${n > 1 ? 's' : ''} mise${n > 1 ? 's' : ''} en vente`, 'green');
  CQ.save(); CQ.refresh();
};
A.stoneCancel = (id) => {
  const l = CQ.stoneLots().find((x) => x.id === id);
  if (!l) return;
  CQ.state.market.stoneLots = CQ.stoneLots().filter((x) => x.id !== id);
  CQ.addStones(l.n); CQ.save(); CQ.refresh();
};
(() => {
  const tick = CQ.marketTick;
  CQ.marketTick = () => {
    tick();
    const now = Date.now();
    for (const l of CQ.stoneLots().slice()) {
      const h = (Math.min(now, l.end) - l.checked) / 3600000;
      if (h <= 0) continue;
      l.checked = Math.min(now, l.end);
      const r = l.price / CQ.STONE.ref, rate = r <= 0.8 ? 0.5 : r <= 1 ? 0.25 : r <= 1.3 ? 0.1 : r <= 2 ? 0.03 : 0.005;
      if (Math.random() < 1 - Math.pow(1 - rate, h)) {
        const net = Math.round(l.n * l.price * (1 - CQ.MKT.tax));
        CQ.state.market.stoneLots = CQ.stoneLots().filter((x) => x.id !== l.id);
        CQ.mailAdd(`Vendu : ${l.n} pierre${l.n > 1 ? 's' : ''} de protection`, { cq: net, note: `${CQ.fmt(l.n * l.price)} CQ − ${CQ.MKT.tax * 100} % de commission` }, CQ.BOT_NAMES[Math.floor(Math.random() * CQ.BOT_NAMES.length)]);
        CQ.toast(`🏛️ ${l.n} pierre${l.n > 1 ? 's' : ''} vendue${l.n > 1 ? 's' : ''} · +${CQ.fmt(net)} CQ dans la boîte aux lettres`, 'green');
      } else if (now >= l.end) {
        CQ.state.market.stoneLots = CQ.stoneLots().filter((x) => x.id !== l.id);
        CQ.addStones(l.n);
      }
    }
  };
})();
P.market.render = () => {
  const tab = CQ.tabOf('mkt', 'buy'), s = S();
  return CQ.tabs('mkt', [['buy', '🛒 Acheter'], ['sell', '💰 Vendre'], ['mine', `📋 Mes ventes (${s.market.mine.length}/${CQ.MKT.max})`], ['stones', `💠 Pierres (${CQ.stones()})`]]) + P.market[tab]();
};
P.market.stones = () => {
  const offers = CQ.stoneOffers(), lots = CQ.stoneLots(), ref = CQ.STONE.ref;
  return `<div class="grid g2">
    <div class="card"><h3>Acheter des pierres<span class="right">nouvelles offres dans ${CQ.fmtDur((CQ.mktSlot() + 1) * CQ.MKT.slot - Date.now())}</span></h3>
      ${offers.length ? offers.map((o) => `<div class="list-row"><span class="item r3" style="width:44px;font-size:20px">💠</span><div class="lr"><b>${o.n} pierre${o.n > 1 ? 's' : ''} de protection</b>
        <span>${CQ.fmt(o.price)} CQ l’unité · vendu par ${CQ.esc(o.seller)}</span></div>
        <button class="btn sm primary" data-act="stoneBuy" data-arg="${o.id}" ${S().cq >= o.n * o.price ? '' : 'disabled'}>${CQ.fmt(o.n * o.price)} CQ</button></div>`).join('') : '<div class="empty">Tout est vendu. De nouveaux vendeurs arrivent chaque heure.</div>'}</div>
    <div class="card"><h3>Vendre vos pierres<span class="right">${CQ.stones()} en réserve</span></h3>
      <div class="row wrap" style="gap:8px"><label class="small muted">Quantité <input class="input sm" id="stN" type="number" min="1" max="${CQ.stones()}" value="${Math.min(1, CQ.stones())}" style="width:80px"></label>
        <label class="small muted">Prix par pierre <input class="input sm" id="stP" type="number" value="${ref}" style="width:110px"></label>
        <button class="btn sm gold" data-act="stoneList" ${CQ.stones() ? '' : 'disabled'}>Mettre en vente</button></div>
      <div class="small dim mt">Prix de référence ${CQ.fmt(ref)} CQ. Frais ${CQ.MKT.fee * 100} % à la mise en vente, ${CQ.MKT.tax * 100} % de commission à la vente.</div>
      ${lots.length ? `<div class="sep"></div>${lots.map((l) => `<div class="list-row"><span class="item r3" style="width:44px;font-size:20px">💠</span><div class="lr"><b>${l.n} pierre${l.n > 1 ? 's' : ''}</b><span>${CQ.fmt(l.price)} CQ l’unité · expire dans ${CQ.fmtDur(l.end - Date.now())}</span></div>
        <button class="btn sm ghost" data-act="stoneCancel" data-arg="${l.id}">Retirer</button></div>`).join('')}` : ''}</div></div>`;
};

// ---------- Forge simplifiée ----------
CQ.eqOf = (slot) => CQ.itemById(CQ.state.equipped[slot]);
// objet inutile : ni porté, ni verrouillé, et pas meilleur que ce qui est porté au même emplacement
CQ.isJunk = (it) => { const eq = CQ.eqOf(it.slot); return !CQ.isEquipped(it) && !it.locked && !!eq && CQ.itemPower(it) <= CQ.itemPower(eq); };
CQ.lowLvl = (it) => it.ilvl < CQ.state.level - 8; // trop bas pour valoir une fusion
// la forge auto ne fond que le tout-venant (Commun, Peu commun) : un Rare ou mieux se revend mieux au marché
CQ.autoSmeltable = (it) => CQ.isJunk(it) && CQ.lowLvl(it) && it.rarity <= 1;

// porte le meilleur objet de chaque emplacement (même règle que « Équiper le meilleur ») ; renvoie le nombre de changements
CQ.equipBest = () => {
  const s = CQ.state;
  let n = 0;
  for (const sl of CQ.SLOTS) {
    const best = s.inventory.filter((i) => i.slot === sl.id && CQ.canWear(i)).sort((a, b) => CQ.itemPower(b) - CQ.itemPower(a))[0];
    if (best && s.equipped[sl.id] !== best.id) { CQ.equip(best.id); n++; }
  }
  return n;
};

CQ.autoUpgrade = (budget) => {
  const s = CQ.state, r = { tries: 0, ok: 0, saved: 0, down: 0, spent: 0 }, start = s.cq;
  for (let i = 0; i < 300; i++) {
    const left = budget - (start - s.cq);
    const c = CQ.SLOTS.map((sl) => CQ.eqOf(sl.id)).filter((it) => it && !CQ.lowLvl(it) && it.plus < CQ.MAX_PLUS && CQ.upgradeCost(it) <= Math.min(left, s.cq)
      && (!CQ.upgradeMats(it) || CQ.matCount(CQ.upgradeMats(it).mat, CQ.upgradeMats(it).q) >= CQ.upgradeMats(it).n)
      && (!CQ.upRisk(it.plus) || (CQ.useStone() && CQ.stones() > 0)))
      .sort((a, b) => a.plus - b.plus || CQ.itemPower(b) - CQ.itemPower(a))[0];
    if (!c) break;
    const ok = CQ.upgrade(c.id);
    if (ok === null) break;
    r.tries++; if (ok) r.ok++; if (CQ.lastUp.saved) r.saved++; if (CQ.lastUp.down) r.down++;
  }
  r.spent = start - s.cq;
  return r;
};
CQ.autoFuse = () => {
  const s = CQ.state, made = [];
  let spent = 0;
  for (let guard = 0; guard < 200; guard++) {
    let done = false;
    for (let r = 0; r <= 3 && !done; r++) {
      const pool = s.inventory.filter((it) => it.rarity === r && CQ.isJunk(it) && !CQ.lowLvl(it));
      if (pool.length < 3 || s.cq < CQ.fusionCost(r)) continue;
      const bySlot = {};
      for (const it of pool) (bySlot[it.slot] = bySlot[it.slot] || []).push(it);
      const same = Object.values(bySlot).find((l) => l.length >= 3);
      const three = (same || pool.sort((a, b) => b.ilvl - a.ilvl)).slice(0, 3).map((i) => i.id);
      spent += CQ.fusionCost(r);
      const it = CQ.fuse(three);
      if (it) { made.push(it); done = true; }
    }
    if (!done) break;
  }
  return { made: made.filter((it) => CQ.itemById(it.id)), spent };
};
CQ.autoForge = () => {
  const s = CQ.state, r = { smelted: 0, forged: null, made: [] };
  // 1) fond les objets inutiles trop bas pour une fusion
  const low = s.inventory.filter(CQ.autoSmeltable).map((i) => i.id);
  if (low.length) r.smelted = CQ.smelt(low).n;
  // 2) forge le meilleur objet possible pour l'emplacement le plus faible
  const slots = CQ.SLOTS.map((sl) => ({ slot: sl.id, eq: CQ.eqOf(sl.id) })).sort((a, b) => (a.eq ? CQ.itemPower(a.eq) : -1) - (b.eq ? CQ.itemPower(b.eq) : -1));
  for (const { slot, eq } of slots) {
    for (let q = 4; q >= 0; q--) {
      const c = CQ.recipeCost(slot, q, s.level);
      if (!CQ.canForge(c)) continue;
      if (eq && eq.rarity > q + 1 && !CQ.lowLvl(eq)) break; // ce qui est porté vaut mieux
      const it = CQ.forgeRecipe(slot, q);
      if (it) { r.made.push(it); if (!eq || CQ.itemPower(it) > CQ.itemPower(eq)) CQ.equip(it.id); }
      break;
    }
  }
  r.forged = r.made[0] || null;
  return r;
};

CQ.ui.ab = CQ.ui.ab || 50;
A.abSet = (v) => { CQ.ui.ab = Number(v); CQ.refresh(); };
A.forgeAdv = () => { CQ.ui.forgeAdv = !CQ.ui.forgeAdv; CQ.refresh(); };
A.autoUpgrade = () => {
  const eqd = CQ.equipBest();
  const r = CQ.autoUpgrade(Math.floor(CQ.state.cq * CQ.ui.ab / 100));
  if (!r.tries) { if (eqd) { CQ.save(); CQ.refresh(); } CQ.toast(CQ.SLOTS.some((sl) => CQ.eqOf(sl.id) && CQ.upRisk(CQ.eqOf(sl.id).plus)) && !CQ.stones() ? 'Tout est à +7 ou plus : il faut des pierres de protection pour continuer.' : (CQ.SLOTS.some((sl) => CQ.eqOf(sl.id) && !CQ.lowLvl(CQ.eqOf(sl.id))) ? 'Rien à améliorer avec ce budget.' : 'Votre équipement est trop bas niveau pour valoir une amélioration : forgez ou farmez des objets proches de votre niveau.'), 'red'); return; }
  CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>⚡ Équipement amélioré</h2>${eqd ? `<p class="muted">${eqd} meilleur${eqd > 1 ? 's' : ''} objet${eqd > 1 ? 's' : ''} équipé${eqd > 1 ? 's' : ''} d’abord.</p>` : ''}<div class="kv"><span>Tentatives</span><span>${r.tries}</span><span>Réussites</span><span class="c-green">${r.ok}</span>
    ${r.saved ? `<span>Échecs absorbés</span><span>💠 ${r.saved}</span>` : ''}<span>Dépensé</span><span>${CQ.money('cq', r.spent)}</span></div>
    <div class="items mt">${CQ.SLOTS.map((sl) => CQ.eqOf(sl.id)).filter(Boolean).map((it) => CQ.itemTile(it, { static: true })).join('')}</div>
    <div class="actions"><button class="btn gold" data-act="closeModal">Parfait</button></div>`);
};
A.autoFuse = () => {
  const eqd = CQ.equipBest();
  const r = CQ.autoFuse();
  if (!r.made.length) { if (eqd) { CQ.save(); CQ.refresh(); } CQ.toast('Pas assez d’objets inutiles de même rareté (3 au minimum), ou CQ insuffisants.', 'red'); return; }
  CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>🔮 ${r.made.length} fusion${r.made.length > 1 ? 's' : ''}</h2>${eqd ? `<p class="muted">${eqd} meilleur${eqd > 1 ? 's' : ''} objet${eqd > 1 ? 's' : ''} équipé${eqd > 1 ? 's' : ''} d’abord.</p>` : ''}<div class="items mt">${r.made.map((it) => CQ.itemTile(it, { static: true })).join('')}</div>
    <div class="small muted mt">Coût : ${CQ.money('cq', r.spent)}. Les nouveaux objets meilleurs que votre équipement restent dans l’inventaire.</div>
    <div class="actions"><button class="btn" data-act="closeModal">Fermer</button><a class="btn gold" href="#inventory" data-act="closeModal">Voir l’inventaire</a></div>`);
};
A.autoForge = () => {
  const eqd = CQ.equipBest();
  const r = CQ.autoForge();
  if (!r.smelted && !r.forged) { if (eqd) { CQ.save(); CQ.refresh(); } CQ.toast('Rien à fondre, et pas assez de matériaux pour forger mieux que votre équipement.', 'red'); return; }
  CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>🔨 Forge automatique</h2>${eqd ? `<p class="muted">${eqd} meilleur${eqd > 1 ? 's' : ''} objet${eqd > 1 ? 's' : ''} équipé${eqd > 1 ? 's' : ''} d’abord.</p>` : ''}${r.smelted ? `<p class="muted">${r.smelted} objet${r.smelted > 1 ? 's' : ''} fondu${r.smelted > 1 ? 's' : ''} en matériaux.</p>` : ''}
    ${r.made.length ? `<div class="reveal">${r.made.map((it) => `<div class="rv r${it.rarity}">${CQ.itemTile(it, { static: true })}<div class="rn">${CQ.esc(it.name)}<br><span class="small">${CQ.RARITIES[it.rarity].name}${CQ.isEquipped(it) ? ' · équipé' : ''}</span></div></div>`).join('')}</div>`
      : '<p class="muted">Pas encore assez de matériaux de même qualité pour forger un objet meilleur que le vôtre.</p>'}
    <div class="actions"><button class="btn gold" data-act="closeModal">Parfait</button></div>`);
};

(() => {
  const adv = P.forge.render;
  P.forge.render = () => {
    if (CQ.ui.forgeAdv) return `<div class="row mb" style="margin-bottom:12px"><button class="btn ghost sm" data-act="forgeAdv">← Forge simplifiée</button></div>${adv()}`;
    const s = S(), eq = CQ.SLOTS.map((sl) => CQ.eqOf(sl.id)).filter(Boolean);
    const minPlus = eq.length ? Math.min(...eq.map((i) => i.plus)) : 0, budget = Math.floor(s.cq * CQ.ui.ab / 100);
    const junk = s.inventory.filter(CQ.isJunk), fusable = [0, 1, 2, 3].reduce((a, r) => a + Math.floor(junk.filter((i) => i.rarity === r && !CQ.lowLvl(i)).length / 3), 0);
    const low = s.inventory.filter(CQ.autoSmeltable).length, pts = CQ.matPoints(), craft = CQ.stonesCraftable();
    const better = CQ.SLOTS.filter((sl) => { const b = s.inventory.filter((i) => i.slot === sl.id && CQ.canWear(i)).sort((a, c) => CQ.itemPower(c) - CQ.itemPower(a))[0]; return b && s.equipped[sl.id] !== b.id; }).length;
    return `${better ? `<div class="town-crier" style="margin-bottom:14px"><span>🛡️</span><div><b>${better} emplacement${better > 1 ? 's' : ''} peu${better > 1 ? 'vent' : 't'} recevoir mieux</b><div class="small muted">Vous avez dans l’inventaire de meilleurs objets que ceux portés (ou des emplacements vides). Chaque bouton ci-dessous les équipe d’abord.</div></div><button class="btn gold sm" data-act="autoEquip">Équiper le meilleur</button></div>` : ''}<div class="forge-auto">
      <div class="fa-card"><div class="fa-ico">⚡</div><h3>Améliorer l’équipement</h3>
        <p class="small muted">Améliore en boucle la pièce équipée la plus faible, parmi celles de niveau ${Math.max(1, s.level - 8)} ou plus (les objets trop bas ne valent pas la dépense). Sans pierre, s’arrête avant +7.</p>
        <div class="row wrap" style="gap:6px">${[25, 50, 100].map((v) => `<button class="chip ${CQ.ui.ab === v ? 'gold' : ''}" data-act="abSet" data-arg="${v}">${v} % des CQ</button>`).join('')}</div>
        <label class="row small mt" style="gap:8px"><input type="checkbox" data-act="toggleStone" ${CQ.useStone() ? 'checked' : ''}> 💠 Utiliser les pierres au-delà de +7 (${CQ.stones()})</label>
        <button class="btn primary block mt" data-act="autoUpgrade" ${eq.length || better ? '' : 'disabled'}>Améliorer · jusqu’à ${CQ.fmt(budget)} CQ</button></div>
      <div class="fa-card"><div class="fa-ico">🔮</div><h3>Fusion auto</h3>
        <p class="small muted">Fusionne par trois les objets moins bons que votre équipement, de même rareté, en regroupant les mêmes emplacements. Jamais les objets portés ou verrouillés.</p>
        <div class="kv"><span>Objets inutiles</span><span>${junk.length}</span><span>Fusions possibles</span><span>${fusable}</span></div>
        <button class="btn primary block mt" data-act="autoFuse" ${fusable || better ? "" : "disabled"}>Tout fusionner</button></div>
      <div class="fa-card"><div class="fa-ico">🔨</div><h3>Forge auto</h3>
        <p class="small muted">Fond les objets Communs et Peu communs inutiles et trop bas (niveau &lt; ${Math.max(1, s.level - 8)}) ; les Rares et mieux sont gardés pour le marché. Puis forge à votre niveau le meilleur objet possible pour votre emplacement le plus faible.</p>
        <div class="kv"><span>À fondre</span><span>${low}</span><span>Matériaux</span><span>${CQ.fmt(pts)} points</span></div>
        <button class="btn primary block mt" data-act="autoForge">Fondre et forger</button></div>
      <div class="fa-card stone"><div class="fa-ico">💠</div><h3>Pierres de protection <span class="chip gold">${CQ.stones()}</span></h3>
        <p class="small muted">Un échec à +7 ou plus fait perdre un palier, à +10 ou plus l’objet se brise. Une pierre absorbe l’échec. Elles se fabriquent avec les matériaux de fonte (plus l’objet fondu est rare, plus il en donne), tombent rarement des monstres et des coffres, et s’échangent au marché.</p>
        <div class="kv"><span>Recette</span><span>${CQ.STONE.pts} points de matériaux + ${CQ.money('cq', CQ.STONE.cq)}</span><span>Fabricables</span><span>${craft}</span></div>
        <div class="row mt" style="gap:8px"><button class="btn gold" data-act="craftStones" data-arg="1" ${craft ? '' : 'disabled'}>Fabriquer 1</button><button class="btn" data-act="craftStones" data-arg="max" ${craft > 1 ? '' : 'disabled'}>Tout fabriquer (${craft})</button></div></div>
    </div>
    <div class="row mt" style="justify-content:center"><button class="btn ghost sm" data-act="forgeAdv" style="white-space:normal">⚙️ Mode avancé (objet par objet, recettes, fonte, réserve)</button></div>`;
  };
})();
