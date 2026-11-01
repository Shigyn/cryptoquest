'use strict';
// V3-2 — Forge à matériaux : fonte des objets, réserve de matériaux en 5 qualités, recettes de préfixes et suffixes
// découvertes en fondant, forge ciblée, amélioration de +11 à +15 avec de la Cendre de qualité.

CQ.MATS = {
  fer: { name: 'Fer', icon: '⛓️' }, cuir: { name: 'Cuir', icon: '🟫' }, os: { name: 'Os', icon: '🦴' },
  essence: { name: 'Essence', icon: '💧' }, sang: { name: 'Sang', icon: '🩸' }, cendre: { name: 'Cendre', icon: '🌋' },
};
CQ.MAT_KEYS = Object.keys(CQ.MATS);
CQ.QUALITIES = ['brut', 'raffiné', 'pur', 'ancestral', 'divin'];
CQ.QUALITY_COLORS = ['#a19b96', '#63c46f', '#4a93ff', '#b06cff', '#f4a227'];
// deux matériaux par emplacement, la Cendre sert de catalyseur (recettes, +11 à +15)
CQ.SLOT_MATS = { weapon: ['fer', 'sang'], helmet: ['fer', 'os'], armor: ['fer', 'cuir'], gloves: ['cuir', 'fer'], boots: ['cuir', 'os'], ring: ['essence', 'sang'], amulet: ['essence', 'os'] };
// améliorer une qualité : 10 unités → 1 de la qualité suivante, plus ce coût par unité produite
CQ.QUALITY_UP = [{ cq: 60 }, { cq: 450 }, { fp: 5 }, { fp: 25 }];

// recettes : chaque suffixe et chaque préfixe donne une stat en plus de celles de l'objet
CQ.SUFFIX_FX = {
  'du Loup': 'crit', 'des Cendres': 'atk', "de l'Aube rouge": 'hp', 'du Vide': 'pen', 'des Cryptes': 'def', 'du Sang-Roi': 'critd', "de l'Ombre": 'dodge',
  "d'Obsidienne": 'parry', 'des Murmures': 'hit', 'du Pacte': 'eregen', 'de la Fange': 'resil', 'du Dernier Serment': 'emax', 'des Braises': 'spd', 'du Corbeau': 'luck',
};
// adjectifs invariables (s'accordent avec tous les noms d'objets)
CQ.PREFIX_FX = {
  Runique: 'xp', Funeste: 'crit', Écarlate: 'atk', Antique: 'def', Sauvage: 'spd', Céleste: 'eregen',
  Sinistre: 'pen', Impitoyable: 'critd', Lugubre: 'resil', Indomptable: 'hp',
};
CQ.RECIPE_FACTOR = 0.7; // force d'une stat de recette (une stat principale vaut 1)

// ---------- Réserve ----------
CQ.matsOf = () => CQ.state.mats || (CQ.state.mats = {});
CQ.matCount = (m, q) => ((CQ.matsOf()[m] || [])[q] || 0);
CQ.matAdd = (m, q, n) => { const r = CQ.matsOf(); r[m] = r[m] || [0, 0, 0, 0, 0]; r[m][q] = Math.max(0, (r[m][q] || 0) + n); };
CQ.matLabel = (m, q) => `<span class="mat q${q}">${CQ.MATS[m].icon} ${CQ.MATS[m].name} ${CQ.QUALITIES[q]}</span>`;

