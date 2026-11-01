'use strict';
// V3-7 — Arène d'équipe (3 contre 3) et mercenaires. Ouvre au niveau 40.
// Combat en relais : les premiers de chaque équipe s'affrontent, le vainqueur reste en piste avec ses PV restants
// et affronte le suivant, jusqu'à ce qu'une équipe n'ait plus personne. L'ordre de passage se règle.
CQ.TEAM = {
  minLevel: 40, tickets: 5, ticketMs: 4.8 * 3600000, K: 24, maxMercs: 2, maxTier: 5,
  ARCH: [
    { id: 'brute', name: 'Brute', icon: '🧔', split: { force: .45, vit: .25, prec: .2, agi: .1 }, branch: 'lame', desc: 'Frappe fort' },
    { id: 'duel', name: 'Duelliste', icon: '🥷', split: { agi: .35, prec: .3, force: .3, vit: .05 }, branch: 'lame', desc: 'Rapide et précis' },
    { id: 'rempart', name: 'Rempart', icon: '🛡️', split: { vit: .5, force: .25, prec: .15, agi: .1 }, branch: 'rempart', desc: 'Encaisse et use l’adversaire' },
    { id: 'archer', name: 'Archer', icon: '🏹', split: { prec: .4, agi: .3, force: .3 }, branch: 'lame', desc: 'Critiques fréquents' },
  ],
  NAMES: ['Brennus', 'Cassia', 'Drusus', 'Elva', 'Fabius', 'Galla', 'Hostus', 'Iria', 'Junia', 'Kaeso', 'Livia', 'Marcus', 'Nerva', 'Octavia', 'Priscus', 'Rufina'],
};
CQ.team = () => CQ.state.team || (CQ.state.team = { glory: 1000, best: 1000, tickets: CQ.TEAM.tickets, tAt: Date.now(), mercs: [], order: ['me'], fights: [], wins: 0, losses: 0, season: null, opps: [] });
CQ.teamOpen = () => CQ.state.level >= CQ.TEAM.minLevel;
CQ.teamTickets = () => {
  const t = CQ.team(), now = Date.now(), T = CQ.TEAM;
  if (t.tickets >= T.tickets) { t.tAt = now; return t.tickets; }
  const n = Math.floor((now - t.tAt) / T.ticketMs);
  if (n > 0) { t.tickets = Math.min(T.tickets, t.tickets + n); t.tAt = t.tickets >= T.tickets ? now : t.tAt + n * T.ticketMs; }
  return t.tickets;
};

// ---------- Mercenaires ----------
CQ.mercCost = () => Math.round(20000 * (1 + CQ.state.level / 10));
CQ.mercTierCost = (tier) => Math.round(30000 * tier * tier * (1 + CQ.state.level / 10));
CQ.heroFrom = (name, level, archId, tier, seed) => {
  const arch = CQ.TEAM.ARCH.find((a) => a.id === archId) || CQ.TEAM.ARCH[0];
  const key = `team:${seed}:${level}:${archId}:${tier}`;
  if (CQ._botCache[key]) return CQ._botCache[key];
  const rnd = CQ.seeded(key), pts = 5 * level, attrs = {}, talents = {};
  for (const at of CQ.ATTRS) attrs[at.id] = Math.min(CQ.attrCap(level), 5 + Math.round(pts * (arch.split[at.id] || 0))) + Math.round(level * 0.08 * tier);
  let tp = Math.max(0, level - CQ.TALENT_START + 1);
  for (const t of CQ.TALENT_BRANCHES.find((b) => b.id === arch.branch).talents) { if (t.ult) continue; const n = Math.min(t.max, tp); if (n) talents[t.id] = n; tp -= n; }
  const items = CQ.SLOTS.map((sl) => CQ.makeItem(sl.id, CQ.clamp(Math.round(tier + rnd() - 0.5), 1, 5), level, { rnd, id: 'm' }));
  const h = { name, icon: arch.icon, arch, level, tier, ps: CQ.statsFor({ level, attrs, talents, items }) };
  CQ._botCache[key] = h;
  return h;
};
CQ.mercHero = (m) => CQ.heroFrom(m.name, Math.max(1, CQ.state.level - 2), m.arch, m.tier, m.id);
CQ.hireMerc = (archId) => {
  const t = CQ.team();
  if (t.mercs.length >= CQ.TEAM.maxMercs) { CQ.toast('Deux mercenaires au maximum.', 'red'); return false; }
  if (!CQ.pay({ cq: CQ.mercCost() }, 'Taverne : recrutement d’un mercenaire')) return false;
  const used = t.mercs.map((m) => m.name), name = CQ.pick(CQ.TEAM.NAMES.filter((n) => !used.includes(n)));
  const m = { id: 'M' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name, arch: archId, tier: 1 };
  t.mercs.push(m); t.order.push(m.id);
  return m;
};
CQ.upMerc = (id) => {
  const m = CQ.team().mercs.find((x) => x.id === id);
  if (!m || m.tier >= CQ.TEAM.maxTier) return false;
  if (!CQ.pay({ cq: CQ.mercTierCost(m.tier) }, `Taverne : équipement de ${m.name}`)) return false;
  m.tier++;
  return true;
};
CQ.fireMerc = (id) => { const t = CQ.team(); t.mercs = t.mercs.filter((m) => m.id !== id); t.order = t.order.filter((x) => x !== id); };
CQ.teamRoster = () => {
  const t = CQ.team(), s = CQ.state;
  return t.order.map((id) => (id === 'me' ? { name: s.name, icon: '🧝', me: true, level: s.level, ps: CQ.playerStats() } : CQ.mercHero(t.mercs.find((m) => m.id === id)))).filter(Boolean);
};

