'use strict';
// Hôtel des ventes : le système met en vente un arrivage de lots toutes les 2 h
// (équipement de qualité supérieure, fioles d'énergie, parchemins).
// Mises en FP : la mise est bloquée, rendue si quelqu'un surenchérit, détruite si vous gagnez (puits de FP).
// Achat direct en diamants, volontairement très cher. Les autres enchérisseurs sont simulés :
// chaque lot a une valeur cachée jusqu'à laquelle ils montent (parfois aucun intérêt).
CQ.AUC = {
  round: 2 * 3600000, items: 10, cons: 5, step: 1.05, snipe: 120000, setChance: 0.12, noInterest: 0.12,
  rarity: [0, 0, 35, 40, 20, 5],
  fp: [0, 0, 30, 90, 300, 900], // mise de départ par rareté (× 1 + niveau/30)
  gem: [0, 0, 40, 110, 300, 800], // achat direct par rareté (× 1 + niveau/60)
};
CQ.aucRound = (t = Date.now()) => Math.floor(t / CQ.AUC.round);
// temps restant lisible : « 1 h 12 min », « 13 min 05 s », « 42 s »
CQ.fmtLeft = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : m ? `${m} min ${String(sec).padStart(2, '0')} s` : `${sec} s`;
};

CQ.aucGenerate = (round, lvl) => {
  const rnd = CQ.seeded('auc' + round + ':' + lvl), A = CQ.AUC;
  const t0 = round * A.round, lots = [];
  const maxZone = CQ.ZONES.reduce((m, z, i) => (lvl >= z.lvl ? i : m), 0);
  const consIds = Object.keys(CQ.CONSUMABLES);
  for (let i = 0; i < A.items + A.cons; i++) {
    // un lot dure de 1 h 12 à 3 h 12 : deux arrivages se chevauchent, il y a toujours des lots en cours
    const lot = { id: `A${round}-${i}`, t0, end: t0 + Math.round((0.6 + rnd()) * A.round), bid: 0, bids: 0, top: null, mine: 0, done: false };
    if (i < A.items) {
      const r = CQ.pickWeightedR(A.rarity, rnd), ilvl = lvl + Math.floor(rnd() * 4);
      let slot = CQ.SLOTS[Math.floor(rnd() * CQ.SLOTS.length)].id, set = null;
      if (rnd() < A.setChance) { set = CQ.zoneSet(Math.floor(rnd() * (maxZone + 1))); slot = CQ.SETS[set].slots[Math.floor(rnd() * 3)]; }
      lot.item = CQ.makeItem(slot, r, ilvl, { rnd, good: true, set, id: lot.id });
      lot.start = Math.round(A.fp[r] * (1 + ilvl / 30));
      lot.buyout = Math.round(A.gem[r] * (1 + ilvl / 60));
    } else {
      const id = consIds[Math.floor(rnd() * consIds.length)], c = CQ.CONSUMABLES[id];
      const n = c.fp <= 25 ? 1 + Math.floor(rnd() * 3) : 1;
      lot.cons = { id, n };
      lot.start = c.fp * n;
      lot.buyout = c.gem * n;
    }
    lot.value = rnd() < A.noInterest ? 0 : Math.round(lot.start * (1.3 + rnd() * 2.2));
    lots.push(lot);
  }
  return lots.sort((a, b) => a.end - b.end);
};

CQ.aucMinBid = (lot) => (lot.bid ? Math.ceil(lot.bid * CQ.AUC.step) : lot.start);
CQ.aucLot = (id) => CQ.state.auction.lots.find((l) => l.id === id);
CQ.aucName = (lot) => (lot.item ? lot.item.name : `${CQ.CONSUMABLES[lot.cons.id].name}${lot.cons.n > 1 ? ' ×' + lot.cons.n : ''}`);
// prix affiché tant que les enchérisseurs simulés mènent : ils montent vers leur valeur au fil du temps
CQ.aucNpcPrice = (lot, t) => {
  if (lot.value < lot.start) return 0;
  const p = CQ.clamp((t - lot.t0) / (lot.end - lot.t0), 0, 1);
  return Math.round(lot.start + (lot.value - lot.start) * 0.85 * Math.pow(p, 2.2));
};

