'use strict';
// V3-8 — Saisons de 3 mois : passe de saison (gratuit + Légion, jamais de FP), événement mensuel, titres,
// et indicateurs de l'économie pour le pilotage.

CQ.SEASON = { levels: 40, xpPer: 1000 };
CQ.SEASON_THEMES = [
  { name: 'Saison du Givre', icon: '❄️' }, { name: 'Saison des Marées', icon: '🌊' },
  { name: 'Saison des Braises', icon: '🔥' }, { name: 'Saison du Crépuscule', icon: '🌒' },
];
CQ.seasonKey = (d = new Date()) => `${d.getFullYear()}-T${Math.floor(d.getMonth() / 3) + 1}`;
CQ.seasonEnd = () => { const d = new Date(); return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3 + 3, 1).getTime(); };
CQ.seasonTheme = () => CQ.SEASON_THEMES[Math.floor(new Date().getMonth() / 3)];
// points de saison par activité (une journée régulière ≈ 800 points : le passe se termine en ~50 jours)
CQ.SEASON_XP = { login: 50, quest: 60, pantheon: 40, floor: 15, arena: 30, team: 40, boss: 25, raid: 5, kills5: 1 };

CQ.season = () => {
  const s = CQ.state, k = CQ.seasonKey();
  if (!s.season || s.season.key !== k) {
    if (s.season && s.season.lvl >= 10) s.titles = Array.from(new Set((s.titles || []).concat([`Vétéran : ${s.season.name}`])));
    s.season = { key: k, name: CQ.seasonTheme().name, xp: 0, claimed: {}, legionClaimed: {}, kills: 0 };
  }
  return s.season;
};
CQ.seasonLvl = () => Math.min(CQ.SEASON.levels, Math.floor(CQ.season().xp / CQ.SEASON.xpPer));
CQ.seasonGain = (src, n = 1) => {
  const se = CQ.season(), before = CQ.seasonLvl();
  se.xp += (CQ.SEASON_XP[src] || 0) * n;
  if (CQ.seasonLvl() > before) CQ.toast(`🎖️ Passe de saison : niveau ${CQ.seasonLvl()} atteint`, 'r4');
};
// récompenses : jamais de FP (le passe ne doit pas alimenter le pool)
CQ.passReward = (lvl, legion) => {
  const L = CQ.state.level, r = {};
  if (legion) {
    if (lvl % 5 === 0) r.gems = 10 + lvl / 2;
    else r.cons = { [['sXp', 'sDrop', 'sLuck', 'sCq', 'e2'][lvl % 5]]: 1 };
    if (lvl === CQ.SEASON.levels) r.chest = 'mythic';
    return r;
  }
  if (lvl % 10 === 0) { r.chest = 'gold'; r.title = `${CQ.seasonTheme().icon} ${['Éveillé', 'Aguerri', 'Champion', 'Légende'][lvl / 10 - 1]} (${CQ.seasonTheme().name})`; }
  else if (lvl % 5 === 0) r.chest = 'silver';
  else if (lvl % 3 === 0) r.cons = { [['e1', 'sXp', 'sDrop', 'sCq'][lvl % 4]]: 1 };
  else if (lvl % 2 === 0) r.honor = 20 + lvl;
  else r.cq = Math.round(800 * (1 + L / 5));
  if (lvl % 4 === 0) r.mat = [CQ.MAT_KEYS[lvl % CQ.MAT_KEYS.length], Math.min(4, Math.floor(lvl / 10)), 5 + lvl];
  return r;
};
CQ.passHtml = (r) => {
  const parts = [];
  const plain = Object.fromEntries(Object.entries(r).filter(([k]) => !['title', 'mat'].includes(k)));
  if (Object.keys(plain).length) parts.push(CQ.rewardHtml(plain));
  if (r.mat) parts.push(`${CQ.matLabel(r.mat[0], r.mat[1])} × ${r.mat[2]}`);
  if (r.title) parts.push(`<span class="chip red">Titre « ${CQ.esc(r.title)} »</span>`);
  return parts.join(' ');
};
CQ.passClaim = (lvl, legion) => {
  const se = CQ.season(), box = legion ? se.legionClaimed : se.claimed;
  if (box[lvl] || CQ.seasonLvl() < lvl || (legion && !CQ.isPremium())) return false;
  const r = CQ.passReward(lvl, legion);
  box[lvl] = true;
  if (r.mat) CQ.matAdd(r.mat[0], r.mat[1], r.mat[2]);
  if (r.title) CQ.state.titles = Array.from(new Set((CQ.state.titles || []).concat([r.title])));
  const g = Object.fromEntries(Object.entries(r).filter(([k]) => !['title', 'mat'].includes(k)));
  CQ.grant(g, `Passe de saison : niveau ${lvl}${legion ? ' (Légion)' : ''}`);
  return true;
};
CQ.passClaimable = () => {
  const se = CQ.season(), L = CQ.seasonLvl();
  for (let l = 1; l <= L; l++) if (!se.claimed[l] || (CQ.isPremium() && !se.legionClaimed[l])) return true;
  return false;
};