// ---------- Équipes adverses simulées ----------
CQ.teamBots = () => {
  const L = CQ.state.level, out = [];
  for (let i = 0; i < 12; i++) {
    const r = CQ.seeded('teambot' + i), glory = Math.round(850 + Math.pow(r(), 1.5) * 1000), tier = 0.7 + (glory - 800) / 520;
    const lead = CQ.BOT_NAMES[i * 3 % CQ.BOT_NAMES.length];
    const members = [0, 1, 2].map((k) => CQ.heroFrom(k ? CQ.TEAM.NAMES[(i * 5 + k) % CQ.TEAM.NAMES.length] : lead, Math.max(CQ.TEAM.minLevel, L + Math.floor(r() * 5) - 2), CQ.TEAM.ARCH[Math.floor(r() * 4)].id, CQ.clamp(Math.round(tier * 10) / 10, 1, 5), 'tb' + i + k));
    out.push({ i, name: `Équipe de ${lead}`, glory: (CQ.team().bots || {})[i] || glory, members });
  }
  return out;
};
CQ.teamOpps = () => {
  const g = CQ.team().glory;
  return CQ.teamBots().map((b) => ({ b, d: Math.abs(b.glory - g) + CQ.hash(b.name + CQ.dayKey()) % 150 })).sort((x, y) => x.d - y.d).slice(0, 3).map((x) => x.b);
};
// relais : le vainqueur reste en piste avec ses PV restants
CQ.relay = (A, B, seed) => {
  const a = A.map((h) => ({ h, hp: h.ps.hp })), b = B.map((h) => ({ h, hp: h.ps.hp })), duels = [];
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length && n++ < 12) {
    const x = a[i], y = b[j];
    const r = CQ.duel(Object.assign({}, x.h.ps, { hp: x.hp }), Object.assign({}, y.h.ps, { hp: y.hp }), seed + n);
    x.hp = Math.round(r.hp[0] * x.hp); y.hp = Math.round(r.hp[1] * y.hp);
    duels.push({ a: x.h.name, ai: x.h.icon, b: y.h.name, bi: y.h.icon, win: r.win, hpA: x.hp, hpB: y.hp });
    if (r.win) { j++; if (x.hp <= 0) x.hp = 1; } else { i++; if (y.hp <= 0) y.hp = 1; }
  }
  return { win: j >= b.length, duels };
};
CQ.teamFight = (idx) => {
  const t = CQ.team(), s = CQ.state;
  if (!CQ.teamOpen()) return null;
  if (CQ.teamTickets() < 1) { CQ.toast('Plus de billet d’équipe.', 'red'); return null; }
  const roster = CQ.teamRoster();
  if (roster.length < 3) { CQ.toast('Il faut une équipe de 3 : recrutez deux mercenaires.', 'red'); return null; }
  const foe = CQ.teamOpps()[idx];
  if (!foe) return null;
  if (t.tickets >= CQ.TEAM.tickets) t.tAt = Date.now();
  t.tickets--;
  const res = CQ.relay(roster, foe.members, 'team' + Date.now());
  const E = CQ.elo(t.glory, foe.glory), delta = Math.round(CQ.TEAM.K * ((res.win ? 1 : 0) - E));
  t.glory = Math.max(0, t.glory + delta); t.best = Math.max(t.best, t.glory);
  t.bots = t.bots || {}; t.bots[foe.i] = Math.max(500, foe.glory - delta);
  const honor = res.win ? Math.round(12 + 18 * (1 - E)) : 3, cq = res.win ? Math.round(40 * s.level * (1.2 - E)) : 0;
  CQ.gain('honor', honor, `Arène : équipe ${res.win ? 'victorieuse' : 'battue'} contre ${foe.name}`);
  if (cq) CQ.gain('cq', cq, `Arène d’équipe : victoire contre ${foe.name}`);
  res.win ? t.wins++ : t.losses++;
  const f = { t: Date.now(), foe: foe.name, win: res.win, delta, honor, cq, duels: res.duels };
  t.fights.unshift(f); t.fights.length = Math.min(t.fights.length, 15);
  return f;
};

