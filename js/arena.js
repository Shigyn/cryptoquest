'use strict';
// Arène asynchrone : on affronte le héros d'un autre joueur tel qu'il est équipé, simulé par le même moteur.
// Billets (10 max, 1 toutes les 2 h 24), cote de Gloire (Elo), ligues, saisons hebdomadaires, défenses, revanches,
// boutique d'Honneur. Prototype : les adversaires sont 40 héros simulés dont la cote évolue avec vos combats.
// Aucune récompense en FP : l'arène ne doit pas devenir une source de FP pour le pool.
CQ.ARENA = {
  minLevel: 10, tickets: 10, ticketMs: 2.4 * 3600000, K: 32, refresh: 100, perOpp: 3, maxMs: 60000,
  defGap: [2, 6], // heures entre deux attaques reçues
  LEAGUES: [
    { name: 'Bronze', min: 0, icon: '🥉', reward: { honor: 100, cq: 2000 } },
    { name: 'Argent', min: 1100, icon: '🥈', reward: { honor: 250, cq: 5000 } },
    { name: 'Or', min: 1300, icon: '🥇', reward: { honor: 500, cq: 10000, chest: 'silver' } },
    { name: 'Platine', min: 1500, icon: '💠', reward: { honor: 900, cq: 20000, chest: 'gold', gems: 20 } },
    { name: 'Écarlate', min: 1700, icon: '🩸', reward: { honor: 1500, cq: 40000, chest: 'mythic', gems: 50 } },
  ],
  // profils des adversaires : répartition des attributs, branche de talents, avatar
  ARCH: [
    { name: 'Brute', split: { force: .45, vit: .25, prec: .2, agi: .1 }, branch: 'lame', icon: '🧔' },
    { name: 'Duelliste', split: { agi: .35, prec: .3, force: .3, vit: .05 }, branch: 'lame', icon: '🥷' },
    { name: 'Rempart', split: { vit: .45, force: .3, prec: .15, agi: .1 }, branch: 'rempart', icon: '🛡️' },
    { name: 'Équilibré', split: { force: .3, vit: .25, prec: .2, agi: .15, endu: .1 }, branch: 'rempart', icon: '🧝' },
  ],
};
CQ.HONOR_SHOP = [
  ...CQ.SETS.gladiateur.slots.map((slot) => ({ id: 'gl-' + slot, kind: 'set', slot, cost: 600 })),
  { id: 'chest-gold', kind: 'chest', chest: 'gold', cost: 350 },
  { id: 'e3', kind: 'cons', cons: 'e3', cost: 150 },
  { id: 'sDrop2', kind: 'cons', cons: 'sDrop2', cost: 120 },
];

CQ.league = (g) => CQ.ARENA.LEAGUES.slice().reverse().find((l) => g >= l.min);
CQ.arenaOpen = () => CQ.state.level >= CQ.ARENA.minLevel;

// ---------- Billets ----------
CQ.arenaTickets = () => {
  const a = CQ.state.arena, now = Date.now(), A = CQ.ARENA;
  if (a.tickets >= A.tickets) { a.tAt = now; return a.tickets; }
  const n = Math.floor((now - a.tAt) / A.ticketMs);
  if (n > 0) { a.tickets = Math.min(A.tickets, a.tickets + n); a.tAt = a.tickets >= A.tickets ? now : a.tAt + n * A.ticketMs; }
  return a.tickets;
};
CQ.arenaNextTicket = () => (CQ.arenaTickets() >= CQ.ARENA.tickets ? 0 : CQ.state.arena.tAt + CQ.ARENA.ticketMs - Date.now());

