'use strict';
// V3-6 — Les Abysses : endgame cyclique à partir du niveau 100.
// 4 cercles de 3 ennemis + un seigneur, 3 difficultés (niveau −20, égal, +20), réserve propre de 18 souffles,
// PV qui ne remontent presque pas, mort = exclusion de 3 jours (Enfer : perte d'un point entraîné),
// réentrée tous les 4 jours. Récompenses : costumes de 3 jours, objets abyssaux, point d'entraînement gratuit en Enfer.

CQ.ABYSS = {
  minLevel: 100, breath: 18, breathGems: 2, cooldown: 4 * 86400000, ban: 3 * 86400000, heal: 0.1,
  mob: { hp: 1.4, atk: 0.95, def: 1.2 }, lord: { hp: 4, atk: 1.2, def: 1.4 }, // force des ennemis (réglée par simulation)
  DIFFS: {
    normal: { name: 'Normal', off: -20, rew: 1, costume: { name: 'Voile des Abysses', fx: { atkPct: 5, hpPct: 5 } } },
    cauchemar: { name: 'Cauchemar', off: 0, rew: 2, costume: { name: 'Manteau du Cauchemar', fx: { atkPct: 8, hpPct: 8, defPct: 5 } } },
    enfer: { name: 'Enfer', off: 28, rew: 4, costume: { name: 'Couronne de l’Enfer', fx: { atkPct: 12, hpPct: 12, defPct: 8 } }, train: true },
  },
  CIRCLES: [
    { name: 'Cercle des Murmures', mobs: [['Âme errante', '👻'], ['Chien des limbes', '🐕‍🦺'], ['Pleureuse', '😶‍🌫️']], lord: ['Vorag, Gardien des Plaintes', '🕯️'] },
    { name: 'Cercle des Chaînes', mobs: [['Damné enchaîné', '⛓️'], ['Geôlier', '🔒'], ['Bourreau des âmes', '🪓']], lord: ['Morhaal, Maître des Fers', '🗝️'] },
    { name: 'Cercle des Flammes', mobs: [['Brasier vivant', '🔥'], ['Démon de cendre', '👹'], ['Salamandre noire', '🦎']], lord: ['Ixtar, Cœur Ardent', '☄️'] },
    { name: 'Cercle du Silence', mobs: [['Ombre muette', '🌑'], ['Spectre aveugle', '👁️‍🗨️'], ['Faucheuse', '💀']], lord: ['Dis Kael, Seigneur des Abysses', '👁️'] },
  ],
};
CQ.abyss = () => CQ.state.abyss || (CQ.state.abyss = { run: null, nextAt: 0, banUntil: 0, clears: {}, best: null });
CQ.abyssOpen = () => CQ.state.level >= CQ.ABYSS.minLevel;
CQ.abyssBlock = () => {
  const a = CQ.abyss(), now = Date.now();
  if (!CQ.abyssOpen()) return `Les Abysses s’ouvrent au niveau ${CQ.ABYSS.minLevel}.`;
  if (a.banUntil > now) return `Vous avez péri dans les Abysses : retour possible dans ${CQ.fmtDur(a.banUntil - now)}.`;
  if (!a.run && a.nextAt > now) return `Les Portes se rouvrent dans ${CQ.fmtDur(a.nextAt - now)}.`;
  return '';
};
CQ.abyssUnlocked = (d) => d === 'normal' || (d === 'cauchemar' ? CQ.abyss().clears.normal : CQ.abyss().clears.cauchemar);

