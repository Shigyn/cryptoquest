'use strict';
// Marché entre joueurs, en CQ : on y revend l'équipement jamais équipé (butin, coffres, enchères).
// Frais de mise en vente 2 % + commission 5 % sur la vente : les deux sont détruits (puits de CQ).
// Prototype : les autres vendeurs et acheteurs sont simulés. Un vendeur simulé renouvelle ses offres chaque heure ;
// un acheteur simulé achète vos objets plus ou moins vite selon le prix comparé au prix de référence.
CQ.MKT = {
  fee: 0.02, feeMin: 10, tax: 0.05, max: 10, ttl: 48 * 3600000, slot: 3600000, offers: 16,
  floor: 0.3, ceil: 5, // prix autorisé : entre 30 % et 5 fois le prix de référence (anti-transferts déguisés)
  rarity: [6, 22, 38, 24, 9, 1],
};
CQ.mktSlot = (t = Date.now()) => Math.floor(t / CQ.MKT.slot);

// offres des vendeurs simulés de l'heure en cours
CQ.mktOffers = () => {
  const s = CQ.state, slot = CQ.mktSlot(), band = Math.max(1, s.level - (s.level % 3));
  const key = slot + ':' + band;
  if (CQ.mktOffers._key !== key) {
    const rnd = CQ.seeded('mkt' + key), list = [];
    for (let i = 0; i < CQ.MKT.offers; i++) {
      const r = CQ.pickWeightedR(CQ.MKT.rarity, rnd), ilvl = Math.max(1, band - 3 + Math.floor(rnd() * 7));
      const it = CQ.makeItem(CQ.SLOTS[Math.floor(rnd() * CQ.SLOTS.length)].id, r, ilvl, { rnd, good: rnd() < 0.25, id: `M${slot}-${i}` });
      list.push({ id: it.id, item: it, price: Math.round(CQ.refPrice(it) * (0.75 + rnd() * 0.75)), seller: CQ.BOT_NAMES[Math.floor(rnd() * CQ.BOT_NAMES.length)] });
    }
    CQ.mktOffers._key = key; CQ.mktOffers._list = list;
  }
  return CQ.mktOffers._list.filter((o) => !s.market.bought[o.id]);
};
CQ.mktHist = (it, price) => {
  const h = CQ.state.market.hist, k = it.slot + '-' + it.rarity;
  (h[k] = h[k] || []).push(price);
  if (h[k].length > 12) h[k].shift();
};
CQ.mktMedian = (it) => {
  const h = (CQ.state.market.hist[it.slot + '-' + it.rarity] || []).slice().sort((a, b) => a - b);
  return h.length ? h[Math.floor(h.length / 2)] : 0;
};

CQ.mktBuy = (id) => {
  const s = CQ.state, o = CQ.mktOffers().find((x) => x.id === id);
  if (!o) return false;
  if (!CQ.pay({ cq: o.price }, `Marché : achat ${o.item.name} (${o.seller})`)) return false;
  s.market.bought[o.id] = 1;
  // on ne garde que les achats de l'heure en cours
  for (const k of Object.keys(s.market.bought)) if (!k.startsWith('M' + CQ.mktSlot() + '-')) delete s.market.bought[k];
  const it = JSON.parse(JSON.stringify(o.item));
  it.boughtAt = Date.now();
  CQ.mktHist(it, o.price);
  if (s.inventory.length >= CQ.INV_CAP) CQ.mailAdd(`Achat au marché : ${it.name}`, { items: [it] }, o.seller);
  else { it.id = s.nextId++; it.at = Date.now(); CQ.addItem(it); }
  it.boughtAt = Date.now();
  return true;
};