// ---------- Adversaires simulés ----------
CQ.botGlory = (name) => {
  const b = CQ.state.arena.bots;
  if (!b[name]) b[name] = Math.round(850 + Math.pow(CQ.seeded('glory' + name)(), 1.6) * 1000);
  return b[name];
};
CQ._botCache = {};
CQ.arenaBot = (name) => {
  const s = CQ.state, glory = CQ.botGlory(name), r = CQ.seeded('bot' + name);
  const level = CQ.clamp(s.level + Math.floor(r() * 7) - 3, CQ.ARENA.minLevel, 60);
  const arch = CQ.ARENA.ARCH[Math.floor(r() * CQ.ARENA.ARCH.length)];
  const tier = 1 + (glory - 800) / 450; // meilleure cote = meilleur équipement
  const key = `${name}:${level}:${Math.round(tier * 2)}`;
  if (!CQ._botCache[key]) {
    const rnd = CQ.seeded(key), pts = 5 * level, attrs = {}, talents = {};
    for (const at of CQ.ATTRS) attrs[at.id] = Math.min(CQ.attrCap(level), 5 + Math.round(pts * (arch.split[at.id] || 0))) + Math.round(level * 0.2 * Math.max(0.5, tier) / 1.5);
    let tp = Math.max(0, level - CQ.TALENT_START + 1);
    for (const t of CQ.TALENT_BRANCHES.find((b) => b.id === arch.branch).talents) {
      if (t.ult) continue;
      const n = Math.min(t.max, tp); if (n) talents[t.id] = n; tp -= n;
    }
    const items = CQ.SLOTS.map((sl) => CQ.makeItem(sl.id, CQ.clamp(Math.round(tier + rnd() * 1.5 - 0.5), 1, 5), level, { rnd, id: 'b' }));
    const ps = CQ.statsFor({ level, attrs, talents, items });
    CQ._botCache[key] = { ps, arch, level, items };
  }
  const c = CQ._botCache[key];
  return { name, glory, level: c.level, arch: c.arch, ps: c.ps, power: c.ps.power, league: CQ.league(glory) };
};
CQ.arenaVs = () => {
  const v = CQ.state.arena.vs, k = CQ.dayKey();
  if (v.day !== k) { v.day = k; v.n = {}; }
  return v.n;
};
CQ.arenaPickOpps = () => {
  const a = CQ.state.arena, vs = CQ.arenaVs();
  const pool = CQ.BOT_NAMES.filter((n) => (vs[n] || 0) < CQ.ARENA.perOpp)
    .map((n) => ({ n, d: Math.abs(CQ.botGlory(n) - a.glory) + Math.random() * 180 }))
    .sort((x, y) => x.d - y.d);
  a.opps = pool.slice(0, 3).map((x) => x.n);
};
CQ.arenaOpps = () => {
  const a = CQ.state.arena, vs = CQ.arenaVs();
  a.opps = a.opps.filter((n) => (vs[n] || 0) < CQ.ARENA.perOpp);
  if (a.opps.length < 3) CQ.arenaPickOpps();
  return a.opps.map(CQ.arenaBot);
};