CQ.aucTick = () => {
  const s = CQ.state, a = s.auction, now = Date.now();
  if (a.lots.some((l) => l.t0 == null && !l.mine)) { a.round = null; a.lots = []; } // lots d'un format antérieur
  for (const lot of a.lots) {
    if (lot.done) continue;
    // riposte des enchérisseurs simulés quand vous menez
    if (lot.top === 'me' && lot.npcAt && lot.npcAt <= Math.min(now, lot.end)) {
      const t = lot.npcAt, min = CQ.aucMinBid(lot);
      lot.npcAt = 0;
      if (lot.value >= min) {
        CQ.refund('fp', lot.mine, `Enchère dépassée : ${CQ.aucName(lot)}`);
        lot.bid = Math.min(lot.value, Math.round(min * (1 + Math.random() * 0.06)));
        lot.top = 'npc'; lot.mine = 0; lot.bids++;
        if (lot.end - t < CQ.AUC.snipe) lot.end = t + CQ.AUC.snipe;
        CQ.toast(`⚖️ Surenchéri : ${CQ.esc(CQ.aucName(lot))} (${CQ.fmt(lot.bid)} FP)`, 'red');
      }
    }
    if (lot.top !== 'me') {
      const p = CQ.aucNpcPrice(lot, Math.min(now, lot.end));
      if (p > lot.bid) { lot.bid = p; lot.top = 'npc'; lot.bids = Math.max(lot.bids, 1 + Math.round(Math.log(p / lot.start) / Math.log(1.08))); }
    }
    if (now >= lot.end) {
      lot.done = true;
      if (lot.top === 'me') CQ.aucWin(lot, `${CQ.fmt(lot.mine)} FP`);
    }
  }
  const r = CQ.aucRound();
  if (a.round !== r) {
    // premier passage : on reconstitue aussi l'arrivage précédent, encore en cours
    const fresh = a.round == null || r - a.round > 1 ? CQ.aucGenerate(r - 1, s.level).filter((l) => l.end > now) : [];
    a.round = r; a.lvl = s.level;
    a.lots = a.lots.filter((l) => !l.done || now - l.end < 15 * 60000).concat(fresh, CQ.aucGenerate(r, s.level)).sort((x, y) => x.end - y.end);
    CQ.aucTick();
  }
};
CQ.aucWin = (lot, price) => {
  const s = CQ.state;
  s.stats.auctionsWon = (s.stats.auctionsWon || 0) + 1;
  if (lot.item) {
    const it = JSON.parse(JSON.stringify(lot.item));
    it.at = Date.now();
    CQ.mailAdd(`Enchère remportée : ${it.name}`, { items: [it] }, 'Hôtel des ventes');
  } else CQ.mailAdd(`Enchère remportée : ${CQ.aucName(lot)}`, { cons: { [lot.cons.id]: lot.cons.n } }, 'Hôtel des ventes');
  CQ.toast(`⚖️ Remporté pour ${price} : ${CQ.esc(CQ.aucName(lot))}. À récupérer dans la boîte aux lettres.`, 'r4');
};

CQ.aucBid = (id, amount) => {
  const lot = CQ.aucLot(id), now = Date.now();
  if (!lot || lot.done || now >= lot.end) return false;
  amount = Math.floor(amount);
  if (amount < CQ.aucMinBid(lot)) { CQ.toast(`Mise minimum : ${CQ.fmt(CQ.aucMinBid(lot))} FP.`, 'red'); return false; }
  const own = lot.top === 'me' ? lot.mine : 0;
  if (CQ.state.fp + own < amount) { CQ.toast('Pas assez de FP.', 'red'); return false; }
  if (own) CQ.refund('fp', own, `Enchère relevée : ${CQ.aucName(lot)}`);
  CQ.pay({ fp: amount }, `Enchère : ${CQ.aucName(lot)}`);
  lot.bid = amount; lot.mine = amount; lot.top = 'me'; lot.bids++;
  if (lot.end - now < CQ.AUC.snipe) lot.end = now + CQ.AUC.snipe; // anti-dernière seconde
  // les autres enchérisseurs réagissent après un délai, plus vite en fin de vente
  const left = lot.end - now;
  lot.npcAt = now + (left < 10 * 60000 ? 5000 + Math.random() * 40000 : 30000 + Math.random() * Math.min(15 * 60000, left * 0.6));
  return true;
};
CQ.aucBuyout = (id) => {
  const lot = CQ.aucLot(id);
  if (!lot || lot.done) return false;
  if (!CQ.pay({ gems: lot.buyout }, `Achat direct : ${CQ.aucName(lot)}`)) return false;
  if (lot.top === 'me' && lot.mine) CQ.refund('fp', lot.mine, `Mise rendue (achat direct) : ${CQ.aucName(lot)}`);
  lot.done = true; lot.top = 'me'; lot.mine = 0; lot.end = Date.now();
  CQ.aucWin(lot, `${lot.buyout} diamants`);
  return true;
};