// ---------- Branchements : gains de points de saison ----------
(() => {
  const w = (name, src, test) => { const f = CQ[name]; CQ[name] = (...a) => { const r = f(...a); if (test ? test(r) : r) CQ.seasonGain(src); return r; }; };
  w('claimLogin', 'login'); w('claimQuest', 'quest'); w('pqClaim', 'pantheon');
  w('arenaFight', 'arena', (f) => f && f.win); w('teamFight', 'team', (f) => f && f.win);
  const fc = CQ.floorCleared; CQ.floorCleared = (f) => { fc(f); CQ.seasonGain('floor'); };
  const ra = CQ.gRaidAttack; CQ.gRaidAttack = (e) => { const d = ra(e); if (d) CQ.seasonGain('raid', Math.floor(e / 100)); return d; };
  const ok = CQ.onKill;
  CQ.onKill = (m, ps) => {
    ok(m, ps);
    if (CQ.isBoss(m)) CQ.seasonGain('boss');
    const se = CQ.season();
    if (++se.kills % 5 === 0) CQ.seasonGain('kills5');
  };
})();

// ---------- Événement mensuel : les 3 premiers jours du mois ----------
CQ.MONTHLY_EVENT = { days: [], icon: '👁️', name: 'Invasion des Abysses', desc: '+50 % de chance de butin et +25 % d’XP (3 premiers jours du mois)', bonus: { drop: 50, xp: 25 } };
(() => {
  const en = CQ.eventNow;
  CQ.eventNow = (d = new Date()) => (d.getDate() <= 3 ? CQ.MONTHLY_EVENT : en(d));
})();

// ---------- Titres ----------
(() => {
  const hn = CQ.heroName;
  CQ.heroName = (name) => hn(name) + (CQ.state.title ? ` <span class="hero-title">${CQ.esc(CQ.state.title)}</span>` : '');
})();

// ---------- Indicateurs de l'économie (7 derniers jours, d'après l'historique) ----------
CQ.econStats = () => {
  const since = Date.now() - 7 * 86400000, out = {};
  for (const t of CQ.state.tx) {
    if (t.t < since) continue;
    const o = out[t.cur] || (out[t.cur] = { in: 0, out: 0, sinks: {} });
    if (t.amt >= 0) o.in += t.amt; else { o.out -= t.amt; const k = (t.why || '').split(' :')[0]; o.sinks[k] = (o.sinks[k] || 0) - t.amt; }
  }
  return out;
};

/* =========================================================
   Page : Saison
   ========================================================= */