// ---------- Duel ----------
// side 0 = attaquant, side 1 = défenseur. Renvoie le vainqueur et la liste des coups pour la rediffusion.
CQ.duel = (A, B, seed) => {
  const rnd = CQ.seeded(String(seed)), ev = [];
  const f = [A, B].map((ps) => ({ ps, hp: ps.hp, int: 1200 * (1 - Math.min(CQ.CAPS.spd, ps.spd) / 100), undy: false, bleed: false }));
  f[0].next = f[0].int; f[1].next = f[1].int * 1.05;
  let t = 0;
  const strike = (i, tag) => {
    const a = f[i], d = f[1 - i], ap = a.ps, dp = d.ps;
    if (rnd() * 100 >= CQ.clamp(CQ.vs(ap, 'hit', dp.level) - CQ.vs(dp, 'dodge', ap.level), 40, 100)) {
      ev.push({ t, s: i, miss: true, tag });
      if (!tag && dp.fx.riposte && rnd() * 100 < dp.fx.riposte) strike(1 - i, 'riposte');
      return;
    }
    const crit = rnd() * 100 < CQ.vs(ap, 'crit', dp.level) - CQ.vs(dp, 'resil', ap.level);
    let dmg = CQ.dmgFormula(ap.atk, dp.def * (1 - ap.pen / 100)) * (0.9 + rnd() * 0.2);
    if (crit) dmg *= ap.critd / 100;
    if (a.bleed) { dmg *= 1 + (ap.fx.bleed || 0) / 100; a.bleed = false; }
    if (crit && ap.fx.bleed) a.bleed = true;
    dmg *= 1 + (ap.fx.arena || 0) / 100;
    const block = rnd() * 100 < CQ.vs(dp, 'parry', ap.level);
    if (block) dmg *= 0.5;
    dmg = Math.max(1, Math.round(dmg));
    d.hp -= dmg;
    if (ap.fx.leech) a.hp = Math.min(ap.hp, a.hp + dmg * ap.fx.leech / 100);
    if (d.hp <= 0 && dp.fx.undying && !d.undy) { d.undy = true; d.hp = 1; }
    ev.push({ t, s: i, dmg, crit, block, tag, hp: [Math.max(0, f[0].hp), Math.max(0, f[1].hp)] });
  };
  while (f[0].hp > 0 && f[1].hp > 0) {
    const i = f[0].next <= f[1].next ? 0 : 1;
    t = f[i].next;
    if (t > CQ.ARENA.maxMs) break;
    strike(i);
    if (f[1 - i].hp > 0 && f[i].ps.fx.double && rnd() * 100 < f[i].ps.fx.double) strike(i, 'double');
    f[i].next += f[i].int;
  }
  const pa = Math.max(0, f[0].hp) / A.hp, pb = Math.max(0, f[1].hp) / B.hp;
  return { win: f[1].hp <= 0 || (f[0].hp > 0 && pa > pb), ev, hp: [pa, pb], t: Math.min(t, CQ.ARENA.maxMs) };
};
CQ._chanceCache = {};
CQ.winChance = (opp) => {
  const me = CQ.playerStats(), key = `${opp.name}:${opp.power}:${me.power}`;
  if (CQ._chanceCache[key] == null) {
    let w = 0;
    for (let i = 0; i < 24; i++) if (CQ.duel(me, opp.ps, key + i).win) w++;
    CQ._chanceCache[key] = w / 24;
  }
  return CQ._chanceCache[key];
};
CQ.elo = (ra, rb) => 1 / (1 + Math.pow(10, (rb - ra) / 400));