/* =========================================================
   Page : Hôtel des ventes
   ========================================================= */
P.auction = {
  title: 'Hôtel des ventes',
  render() {
    CQ.aucTick();
    const s = S(), a = s.auction, tab = CQ.tabOf('auc', 'all');
    const live = a.lots.filter((l) => !l.done || (l.top === 'me' && Date.now() - l.end < 15 * 60000));
    const list = live.filter((l) => tab === 'all' || (tab === 'gear' && l.item) || (tab === 'cons' && l.cons) || (tab === 'mine' && (l.top === 'me' || l.mine)));
    const leading = live.filter((l) => !l.done && l.top === 'me').length;
    P.auction._sig = P.auction.sig();
    return `<div class="card row between wrap mb">
        <div><div class="kicker">Arrivage n°${a.round % 10000}</div><b>Prochain arrivage dans <span class="tnum" id="aucNext">${CQ.fmtClock((a.round + 1) * CQ.AUC.round - Date.now())}</span></b>
          <div class="small muted">Équipement de qualité supérieure, fioles d’énergie et parchemins. Mises en FP, achat direct en diamants.</div></div>
        <div class="row wrap" style="gap:8px">${CQ.money('fp', s.fp)} ${CQ.money('gems', s.gems)}${leading ? ` <span class="chip green">Vous menez sur ${leading} lot${leading > 1 ? 's' : ''}</span>` : ''}</div>
      </div>
      ${CQ.tabs('auc', [['all', 'Tout'], ['gear', '⚔️ Équipement'], ['cons', '🧪 Consommables'], ['mine', '⚖️ Mes enchères']])}
      ${list.length ? `<div class="lots">${list.map(P.auction.card).join('')}</div>` : '<div class="empty">Aucun lot ici pour le moment.</div>'}
      <div class="note mt">Votre mise est bloquée tant que vous menez. Si quelqu’un enchérit plus haut, elle vous est rendue aussitôt. Une mise dans les 2 dernières minutes prolonge la vente de 2 minutes. Les lots remportés arrivent dans la boîte aux lettres. Les FP d’une enchère gagnée sont détruits.</div>`;
  },
  card(lot) {
    const it = lot.item, c = lot.cons && CQ.CONSUMABLES[lot.cons.id], min = CQ.aucMinBid(lot);
    const state = lot.done ? (lot.top === 'me' ? '<span class="chip green">Remporté</span>' : '<span class="chip">Terminé</span>')
      : lot.top === 'me' ? '<span class="chip green">Vous menez</span>' : lot.bid ? `<span class="chip">${lot.bids} enchère${lot.bids > 1 ? 's' : ''}</span>` : '<span class="chip">Aucune enchère</span>';
    const head = it
      ? `<div class="row" style="gap:10px">${CQ.itemTile(it, { act: 'aucInfo', arg: lot.id })}<div style="min-width:0"><b class="r${it.rarity} rt">${CQ.esc(it.name)}</b>
          <div class="small muted">${CQ.RARITIES[it.rarity].name} · ${CQ.SLOT[it.slot].name} · niv. ${it.ilvl}</div>
          <div class="row wrap" style="gap:4px;margin-top:4px"><span class="chip gold">Qualité supérieure</span>${it.set ? `<span class="chip red">Ensemble</span>` : ''}</div></div></div>
        <div class="rolls compact">${it.rolls.map((r) => `<div class="${r.main ? 'main' : 'aff'}"><span>${CQ.statLine(r.k, r.v)}</span></div>`).join('')}</div>`
      : `<div class="row" style="gap:10px"><span class="cons-ico">${c.icon}</span><div><b>${c.name}${lot.cons.n > 1 ? ` ×${lot.cons.n}` : ''}</b><div class="small muted">${c.desc}</div></div></div>`;
    return `<div class="card lot ${lot.top === 'me' ? 'lead' : ''} ${lot.done ? 'ended' : ''}">
      ${head}
      <div class="sep"></div>
      <div class="row between"><div><div class="kicker">${lot.bid ? 'Enchère actuelle' : 'Mise de départ'}</div><div class="c-fp big" style="font-size:20px">${CQ.fmt(lot.bid || lot.start)} <span class="small muted">FP</span></div></div>
        <div style="text-align:right">${CQ.watchBtn(lot)} ${state}<div class="small muted tnum" data-end="${lot.end}">${lot.done ? '' : CQ.fmtLeft(lot.end - Date.now())}</div></div></div>
      ${lot.done ? '' : `<div class="row mt" style="gap:6px">
        <button class="btn primary sm" style="flex:1" data-act="aucBid" data-arg="${lot.id}" ${lot.top === 'me' || S().fp < min ? 'disabled' : ''}>Enchérir ${CQ.fmt(min)} FP</button>
        <button class="btn sm gem" data-act="aucBuy" data-arg="${lot.id}" ${S().gems < lot.buyout ? 'disabled' : ''} title="Achat direct">💎 ${CQ.fmt(lot.buyout)}</button></div>`}
    </div>`;
  },
  // signature de l'état des lots : on redessine seulement quand quelque chose change
  sig() { return S().auction.lots.map((l) => `${l.id}${l.top}${l.bid}${l.done ? 1 : 0}`).join('|') + S().auction.round; },
  tick() {
    const n = CQ.$('#aucNext');
    if (!n) return;
    CQ.aucTick();
    if (P.auction.sig() !== P.auction._sig) { CQ.refresh(); return; }
    n.textContent = CQ.fmtClock((CQ.aucRound() + 1) * CQ.AUC.round - Date.now());
    for (const el of document.querySelectorAll('[data-end]')) if (el.textContent) el.textContent = CQ.fmtLeft(Number(el.dataset.end) - Date.now());
  },
};
A.aucBid = (id) => {
  const lot = CQ.aucLot(id);
  if (lot && CQ.aucBid(id, CQ.aucMinBid(lot))) { CQ.toast(`⚖️ Vous menez : ${CQ.esc(CQ.aucName(lot))}`, 'green'); CQ.save(); CQ.refresh(); }
};
A.aucBidCustom = (id) => {
  const v = Number((CQ.$('#aucAmt') || {}).value);
  const lot = CQ.aucLot(id);
  if (lot && CQ.aucBid(id, v)) { CQ.closeModal(); CQ.toast(`⚖️ Vous menez : ${CQ.esc(CQ.aucName(lot))}`, 'green'); CQ.save(); CQ.refresh(); }
};
A.aucBuy = (id) => {
  const lot = CQ.aucLot(id);
  if (!lot) return;
  CQ.confirm('Achat direct ?', `<b>${CQ.esc(CQ.aucName(lot))}</b> pour <b class="c-gem">${CQ.fmt(lot.buyout)} diamants</b>. Le lot part immédiatement dans votre boîte aux lettres.`, 'Acheter', () => {
    if (CQ.aucBuyout(id)) { CQ.save(); CQ.refresh(); }
  });
};
A.aucInfo = (id) => {
  const lot = CQ.aucLot(id);
  if (!lot || !lot.item) return;
  CQ.openModal(`<div class="item-detail">${CQ.itemHead(lot.item)}${CQ.rollsHtml(lot.item)}${CQ.compareHtml(lot.item)}</div>
    ${lot.done ? '' : `<div class="sep"></div><div class="field"><label>Votre mise (minimum ${CQ.fmt(CQ.aucMinBid(lot))} FP · solde ${CQ.fmt(S().fp)} FP)</label>
    <div class="row"><input class="input" id="aucAmt" type="number" min="${CQ.aucMinBid(lot)}" value="${CQ.aucMinBid(lot)}"><button class="btn primary" data-act="aucBidCustom" data-arg="${lot.id}" ${lot.top === 'me' ? 'disabled' : ''}>Enchérir</button></div></div>
    <div class="actions"><button class="btn gem" data-act="aucBuy" data-arg="${lot.id}" ${S().gems < lot.buyout ? 'disabled' : ''}>Achat direct · 💎 ${CQ.fmt(lot.buyout)}</button></div>`}`);
};