// ---------- Fonte ----------
CQ.smeltYield = (it, rnd = Math.random) => {
  const out = [], q0 = Math.max(0, it.rarity - 1);
  const q = () => Math.min(4, q0 + (rnd() < 0.35 ? 1 : 0));
  for (const m of CQ.SLOT_MATS[it.slot]) out.push([m, q(), Math.max(1, Math.round((3 + it.ilvl / 5) * (1 + it.rarity * 0.5) * (0.8 + rnd() * 0.4)))]);
  if (it.rarity >= 2) out.push(['cendre', q(), 1 + it.rarity - 2 + Math.floor(it.plus / 3)]);
  return out;
};
// recettes portées par le nom de l'objet
CQ.recipesOf = (it) => {
  const r = [];
  for (const sfx of Object.keys(CQ.SUFFIX_FX)) if (it.name.endsWith(' ' + sfx)) r.push(['suf', sfx]);
  for (const pre of Object.keys(CQ.PREFIX_FX)) if (it.name.split(' ').includes(pre)) r.push(['pre', pre]);
  return r;
};
CQ.known = () => CQ.state.recipes || (CQ.state.recipes = { pre: {}, suf: {} });
CQ.smelt = (ids) => {
  const s = CQ.state, gained = {}, learned = [];
  let n = 0;
  for (const id of ids) {
    const it = CQ.itemById(id);
    if (!it || it.locked || CQ.isEquipped(it)) continue;
    for (const [m, q, k] of CQ.smeltYield(it)) { CQ.matAdd(m, q, k); gained[m + q] = (gained[m + q] || 0) + k; }
    const kn = CQ.known();
    for (const [kind, name] of CQ.recipesOf(it)) if (!kn[kind][name]) { kn[kind][name] = 1; learned.push(name); }
    // un objet Rare ou mieux peut révéler un préfixe encore inconnu
    if (it.rarity >= 2 && Math.random() < 0.15) {
      const left = Object.keys(CQ.PREFIX_FX).filter((p) => !kn.pre[p]);
      if (left.length) { const p = CQ.pick(left); kn.pre[p] = 1; learned.push(p); }
    }
    s.inventory = s.inventory.filter((x) => x.id !== id);
    n++;
  }
  s.stats.smelted = (s.stats.smelted || 0) + n;
  if (n) CQ.questProgress('forge');
  return { n, gained, learned };
};
CQ.qualityUp = (m, q, times = 1) => {
  if (q >= 4) return 0;
  let done = 0;
  for (let i = 0; i < times; i++) {
    if (CQ.matCount(m, q) < 10) break;
    const cost = CQ.QUALITY_UP[q];
    if (!CQ.canPay(cost)) break;
    CQ.pay(cost, `Forge : ${CQ.MATS[m].name} ${CQ.QUALITIES[q + 1]}`);
    CQ.matAdd(m, q, -10); CQ.matAdd(m, q + 1, 1); done++;
  }
  return done;
};

// ---------- Forge ciblée ----------
// qualité Q des matériaux → rareté Q + 1 (brut = Peu commun … divin = Mythique)
CQ.recipeCost = (slot, q, ilvl, pre, suf) => {
  const [a, b] = CQ.SLOT_MATS[slot], n = Math.round(10 + ilvl / 3);
  const mats = [[a, q, n], [b, q, n]];
  const cat = (pre ? 2 : 0) + (suf ? 2 : 0);
  if (cat) mats.push(['cendre', q, cat]);
  return { mats, cq: Math.round(200 * (1 + ilvl / 8) * (1 + q)) };
};
CQ.canForge = (c) => c.mats.every(([m, q, n]) => CQ.matCount(m, q) >= n) && CQ.state.cq >= c.cq;
CQ.forgeRecipe = (slot, q, pre, suf) => {
  const s = CQ.state, ilvl = s.level, c = CQ.recipeCost(slot, q, ilvl, pre, suf);
  if (!CQ.canForge(c)) { CQ.toast('Matériaux ou CQ insuffisants.', 'red'); return null; }
  for (const [m, qq, n] of c.mats) CQ.matAdd(m, qq, -n);
  CQ.pay({ cq: c.cq }, `Forge : ${CQ.SLOT[slot].name} ${CQ.QUALITIES[q]}`);
  const r = q + 1, it = CQ.makeItem(slot, r, ilvl);
  const base = it.name.split(' ')[0];
  if (pre) it.rolls.push({ k: CQ.PREFIX_FX[pre], v: CQ.rollStat(CQ.PREFIX_FX[pre], ilvl, r, CQ.RECIPE_FACTOR), pre: true });
  if (suf) it.rolls.push({ k: CQ.SUFFIX_FX[suf], v: CQ.rollStat(CQ.SUFFIX_FX[suf], ilvl, r, CQ.RECIPE_FACTOR), suf: true });
  it.name = [base, pre, suf || CQ.pick(CQ.SUFFIXES)].filter(Boolean).join(' ');
  it.forged = true;
  s.stats.crafts++;
  CQ.questProgress('forge');
  return CQ.addItem(it, 'forge');
};