// ennemi des Abysses : un adversaire « héros » simulé par le moteur de duel
CQ.abyssFoe = (run, ci, k) => {
  const D = CQ.ABYSS.DIFFS[run.diff], C = CQ.ABYSS.CIRCLES[ci], lord = k === 3;
  const L = Math.max(1, run.lvl + D.off + ci * 2 + (lord ? 3 : 0));
  const K = lord ? CQ.ABYSS.lord : CQ.ABYSS.mob;
  const [name, icon] = lord ? C.lord : C.mobs[k];
  const hp = Math.round((30 + L * 20 + Math.pow(L, 1.7) * 3) * K.hp);
  return {
    name, icon, lord, level: L, hp, atk: Math.round((4 + L * 2.4 + Math.pow(L, 1.35)) * K.atk), def: L * K.def,
    hit: 104 + ci * 2, dodge: 22 + ci * 2, crit: 12 + ci * 2, parry: lord ? 8 : 0, resil: 8, spd: lord ? 8 : 4, pen: 10, critd: 165, fx: {},
  };
};
CQ.abyssEnter = (diff) => {
  const a = CQ.abyss(), err = CQ.abyssBlock();
  if (err) { CQ.toast(err, 'red'); return false; }
  if (a.run) return false;
  if (!CQ.abyssUnlocked(diff)) { CQ.toast('Terminez d’abord la difficulté précédente.', 'red'); return false; }
  const ps = CQ.playerStats();
  a.run = { diff, lvl: CQ.state.level, start: Date.now(), circle: 0, k: 0, foeHp: null, hp: ps.maxHp, breath: CQ.ABYSS.breath, potion: CQ.isPremium() ? 1 : 0, kills: 0, loot: [] };
  return true;
};
CQ.abyssBreath = () => {
  const r = CQ.abyss().run;
  if (r.breath > 0) { r.breath--; return true; }
  return CQ.pay({ gems: CQ.ABYSS.breathGems }, 'Abysses : souffle supplémentaire');
};
CQ.abyssFight = () => {
  const a = CQ.abyss(), r = a.run, s = CQ.state;
  if (!r) return null;
  if (!CQ.abyssBreath()) return null;
  const me = CQ.playerStats(), foe = CQ.abyssFoe(r, r.circle, r.k);
  const meCur = Object.assign({}, me, { hp: r.hp });
  const foeCur = Object.assign({}, foe, { hp: r.foeHp || foe.hp });
  const res = CQ.duel(meCur, foeCur, 'aby' + Date.now());
  const myLeft = Math.round(res.hp[0] * meCur.hp), foeLeft = Math.round(res.hp[1] * foeCur.hp);
  const f = { id: 'X' + Date.now().toString(36), name: foe.name, icon: foe.icon, ev: res.ev, hp: [res.hp[0] * meCur.hp / me.hp, res.hp[1] * foeCur.hp / foe.hp], win: false,
    me: { name: s.name, hp: me.hp }, opp: { hp: foe.hp } };
  f.start = [meCur.hp, foeCur.hp]; // la rediffusion part des PV courants, pas des PV max
  if (myLeft <= 0) {
    a.banUntil = Date.now() + CQ.ABYSS.ban;
    let lost = '';
    if (r.diff === 'enfer') {
      const tr = CQ.ATTRS.map((x) => x.id).filter((id) => CQ.trained(id) > 0);
      if (tr.length) { const id = CQ.pick(tr); s.train[id]--; lost = ` · 1 point de ${CQ.ATTRS.find((x) => x.id === id).name} entraîné perdu`; }
    }
    f.resultText = `Vous périssez face à ${CQ.esc(foe.name)}. Exclusion de 3 jours${lost}.`;
    a.run = null; a.nextAt = Date.now() + CQ.ABYSS.cooldown;
    return f;
  }
  r.hp = myLeft;
  if (foeLeft > 0) {
    r.foeHp = foeLeft;
    f.resultText = `Personne ne tombe : ${CQ.esc(foe.name)} garde ${CQ.fmt(foeLeft)} PV. Il faudra un autre souffle.`;
    return f;
  }
  // ennemi vaincu
  f.win = true; r.foeHp = null; r.kills++;
  const D = CQ.ABYSS.DIFFS[r.diff], L = foe.level;
  const xp = Math.round(CQ.xpNeed(s.level) * (foe.lord ? 0.06 : 0.02) * D.rew), cq = Math.round(L * (foe.lord ? 900 : 300) * D.rew);
  CQ.gainXp(xp); CQ.gain('cq', cq, `Abysses : ${foe.name}`);
  let extra = '';
  if (foe.lord) {
    const q = Math.min(4, 2 + (r.diff === 'normal' ? 0 : r.diff === 'cauchemar' ? 1 : 2)), m = CQ.pick(CQ.MAT_KEYS), n = 6 + r.circle * 3;
    CQ.matAdd(m, q, n);
    extra = ` · ${CQ.MATS[m].name} ${CQ.QUALITIES[q]} × ${n}`;
    if (Math.random() < 0.35 * D.rew) {
      const it = CQ.abyssItem(L);
      r.loot.push(it.name);
      CQ.mailAdd(`Butin des Abysses : ${it.name}`, { items: [it] }, 'Abysses');
      extra += ` · objet abyssal dans la boîte aux lettres`;
    }
  }
  r.hp = Math.min(me.maxHp, r.hp + me.maxHp * (CQ.ABYSS.heal + (CQ.guild() ? CQ.gLvl('infirmary') / 100 : 0)));
  f.resultText = `${CQ.esc(foe.name)} vaincu · +${CQ.fmt(xp)} XP · +${CQ.fmt(cq)} CQ${extra}`;
  r.k++;
  if (r.k > 3) { r.k = 0; r.circle++; }
  if (r.circle > 3) CQ.abyssComplete(f);
  return f;
};
// objet abyssal : Légendaire ou Mythique, avec une stat abyssale en plus
CQ.abyssItem = (L) => {
  const r = Math.random() < 0.25 ? 5 : 4, it = CQ.makeItem(CQ.pick(CQ.SLOTS).id, r, L, { good: true });
  const k = CQ.pick(CQ.RATED);
  it.rolls.push({ k, v: CQ.rollStat(k, L, r, 0.8), abyss: true });
  it.name = it.name.split(' ')[0] + ' des Abysses';
  it.abyss = true;
  return it;
};
CQ.abyssComplete = (f) => {
  const a = CQ.abyss(), r = a.run, s = CQ.state, D = CQ.ABYSS.DIFFS[r.diff];
  a.clears[r.diff] = (a.clears[r.diff] || 0) + 1;
  s.costume = { name: D.costume.name, fx: D.costume.fx, until: Date.now() + 3 * 86400000, diff: r.diff };
  if (D.train) { const id = CQ.pick(CQ.ATTRS).id; s.train[id] = CQ.trained(id) + 1; }
  s.titles = Array.from(new Set((s.titles || []).concat([`Vainqueur des Abysses (${D.name})`])));
  f.resultText += ` · Abysses vaincues ! Costume « ${D.costume.name} » pour 3 jours${D.train ? ' · 1 point d’entraînement offert' : ''}`;
  a.run = null; a.nextAt = Date.now() + CQ.ABYSS.cooldown;
};
CQ.abyssPotion = () => {
  const r = CQ.abyss().run;
  if (!r || !r.potion) return false;
  r.potion--; r.hp = CQ.playerStats().maxHp;
  return true;
};
CQ.abyssLeave = () => { const a = CQ.abyss(); a.run = null; a.nextAt = Date.now() + CQ.ABYSS.cooldown; };