CQ.mktBounds = (it) => { const r = CQ.refPrice(it); return [Math.ceil(r * CQ.MKT.floor), Math.floor(r * CQ.MKT.ceil)]; };
CQ.mktFee = (price) => Math.max(CQ.MKT.feeMin, Math.round(price * CQ.MKT.fee));
CQ.mktList = (itemId, price) => {
  const s = CQ.state, it = CQ.itemById(itemId);
  price = Math.floor(price);
  if (!it || CQ.tradeBlock(it)) { CQ.toast(`Impossible : ${it ? CQ.tradeBlock(it).toLowerCase() : 'objet introuvable'}.`, 'red'); return false; }
  if (s.market.mine.length >= CQ.MKT.max) { CQ.toast(`${CQ.MKT.max} ventes au maximum.`, 'red'); return false; }
  const [lo, hi] = CQ.mktBounds(it);
  if (!(price >= lo && price <= hi)) { CQ.toast(`Prix autorisé : entre ${CQ.fmt(lo)} et ${CQ.fmt(hi)} CQ.`, 'red'); return false; }
  if (!CQ.pay({ cq: CQ.mktFee(price) }, `Marché : frais de mise en vente (${it.name})`)) return false;
  s.inventory = s.inventory.filter((x) => x.id !== it.id);
  const now = Date.now();
  s.market.mine.push({ id: 'L' + now.toString(36), item: it, price, at: now, end: now + CQ.MKT.ttl, checked: now });
  return true;
};
CQ.mktCancel = (id) => {
  const s = CQ.state, l = s.market.mine.find((x) => x.id === id);
  if (!l) return false;
  s.market.mine = s.market.mine.filter((x) => x.id !== id);
  if (s.inventory.length >= CQ.INV_CAP) CQ.mailAdd(`Vente retirée : ${l.item.name}`, { items: [l.item] }, 'Marché');
  else s.inventory.push(l.item);
  return true;
};
// chance horaire qu'un acheteur simulé prenne l'objet, selon le prix comparé à la référence
CQ.mktBuyRate = (it, price) => {
  // revente immédiate d'un achat au marché : les acheteurs simulés ne jouent pas les intermédiaires
  if (it.boughtAt && Date.now() - it.boughtAt < 48 * 3600000) return 0.002;
  const r = price / CQ.refPrice(it);
  return r <= 0.8 ? 0.5 : r <= 1 ? 0.25 : r <= 1.3 ? 0.1 : r <= 2 ? 0.03 : 0.005;
};
CQ.marketTick = () => {
  const s = CQ.state, now = Date.now();
  for (const l of s.market.mine.slice()) {
    const until = Math.min(now, l.end), h = (until - l.checked) / 3600000;
    if (h <= 0) continue;
    l.checked = until;
    if (Math.random() < 1 - Math.pow(1 - CQ.mktBuyRate(l.item, l.price), h)) {
      const net = Math.round(l.price * (1 - CQ.MKT.tax));
      s.market.mine = s.market.mine.filter((x) => x.id !== l.id);
      CQ.mktHist(l.item, l.price);
      s.stats.marketSales = (s.stats.marketSales || 0) + 1;
      CQ.mailAdd(`Vendu : ${l.item.name}`, { cq: net, note: `${CQ.fmt(l.price)} CQ − ${CQ.MKT.tax * 100} % de commission` }, CQ.BOT_NAMES[Math.floor(Math.random() * CQ.BOT_NAMES.length)]);
      CQ.toast(`🏛️ Vendu : ${CQ.esc(l.item.name)} · +${CQ.fmt(net)} CQ dans la boîte aux lettres`, 'green');
    } else if (now >= l.end) {
      s.market.mine = s.market.mine.filter((x) => x.id !== l.id);
      CQ.mailAdd(`Invendu : ${l.item.name}`, { items: [l.item] }, 'Marché');
    }
  }
};

/* =========================================================
   Page : Marché
   ========================================================= */