P.season = {
  title: 'Saison',
  render() {
    const se = CQ.season(), L = CQ.seasonLvl(), th = CQ.seasonTheme(), on = CQ.isPremium();
    const into = se.xp - L * CQ.SEASON.xpPer, ev = CQ.eventNow();
    return `<div class="season-hero"><span class="season-ico">${th.icon}</span><div style="flex:1;min-width:0"><div class="kicker">Passe de saison · fin dans ${CQ.fmtDur(CQ.seasonEnd() - Date.now())}</div>
        <h2>${th.name}</h2><div class="row" style="gap:10px"><b class="big">${L}</b><span class="muted">/ ${CQ.SEASON.levels}</span></div>
        ${CQ.passClaimable() ? '<button class="btn gold sm mb" data-act="passAll">Tout récupérer</button>' : ''}
        ${L < CQ.SEASON.levels ? `${CQ.bar(100 * into / CQ.SEASON.xpPer, 'gold')}<div class="small dim mt">${CQ.fmt(into)} / ${CQ.fmt(CQ.SEASON.xpPer)} points jusqu’au niveau ${L + 1}</div>` : '<div class="chip gold">Passe terminé</div>'}</div></div>
      ${ev ? `<div class="mt">${CQ.eventBanner()}</div>` : ''}
      <div class="card mt"><h3>Gagner des points<span class="right">≈ 800 par journée régulière</span></h3><div class="row wrap" style="gap:6px">
        ${[['📅 Connexion', 'login'], ['📜 Quête du jour', 'quest'], ['🏛️ Panthéon', 'pantheon'], ['🗝️ Étage de donjon', 'floor'], ['👑 Boss', 'boss'], ['🏟️ Victoire d’arène', 'arena'], ['🤝 Victoire d’équipe', 'team'], ['🐉 Raid (100 ⚡)', 'raid'], ['⚔️ 5 victoires', 'kills5']]
          .map(([l, k]) => `<span class="chip">${l} · +${CQ.SEASON_XP[k]}</span>`).join('')}</div></div>
      <div class="pass mt">${Array.from({ length: CQ.SEASON.levels }, (_, i) => i + 1).map((l) => {
        const reached = L >= l, fr = CQ.passReward(l, false), lr = CQ.passReward(l, true);
        const cf = se.claimed[l], cl = se.legionClaimed[l];
        return `<div class="pass-row ${reached ? 'on' : ''}"><div class="pass-lvl">${l}</div>
          <div class="pass-cell"><div class="small">${CQ.passHtml(fr)}</div><button class="btn sm ${reached && !cf ? 'gold' : ''}" data-act="passClaim" data-arg="${l}:0" ${reached && !cf ? '' : 'disabled'}>${cf ? '✓' : 'Prendre'}</button></div>
          <div class="pass-cell legion"><div class="small">${CQ.passHtml(lr)}</div><button class="btn sm ${reached && on && !cl ? 'gold' : ''}" data-act="passClaim" data-arg="${l}:1" ${reached && on && !cl ? '' : 'disabled'}>${cl ? '✓' : on ? 'Prendre' : '🦅'}</button></div></div>`;
      }).join('')}</div>
      <div class="note mt">Colonne de gauche : gratuite pour tous. Colonne de droite : réservée à la <a href="#premium">Légion</a> (diamants, parchemins, coffre Mythique). Aucune récompense en FP, pour ne pas influencer le Crypto Pool. Atteindre le niveau 10 donne un titre de vétéran de la saison.</div>`;
  },
};
A.passClaim = (arg) => {
  const [l, g] = arg.split(':').map(Number);
  if (CQ.passClaim(l, !!g)) { CQ.sfx('coin'); CQ.save(); CQ.refresh(); }
};
A.passAll = () => { let n = 0; for (let l = 1; l <= CQ.seasonLvl(); l++) { if (CQ.passClaim(l, false)) n++; if (CQ.passClaim(l, true)) n++; } if (n) { CQ.sfx('loot'); CQ.toast(`🎖️ ${n} récompense${n > 1 ? 's' : ''} récupérée${n > 1 ? 's' : ''}`, 'green'); CQ.save(); CQ.refresh(); } };

// profil : titre affiché et indicateurs de l'économie
(() => {
  const r = P.profile.render;
  P.profile.render = () => {
    const s = S(), ec = CQ.econStats(), t = s.titles || [];
    const econ = ['cq', 'fp', 'gems', 'honor', 'crypto'].filter((k) => ec[k]).map((k) => {
      const o = ec[k], top = Object.entries(o.sinks).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return `<tr><td>${CQ.CUR[k].ico} ${CQ.CUR[k].name}</td><td class="r c-green">+${CQ.fmt(o.in)}</td><td class="r c-fp">−${CQ.fmt(o.out)}</td><td class="r">${o.in ? Math.round(100 * o.out / o.in) : 0} %</td><td class="small dim">${top.map(([n, v]) => `${CQ.esc(n)} ${CQ.fmt(v)}`).join(' · ') || '—'}</td></tr>`;
    }).join('');
    return r() + `<div class="grid g2 mt"><div class="card"><h3>🏷️ Titre affiché</h3>
      ${t.length ? `<select class="input" data-change="setTitle"><option value="">Aucun</option>${t.map((x) => `<option ${s.title === x ? 'selected' : ''} value="${CQ.esc(x)}">${CQ.esc(x)}</option>`).join('')}</select>` : '<div class="small muted">Les titres se gagnent au passe de saison, dans les Abysses et à l’arène.</div>'}</div>
      <div class="card"><h3>📈 Votre économie sur 7 jours</h3>${econ ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Monnaie</th><th class="r">Gagné</th><th class="r">Dépensé</th><th class="r">Taux</th><th>Grosses dépenses</th></tr>${econ}</table></div>` : '<div class="small muted">Pas encore assez d’historique.</div>'}
      <div class="small dim mt">Les gains de combat sont regroupés par minute. Une version serveur suivra l’inflation de tous les joueurs (PLAN-V3 §3.3).</div></div></div>`;
  };
})();
A.setTitle = (v) => { S().title = v || null; CQ.save(); CQ.refresh(); };