// costume porté : bonus pendant 3 jours
CQ.costume = () => (CQ.state.costume && CQ.state.costume.until > Date.now() ? CQ.state.costume : null);
(() => {
  const stats = CQ.playerStats;
  CQ.playerStats = () => {
    const st = stats(), c = CQ.costume();
    if (c) {
      const fx = c.fx;
      if (fx.atkPct) st.atk = Math.round(st.atk * (1 + fx.atkPct / 100));
      if (fx.hpPct) { st.hp = Math.round(st.hp * (1 + fx.hpPct / 100)); st.maxHp = st.hp; }
      if (fx.defPct) st.def = Math.round(st.def * (1 + fx.defPct / 100));
    }
    return st;
  };
})();

/* =========================================================
   Page : Abysses
   ========================================================= */
P.abyss = {
  title: 'Abysses',
  render() {
    const a = CQ.abyss(), s = S(), err = CQ.abyssBlock(), c = CQ.costume();
    const head = `<div class="abyss-hero"><div class="abyss-eye">👁️</div><div><div class="kicker">Fin de jeu · à partir du niveau ${CQ.ABYSS.minLevel}</div><h2>Les Abysses</h2>
      <div class="small muted">4 cercles, 16 adversaires. ${CQ.ABYSS.breath} souffles par descente, presque aucun soin. La mort exclut 3 jours.</div>
      ${c ? `<div class="chip gold mt">Costume « ${c.name} » · ${CQ.fxText(c.fx)} · encore ${CQ.fmtDur(c.until - Date.now())}</div>` : ''}</div></div>`;
    if (!a.run) {
      return head + `<div class="grid g3 mt">${Object.entries(CQ.ABYSS.DIFFS).map(([k, d]) => {
        const ok = !err && CQ.abyssUnlocked(k);
        return `<div class="card ${k === 'enfer' ? 'glow' : ''}"><h3>${d.name}<span class="right">${d.off ? (d.off > 0 ? '+' : '') + d.off + ' niveaux' : 'votre niveau'}</span></h3>
          <div class="kv"><span>Récompenses</span><span>× ${d.rew}</span><span>Costume</span><span>${d.costume.name}</span><span>Bonus</span><span>${CQ.fxText(d.costume.fx)}</span>
          ${d.train ? '<span>En plus</span><span>1 point d’entraînement offert</span><span>Mort</span><span class="c-fp">perte d’un point entraîné</span>' : ''}
          <span>Victoires</span><span>${a.clears[k] || 0}</span></div>
          <button class="btn ${k === 'enfer' ? 'primary' : ''} block mt" data-act="abyssEnter" data-arg="${k}" ${ok ? '' : 'disabled'}>${CQ.abyssUnlocked(k) ? 'Descendre' : 'Verrouillé'}</button></div>`;
      }).join('')}</div>${err ? `<div class="note mt">${err}</div>` : ''}
      <div class="note mt">Les souffles ne se rechargent pas : quand ils manquent, chaque combat coûte ${CQ.ABYSS.breathGems} diamants. Les combats se jouent en duel (60 s au plus) : un ennemi non abattu garde ses blessures. L’Infirmerie de guilde soigne entre deux combats ; la Légion offre une potion de soin complet par descente.</div>`;
    }
    const r = a.run, ps = CQ.playerStats(), foe = CQ.abyssFoe(r, r.circle, r.k), C = CQ.ABYSS.CIRCLES[r.circle];
    return head + `<div class="grid g-side mt"><div class="card"><h3>${C.name} · ${CQ.ABYSS.DIFFS[r.diff].name}<span class="right">cercle ${r.circle + 1}/4</span></h3>
      <div class="abyss-path">${CQ.ABYSS.CIRCLES.map((cc, ci) => [0, 1, 2, 3].map((k) => {
        const done = ci < r.circle || (ci === r.circle && k < r.k), cur = ci === r.circle && k === r.k;
        const ic = k === 3 ? cc.lord[1] : cc.mobs[k][1];
        return `<span class="step ${done ? 'done' : ''} ${cur ? 'cur' : ''} ${k === 3 ? 'lord' : ''}" title="${CQ.esc(k === 3 ? cc.lord[0] : cc.mobs[k][0])}">${done ? '✓' : ic}</span>`;
      }).join('')).join('<span class="sepc"></span>')}</div>
      <div class="row mt" style="gap:14px"><span style="font-size:44px">${foe.icon}</span><div style="flex:1;min-width:0"><b>${foe.name}</b> <span class="small muted">niveau ${foe.level}${foe.lord ? ' · seigneur' : ''}</span>
        ${CQ.bar(100 * (r.foeHp || foe.hp) / foe.hp, 'hp')}<div class="small dim">${CQ.fmt(r.foeHp || foe.hp)} / ${CQ.fmt(foe.hp)} PV</div></div></div>
      <button class="btn primary block mt" data-act="abyssFight">${r.breath > 0 ? `Combattre · 1 souffle (${r.breath} restants)` : `Combattre · ${CQ.ABYSS.breathGems} 💎`}</button></div>
      <div class="card gold"><h3>Votre héros</h3>${CQ.bar(100 * r.hp / ps.maxHp, 'hp me big')}<div class="small muted mt">${CQ.fmt(r.hp)} / ${CQ.fmt(ps.maxHp)} PV</div>
        <div class="kv mt"><span>Souffles</span><span>${r.breath} / ${CQ.ABYSS.breath}</span><span>Ennemis vaincus</span><span>${r.kills} / 16</span><span>Butin</span><span>${r.loot.length ? r.loot.map(CQ.esc).join(', ') : '—'}</span></div>
        ${r.potion ? '<button class="btn gold block mt" data-act="abyssPotion">🧪 Potion de soin complet (Légion)</button>' : ''}
        <button class="btn ghost block mt" data-act="abyssLeave">Remonter (fin de la descente)</button></div></div>`;
  },
};
A.abyssEnter = (d) => { if (CQ.abyssEnter(d)) { CQ.sfx('alert'); CQ.save(); CQ.refresh(); } };
A.abyssFight = () => {
  const f = CQ.abyssFight();
  if (!f) return;
  CQ.save();
  CQ.replay(f, () => { CQ.sfx(f.win ? 'win' : 'lose'); });
  CQ.ui.modalClose = () => { clearInterval(CQ.ui.rpTimer); CQ.refresh(); };
};
A.abyssPotion = () => { if (CQ.abyssPotion()) { CQ.sfx('coin'); CQ.save(); CQ.refresh(); } };
A.abyssLeave = () => CQ.confirm('Remonter ?', 'La descente s’arrête là. Les Portes se rouvriront dans 4 jours.', 'Remonter', () => { CQ.abyssLeave(); CQ.save(); CQ.refresh(); }, true);