// ---------- Amélioration de +11 à +15 ----------
CQ.upgradeMats = (it) => (it.plus < 10 ? null : { mat: 'cendre', q: Math.min(4, it.plus - 9), n: 3 + (it.plus - 10) * 2 });
(() => {
  const up = CQ.upgrade;
  CQ.upgrade = (id) => {
    const it = CQ.itemById(id), um = it && CQ.upgradeMats(it);
    if (um) {
      if (CQ.matCount(um.mat, um.q) < um.n) { CQ.toast('Cendre de qualité insuffisante.', 'red'); return null; }
      if (!CQ.canPay({ cq: CQ.upgradeCost(it) })) { CQ.toast('Fonds insuffisants.', 'red'); return null; }
      CQ.matAdd(um.mat, um.q, -um.n);
    }
    return up(id);
  };
})();

/* =========================================================
   Onglets de la Forge
   ========================================================= */
P.forge.recipe = () => {
  const s = S(), f = CQ.ui.fr || (CQ.ui.fr = { slot: 'weapon', q: 0, pre: '', suf: '' }), kn = CQ.known();
  const c = CQ.recipeCost(f.slot, f.q, s.level, f.pre, f.suf), r = f.q + 1;
  const pres = Object.keys(kn.pre), sufs = Object.keys(kn.suf);
  const stat = (k) => `${CQ.STATS[k].name} ≈ +${CQ.fmtStat(k, CQ.rollStat(k, s.level, r, CQ.RECIPE_FACTOR, () => 0.5))}`;
  return `<div class="grid g-side"><div class="card"><h3>Forger un objet<span class="right">niveau d’objet ${s.level}</span></h3>
    <div class="field"><label>Emplacement</label><div class="tabs seg wrap">${CQ.SLOTS.map((sl) => `<button class="tab ${f.slot === sl.id ? 'on' : ''}" data-act="frSet" data-arg="slot:${sl.id}">${sl.icon} ${sl.name}</button>`).join('')}</div></div>
    <div class="field mt"><label>Qualité des matériaux → rareté</label><div class="tabs seg wrap">${CQ.QUALITIES.map((q, i) => `<button class="tab ${f.q === i ? 'on' : ''}" data-act="frSet" data-arg="q:${i}"><span class="r${i + 1} rt">${q} → ${CQ.RARITIES[i + 1].name}</span></button>`).join('')}</div></div>
    <div class="grid g2 mt">
      <div class="field"><label>Préfixe (${pres.length}/${Object.keys(CQ.PREFIX_FX).length} connus)</label><select class="input" data-change="frPre"><option value="">Aucun</option>${pres.map((p) => `<option ${f.pre === p ? 'selected' : ''} value="${p}">${p} · ${CQ.STATS[CQ.PREFIX_FX[p]].name}</option>`).join('')}</select></div>
      <div class="field"><label>Suffixe (${sufs.length}/${Object.keys(CQ.SUFFIX_FX).length} connus)</label><select class="input" data-change="frSuf"><option value="">Aucun</option>${sufs.map((p) => `<option ${f.suf === p ? 'selected' : ''} value="${CQ.esc(p)}">${CQ.esc(p)} · ${CQ.STATS[CQ.SUFFIX_FX[p]].name}</option>`).join('')}</select></div>
    </div>
    <div class="note mt">Les recettes se découvrent en fondant des objets qui les portent dans leur nom. Fondre un objet Rare ou mieux peut aussi révéler un préfixe.</div>
  </div>
  <div class="card gold"><h3>Résultat</h3>
    <div class="kv"><span>Objet</span><span><span class="r${r} rt">${CQ.SLOT[f.slot].name} ${CQ.RARITIES[r].name}</span> niv. ${s.level}</span>
      <span>Stats principales</span><span>${CQ.SLOT[f.slot].main.map((k) => CQ.STATS[k].name).join(', ')}</span>
      ${f.pre ? `<span>Préfixe ${f.pre}</span><span>${stat(CQ.PREFIX_FX[f.pre])}</span>` : ''}
      ${f.suf ? `<span>Suffixe ${CQ.esc(f.suf)}</span><span>${stat(CQ.SUFFIX_FX[f.suf])}</span>` : ''}
      <span>Affixes aléatoires</span><span>${CQ.RARITIES[r].affixes}${r === 5 ? ' + affixe unique' : ''}</span></div>
    <div class="sep"></div><div class="kicker">Coût</div>
    <div class="cost-list">${c.mats.map(([m, q, n]) => `<div class="${CQ.matCount(m, q) >= n ? '' : 'c-fp'}">${CQ.matLabel(m, q)} × ${n} <span class="dim">(${CQ.matCount(m, q)})</span></div>`).join('')}<div>${CQ.money('cq', c.cq)}</div></div>
    <button class="btn primary block mt" data-act="doForge" ${CQ.canForge(c) ? '' : 'disabled'}>Forger</button></div></div>`;
};
P.forge.smelt = () => {
  const s = S(), items = s.inventory.filter((it) => !it.locked && !CQ.isEquipped(it)).sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);
  const sel = (CQ.ui.sel.smelt || []).filter((id) => CQ.itemById(id));
  CQ.ui.sel.smelt = sel;
  const kn = CQ.known(), preview = {};
  for (const id of sel) for (const [m, q, n] of CQ.smeltYield(CQ.itemById(id), () => 0.5)) preview[m + q] = (preview[m + q] || 0) + n;
  return `<div class="grid g-side"><div class="card"><h3>Objets à fondre<span class="right">${sel.length} sélectionné${sel.length > 1 ? 's' : ''}</span></h3>
    ${items.length ? `<div class="items">${items.map((it) => {
      const nw = CQ.recipesOf(it).some(([k, n]) => !kn[k][n]);
      return `<span class="tile-wrap">${CQ.itemTile(it, { act: 'selSmelt', sel: sel.includes(it.id) })}${nw ? '<span class="new-recipe" title="Recette inconnue">📜</span>' : ''}</span>`;
    }).join('')}</div>` : '<div class="empty">Aucun objet à fondre.</div>'}
    <div class="row wrap mt" style="gap:6px">${[0, 1, 2].map((r) => `<button class="btn sm ghost" data-act="smeltPick" data-arg="${r}">Tous les ${CQ.RARITIES[r].name.toLowerCase()}s</button>`).join('')}<button class="btn sm ghost" data-act="smeltPick" data-arg="new">Recettes inconnues</button>${sel.length ? '<button class="btn sm ghost" data-act="smeltPick" data-arg="none">Vider</button>' : ''}</div>
    <div class="note mt">📜 = l’objet porte une recette que vous ne connaissez pas encore. Les objets équipés ou verrouillés sont exclus.</div></div>
    <div class="card gold"><h3>Fourneau</h3>
      ${sel.length ? `<div class="cost-list">${Object.entries(preview).map(([k, n]) => `<div>${CQ.matLabel(k.slice(0, -1), Number(k.slice(-1)))} ≈ ${n}</div>`).join('')}</div>` : '<div class="small muted">Sélectionnez des objets : la fonte donne les matériaux de leur emplacement, et de la Cendre à partir de Rare.</div>'}
      <button class="btn primary block mt" data-act="doSmelt" ${sel.length ? '' : 'disabled'}>Fondre ${sel.length || ''}</button></div></div>`;
};
P.forge.reserve = () => {
  const kn = CQ.known();
  return `<div class="card"><h3>🧱 Réserve de matériaux<span class="right">hors du sac, sans limite</span></h3><div class="tbl-wrap"><table class="tbl">
    <tr><th>Matériau</th>${CQ.QUALITIES.map((q, i) => `<th class="r"><span style="color:${CQ.QUALITY_COLORS[i]}">${q}</span></th>`).join('')}</tr>
    ${CQ.MAT_KEYS.map((m) => `<tr><td>${CQ.MATS[m].icon} ${CQ.MATS[m].name}</td>${CQ.QUALITIES.map((q, i) => {
      const n = CQ.matCount(m, i), can = i < 4 && n >= 10;
      return `<td class="r">${CQ.fmt(n)}${can ? ` <button class="btn sm ghost" data-act="qUp" data-arg="${m}:${i}" title="10 → 1 ${CQ.QUALITIES[i + 1]} · ${CQ.costHtml(CQ.QUALITY_UP[i]).replace(/<[^>]+>/g, '')}">⬆</button>` : ''}</td>`;
    }).join('')}</tr>`).join('')}
  </table></div>
  <div class="note mt">⬆ convertit tout ce qui peut l’être : 10 unités donnent 1 unité de la qualité supérieure, contre ${CQ.QUALITY_UP.map((c, i) => `${CQ.QUALITIES[i]} → ${CQ.QUALITIES[i + 1]} : ${Object.entries(c).map(([k, v]) => v + ' ' + CQ.CUR[k].name).join('')} par unité`).join(' · ')}.</div></div>
  <div class="grid g2 mt"><div class="card"><h3>Préfixes connus</h3>${Object.keys(CQ.PREFIX_FX).map((p) => `<span class="chip ${kn.pre[p] ? 'gold' : ''}" style="${kn.pre[p] ? '' : 'opacity:.35'}">${kn.pre[p] ? p : '???'} · ${CQ.STATS[CQ.PREFIX_FX[p]].name}</span>`).join(' ')}</div>
  <div class="card"><h3>Suffixes connus</h3>${Object.keys(CQ.SUFFIX_FX).map((p) => `<span class="chip ${kn.suf[p] ? 'gold' : ''}" style="${kn.suf[p] ? '' : 'opacity:.35'}">${kn.suf[p] ? CQ.esc(p) : '???'} · ${CQ.STATS[CQ.SUFFIX_FX[p]].name}</span>`).join(' ')}</div></div>`;
};
A.frSet = (arg) => { const [k, v] = arg.split(':'); CQ.ui.fr[k] = k === 'q' ? Number(v) : v; CQ.refresh(); };
A.frPre = (v) => { CQ.ui.fr.pre = v; CQ.refresh(); };
A.frSuf = (v) => { CQ.ui.fr.suf = v; CQ.refresh(); };
A.doForge = () => {
  const f = CQ.ui.fr, it = CQ.forgeRecipe(f.slot, f.q, f.pre, f.suf);
  if (!it) return;
  CQ.sfx(it.rarity >= 3 ? 'loot' : 'coin');
  CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>Objet forgé</h2><div class="item-detail">${CQ.itemHead(it)}${CQ.rollsHtml(it)}</div><div class="actions"><button class="btn primary" data-act="closeModal">Continuer</button></div>`);
};
A.selSmelt = (id) => {
  id = Number(id);
  const sel = CQ.ui.sel.smelt || (CQ.ui.sel.smelt = []);
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1); else sel.push(id);
  CQ.refresh();
};
A.smeltPick = (arg) => {
  const s = S(), kn = CQ.known(), ok = (it) => !it.locked && !CQ.isEquipped(it);
  CQ.ui.sel.smelt = arg === 'none' ? []
    : arg === 'new' ? s.inventory.filter((it) => ok(it) && CQ.recipesOf(it).some(([k, n]) => !kn[k][n])).map((it) => it.id)
    : s.inventory.filter((it) => ok(it) && it.rarity === Number(arg)).map((it) => it.id);
  CQ.refresh();
};
A.doSmelt = () => {
  const ids = CQ.ui.sel.smelt || [];
  CQ.confirm('Fondre ces objets ?', `${ids.length} objet${ids.length > 1 ? 's' : ''} seront détruits contre des matériaux.`, 'Fondre', () => {
    const r = CQ.smelt(ids);
    CQ.ui.sel.smelt = [];
    CQ.sfx('coin');
    CQ.toast(`🔥 ${r.n} objet${r.n > 1 ? 's' : ''} fondu${r.n > 1 ? 's' : ''}${r.learned.length ? ` · nouvelle${r.learned.length > 1 ? 's' : ''} recette${r.learned.length > 1 ? 's' : ''} : ${CQ.esc(r.learned.join(', '))}` : ''}`, r.learned.length ? 'r4' : 'green');
    CQ.save(); CQ.refresh();
  }, true);
};
A.qUp = (arg) => {
  const [m, q] = arg.split(':');
  const n = CQ.qualityUp(m, Number(q), 1e6);
  if (n) { CQ.sfx('coin'); CQ.toast(`⬆ ${n} ${CQ.MATS[m].name} ${CQ.QUALITIES[Number(q) + 1]}`, 'green'); CQ.save(); CQ.refresh(); } else CQ.toast('Fonds insuffisants.', 'red');
};