// ---------- Combat, défenses, saison ----------
CQ.arenaFight = (name, revengeId) => {
  const s = CQ.state, a = s.arena, A = CQ.ARENA;
  if (!CQ.arenaOpen()) return null;
  const rev = revengeId && a.defenses.find((d) => d.id === revengeId && !d.revenged);
  if (!rev) {
    if ((CQ.arenaVs()[name] || 0) >= A.perOpp) { CQ.toast('3 combats par jour au maximum contre le même adversaire.', 'red'); return null; }
    if (CQ.arenaTickets() < 1) { CQ.toast('Plus de billet d’arène.', 'red'); return null; }
    if (a.tickets >= A.tickets) a.tAt = Date.now();
    a.tickets--;
    CQ.arenaVs()[name] = (CQ.arenaVs()[name] || 0) + 1;
  } else rev.revenged = true;
  const opp = CQ.arenaBot(name), me = CQ.playerStats();
  const res = CQ.duel(me, opp.ps, 'f' + Date.now() + name);
  const E = CQ.elo(a.glory, opp.glory);
  const delta = Math.round(A.K * ((res.win ? 1 : 0) - E));
  a.glory = Math.max(0, a.glory + delta);
  a.best = Math.max(a.best, a.glory);
  a.bots[name] = Math.max(500, opp.glory - delta);
  const honor = res.win ? Math.round(8 + 22 * (1 - E)) : 2;
  const cq = res.win ? Math.round(25 * s.level * (1.2 - E)) : 0;
  CQ.gain('honor', honor, `Arène : ${res.win ? 'victoire' : 'défaite'} contre ${name}`);
  if (cq) CQ.gain('cq', cq, `Arène : victoire contre ${name}`);
  res.win ? a.wins++ : a.losses++;
  const fight = { id: 'F' + Date.now().toString(36), t: Date.now(), name, level: opp.level, icon: opp.arch.icon, win: res.win, delta, honor, cq,
    ev: res.ev, hp: res.hp, dur: res.t, me: { hp: me.hp, name: s.name }, opp: { hp: opp.ps.hp }, revenge: !!rev };
  a.fights.unshift(fight);
  if (a.fights.length > 15) a.fights.length = 15;
  a.opps = a.opps.filter((n) => n !== name);
  if (!a.defAt) a.defAt = Date.now() + (A.defGap[0] + Math.random() * (A.defGap[1] - A.defGap[0])) * 3600000; // les autres peuvent désormais vous attaquer
  return fight;
};
CQ.arenaDefTick = () => {
  const s = CQ.state, a = s.arena, now = Date.now(), A = CQ.ARENA;
  if (!CQ.arenaOpen() || a.wins + a.losses === 0) return;
  const gap = () => (A.defGap[0] + Math.random() * (A.defGap[1] - A.defGap[0])) * 3600000;
  if (!a.defAt) a.defAt = now + gap();
  let n = 0;
  while (now >= a.defAt && n++ < 4) {
    const name = CQ.BOT_NAMES.map((x) => ({ x, d: Math.abs(CQ.botGlory(x) - a.glory) + Math.random() * 300 })).sort((p, q) => p.d - q.d)[0].x;
    const opp = CQ.arenaBot(name), me = CQ.playerStats();
    const res = CQ.duel(opp.ps, me, 'd' + a.defAt + name);
    const E = CQ.elo(a.glory, opp.glory);
    const delta = Math.round(A.K / 2 * ((res.win ? 0 : 1) - E)); // moitié des points d'une attaque
    a.glory = Math.max(0, a.glory + delta);
    a.best = Math.max(a.best, a.glory);
    a.bots[name] = Math.max(500, opp.glory - delta);
    a.defenses.unshift({ id: 'D' + a.defAt.toString(36), t: a.defAt, name, icon: opp.arch.icon, level: opp.level, win: !res.win, delta, revenged: false,
      ev: res.ev, hp: res.hp, dur: res.t, me: { hp: opp.ps.hp, name }, opp: { hp: me.hp } });
    if (a.defenses.length > 15) a.defenses.length = 15;
    if (now - a.defAt < 60000) CQ.toast(`🏟️ ${CQ.esc(name)} vous a attaqué : ${res.win ? 'défaite' : 'victoire'} (${delta >= 0 ? '+' : ''}${delta} Gloire)`, res.win ? 'red' : 'green');
    a.defAt += gap();
  }
};
CQ.arenaSeasonTick = () => {
  const a = CQ.state.arena, key = CQ.weekKey();
  if (a.season === key) return;
  if (a.season && a.wins + a.losses > 0) {
    const lg = CQ.league(a.best);
    CQ.mailAdd(`Saison d’arène terminée : ligue ${lg.name}`, Object.assign({}, lg.reward), 'Arène');
    CQ.toast(`🏟️ Saison terminée : ligue ${lg.name}. Récompenses dans la boîte aux lettres.`, 'r4');
  }
  // la cote est tassée vers 1 000 à chaque nouvelle saison
  a.glory = Math.round(1000 + (a.glory - 1000) / 2);
  a.best = a.glory;
  for (const n of Object.keys(a.bots)) a.bots[n] = Math.round(1000 + (a.bots[n] - 1000) / 2);
  a.season = key;
};
CQ.arenaTick = () => { if (!CQ.arenaOpen()) return; CQ.arenaSeasonTick(); CQ.arenaDefTick(); };