/* =========================================================
   Page : Arène d'équipe
   ========================================================= */
P.team = {
  title: 'Arène d’équipe',
  render() {
    const s = S();
    if (!CQ.teamOpen()) return `<div class="empty">L’arène d’équipe ouvre au niveau ${CQ.TEAM.minLevel}. Vous êtes niveau ${s.level}.</div>`;
    const t = CQ.team(), lg = CQ.league(t.glory), tk = CQ.teamTickets(), tab = CQ.tabOf('team', 'fight');
    return `<div class="pool-hero arena-hero"><div><div class="kicker">Arène d’équipe · 3 contre 3 en relais</div>
        <div class="row" style="gap:14px;margin-top:6px"><span style="font-size:46px">${lg.icon}</span><div><div class="big">${CQ.fmt(t.glory)} <span class="small muted" style="font-family:var(--font)">Gloire d’équipe</span></div>
        <div class="muted">Ligue ${lg.name} · ${t.wins} victoire${t.wins > 1 ? 's' : ''} · ${t.losses} défaite${t.losses > 1 ? 's' : ''}</div></div></div></div>
      <div class="kv"><span>Billets</span><span><b>${tk}</b> / ${CQ.TEAM.tickets}${tk < CQ.TEAM.tickets ? ` · +1 dans ${CQ.fmtDur(t.tAt + CQ.TEAM.ticketMs - Date.now())}` : ''}</span><span>Honneur</span><span>${CQ.money('honor', s.honor)}</span></div></div>
      <div class="mt">${CQ.tabs('team', [['fight', '⚔️ Combats'], ['mercs', '🍺 Taverne'], ['hist', '📜 Historique']])}</div>${P.team[tab]()}`;
  },
  fight() {
    const roster = CQ.teamRoster(), opps = CQ.teamOpps(), tk = CQ.teamTickets();
    const team = (list) => list.map((h) => `<span class="mini-hero" title="${CQ.esc(h.name)} · niveau ${h.level}">${h.icon}<b>${CQ.esc(h.name)}</b><small>P ${CQ.fmt(h.ps.power)}</small></span>`).join('');
    return `<div class="card mb"><h3>Votre équipe<span class="right">ordre de passage</span></h3><div class="row wrap" style="gap:8px">${roster.map((h, k) => `<span class="mini-hero ${h.me ? 'me' : ''}">${h.icon}<b>${CQ.esc(h.name)}</b><small>P ${CQ.fmt(h.ps.power)}</small>
        <span class="row" style="gap:3px">${k ? `<button class="btn sm ghost" data-act="teamMove" data-arg="${k}:-1" aria-label="Avancer">▲</button>` : ''}${k < roster.length - 1 ? `<button class="btn sm ghost" data-act="teamMove" data-arg="${k}:1" aria-label="Reculer">▼</button>` : ''}</span></span>`).join('')}</div>
      ${roster.length < 3 ? '<div class="note mt">Recrutez deux mercenaires à la Taverne pour former une équipe.</div>' : ''}</div>
      <div class="grid g3">${opps.map((o, i) => `<div class="card"><b>${CQ.esc(o.name)}</b><div class="small muted">${CQ.league(o.glory).icon} ${CQ.fmt(o.glory)} Gloire</div>
        <div class="row wrap mt" style="gap:6px">${team(o.members)}</div>
        <button class="btn primary block mt" data-act="teamFight" data-arg="${i}" ${tk && roster.length >= 3 ? '' : 'disabled'}>Combattre · 1 billet</button></div>`).join('')}</div>
      <div class="note mt">Le premier de chaque équipe s’affronte. Le vainqueur reste en piste avec les PV qui lui restent et affronte le suivant. Placez un Rempart en tête pour user l’adversaire, ou votre meilleur combattant en dernier pour finir le travail.</div>`;
  },
  mercs() {
    const t = CQ.team(), s = S();
    return `<div class="grid g2"><div class="card"><h3>Vos mercenaires<span class="right">${t.mercs.length}/${CQ.TEAM.maxMercs}</span></h3>
      ${t.mercs.length ? t.mercs.map((m) => { const h = CQ.mercHero(m); return `<div class="list-row"><span style="font-size:26px">${h.icon}</span><div class="lr"><b>${CQ.esc(m.name)} · ${h.arch.name}</b>
        <span>niveau ${h.level} · équipement ${'★'.repeat(m.tier)}${'☆'.repeat(CQ.TEAM.maxTier - m.tier)} · puissance ${CQ.fmt(h.ps.power)}</span></div>
        <div class="row" style="gap:5px">${m.tier < CQ.TEAM.maxTier ? `<button class="btn sm gold" data-act="mercUp" data-arg="${m.id}" ${s.cq >= CQ.mercTierCost(m.tier) ? '' : 'disabled'}>★ ${CQ.fmt(CQ.mercTierCost(m.tier))} CQ</button>` : ''}
        <button class="btn sm ghost" data-act="mercFire" data-arg="${m.id}">Renvoyer</button></div></div>`; }).join('') : '<div class="empty">Aucun mercenaire.</div>'}
      <div class="note mt">Les mercenaires suivent votre niveau (−2). Leur équipement s’améliore à la Taverne, en 5 étoiles.</div></div>
      <div class="card gold"><h3>🍺 Taverne<span class="right">recrutement ${CQ.fmt(CQ.mercCost())} CQ</span></h3>
      ${CQ.TEAM.ARCH.map((a) => `<div class="list-row"><span style="font-size:26px">${a.icon}</span><div class="lr"><b>${a.name}</b><span>${a.desc}</span></div>
        <button class="btn sm" data-act="mercHire" data-arg="${a.id}" ${t.mercs.length < CQ.TEAM.maxMercs && s.cq >= CQ.mercCost() ? '' : 'disabled'}>Recruter</button></div>`).join('')}</div></div>`;
  },
  hist() {
    const t = CQ.team();
    return `<div class="card"><h3>Derniers combats</h3>${t.fights.length ? t.fights.map((f) => `<div class="list-row"><div class="lr"><b>Contre ${CQ.esc(f.foe)} · <span class="${f.win ? 'c-green' : 'c-fp'}">${f.win ? 'victoire' : 'défaite'}</span></b>
      <span>${CQ.fmtDate(f.t)} · ${f.delta >= 0 ? '+' : ''}${f.delta} Gloire · +${f.honor} Honneur${f.cq ? ` · +${CQ.fmt(f.cq)} CQ` : ''}</span>
      <span class="small dim">${f.duels.map((d) => `${d.ai} ${CQ.esc(d.a)} ${d.win ? '✔' : '✘'} ${d.bi} ${CQ.esc(d.b)}`).join(' → ')}</span></div></div>`).join('') : '<div class="empty">Aucun combat pour l’instant.</div>'}</div>`;
  },
};
A.teamMove = (arg) => {
  const [k, d] = arg.split(':').map(Number), o = CQ.team().order, j = k + d;
  if (j < 0 || j >= o.length) return;
  [o[k], o[j]] = [o[j], o[k]];
  CQ.save(); CQ.refresh();
};
A.mercHire = (a) => { const m = CQ.hireMerc(a); if (m) { CQ.sfx('coin'); CQ.toast(`🍺 ${m.name} rejoint votre équipe.`, 'green'); CQ.save(); CQ.refresh(); } };
A.mercUp = (id) => { if (CQ.upMerc(id)) { CQ.sfx('level'); CQ.save(); CQ.refresh(); } };
A.mercFire = (id) => CQ.confirm('Renvoyer ce mercenaire ?', 'Son équipement est perdu.', 'Renvoyer', () => { CQ.fireMerc(id); CQ.save(); CQ.refresh(); }, true);
A.teamFight = (i) => {
  const f = CQ.teamFight(Number(i));
  if (!f) return;
  CQ.sfx(f.win ? 'win' : 'lose'); CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>${f.win ? 'Victoire' : 'Défaite'} contre ${CQ.esc(f.foe)}</h2><div class="relay">${f.duels.map((d, k) => `<div class="relay-row" style="animation-delay:${k * 0.35}s"><span>${d.ai} <b>${CQ.esc(d.a)}</b></span><span class="${d.win ? 'c-green' : 'c-fp'}">${d.win ? '▶ l’emporte' : '◀ tombe'}</span><span>${d.bi} <b>${CQ.esc(d.b)}</b></span>
    <span class="small dim">PV restants : ${CQ.fmt(Math.max(0, d.hpA))} / ${CQ.fmt(Math.max(0, d.hpB))}</span></div>`).join('')}</div>
    <div class="result ${f.win ? 'win' : 'lose'} mt">${f.delta >= 0 ? '+' : ''}${f.delta} Gloire · +${f.honor} Honneur${f.cq ? ` · +${CQ.fmt(f.cq)} CQ` : ''}</div><div class="actions"><button class="btn primary" data-act="closeModal">Continuer</button></div>`);
};