P.market = {
  title: 'Marché',
  render() {
    const tab = CQ.tabOf('mkt', 'buy'), s = S();
    return CQ.tabs('mkt', [['buy', '🛒 Acheter'], ['sell', '💰 Vendre'], ['mine', `📋 Mes ventes (${s.market.mine.length}/${CQ.MKT.max})`]]) + P.market[tab]();
  },
  buy() {
    const f = CQ.ui.mf || (CQ.ui.mf = { slot: 'all', rarity: 'all' });
    let list = CQ.mktOffers();
    if (f.slot !== 'all') list = list.filter((o) => o.item.slot === f.slot);
    if (f.rarity !== 'all') list = list.filter((o) => o.item.rarity === Number(f.rarity));
    list.sort((a, b) => b.item.rarity - a.item.rarity || a.price - b.price);
    return `<div class="filters">
      <select class="input" data-change="mfSlot"><option value="all">Tous les emplacements</option>${CQ.SLOTS.map((sl) => `<option value="${sl.id}" ${f.slot === sl.id ? 'selected' : ''}>${sl.icon} ${sl.name}</option>`).join('')}</select>
      <select class="input" data-change="mfRarity"><option value="all">Toutes les raretés</option>${CQ.RARITIES.map((r, i) => `<option value="${i}" ${String(f.rarity) === String(i) ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
      <span class="chip" style="margin-left:auto">Nouvelles offres dans ${CQ.fmtDur((CQ.mktSlot() + 1) * CQ.MKT.slot - Date.now())}</span>
    </div>
    ${list.length ? `<div class="tbl-wrap"><table class="tbl mkt">${list.map((o) => {
      const d = o.price / CQ.refPrice(o.item) - 1;
      return `<tr><td style="width:60px">${CQ.itemTile(o.item, { act: 'mktInfo' })}</td>
        <td><b class="r${o.item.rarity} rt">${CQ.esc(o.item.name)}</b>${o.item.good ? ' <span class="chip gold">Qualité supérieure</span>' : ''}
          <div class="small muted">${CQ.RARITIES[o.item.rarity].name} · ${CQ.SLOT[o.item.slot].name} · niv. ${o.item.ilvl} · puissance ${CQ.itemPower(o.item)} · vendu par ${CQ.esc(o.seller)}</div></td>
        <td class="r"><b class="c-cq">${CQ.fmt(o.price)}</b> <span class="small dim">CQ</span><div class="small ${d < 0 ? 'c-green' : 'dim'}">${d < 0 ? '−' : '+'}${Math.abs(Math.round(d * 100))} % / réf.</div></td>
        <td class="r"><button class="btn sm primary" data-act="mktBuy" data-arg="${o.id}" ${S().cq >= o.price ? '' : 'disabled'}>Acheter</button></td></tr>`;
    }).join('')}</table></div>` : '<div class="empty">Plus aucune offre pour ce filtre. De nouveaux vendeurs arrivent chaque heure.</div>'}
    <div class="note mt">Le marché se paie en CQ. Un objet acheté ici peut être revendu tant que vous ne l’avez pas équipé : une fois porté, il est lié à votre compte.</div>`;
  },
  sell() {
    const s = S();
    const items = s.inventory.filter((it) => !CQ.tradeBlock(it)).sort((a, b) => b.rarity - a.rarity || CQ.itemPower(b) - CQ.itemPower(a));
    const blocked = s.inventory.length - items.length;
    return `<div class="card"><h3>Objets vendables<span class="right">${items.length} objet${items.length > 1 ? 's' : ''}</span></h3>
      ${items.length ? `<div class="items">${items.map((it) => CQ.itemTile(it, { act: 'mktSellForm' })).join('')}</div>` : '<div class="empty">Aucun objet vendable.</div>'}
      <div class="note mt">${blocked} objet${blocked > 1 ? 's' : ''} non vendable${blocked > 1 ? 's' : ''} : équipés, liés (déjà portés une fois), ou verrouillés. Frais de mise en vente ${CQ.MKT.fee * 100} % (minimum ${CQ.MKT.feeMin} CQ), non remboursés, et ${CQ.MKT.tax * 100} % de commission sur la vente. Durée : 48 h.</div></div>`;
  },
  mine() {
    const s = S();
    return `<div class="card"><h3>Mes ventes<span class="right">${s.market.mine.length}/${CQ.MKT.max}</span></h3>
      ${s.market.mine.length ? s.market.mine.map((l) => `<div class="list-row">${CQ.itemTile(l.item, { act: 'noop' })}<div class="lr"><b class="r${l.item.rarity} rt">${CQ.esc(l.item.name)}</b>
        <span>${CQ.fmt(l.price)} CQ · référence ${CQ.fmt(CQ.refPrice(l.item))} · expire dans ${CQ.fmtDur(l.end - Date.now())}</span></div>
        <button class="btn sm ghost" data-act="mktCancel" data-arg="${l.id}">Retirer</button></div>`).join('') : '<div class="empty">Aucune vente en cours.</div>'}
      <div class="note mt">Les ventes conclues et les invendus arrivent dans la boîte aux lettres. Plus le prix est proche de la référence, plus la vente est rapide.</div></div>`;
  },
};
A.mfSlot = (v) => { CQ.ui.mf.slot = v; CQ.refresh(); };
A.mfRarity = (v) => { CQ.ui.mf.rarity = v; CQ.refresh(); };
A.mktInfo = (id) => {
  const o = CQ.mktOffers().find((x) => x.id === id);
  if (!o) return;
  CQ.openModal(`<div class="item-detail">${CQ.itemHead(o.item)}${CQ.rollsHtml(o.item)}${CQ.compareHtml(o.item)}</div>
    <div class="kv mt"><span>Prix</span><span class="c-cq">${CQ.fmt(o.price)} CQ</span><span>Prix de référence</span><span>${CQ.fmt(CQ.refPrice(o.item))} CQ</span><span>Vendeur</span><span>${CQ.esc(o.seller)}</span></div>
    <div class="actions"><button class="btn primary" data-act="mktBuy" data-arg="${o.id}" ${S().cq >= o.price ? '' : 'disabled'}>Acheter</button></div>`);
};
A.mktBuy = (id) => {
  const o = CQ.mktOffers().find((x) => x.id === id);
  if (o && CQ.mktBuy(id)) { CQ.closeModal(); CQ.toast(`🏛️ Acheté : ${CQ.esc(o.item.name)}`, 'green'); CQ.save(); CQ.refresh(); }
};
A.mktSellForm = (id) => {
  const it = CQ.itemById(Number(id));
  if (!it) return;
  const ref = CQ.refPrice(it), [lo, hi] = CQ.mktBounds(it), med = CQ.mktMedian(it);
  CQ.openModal(`<div class="item-detail">${CQ.itemHead(it)}${CQ.rollsHtml(it)}</div><div class="sep"></div>
    <div class="kv"><span>Prix de référence</span><span>${CQ.fmt(ref)} CQ</span>${med ? `<span>Dernières ventes (médiane)</span><span>${CQ.fmt(med)} CQ</span>` : ''}
      <span>Prix autorisé</span><span>${CQ.fmt(lo)} – ${CQ.fmt(hi)} CQ</span></div>
    <div class="field mt"><label>Votre prix (CQ)</label><input class="input" id="mktPrice" type="number" min="${lo}" max="${hi}" value="${ref}" data-input="mktPrice"></div>
    <div class="quick mt">${[[0.8, 'Vente rapide'], [1, 'Référence'], [1.3, 'Ambitieux']].map(([f, l]) => `<button class="btn sm" data-act="mktQuick" data-arg="${Math.round(ref * f)}">${l}</button>`).join('')}</div>
    <div class="small muted mt" id="mktNet">${P.market.net(it, ref)}</div>
    <div class="actions"><button class="btn primary" data-act="mktList" data-arg="${it.id}">Mettre en vente</button></div>`);
};
P.market.net = (it, price) => {
  price = Math.floor(Number(price) || 0);
  const rate = CQ.mktBuyRate(it, price);
  const speed = rate >= 0.5 ? 'en moins de 2 h' : rate >= 0.25 ? 'en quelques heures' : rate >= 0.1 ? 'dans la journée' : rate >= 0.03 ? 'en 1 à 2 jours' : 'difficilement';
  return `Frais : ${CQ.fmt(CQ.mktFee(price))} CQ maintenant · vous recevrez ${CQ.fmt(Math.round(price * (1 - CQ.MKT.tax)))} CQ · vente probable ${speed}`;
};
A.mktPrice = (v) => {
  const el = CQ.$('#mktNet'), id = CQ.$('[data-act="mktList"]');
  const it = id && CQ.itemById(Number(id.dataset.arg));
  if (el && it) el.innerHTML = P.market.net(it, v);
};
A.mktQuick = (v) => { const el = CQ.$('#mktPrice'); if (el) { el.value = v; A.mktPrice(v); } };
A.mktList = (id) => {
  const it = CQ.itemById(Number(id)), price = Number(CQ.$('#mktPrice').value);
  if (it && CQ.mktList(Number(id), price)) { CQ.closeModal(); CQ.toast(`🏛️ En vente : ${CQ.esc(it.name)}`, 'green'); CQ.save(); CQ.refresh(); }
};
A.mktCancel = (id) => CQ.confirm('Retirer la vente ?', 'L’objet revient dans votre inventaire. Les frais de mise en vente ne sont pas remboursés.', 'Retirer', () => {
  if (CQ.mktCancel(id)) { CQ.save(); CQ.refresh(); }
});

/* =========================================================
   Page : Boîte aux lettres
   ========================================================= */
P.mail = {
  title: 'Boîte aux lettres',
  render() {
    const s = S();
    return `<div class="card"><h3>📬 Courrier<span class="right">${s.mail.length ? `<button class="btn sm gold" data-act="mailAll">Tout récupérer</button>` : ''}</span></h3>
      ${s.mail.length ? s.mail.map((m) => {
        const cur = ['cq', 'fp', 'gems', 'honor'].filter((k) => m[k]).map((k) => CQ.money(k, m[k])).join(' ');
        const cons = m.cons ? CQ.rewardHtml({ cons: m.cons }) : '';
        const chest = m.chest ? CQ.rewardHtml({ chest: m.chest }) : '';
        return `<div class="list-row mail"><div class="lr"><b>${CQ.esc(m.title)}</b><span>${CQ.esc(m.from)} · ${CQ.fmtDate(m.t)}${m.note ? ' · ' + CQ.esc(m.note) : ''}</span>
          <div class="row wrap" style="gap:6px;margin-top:6px">${(m.items || []).map((it) => CQ.itemTile(it, { act: 'noop' })).join('')}${cur}${cons}${chest}</div></div>
          <button class="btn sm primary" data-act="mailClaim" data-arg="${m.id}">Récupérer</button></div>`;
      }).join('') : '<div class="empty">Aucun courrier. Les lots remportés, les ventes et les récompenses de saison arrivent ici.</div>'}
      <div class="note mt">Un objet ne peut pas être récupéré si l’inventaire est plein (${CQ.INV_CAP} places) : il reste ici en attendant.</div></div>`;
  },
};
A.mailClaim = (id) => {
  const r = CQ.mailClaim(id);
  if (r.ok) CQ.toast(r.kept ? 'Inventaire plein : un objet reste dans la boîte aux lettres.' : '📬 Récupéré.', r.kept ? 'red' : 'green');
  CQ.save(); CQ.refresh();
};
A.mailAll = () => {
  const kept = CQ.mailClaimAll();
  CQ.toast(kept ? `Inventaire plein : ${kept} objet${kept > 1 ? 's restent' : ' reste'} dans la boîte aux lettres.` : '📬 Tout est récupéré.', kept ? 'red' : 'green');
  CQ.save(); CQ.refresh();
};