CQ.buyHonor = (id) => {
  const s = CQ.state, o = CQ.HONOR_SHOP.find((x) => x.id === id);
  if (!o || !CQ.pay({ honor: o.cost }, `Boutique d’Honneur : ${CQ.honorName(o)}`)) return false;
  if (o.kind === 'set') {
    const it = CQ.makeItem(o.slot, 3, s.level, { set: 'gladiateur' });
    if (!CQ.addItem(it, 'shop')) return true;
  } else if (o.kind === 'chest') s.chests[o.chest]++;
  else CQ.grant({ cons: { [o.cons]: 1 } });
  return true;
};
CQ.honorName = (o) => (o.kind === 'set' ? `${CQ.SET_PIECE[o.slot]} du Gladiateur` : o.kind === 'chest' ? CQ.CHESTS[o.chest].name : CQ.CONSUMABLES[o.cons].name);

/* =========================================================
   Page : Arène
   ========================================================= */
P.arena = {
  title: 'Arène',
  render() {
    const s = S(), a = s.arena;
    if (!CQ.arenaOpen()) return `<div class="empty">L’arène ouvre au niveau ${CQ.ARENA.minLevel}. Vous êtes niveau ${s.level}.</div>`;
    CQ.arenaTick();
    const lg = CQ.league(a.glory), next = CQ.ARENA.LEAGUES.find((l) => l.min > a.glory), tk = CQ.arenaTickets();
    const tab = CQ.tabOf('arena', 'opps');
    return `<div class="pool-hero arena-hero">
      <div><div class="kicker">Saison · fin dans <span class="tnum">${CQ.fmtDur(CQ.periodEnd('weekly') - Date.now())}</span></div>
        <div class="row" style="gap:14px;margin-top:6px"><span style="font-size:46px">${lg.icon}</span><div><div class="big">${CQ.fmt(a.glory)} <span class="small muted" style="font-family:var(--font)">Gloire</span></div>
          <div class="muted">Ligue ${lg.name}${next ? ` · ${next.icon} ${next.name} à ${next.min}` : ''} · meilleure cote ${CQ.fmt(a.best)}</div></div></div>
        ${next ? `<div class="mt">${CQ.bar(100 * (a.glory - lg.min) / (next.min - lg.min), 'gold')}</div>` : ''}</div>
      <div><div class="kv">
        <span>Billets</span><span><b class="tnum">${tk}</b> / ${CQ.ARENA.tickets}${tk < CQ.ARENA.tickets ? ` · +1 dans <span class="tnum" id="arTk">${CQ.fmtDur(CQ.arenaNextTicket())}</span>` : ''}</span>
        <span>Honneur</span><span>${CQ.money('honor', s.honor)}</span>
        <span>Bilan</span><span>${a.wins} victoire${a.wins > 1 ? 's' : ''} · ${a.losses} défaite${a.losses > 1 ? 's' : ''}</span>
        <span>Récompense de saison</span><span>${CQ.rewardHtml(CQ.league(a.best).reward)}</span></div></div>
    </div>
    <div class="mt">${CQ.tabs('arena', [['opps', '⚔️ Adversaires'], ['defs', `🛡️ Défenses${a.defenses.some((d) => !d.win && !d.revenged) ? ' •' : ''}`], ['rank', '🏆 Classement'], ['shop', '🏅 Boutique d’Honneur']])}</div>
    ${P.arena[tab]()}`;
  },
  opps() {
    const opps = CQ.arenaOpps(), a = S().arena, tk = CQ.arenaTickets();
    return `<div class="grid g3">${opps.map((o) => {
      const ch = CQ.winChance(o), E = CQ.elo(a.glory, o.glory);
      const left = CQ.ARENA.perOpp - (CQ.arenaVs()[o.name] || 0);
      return `<div class="card opp">
        <div class="row" style="gap:12px"><span class="opp-ico">${o.arch.icon}</span><div style="min-width:0"><b>${CQ.esc(o.name)}</b>
          <div class="small muted">${o.arch.name} · niveau ${o.level} · ${o.league.icon} ${o.league.name}</div></div></div>
        <div class="kv mt"><span>Gloire</span><span>${CQ.fmt(o.glory)}</span><span>Puissance</span><span>${CQ.fmt(o.power)}</span>
          <span>Chance de victoire</span><span class="risk ${ch >= 0.65 ? 'green' : ch >= 0.4 ? 'gold' : 'red'}">≈ ${Math.round(ch * 100)} %</span>
          <span>Gloire en jeu</span><span><span class="c-green">+${Math.round(CQ.ARENA.K * (1 - E))}</span> / <span class="c-fp">−${Math.round(CQ.ARENA.K * E)}</span></span></div>
        <button class="btn primary block mt" data-act="arenaFight" data-arg="${CQ.esc(o.name)}" ${tk ? '' : 'disabled'}>Combattre · 1 billet</button>
        <div class="small dim mt" style="text-align:center">${left} combat${left > 1 ? 's' : ''} possible${left > 1 ? 's' : ''} aujourd’hui contre lui</div>
      </div>`;
    }).join('')}</div>
    <div class="row between wrap mt"><span class="small muted">Votre puissance : ${CQ.fmt(CQ.playerStats().power)}. Les adversaires sont choisis près de votre cote.</span>
      <button class="btn ghost sm" data-act="arenaRefresh" ${S().cq >= CQ.ARENA.refresh ? '' : 'disabled'}>Nouveaux adversaires · ${CQ.money('cq', CQ.ARENA.refresh)}</button></div>
    ${a.fights.length ? `<div class="card mt"><h3>Derniers combats</h3>${a.fights.slice(0, 8).map((f) => P.arena.row(f, false)).join('')}</div>` : ''}
    <div class="note mt">Combat de 60 s au plus, simulé avec les mêmes règles que le farm (toucher, esquive, critiques, talents). À la fin du temps, le héros avec le plus de PV restants en % l’emporte. L’ensemble du Gladiateur Écarlate donne +10 % de dégâts dans l’arène.</div>`;
  },
  row(f, def) {
    return `<div class="list-row"><span style="font-size:22px">${f.icon}</span><div class="lr"><b>${def ? `${CQ.esc(f.name)} vous a attaqué` : `Contre ${CQ.esc(f.name)}`}${f.revenge ? ' (revanche)' : ''}</b>
      <span>${CQ.fmtDate(f.t)} · niveau ${f.level} · <span class="${f.win ? 'c-green' : 'c-fp'}">${f.win ? 'Victoire' : 'Défaite'}</span> · ${f.delta >= 0 ? '+' : ''}${f.delta} Gloire${f.honor ? ` · +${f.honor} Honneur` : ''}${f.cq ? ` · +${CQ.fmt(f.cq)} CQ` : ''}</span></div>
      <div class="row" style="gap:6px"><button class="btn sm ghost" data-act="arenaReplay" data-arg="${f.id}">Revoir</button>
      ${def && !f.win && !f.revenged ? `<button class="btn sm gold" data-act="arenaRevenge" data-arg="${f.id}">Revanche gratuite</button>` : ''}</div></div>`;
  },
  defs() {
    const a = S().arena;
    return `<div class="card"><h3>Attaques reçues</h3>${a.defenses.length ? a.defenses.map((d) => P.arena.row(d, true)).join('')
      : `<div class="empty">${a.wins + a.losses ? 'Personne ne vous a encore attaqué.' : 'Livrez un premier combat : les autres joueurs pourront alors vous défier.'}</div>`}
      <div class="note mt">Les autres joueurs affrontent votre héros même quand vous n’êtes pas là. En défense, on gagne ou on perd moitié moins de Gloire. Après une défaite, une revanche gratuite (sans billet) est offerte.</div></div>`;
  },
  rank() {
    const s = S(), a = s.arena;
    const rows = CQ.BOT_NAMES.map((n) => ({ name: n, glory: CQ.botGlory(n) })).concat([{ name: s.name, glory: a.glory, me: true }]).sort((x, y) => y.glory - x.glory);
    return `<div class="card"><h3>Classement de la saison</h3><div class="tbl-wrap"><table class="tbl"><tr><th>Rang</th><th>Joueur</th><th>Ligue</th><th class="r">Gloire</th></tr>
      ${rows.slice(0, 30).map((r, i) => `<tr class="${r.me ? 'me' : ''}"><td><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span></td><td>${CQ.esc(r.name)}${r.me ? ' (vous)' : ''}</td><td>${CQ.league(r.glory).icon} ${CQ.league(r.glory).name}</td><td class="r">${CQ.fmt(r.glory)}</td></tr>`).join('')}
      </table></div>
      <div class="section-title">Récompenses de fin de saison (selon la meilleure cote atteinte)</div>
      <div class="kv">${CQ.ARENA.LEAGUES.map((l) => `<span>${l.icon} ${l.name} (${l.min}+)</span><span>${CQ.rewardHtml(l.reward)}</span>`).join('')}</div></div>`;
  },
  shop() {
    const s = S(), set = CQ.SETS.gladiateur;
    return `<div class="card gold mb"><h3>⚔️ Ensemble ${set.name}<span class="right">Épique · niveau ${s.level} · lié au compte</span></h3>
      <div class="small muted">2 pièces : ${CQ.fxText(set.b2)} · 3 pièces : ${CQ.fxText(set.b3)}</div></div>
      <div class="grid g3">${CQ.HONOR_SHOP.map((o) => {
        const icon = o.kind === 'set' ? CQ.SLOT[o.slot].icon : o.kind === 'chest' ? CQ.CHESTS[o.chest].icon : CQ.CONSUMABLES[o.cons].icon;
        const desc = o.kind === 'set' ? `${CQ.SLOT[o.slot].name} · ${CQ.SLOT[o.slot].main.map((k) => CQ.STATS[k].name).join(' · ')}` : o.kind === 'chest' ? 'Contient 3 objets' : CQ.CONSUMABLES[o.cons].desc;
        return `<div class="card"><div class="row"><span style="font-size:32px">${icon}</span><div><b>${CQ.honorName(o)}</b><div class="small muted">${desc}</div></div></div>
          <button class="btn block mt" data-act="buyHonor" data-arg="${o.id}" ${s.honor >= o.cost ? '' : 'disabled'}>Acheter · ${CQ.money('honor', o.cost)}</button></div>`;
      }).join('')}</div>
      <div class="note mt">L’Honneur se gagne uniquement à l’arène (victoires, défaites et fin de saison).</div>`;
  },
  tick() {
    const el = CQ.$('#arTk');
    if (el) el.textContent = CQ.fmtDur(CQ.arenaNextTicket());
  },
};

// rediffusion d'un combat (accélérée × 4)
CQ.replay = (f, onDone) => {
  const L = { name: f.me.name, hp: f.me.hp }, R = { name: f.name, hp: f.opp.hp };
  const def = f.id[0] === 'D';
  if (def) { L.name = f.name; R.name = CQ.state.name; }
  CQ.openModal(`<h2>${CQ.esc(L.name)} contre ${CQ.esc(R.name)}</h2>
    <div class="duel"><div class="dside"><div class="sprite">${def ? f.icon : '🧝'}</div><b>${CQ.esc(L.name)}</b>${CQ.bar(100, 'hp me', 'rpA')}<div class="small muted tnum" id="rpAt"></div></div>
      <div class="vs">VS</div>
      <div class="dside"><div class="sprite">${def ? '🧝' : f.icon}</div><b>${CQ.esc(R.name)}</b>${CQ.bar(100, 'hp', 'rpB')}<div class="small muted tnum" id="rpBt"></div></div></div>
    <div class="duel-log" id="rpLog"></div>
    <div class="actions" id="rpAct"><button class="btn ghost" data-act="replaySkip">Passer</button></div>`, { wide: true, onClose: () => clearInterval(CQ.ui.rpTimer) });
  let i = 0, t = 0;
  const hp = f.start ? f.start.slice() : [L.hp, R.hp];
  const draw = () => {
    const a = CQ.$('#rpA'), b = CQ.$('#rpB');
    if (!a) return;
    a.style.width = (100 * hp[0] / L.hp) + '%'; b.style.width = (100 * hp[1] / R.hp) + '%';
    CQ.$('#rpAt').textContent = `${Math.ceil(hp[0])} / ${L.hp} PV`; CQ.$('#rpBt').textContent = `${Math.ceil(hp[1])} / ${R.hp} PV`;
  };
  const line = (e) => {
    const who = e.s === 0 ? L.name : R.name, log = CQ.$('#rpLog');
    if (!log) return;
    const txt = e.miss ? `${CQ.esc(who)} rate son coup` : `${CQ.esc(who)} ${e.tag === 'riposte' ? 'riposte' : e.tag === 'double' ? 'frappe encore' : 'frappe'} : <b class="${e.crit ? 'c-cq' : ''}">${e.dmg}${e.crit ? ' critique' : ''}</b>${e.block ? ' (bloqué à moitié)' : ''}`;
    log.insertAdjacentHTML('afterbegin', `<div>${(e.t / 1000).toFixed(1).replace('.', ',')} s · ${txt}</div>`);
  };
  const finish = () => {
    clearInterval(CQ.ui.rpTimer);
    hp[0] = f.hp[0] * L.hp; hp[1] = f.hp[1] * R.hp; draw();
    const act = CQ.$('#rpAct');
    if (act) act.innerHTML = `<div class="result ${f.win ? 'win' : 'lose'}">${f.resultText || `${f.win ? 'Victoire' : 'Défaite'} · ${f.delta >= 0 ? '+' : ''}${f.delta} Gloire${f.honor ? ` · +${f.honor} Honneur` : ''}${f.cq ? ` · +${CQ.fmt(f.cq)} CQ` : ''}`}</div><button class="btn primary" data-act="closeModal">Continuer</button>`;
    if (onDone) onDone();
  };
  CQ.ui.replaySkip = () => { while (i < f.ev.length) line(f.ev[i++]); finish(); };
  draw();
  CQ.ui.rpTimer = setInterval(() => {
    t += 200; // 50 ms réels = 200 ms de combat
    while (i < f.ev.length && f.ev[i].t <= t) {
      const e = f.ev[i++];
      if (e.hp) { hp[0] = e.hp[0]; hp[1] = e.hp[1]; }
      line(e);
    }
    draw();
    if (i >= f.ev.length) finish();
  }, 50);
};
A.replaySkip = () => CQ.ui.replaySkip && CQ.ui.replaySkip();
A.arenaFight = (name) => {
  const f = CQ.arenaFight(name);
  if (!f) return;
  CQ.save();
  CQ.replay(f, () => CQ.renderWallet());
  CQ.ui.modalClose = () => { clearInterval(CQ.ui.rpTimer); CQ.refresh(); };
};
A.arenaRevenge = (id) => {
  const d = S().arena.defenses.find((x) => x.id === id);
  if (!d) return;
  const f = CQ.arenaFight(d.name, id);
  if (!f) return;
  CQ.save();
  CQ.replay(f);
  CQ.ui.modalClose = () => { clearInterval(CQ.ui.rpTimer); CQ.refresh(); };
};
A.arenaReplay = (id) => {
  const a = S().arena, f = a.fights.find((x) => x.id === id) || a.defenses.find((x) => x.id === id);
  if (f) CQ.replay(f);
};
A.arenaRefresh = () => { if (CQ.pay({ cq: CQ.ARENA.refresh }, 'Arène : nouveaux adversaires')) { CQ.arenaPickOpps(); CQ.save(); CQ.refresh(); } };
A.buyHonor = (id) => { if (CQ.buyHonor(id)) { CQ.toast('🏅 Acheté.', 'green'); CQ.save(); CQ.refresh(); } };
