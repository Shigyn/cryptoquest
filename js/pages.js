'use strict';
// Les 14 pages de l'application.
const P = CQ.PAGES, A = CQ.A, S = () => CQ.state;
const pctFmt = (v, d = 1) => v.toFixed(d).replace('.', ',') + ' %';
const HERO = '🧝';

/* =========================================================
   1. Accueil
   ========================================================= */
P.dashboard = {
  title: 'Accueil',
  render() {
    const s = S(), ps = CQ.playerStats(), zone = CQ.ZONES[s.zone];
    const nextMs = Object.keys(CQ.STREAK_MILESTONES).map(Number).find((d) => d > s.login.streak);
    const est = CQ.poolEstimate();
    return `
    <div class="hero">
      <div class="avatar ${CQ.isPremium() ? 'legion' : ''}">${HERO}</div>
      <div>
        <h2>${CQ.heroName(s.name)}</h2>
        <div class="meta">Niveau ${s.level} · ${zone.name} · série de ${s.login.streak} jour${s.login.streak > 1 ? 's' : ''}</div>
        <div class="mt" style="max-width:420px">${CQ.bar(100 * s.xp / CQ.xpNeed(s.level), 'xp')}<div class="small dim mt" style="margin-top:4px">${CQ.fmt(s.xp)} / ${CQ.fmt(CQ.xpNeed(s.level))} XP</div></div>
      </div>
      <div class="power"><div class="kicker">Puissance</div><div class="big">${CQ.fmt(ps.power)}</div></div>
    </div>

    <div class="stat-tiles mb">
      ${[['Attaque', ps.atk], ['Défense', ps.def], ['Points de vie', ps.maxHp], ['Énergie max', CQ.fmt(ps.emax)], ['Critique', CQ.fmtPs('crit', ps.crit)], ['Farm Power', '+' + pctFmt(ps.fp)]]
        .map(([k, v]) => `<div class="stile"><div class="k">${k}</div><div class="v">${v}</div></div>`).join('')}
    </div>

    <div class="grid g3">
      <div class="card glow">
        <h3>⚔️ Combat en cours<span class="right" id="dCmode"></span></h3>
        <div class="row"><div style="font-size:42px" id="dCicon"></div><div style="min-width:0;flex:1"><b id="dCname"></b><div class="small muted" id="dClvl"></div>
        <div class="mt" style="margin-top:8px">${CQ.bar(0, 'hp', 'dChp')}</div></div></div>
        <div class="mt">${CQ.bar(0, 'en', 'dCenBar')}<div class="small muted" style="margin-top:4px" id="dCen"></div></div>
        <div class="kv mt"><span>Victoires (session)</span><span id="dCkills"></span><span>Butin trouvé</span><span id="dCitems"></span></div>
        <a class="btn block mt" href="#combat">Aller au combat</a>
      </div>

      <div class="card gold">
        <h3>📅 Bonus de connexion<span class="right">Série ${s.login.streak} j</span></h3>
        ${CQ.loginAvailable() ? (() => {
          const st = CQ.loginNextStreak(), r = CQ.loginReward(st), ms = CQ.STREAK_MILESTONES[st];
          return `<div class="muted small">Jour ${st} de votre série</div><div class="row wrap mt">${CQ.rewardHtml(r)}${ms ? ` <span class="chip gold">+ ${ms.label}</span>` : ''}</div>
          <button class="btn gold block mt" data-act="claimLogin">Récupérer le bonus</button>`;
        })() : `<div class="muted">Bonus récupéré. Revenez demain pour prolonger la série.</div>
          <div class="small dim mt">Prochain palier : ${nextMs ? `jour ${nextMs} — ${CQ.STREAK_MILESTONES[nextMs].label}` : 'série maximale atteinte'}</div>`}
        <div class="row wrap mt">${[7, 14, 30].map((d) => `<span class="chip ${s.login.streak >= d ? 'green' : ''}">J${d}</span>`).join('')}</div>
      </div>

      <div class="card">
        <h3>💧 Faucet<span class="right">toutes les 30 min</span></h3>
        <div class="big tnum" id="dFaucet"></div>
        <div class="small muted" id="dFaucetSub"></div>
        <a class="btn block mt" href="#faucet" id="dFaucetBtn">Ouvrir le faucet</a>
      </div>
    </div>

    <div class="grid g2 mt">
      <div class="card gold">
        <h3>🔥 Crypto Pool n°${CQ.poolCycle().id}<span class="right">clôture dans <b class="tnum" id="dPoolT"></b></span></h3>
        <div class="kv">
          <span>Vos FP sacrifiés</span><span>${CQ.fmt(CQ.poolCycle().mine)} FP</span>
          <span>Part estimée à la clôture</span><span>${pctFmt(est.share * 100, 3)}</span>
          <span>Récompense estimée</span><span class="c-usd">${CQ.fmtUsd(est.reward)}</span>
          <span>Solde crypto</span><span class="c-usd">${CQ.fmtUsd(s.crypto)}</span>
        </div>
        <a class="btn gold block mt" href="#pool">Participer au pool</a>
      </div>
      <div class="card">
        <h3>📌 À faire maintenant</h3>
        <div class="todo">${P.dashboard.todos()}</div>
      </div>
    </div>
    <div class="mt">${CQ.adBanner('Bannière 728×90')}</div>`;
  },
  todos() {
    const s = S(), q = CQ.questsToday(), out = [];
    const add = (ic, t, sub, href, lab) => out.push(`<div class="todo-item"><span class="ti">${ic}</span><div class="tt"><b>${t}</b><span>${sub}</span></div><a class="btn sm" href="#${href}">${lab}</a></div>`);
    const ap = CQ.attrPoints().free, tp = CQ.talentPoints().free;
    if (ap || tp) add('🧝', 'Points à répartir', [ap ? `${ap} attribut${ap > 1 ? 's' : ''}` : '', tp ? `${tp} talent${tp > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '), 'hero', 'Répartir');
    if (!s.auto) add('⚔️', 'Votre héros attend vos ordres', 'Lancez le combat pour gagner XP, CQ et butin', 'combat', 'Combattre');
    if (CQ.isResting() && s.auto) add('🔥', 'Votre héros se repose', 'Plus d’énergie : fiole ou vidéo pour repartir', 'shop', 'Énergie');
    const qc = CQ.QUESTS.filter(CQ.questClaimable).length;
    if (qc) add('📜', `${qc} quête${qc > 1 ? 's' : ''} à récupérer`, 'Récompenses en attente', 'quests', 'Voir');
    const ac = CQ.ACHIEVEMENTS.filter(CQ.achClaimable).length;
    if (ac) add('🏅', `${ac} succès débloqué${ac > 1 ? 's' : ''}`, 'Récompenses en FP et CQ', 'quests', 'Voir');
    const ch = CQ.CHEST_KEYS.reduce((a, k) => a + s.chests[k], 0);
    if (ch) add('📦', `${ch} coffre${ch > 1 ? 's' : ''} à ouvrir`, 'Équipements et CQ', 'chests', 'Ouvrir');
    if (s.zoneKills[s.zone] >= CQ.BOSS_KILLS) add('👑', 'Boss disponible', CQ.ZONES[s.zone].boss[0], 'combat', 'Défier');
    if (s.stakes.some((st) => Date.now() >= st.end)) add('🔒', 'Staking arrivé à terme', 'Récupérez vos FP', 'staking', 'Récupérer');
    const nz = CQ.ZONES.findIndex((z, i) => i > s.zone && s.level >= z.lvl);
    if (nz > 0) add('🗺️', 'Nouvelle zone accessible', CQ.ZONES[nz].name, 'combat', 'Explorer');
    if (CQ.faucetReadyIn() === 0) add('💧', 'Faucet prêt', `+${CQ.faucetAmount()} FP`, 'faucet', 'Récupérer');
    const done = CQ.QUESTS.filter((x) => q.claimed[x.id]).length;
    if (!out.length) add('⚔️', 'Continuez à farmer', `Quêtes du jour : ${done}/${CQ.QUESTS.length}`, 'quests', 'Quêtes');
    return out.join('');
  },
  tick() {
    const c = CQ.combat, m = c.m, $ = CQ.$;
    if (!$('#dCname')) return;
    $('#dCmode').textContent = c.deadUntil ? 'K.O.' : CQ.isResting() ? 'Repos' : c.mode === 'farm' ? 'Farm' : c.mode === 'boss' ? 'Boss' : `Donjon ${c.wave}/${c.waves}`;
    const ps = CQ.playerStats(), en = CQ.energyNow(ps);
    $('#dCenBar').style.width = Math.min(100, 100 * en / ps.emax) + '%';
    $('#dCen').textContent = `⚡ ${CQ.fmt(Math.floor(en))} / ${CQ.fmt(ps.emax)} énergie${en < ps.emax ? ` · pleine dans ${CQ.fmtDur(CQ.energyFullIn(ps))}` : ''}`;
    $('#dCicon').textContent = m ? m.icon : '…';
    $('#dCname').textContent = m ? m.name : c.deadUntil ? 'Retour au camp…' : 'Recherche d’un adversaire…';
    $('#dClvl').textContent = m ? `Niveau ${m.lvl} · ${CQ.ZONES[c.zone].name}` : '';
    $('#dChp').style.width = m ? (100 * m.hp / m.max) + '%' : '0%';
    $('#dCkills').textContent = CQ.fmt(c.session.kills);
    $('#dCitems').textContent = c.session.items;
    const f = CQ.faucetReadyIn();
    $('#dFaucet').innerHTML = f ? CQ.fmtDur(f) : `<span class="c-fp">+${CQ.faucetAmount()} FP</span>`;
    $('#dFaucetSub').textContent = f ? 'avant le prochain claim' : 'Prêt à être récupéré';
    $('#dFaucetBtn').className = 'btn block mt ' + (f ? '' : 'primary');
    $('#dPoolT').textContent = CQ.fmtClock(CQ.poolCycle().end - Date.now());
  },
};
A.claimLogin = () => {
  const r = CQ.claimLogin();
  if (!r) return;
  CQ.toast(`📅 Jour ${r.streak} : ${CQ.rewardHtml(r.r)}${r.ms ? ` + ${r.ms.label}` : ''}`, 'green');
  CQ.save(); CQ.refresh();
};

/* =========================================================
   2. Combat et zones
   ========================================================= */
P.combat = {
  title: 'Combat',
  render() {
    const s = S(), c = CQ.combat, ps = CQ.playerStats();
    return `
    <div class="zones">${CQ.ZONES.map((z, i) => {
      const locked = s.level < z.lvl;
      const [rl, rc] = CQ.riskLabel(CQ.zoneYield(i, ps).risk);
      return `<button class="zone ${i === c.zone ? 'on' : ''} ${locked ? 'locked' : ''}" style="--zbg:${z.bg}" data-act="zone" data-arg="${i}">
        <div class="zn">${z.name}</div><div class="zl">Niveau ${z.lvl}+${locked ? '' : ` · <span class="risk ${rc}">${rl}</span>`}</div><span class="zi">${z.icon}</span></button>`;
    }).join('')}</div>

    <div class="arena" id="arena" style="--abg:${CQ.ZONES[c.zone].bg}">
      <div class="arena-mode" id="arenaMode"></div>
      <div class="fighter ${CQ.isPremium() ? 'legion' : ''}" id="fP">
        <div class="sprite">${HERO}</div>
        <div class="fname">${CQ.heroName(s.name)}</div><div class="flvl">Niveau ${s.level}</div>
        <div class="bars">${CQ.bar(100, 'hp me', 'pHp')}<div class="hpt" id="pHpT"></div>${CQ.bar(0, 'cd', 'pCd')}${CQ.bar(0, 'en thin', 'pEn')}<div class="hpt" id="pEnT"></div></div>
      </div>
      <div class="vs">VS</div>
      <div class="fighter" id="fM"></div>
      <div class="rest" id="rest" hidden></div>
    </div>

    <div class="combat-side">
      <div class="card"><h3>📜 Journal de combat</h3><div class="log" id="log"></div></div>
      <div class="card"><div id="challenges"></div></div>
    </div>`;
  },
  mount() { P.combat._rk = null; P.combat.monster(); P.combat.challenges(); P.combat.drawLog(); P.combat.tick(); },
  monster() {
    const c = CQ.combat, m = c.m, el = CQ.$('#fM');
    if (!el) return;
    const boss = m && CQ.isBoss(m);
    el.className = 'fighter spawn' + (boss ? ' boss' : '');
    el.innerHTML = m ? `<div class="sprite">${m.icon}</div><div class="fname">${CQ.esc(m.name)}</div><div class="flvl">Niveau ${m.lvl}${m.kind !== 'normal' ? ` · ${m.kind === 'elite' ? 'Élite' : 'Boss'}` : ''} · esquive ${Math.round(m.dodge)} %</div>
      <div class="bars">${CQ.bar(100 * m.hp / m.max, 'hp', 'mHp')}<div class="hpt" id="mHpT"></div>${CQ.bar(0, 'cd', 'mCd')}</div>`
      : `<div class="sprite dim">${c.deadUntil ? '💀' : '·'}</div><div class="fname dim">${c.deadUntil ? 'Vous êtes à terre' : 'Un adversaire approche…'}</div>`;
    const mode = CQ.$('#arenaMode');
    if (mode) mode.innerHTML = c.mode === 'captive' ? '<span class="chip red">⛓️ Boss des cachots</span>' : c.mode === 'boss' ? '<span class="chip red">👑 Combat de boss</span>'
      : c.mode === 'dungeon' ? `<span class="chip gold">🗝️ ${CQ.ZONES[c.zone].dungeon} · ${CQ.DMODES[c.dmode || 'normal'].name} · étage ${c.floor}/${c.floors}</span>` : '<span class="chip">Farm automatique</span>';
  },
  challenges() {
    const s = S(), c = CQ.combat, el = CQ.$('#challenges');
    if (!el) return;
    const ps = CQ.playerStats(), zone = CQ.ZONES[c.zone], kills = s.zoneKills[c.zone], ses = c.session;
    const y = CQ.zoneYield(c.zone, ps), [rl, rc] = CQ.riskLabel(y.risk);
    const bossR = CQ.riskLabel(CQ.survival(ps, CQ.makeMonster(c.zone, 0, 'boss')));
    el.innerHTML = `<h3>🎯 Défis de la zone</h3>
    <div class="challenge">
      <div class="ch"><span class="ci">${zone.boss[1]}</span><div class="cb"><b>${zone.boss[0]}</b><div class="small muted">Boss · Rare garanti minimum · ≈ ${CQ.fmt(CQ.bossEnergy(c.zone, ps))} énergie · <span class="risk ${bossR[1]}">${bossR[0]}</span></div>
        <div class="mt" style="margin-top:6px">${CQ.bar(100 * kills / CQ.BOSS_KILLS, 'gold')}</div><div class="small dim" style="margin-top:3px">${kills}/${CQ.BOSS_KILLS} victoires dans la zone</div></div>
        <button class="btn sm ${kills >= CQ.BOSS_KILLS ? 'primary' : ''}" data-act="boss" ${kills >= CQ.BOSS_KILLS && c.mode === 'farm' ? '' : 'disabled'}>Défier</button></div>
      <div class="ch"><span class="ci">🗝️</span><div class="cb"><b>${zone.dungeon}</b>
        <div class="small muted">Donjon à étages · 1 clé · matériaux à chaque étage, coffre et pièce d’ensemble à la fin</div>
        <div class="small mt" style="margin-top:6px">Clés : <b>${CQ.keysNow()}/${CQ.keysMax()}</b>${CQ.keysNow() < CQ.keysMax() ? ` · +1 dans ${CQ.fmtDur(CQ.keysNextIn())}` : ''} · meilleur étage : Normal ${CQ.dungeonOf(c.zone).normal}/5 · Héroïque ${CQ.dungeonOf(c.zone).hero}/10</div>
        <div class="small dim">≈ ${CQ.fmt(CQ.dungeonEnergy(c.zone, ps, 'normal'))} énergie en Normal · ≈ ${CQ.fmt(CQ.dungeonEnergy(c.zone, ps, 'hero'))} en Héroïque</div></div>
        <div class="row" style="flex-direction:column;gap:5px"><button class="btn sm" data-act="dungeon" data-arg="normal" ${c.mode === 'farm' && CQ.keysNow() && s.level >= CQ.FEATURE_LVL.dungeon ? '' : 'disabled'}>${s.level >= CQ.FEATURE_LVL.dungeon ? 'Normal' : `🔒 niv. ${CQ.FEATURE_LVL.dungeon}`}</button>
        <button class="btn sm gold" data-act="dungeon" data-arg="hero" ${c.mode === 'farm' && CQ.keysNow() && CQ.dungeonOpen(c.zone, 'hero') ? '' : 'disabled'} title="${CQ.dungeonOpen(c.zone, 'hero') ? '' : 'Terminez d’abord le Normal'}">Héroïque</button></div></div>
      ${c.mode !== 'farm' ? '<button class="btn ghost sm" data-act="abandon">Abandonner et revenir au farm</button>' : ''}
    </div>
    <div class="sep"></div>
    <div class="row between wrap" style="gap:8px">
      <button class="btn sm ${s.auto ? '' : 'gold'}" data-act="toggleAuto">${s.auto ? '⏸ Arrêter le combat' : '⚔️ Commencer à combattre'}</button>
      <label class="small muted row" style="gap:6px">S’arrêter à
        <select class="input sm" data-change="eguard">${CQ.ENERGY_GUARDS.map((g) => `<option value="${g}" ${s.eguard === g ? 'selected' : ''}>${g} énergie</option>`).join('')}</select></label>
    </div>
    <div class="section-title" style="margin:14px 0 8px">Rendement pour 100 énergie</div>
    <div class="kv">
      <span>Victoires</span><span>≈ ${y.kills.toFixed(1).replace('.', ',')}</span>
      <span>Expérience</span><span>≈ ${CQ.fmt(y.xp)} XP</span>
      <span>CQ</span><span class="c-cq">≈ ${CQ.fmt(y.cq)}</span>
      <span>Farm Points</span><span class="c-fp">≈ ${y.fp.toFixed(1).replace('.', ',')}</span>
      <span>Danger</span><span class="risk ${rc}">${rl}</span>
      <span>Énergie dépensée (session)</span><span>${CQ.fmt(ses.energy || 0)}</span>
    </div>
    ${CQ.gapMult(s.level, zone.lvl + 1) < 1 ? `<div class="note mt" style="border-color:#4f2328">⚠️ Monstres trop faibles pour votre niveau : −${Math.round(100 * (1 - CQ.gapMult(s.level, zone.lvl + 1)))} % d’XP et de CQ. Une zone plus haute rapporte davantage par énergie.</div>` : ''}
    ${zone.tip ? `<div class="note mt">${zone.tip}.</div>` : ''}`;
  },
  rest() {
    const el = CQ.$('#rest'), s = S(), c = CQ.combat;
    if (!el) return;
    const rk = !s.auto ? 'pause' : c.resting ? 'rest' : '';
    if (rk === P.combat._rk) return;
    P.combat._rk = rk;
    el.hidden = !rk;
    if (!rk) return;
    const left = CQ.energyVideoLeft();
    el.innerHTML = rk === 'pause'
      ? `<div class="rest-in"><div class="fire">⚔️</div><b>Prêt au combat</b><div class="small muted">Votre héros attend vos ordres. Chaque attaque coûte 1 énergie ; tant que le combat est arrêté, l’énergie se recharge.</div>
        <button class="btn primary mt" data-act="toggleAuto">⚔️ Commencer à combattre</button></div>`
      : `<div class="rest-in"><div class="fire">🔥</div><b>Votre héros se repose</b><div class="small muted" id="restSub"></div>
        <div class="row wrap mt" style="justify-content:center;gap:8px">
          <button class="btn gold sm" data-act="energyVideo" ${left > 0 ? '' : 'disabled'}>▶ Vidéo +${CQ.ENERGY.video} ⚡ (${left}/${CQ.ENERGY.videoPerDay})</button>
          <a class="btn sm" href="#shop">Fioles d’énergie</a></div></div>`;
  },
  drawLog() {
    const el = CQ.$('#log');
    if (el) el.innerHTML = CQ.combat.log.map((l) => `<div>${l}</div>`).join('') || '<div class="dim">Le combat commence…</div>';
  },
  tick() {
    const c = CQ.combat, s = S(), ps = CQ.playerStats(), $ = CQ.$;
    if (!$('#pHp')) return;
    const en = CQ.energyNow(ps);
    $('#pHp').style.width = (100 * c.php / ps.maxHp) + '%';
    $('#pHpT').textContent = `${Math.ceil(c.php)} / ${ps.maxHp} PV`;
    $('#pCd').style.width = CQ.isResting() ? '0%' : Math.min(100, 100 * c.pT / CQ.attackInterval(ps)) + '%';
    $('#pEn').style.width = Math.min(100, 100 * en / ps.emax) + '%';
    $('#pEnT').textContent = `⚡ ${CQ.fmt(Math.floor(en))} / ${CQ.fmt(ps.emax)}`;
    if (c.m && $('#mHp')) {
      $('#mHp').style.width = (100 * c.m.hp / c.m.max) + '%';
      $('#mHpT').textContent = `${Math.ceil(c.m.hp)} / ${c.m.max} PV`;
      $('#mCd').style.width = Math.min(100, 100 * c.mT / (CQ.isBoss(c.m) ? 1500 : 1700)) + '%';
    }
    P.combat.rest();
    const sub = $('#restSub');
    if (sub) {
      const need = s.eguard + CQ.ENERGY.resume;
      sub.textContent = `Reprise automatique à ${need} énergie · dans ${CQ.fmtDur(Math.max(0, need - en) / ps.eregen * 3600000)}`;
    }
  },
  floater(target, text, cls) {
    const arena = CQ.$('#arena'), f = CQ.$(target);
    if (!arena || !f) return;
    const ar = arena.getBoundingClientRect(), r = f.querySelector('.sprite').getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'floater ' + cls;
    el.textContent = text;
    el.style.left = (r.left - ar.left + r.width / 2 + CQ.rand(-18, 18)) + 'px';
    el.style.top = (r.top - ar.top + 10) + 'px';
    arena.appendChild(el);
    setTimeout(() => el.remove(), 950);
  },
  anim(sel, cls) {
    const el = CQ.$(sel);
    if (!el) return;
    el.classList.remove('lunge-r', 'lunge-l', 'hit', 'spawn');
    void el.offsetWidth;
    el.classList.add(cls);
  },
};
CQ.on((type, d) => {
  const pg = CQ.ui.page;
  if (type === 'kill' && pg === 'dashboard') return; // tick suffit
  if (pg !== 'combat') return;
  const C = P.combat;
  if (type === 'pHit') {
    C.anim('#fP', 'lunge-r');
    if (d.miss) { C.floater('#fM', 'Raté', 'miss'); return; }
    C.anim('#fM', 'hit');
    const pre = d.tag === 'double' ? '×2 ' : d.tag === 'riposte' ? '↩ ' : '';
    if (d.exec) C.floater('#fM', 'Coup de grâce', 'crit');
    else C.floater('#fM', d.crit ? `${pre}CRITIQUE ${d.dmg}` : pre + d.dmg, d.crit ? 'crit' : 'dmg');
  } else if (type === 'mHit') {
    C.anim('#fM', 'lunge-l');
    if (d.dodge) { C.floater('#fP', 'Esquivé', 'miss'); return; }
    C.anim('#fP', 'hit');
    C.floater('#fP', `-${d.dmg}${d.block ? ' bloqué' : d.crit ? ' !' : ''}`, 'hurt');
  } else if (type === 'free') C.floater('#fP', '⚡ gratuit', 'free');
  else if (type === 'kill') {
    const el = CQ.$('#fM');
    if (el) el.classList.add('dead');
    if (d.fp) C.floater('#fM', `+${d.fp} FP`, 'loot');
    C.challenges();
  } else if (type === 'spawn' || type === 'death' || type === 'rest') { C.monster(); C.challenges(); C.rest(); }
  else if (type === 'log') C.drawLog();
});
A.zone = (i) => { CQ.setZone(Number(i)); CQ.save(); CQ.refresh(); };
A.boss = () => { CQ.startBoss(); CQ.refresh(); };
A.dungeon = (mode) => { CQ.startDungeon(mode || 'normal'); CQ.refresh(); };
A.abandon = () => { CQ.abandon(); CQ.refresh(); };
A.toggleAuto = () => {
  const s = S();
  s.auto = !s.auto;
  if (s.auto) { CQ.combat.resting = true; CQ.wake(); }
  CQ.save(); CQ.refresh();
};
A.eguard = (v) => { S().eguard = Number(v) || 0; CQ.combat.resting = true; CQ.wake(); CQ.save(); CQ.refresh(); };
A.energyVideo = () => {
  if (CQ.energyVideoLeft() <= 0) return;
  CQ.watch({ title: 'Second souffle', secs: 5, label: 'Votre vidéo partenaire', reward: true }, () => {
    const n = CQ.claimEnergyVideo();
    CQ.toast(`⚡ +${n} énergie`, 'green');
    CQ.save(); CQ.refresh();
  });
};
A.energyInfo = () => {
  const s = S(), ps = CQ.playerStats(), en = CQ.energyNow(ps), d = CQ.eDay();
  CQ.openModal(`<h2>⚡ Énergie</h2>
    <div class="big c-en">${CQ.fmt(Math.floor(en))} <span class="small muted" style="font-family:var(--font)">/ ${CQ.fmt(ps.emax)}</span></div>
    <div class="mt">${CQ.bar(100 * en / ps.emax, 'en big')}</div>
    <div class="kv mt"><span>Recharge</span><span>${CQ.fmtStat('eregen', ps.eregen)}</span>
      <span>Pleine dans</span><span>${en >= ps.emax ? '—' : CQ.fmtDur(CQ.energyFullIn(ps))}</span>
      <span>Coût d’une attaque</span><span>1 énergie, touchée ou ratée</span>
      <span>Combat automatique</span><span>${s.auto ? 'en marche' : 'en pause'}${s.eguard ? ` · arrêt à ${s.eguard}` : ''}</span></div>
    <div class="section-title">Regagner de l’énergie</div>
    <div class="kv"><span>Passage de niveau</span><span>+${CQ.ENERGY.levelUp}</span><span>Bonus de connexion</span><span>+${CQ.ENERGY.login}</span>
      <span>Quête « Abattre 60 monstres »</span><span>+150</span><span>Vidéo Second souffle</span><span>+${CQ.ENERGY.video} (${CQ.ENERGY.videoPerDay - d.video} restantes aujourd’hui)</span>
      <span>Coffre d’Or / Mythique</span><span>+${CQ.ENERGY.chest.gold} / +${CQ.ENERGY.chest.mythic}</span></div>
    <div class="note mt">Les fioles, vidéos et bonus peuvent dépasser le maximum, jusqu’à ${CQ.ENERGY.overcap} × (surcharge). La recharge naturelle s’arrête au maximum. L’Endurance, l’Amulette et la branche Moisson augmentent la réserve et la recharge.</div>
    <div class="actions"><button class="btn" data-act="goClose" data-arg="hero">Attributs</button><button class="btn gold" data-act="goClose" data-arg="shop">Fioles d’énergie</button></div>`);
};

/* =========================================================
   3. Inventaire
   ========================================================= */
P.inventory = {
  title: 'Inventaire',
  render() {
    const s = S(), f = CQ.ui.filter;
    let items = s.inventory.slice();
    if (f.slot !== 'all') items = items.filter((i) => i.slot === f.slot);
    if (f.rarity !== 'all') items = items.filter((i) => i.rarity === Number(f.rarity));
    const sorters = { recent: (a, b) => b.at - a.at, rarity: (a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl, power: (a, b) => CQ.itemPower(b) - CQ.itemPower(a), level: (a, b) => b.ilvl - a.ilvl };
    items.sort(sorters[f.sort]);
    const junk = s.inventory.filter((i) => i.rarity <= 1 && !i.locked && !CQ.isEquipped(i));
    const cons = Object.entries(s.consumables).filter(([, n]) => n > 0), buffs = CQ.activeBuffs();
    return `
    ${cons.length || buffs.length ? `<div class="card mb"><h3>🧪 Consommables${buffs.length ? `<span class="right row wrap" style="gap:6px">${buffs.map(([k, b]) => `<span class="chip green">+${b.val} % ${CQ.BUFF_NAMES[k]} · ${CQ.fmtDur(b.until - Date.now())}</span>`).join('')}</span>` : ''}</h3>
      ${cons.length ? `<div class="cons-list">${cons.map(([id, n]) => { const c = CQ.CONSUMABLES[id]; return `<div class="cons"><span class="cons-ico">${c.icon}</span><div class="lr"><b>${c.name} ×${n}</b><span>${c.desc}</span></div><button class="btn sm gold" data-act="useCons" data-arg="${id}">Utiliser</button></div>`; }).join('')}</div>`
        : '<div class="small muted">Aucun consommable. Fioles et parchemins s’achètent à l’hôtel des ventes.</div>'}</div>` : ''}
    <div class="filters">
      <select class="input" data-change="fSlot"><option value="all">Tous les emplacements</option>${CQ.SLOTS.map((sl) => `<option value="${sl.id}" ${f.slot === sl.id ? 'selected' : ''}>${sl.icon} ${sl.name}</option>`).join('')}</select>
      <select class="input" data-change="fRarity"><option value="all">Toutes les raretés</option>${CQ.RARITIES.map((r, i) => `<option value="${i}" ${String(f.rarity) === String(i) ? 'selected' : ''}>${r.name}</option>`).join('')}</select>
      <select class="input" data-change="fSort">${[['recent', 'Plus récents'], ['rarity', 'Rareté'], ['power', 'Puissance'], ['level', 'Niveau']].map(([v, l]) => `<option value="${v}" ${f.sort === v ? 'selected' : ''}>Trier : ${l}</option>`).join('')}</select>
      <span class="chip" style="margin-left:auto">${s.inventory.length} / ${CQ.INV_CAP}</span>
      <button class="btn sm" data-act="sellJunk" ${junk.length ? '' : 'disabled'}>Revendre ${junk.length} commun${junk.length > 1 ? 's' : ''} et peu commun${junk.length > 1 ? 's' : ''}</button>
    </div>
    ${items.length ? `<div class="items">${items.map((it) => CQ.itemTile(it)).join('')}</div>`
      : '<div class="empty">Aucun objet. Combattez des monstres ou ouvrez des coffres pour remplir votre sac.</div>'}
    <div class="note mt2">🟢 équipé · 🔗 lié (déjà porté : plus vendable au marché) · 🔒 verrouillé (protégé de la revente et de la fusion) · ◆ pièce d’ensemble. Inventaire plein : les nouveaux objets sont revendus automatiquement.</div>`;
  },
};
A.useCons = (id) => {
  const c = CQ.CONSUMABLES[id];
  if (CQ.useConsumable(id)) { CQ.toast(`${c.icon} ${c.name} : ${c.desc}`, 'green'); CQ.save(); CQ.refresh(); }
};
A.fSlot = (v) => { CQ.ui.filter.slot = v; CQ.refresh(); };
A.fRarity = (v) => { CQ.ui.filter.rarity = v; CQ.refresh(); };
A.fSort = (v) => { CQ.ui.filter.sort = v; CQ.refresh(); };
A.sellJunk = () => {
  const ids = S().inventory.filter((i) => i.rarity <= 1 && !i.locked && !CQ.isEquipped(i)).map((i) => i.id);
  const r = CQ.sell(ids);
  if (r.n) CQ.toast(`${r.n} objets revendus : +${CQ.fmt(r.total)} CQ`, 'green');
  CQ.save(); CQ.refresh();
};

A.itemInfo = (id) => {
  const it = CQ.itemById(Number(id));
  if (!it) return;
  const eq = CQ.isEquipped(it), tb = CQ.tradeBlock(it);
  CQ.openModal(`<div class="item-detail">${CQ.itemHead(it)}${CQ.rollsHtml(it)}${eq ? '' : CQ.compareHtml(it)}
    <div class="small dim mt">Revente au marchand : ${CQ.fmt(CQ.sellValue(it))} CQ · prix de référence au marché : ${tb ? `non vendable (${tb.toLowerCase()})` : CQ.fmt(CQ.refPrice(it)) + ' CQ'}</div></div>
    <div class="actions">
      ${eq ? '' : `<button class="btn ghost sm" data-act="sellOne" data-arg="${it.id}" ${it.locked ? 'disabled' : ''}>Revendre</button>`}
      ${tb ? '' : `<button class="btn ghost sm" data-act="mktSellForm" data-arg="${it.id}">Vendre au marché</button>`}
      <button class="btn ghost sm" data-act="lock" data-arg="${it.id}">${it.locked ? 'Déverrouiller' : 'Verrouiller'}</button>
      <button class="btn sm" data-act="toForge" data-arg="${it.id}">Améliorer</button>
      ${eq ? `<button class="btn sm" data-act="unequip" data-arg="${it.slot}">Retirer</button>` : `<button class="btn primary sm" data-act="equip" data-arg="${it.id}">Équiper</button>`}
    </div>`);
};
A.equip = (id) => {
  const it = CQ.itemById(Number(id));
  if (!it) return;
  const go = () => { CQ.equip(it.id); CQ.closeModal(); CQ.save(); CQ.refresh(); };
  // un objet de valeur encore vendable : prévenir qu'il sera lié
  if (!it.bound && (it.rarity >= 3 || it.good)) {
    CQ.confirm('Équiper cet objet ?', `Une fois équipé, <b>${CQ.esc(it.name)}</b> sera lié à votre compte : vous ne pourrez plus le vendre au marché (référence ${CQ.fmt(CQ.refPrice(it))} CQ).`, 'Équiper', go);
  } else go();
};
A.unequip = (slot) => { CQ.unequip(slot); CQ.closeModal(); CQ.save(); CQ.refresh(); };
A.lock = (id) => { const it = CQ.itemById(Number(id)); it.locked = !it.locked; CQ.save(); A.itemInfo(id); CQ.refresh(); };
A.sellOne = (id) => { const r = CQ.sell([Number(id)]); if (r.n) CQ.toast(`Revendu : +${r.total} CQ`, 'green'); CQ.closeModal(); CQ.save(); CQ.refresh(); };
A.toForge = (id) => { CQ.ui.sel.up = Number(id); CQ.ui.tab.forge = 'up'; CQ.closeModal(); CQ.go('forge'); };

/* =========================================================
   4. Équipement
   ========================================================= */
P.equipment = {
  title: 'Équipement',
  render() {
    const s = S(), ps = CQ.playerStats();
    const slot = (id) => {
      const sl = CQ.SLOT[id], it = s.equipped[id] && CQ.itemById(s.equipped[id]);
      return `<button class="slot ${it ? 'r' + it.rarity : ''}" data-act="${it ? 'itemInfo' : 'slotPick'}" data-arg="${it ? it.id : id}">
        ${it ? CQ.itemTile(it, { static: true }) : `<span class="item none">${sl.icon}</span>`}
        <div style="min-width:0"><div class="sn">${sl.name}</div><div class="sv">${it ? CQ.esc(it.name) + (it.plus ? ` +${it.plus}` : '') : 'Vide'}</div>${it ? `<div class="small dim">Puissance ${CQ.itemPower(it)}</div>` : `<div class="small dim">${sl.main.map((k) => CQ.STATS[k].name).join(' · ')}</div>`}</div></button>`;
    };
    return `
    <div class="grid g-side">
      <div class="card">
        <h3>Personnage<span class="right">Puissance <b class="c-cq">${CQ.fmt(ps.power)}</b></span></h3>
        <div class="doll">
          <div class="col">${slot('weapon')}${slot('helmet')}${slot('armor')}${slot('amulet')}</div>
          <div class="figure">${HERO}</div>
          <div class="col">${slot('gloves')}${slot('boots')}${slot('ring')}</div>
        </div>
        <div class="row mt"><button class="btn gold" data-act="autoEquip">Équiper le meilleur</button><a class="btn ghost" href="#inventory">Ouvrir l'inventaire</a></div>
      </div>
      <div class="card">
        <h3>Statistiques</h3>
        <div class="kv">${CQ.STAT_VIEW.map((k) => `<span title="${CQ.esc(CQ.STAT_HELP[k])}">${CQ.STATS[k].name}</span><span>${CQ.fmtPs(k, ps[k])}</span>`).join('')}</div>
        <a class="btn block mt" href="#hero">Détail par source et attributs</a>
      </div>
    </div>`;
  },
};
// ordre d'affichage des statistiques du héros
CQ.STAT_VIEW = ['atk', 'def', 'hp', 'hit', 'dodge', 'crit', 'critd', 'parry', 'resil', 'spd', 'pen', 'emax', 'eregen', 'fp', 'luck', 'xp'];
A.slotPick = (slot) => { CQ.ui.filter.slot = slot; CQ.ui.filter.sort = 'power'; CQ.go('inventory'); };
A.autoEquip = () => {
  const s = S();
  let n = 0;
  for (const sl of CQ.SLOTS) {
    const best = s.inventory.filter((i) => i.slot === sl.id && CQ.canWear(i)).sort((a, b) => CQ.itemPower(b) - CQ.itemPower(a))[0];
    if (best && s.equipped[sl.id] !== best.id) { CQ.equip(best.id); n++; }
  }
  CQ.toast(n ? `${n} emplacement${n > 1 ? 's' : ''} amélioré${n > 1 ? 's' : ''}.` : 'Vous portez déjà le meilleur équipement.', n ? 'green' : '');
  CQ.save(); CQ.refresh();
};

/* =========================================================
   5. Coffres
   ========================================================= */
P.chests = {
  title: 'Coffres',
  render() {
    const s = S();
    return `<div class="grid g4">${CQ.CHEST_KEYS.map((k) => {
      const c = CQ.CHESTS[k], tot = c.weights.reduce((a, b) => a + b, 0);
      return `<div class="card chest-card" style="--cg:${c.glow}">
        <div class="chest-ico">${c.icon}</div>
        <h3 style="margin:0">${c.name}</h3>
        <div class="small muted">${c.items} objet${c.items > 1 ? 's' : ''} · ${CQ.fmt(c.cq[0])}–${CQ.fmt(c.cq[1])} CQ</div>
        <div class="odds" title="Probabilités de rareté">${c.weights.map((w, i) => (w ? `<i style="width:${(100 * w / tot).toFixed(1)}%;background:${CQ.RARITY_COLORS[i]}"></i>` : '')).join('')}</div>
        <div class="small dim">${c.weights.map((w, i) => (w ? `${CQ.RARITIES[i].name} ${Math.round(100 * w / tot * 10) / 10} %` : '')).filter(Boolean).join(' · ')}</div>
        <div class="big">${s.chests[k]}<span class="small muted" style="font-family:var(--font)"> possédé${s.chests[k] > 1 ? 's' : ''}</span></div>
        <button class="btn primary block" data-act="openChest" data-arg="${k}" ${s.chests[k] ? '' : 'disabled'}>Ouvrir</button>
        <button class="btn block" data-act="buyChest" data-arg="${k}" ${CQ.canPay(CQ.chestCost(k)) ? '' : 'disabled'}>Acheter · ${CQ.costHtml(CQ.chestCost(k))}</button>
      </div>`;
    }).join('')}</div>
    <div class="note mt">Les coffres s'obtiennent aussi dans les donjons, les quêtes quotidiennes et les paliers de connexion (jours 7, 14 et 30). La Luck améliore les chances de rareté.</div>`;
  },
};
A.buyChest = (k) => { if (CQ.buyChest(k)) { CQ.toast(`${CQ.CHESTS[k].name} acheté.`, 'green'); CQ.save(); CQ.refresh(); } };
A.openChest = (k) => {
  const c = CQ.CHESTS[k];
  const res = CQ.openChest(k);
  if (!res) return;
  CQ.save();
  CQ.openModal(`<h2>${c.name}</h2><div class="opening" id="opening" style="--cg:${c.glow}"><div class="chest-ico">${c.icon}</div></div><div class="reveal" id="reveal"></div>`, { wide: true, onClose: () => CQ.refresh() });
  setTimeout(() => { const o = CQ.$('#opening'); if (o) o.classList.add('burst'); }, 1200);
  setTimeout(() => {
    const o = CQ.$('#opening'), r = CQ.$('#reveal');
    if (!r) return;
    if (o) o.remove();
    r.innerHTML = res.items.map((it, i) => `<div class="rv r${it.rarity}" style="animation-delay:${i * 0.25}s">${CQ.itemTile(it)}<div class="rn">${CQ.esc(it.name)}<br><span class="small">${CQ.RARITIES[it.rarity].name}</span></div></div>`).join('') +
      `<div class="rv" style="animation-delay:${res.items.length * 0.25}s;justify-content:center"><div class="big c-cq">+${CQ.fmt(res.cq)}</div><div class="small muted">CQ</div></div>` +
      (res.energy ? `<div class="rv" style="animation-delay:${(res.items.length + 1) * 0.25}s;justify-content:center"><div class="big c-en">+${CQ.fmt(res.energy)}</div><div class="small muted">énergie</div></div>` : '');
    r.insertAdjacentHTML('afterend', `<div class="actions">${S().chests[k] ? `<button class="btn" data-act="openChest" data-arg="${k}">En ouvrir un autre (${S().chests[k]})</button>` : ''}<button class="btn primary" data-act="closeModal">Continuer</button></div>`);
  }, 1650);
};

/* =========================================================
   6. Forge
   ========================================================= */
P.forge = {
  title: 'Forge',
  render() {
    const tab = CQ.tabOf('forge', 'up');
    return CQ.tabs('forge', [['up', '🔨 Amélioration'], ['recipe', '📜 Forger'], ['smelt', '🔥 Fonte'], ['reserve', '🧱 Réserve'], ['fuse', '🌀 Fusion'], ['craft', '🎲 Au hasard'], ['salvage', '♻️ Recyclage']]) + P.forge[tab]();
  },
  up() {
    const s = S(), sel = CQ.itemById(CQ.ui.sel.up);
    const items = s.inventory.slice().sort((a, b) => (CQ.isEquipped(b) - CQ.isEquipped(a)) || b.rarity - a.rarity || b.plus - a.plus);
    let panel = '<div class="empty">Choisissez un objet à améliorer.</div>';
    if (sel) {
      const max = sel.plus >= CQ.MAX_PLUS, cost = max ? 0 : CQ.upgradeCost(sel), um = max ? null : CQ.upgradeMats(sel);
      panel = `<div class="item-detail">${CQ.itemHead(sel)}${CQ.rollsHtml(sel)}</div><div class="sep"></div>
        ${max ? `<div class="chip gold">Niveau maximum atteint (+${CQ.MAX_PLUS})</div>` : `<div class="kv">
          <span>Palier</span><span>+${sel.plus} → +${sel.plus + 1}</span>
          <span>Chance de réussite</span><span>${CQ.UPGRADE_CHANCE[sel.plus]} %</span>
          <span>Gain par palier</span><span>+10 % des stats de base</span>
          <span>Coût</span><span>${CQ.money('cq', cost)}${um ? ` + ${um.n} ${CQ.matLabel(um.mat, um.q)} <span class="dim">(${CQ.matCount(um.mat, um.q)} en réserve)</span>` : ''}</span></div>
          ${CQ.upRiskHtml ? CQ.upRiskHtml(sel) : ''}
          <button class="btn primary block mt" data-act="doUpgrade" ${s.cq >= cost && (!um || CQ.matCount(um.mat, um.q) >= um.n) ? '' : 'disabled'}>Forger +${sel.plus + 1}</button>`}`;
    }
    return `<div class="grid g2"><div class="card"><h3>Vos objets</h3>${items.length ? `<div class="items">${items.map((it) => CQ.itemTile(it, { act: 'selUp', sel: sel && sel.id === it.id })).join('')}</div>` : '<div class="empty">Inventaire vide.</div>'}</div>
      <div class="card gold"><h3>Enclume</h3>${panel}</div></div>`;
  },
  fuse() {
    const s = S(), sel = (CQ.ui.sel.fuse || []).filter((id) => CQ.itemById(id));
    CQ.ui.sel.fuse = sel;
    const r = sel.length ? CQ.itemById(sel[0]).rarity : null;
    const items = s.inventory.filter((i) => i.rarity < 5 && !i.locked && !CQ.isEquipped(i) && (r === null || i.rarity === r)).sort((a, b) => b.rarity - a.rarity || b.ilvl - a.ilvl);
    const cost = r !== null ? CQ.fusionCost(r) : 0;
    return `<div class="grid g2"><div class="card"><h3>Objets fusionnables<span class="right">${r !== null ? 'Rareté : ' + CQ.RARITIES[r].name : 'Sélectionnez 3 objets de même rareté'}</span></h3>
      ${items.length ? `<div class="items">${items.map((it) => CQ.itemTile(it, { act: 'selFuse', sel: sel.includes(it.id) })).join('')}</div>` : '<div class="empty">Aucun objet fusionnable (les objets équipés, verrouillés ou mythiques sont exclus).</div>'}</div>
      <div class="card gold"><h3>Creuset</h3>
        <div class="row" style="gap:12px;justify-content:center">${[0, 1, 2].map((i) => (sel[i] ? CQ.itemTile(CQ.itemById(sel[i]), { act: 'selFuse' }) : '<span class="item r0" style="width:76px;opacity:.35">?</span>')).join('')}
        <span class="big dim">→</span><span class="item ${r !== null ? 'r' + (r + 1) : 'r0'}" style="width:76px;${r === null ? 'opacity:.35' : ''}">✦</span></div>
        <div class="kv mt"><span>Résultat</span><span>${r !== null ? `<span class="r${r + 1} rt">${CQ.RARITIES[r + 1].name}</span>` : '—'}</span>
        <span>Emplacement</span><span>${sel.length === 3 && sel.every((id) => CQ.itemById(id).slot === CQ.itemById(sel[0]).slot) ? CQ.SLOT[CQ.itemById(sel[0]).slot].name : 'Aléatoire parmi les 3'}</span>
        <span>Coût</span><span>${r !== null ? CQ.money('cq', cost) : '—'}</span></div>
        <div class="note mt">Les trois objets sont consommés. Le niveau du nouvel objet est celui du plus haut des trois.</div>
        <button class="btn primary block mt" data-act="doFuse" ${sel.length === 3 && s.cq >= cost ? '' : 'disabled'}>Fusionner</button>
        ${sel.length ? '<button class="btn ghost block mt" data-act="clearFuse">Vider la sélection</button>' : ''}
      </div></div>`;
  },
  craft() {
    const cost = CQ.craftCost(), tot = CQ.CRAFT_WEIGHTS.reduce((a, b) => a + b, 0);
    return `<div class="card"><h3>Créer un objet<span class="right">niveau d'objet ${S().level + 1} · coût ${CQ.money('cq', cost)}</span></h3>
      <div class="grid g3">${CQ.SLOTS.map((sl) => `<button class="slot" data-act="doCraft" data-arg="${sl.id}" ${S().cq >= cost ? '' : 'disabled'}><span class="item r0">${sl.icon}</span><div><div class="sn">Forger</div><div class="sv" style="color:var(--text)">${sl.name}</div><div class="small dim">${sl.main.map((k) => CQ.STATS[k].name).join(' · ')}</div></div></button>`).join('')}</div>
      <div class="odds mt">${CQ.CRAFT_WEIGHTS.map((w, i) => (w ? `<i style="width:${100 * w / tot}%;background:${CQ.RARITY_COLORS[i]}"></i>` : '')).join('')}</div>
      <div class="small dim mt" style="margin-top:6px">${CQ.CRAFT_WEIGHTS.map((w, i) => (w ? `${CQ.RARITIES[i].name} ${Math.round(100 * w / tot)} %` : '')).filter(Boolean).join(' · ')} — avant bonus de Luck</div></div>`;
  },
  salvage() {
    const s = S();
    return `<div class="card"><h3>Recyclage par rareté</h3>${CQ.RARITIES.map((r, i) => {
      const list = s.inventory.filter((it) => it.rarity === i && !it.locked && !CQ.isEquipped(it));
      const val = list.reduce((a, it) => a + CQ.sellValue(it), 0);
      return `<div class="list-row r${i}"><span class="item r${i}" style="width:44px;font-size:18px">✦</span><div class="lr"><b class="rt">${r.name}</b><span>${list.length} objet${list.length > 1 ? 's' : ''} · ${CQ.fmt(val)} CQ</span></div>
        <button class="btn sm" data-act="salvage" data-arg="${i}" ${list.length ? '' : 'disabled'}>Tout recycler</button></div>`;
    }).join('')}<div class="note mt">Les objets équipés et verrouillés ne sont jamais recyclés.</div></div>`;
  },
};
A.selUp = (id) => { CQ.ui.sel.up = Number(id); CQ.refresh(); };
A.doUpgrade = () => {
  const it = CQ.itemById(CQ.ui.sel.up);
  const ok = CQ.upgrade(CQ.ui.sel.up);
  if (ok === null) return;
  CQ.toast(ok ? `🔨 Réussite : ${CQ.esc(it.name)} +${it.plus}` : '💥 Échec de la forge. L’objet est intact.', ok ? 'green' : 'red');
  CQ.save(); CQ.refresh();
};
A.selFuse = (id) => {
  id = Number(id);
  const sel = CQ.ui.sel.fuse || (CQ.ui.sel.fuse = []);
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1); else if (sel.length < 3) sel.push(id);
  CQ.refresh();
};
A.clearFuse = () => { CQ.ui.sel.fuse = []; CQ.refresh(); };
A.doFuse = () => {
  const it = CQ.fuse(CQ.ui.sel.fuse);
  if (!it) return;
  CQ.ui.sel.fuse = [];
  CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>Fusion réussie</h2><div class="reveal"><div class="rv r${it.rarity}">${CQ.itemTile(it)}<div class="rn">${CQ.esc(it.name)}<br><span class="small">${CQ.RARITIES[it.rarity].name}</span></div></div></div><div class="actions"><button class="btn primary" data-act="closeModal">Continuer</button></div>`);
};
A.doCraft = (slot) => {
  const it = CQ.craft(slot);
  if (!it) return;
  CQ.save(); CQ.refresh();
  CQ.openModal(`<h2>Objet forgé</h2><div class="reveal"><div class="rv r${it.rarity}">${CQ.itemTile(it)}<div class="rn">${CQ.esc(it.name)}<br><span class="small">${CQ.RARITIES[it.rarity].name}</span></div></div></div><div class="actions"><button class="btn" data-act="doCraft" data-arg="${slot}">Recommencer</button><button class="btn primary" data-act="closeModal">Continuer</button></div>`);
};
A.salvage = (r) => {
  const ids = S().inventory.filter((it) => it.rarity === Number(r) && !it.locked && !CQ.isEquipped(it)).map((i) => i.id);
  CQ.confirm('Recycler ces objets ?', `${ids.length} objet${ids.length > 1 ? 's' : ''} ${CQ.RARITIES[r].name.toLowerCase()} seront détruits contre des CQ.`, 'Recycler', () => {
    const res = CQ.sell(ids);
    CQ.toast(`♻️ +${CQ.fmt(res.total)} CQ`, 'green');
    CQ.save(); CQ.refresh();
  }, true);
};

/* =========================================================
   7. Quêtes, succès et bestiaire
   ========================================================= */
P.quests = {
  title: 'Quêtes',
  render() {
    const tab = CQ.tabOf('quests', 'daily');
    const nAch = CQ.ACHIEVEMENTS.filter((a) => S().achievements[a.id]).length;
    return CQ.tabs('quests', [['daily', '📜 Quotidiennes'], ['secondary', `🧭 Secondaires${CQ.missionsClaimable() ? ' •' : ''}`]].concat(S().level >= CQ.FEATURE_LVL.pantheon ? [['pantheon', `🏛️ Panthéon${CQ.pqClaimable() ? ' •' : ''}`]] : []).concat([['ach', `🏅 Succès ${nAch}/${CQ.ACHIEVEMENTS.length}`], ['bestiary', '📚 Bestiaire']])) + P.quests[tab]();
  },
  daily() {
    const q = CQ.questsToday(), all = CQ.QUESTS.every((x) => q.claimed[x.id]);
    const done = CQ.QUESTS.filter((x) => q.claimed[x.id]).length;
    return `<div class="card"><h3>Quêtes du jour<span class="right">renouvelées dans ${CQ.fmtDur(CQ.nextMidnight() - Date.now())}</span></h3>
      ${CQ.QUESTS.map((qd) => {
        const p = Math.min(qd.goal, q.prog[qd.id] || 0), claimed = q.claimed[qd.id];
        return `<div class="quest ${claimed ? 'done' : ''}"><span class="qi">${qd.icon}</span><div class="qb"><b>${qd.name}</b>${CQ.bar(100 * p / qd.goal, 'gold')}</div>
          <div class="qr"><div>${CQ.rewardHtml(qd.reward)}</div><div class="dim">${p}/${qd.goal}</div></div>
          <button class="btn sm ${CQ.questClaimable(qd) ? 'gold' : ''}" data-act="claimQuest" data-arg="${qd.id}" ${CQ.questClaimable(qd) ? '' : 'disabled'}>${claimed ? 'Fait' : 'Récupérer'}</button></div>`;
      }).join('')}
      <div class="sep"></div>
      <div class="row between wrap"><div><b>Bonus de complétion</b> <span class="muted small">(${done}/${CQ.QUESTS.length})</span><div class="row wrap mt" style="margin-top:6px">${CQ.rewardHtml(CQ.QUEST_BONUS)}</div></div>
      <button class="btn ${all && !q.bonus ? 'gold' : ''}" data-act="questBonus" ${all && !q.bonus ? '' : 'disabled'}>${q.bonus ? 'Récupéré' : 'Récupérer'}</button></div></div>`;
  },
  ach() {
    const s = S();
    return `<div class="grid g2">${CQ.ACHIEVEMENTS.map((a) => {
      const v = Math.min(a.goal, a.val(s)), got = s.achievements[a.id], can = CQ.achClaimable(a);
      return `<div class="quest ${got ? 'done' : ''}" style="margin:0"><span class="qi">${a.icon}</span><div class="qb"><b>${a.name}</b><div class="small muted">${a.desc}</div>${CQ.bar(100 * v / a.goal, 'gold')}</div>
        <div class="qr">${CQ.rewardHtml(a.reward)}</div>
        <button class="btn sm ${can ? 'gold' : ''}" data-act="claimAch" data-arg="${a.id}" ${can ? '' : 'disabled'}>${got ? '✓' : 'Récupérer'}</button></div>`;
    }).join('')}</div>`;
  },
  bestiary() {
    const s = S();
    return CQ.ZONES.map((z, zi) => `<div class="section-title">${z.icon} ${z.name}</div><div class="bestiary">${
      z.monsters.map((m, i) => [m, `${zi}-${i}`, false]).concat([[z.boss, `${zi}-b`, true]]).map(([m, key, boss]) => {
        const n = s.bestiary[key] || 0;
        return `<div class="beast ${n ? '' : 'unknown'}"><div class="bi">${m[1]}</div><div class="bn">${n ? m[0] : '???'}</div><div class="small ${boss ? 'c-fp' : 'muted'}">${boss ? 'Boss · ' : ''}${n ? `${CQ.fmt(n)} vaincu${n > 1 ? 's' : ''}` : 'Jamais rencontré'}</div></div>`;
      }).join('')}</div>`).join('') +
      `<div class="section-title">✦ Codex des raretés</div><div class="row wrap">${CQ.RARITIES.map((r, i) => `<span class="chip r${i}" style="${s.stats.bestRarity >= i ? 'color:var(--rc);border-color:var(--rc)' : 'opacity:.4'}">${r.name}</span>`).join('')}</div>`;
  },
};
A.claimQuest = (id) => { if (CQ.claimQuest(id)) { CQ.toast('📜 Quête accomplie !', 'green'); CQ.save(); CQ.refresh(); } };
A.questBonus = () => { if (CQ.claimQuestBonus()) { CQ.toast(`Bonus du jour : ${CQ.rewardHtml(CQ.QUEST_BONUS)}`, 'r4'); CQ.save(); CQ.refresh(); } };
A.claimAch = (id) => { if (CQ.claimAch(id)) { CQ.toast('🏅 Succès récupéré !', 'r4'); CQ.save(); CQ.refresh(); } };

/* =========================================================
   8. Faucet, PTC, offerwall
   ========================================================= */
P.faucet = {
  title: 'Faucet',
  render() {
    const ptc = CQ.ptcToday(), offers = P.faucet.offers();
    const lf = CQ.ui.lastFaucet;
    return `<div class="grid g2">
      <div class="card glow" style="text-align:center">
        <h3 style="justify-content:center">💧 Faucet de Farm Points</h3>
        <div class="faucet-orb" id="orb"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="none" stroke="#2b2529" stroke-width="2"/><circle id="orbRing" cx="50" cy="50" r="48" fill="none" stroke="#e8c87e" stroke-width="2" stroke-dasharray="301.6" stroke-dashoffset="301.6" stroke-linecap="round"/></svg>
          <div><div class="big c-fp" id="orbVal"></div><div class="small muted" id="orbSub"></div></div></div>
        <button class="btn primary" id="faucetBtn" data-act="faucet">Récupérer +${CQ.faucetAmount()} FP</button>
        ${lf && !lf.doubled && Date.now() - lf.t < 5 * 60000 ? `<div class="mt"><button class="btn gold" data-act="doubleFaucet">▶ Doubler avec une vidéo (+${lf.amt} FP)</button></div>` : ''}
        <div class="small dim mt">12 FP de base + ½ FP par niveau + 1 FP par jour de série (max 10).</div>
      </div>
      <div class="card">
        <h3>👁️ Publicités rémunérées (PTC)<span class="right">renouvelées chaque jour</span></h3>
        ${CQ.PTC_ADS.map((a) => `<div class="list-row"><span style="font-size:20px">📺</span><div class="lr"><b>${a.name}</b><span>${a.secs} s de visionnage · annonceur fictif</span></div>
          <span class="c-fp small"><b>+${a.fp} FP</b></span><button class="btn sm" data-act="ptc" data-arg="${a.id}" ${ptc.done[a.id] ? 'disabled' : ''}>${ptc.done[a.id] ? 'Vu' : 'Voir'}</button></div>`).join('')}
      </div>
    </div>
    <div class="card mt">
      <h3>🤝 Offerwall — missions partenaires<span class="right">partenaires fictifs · intégrés en V0.4</span></h3>
      <div class="grid g2">${CQ.OFFERS.map((o) => {
        const st = offers[o.id];
        const ready = st && !st.done && Date.now() - st.start >= o.secs * 1000;
        const btn = !st ? `<button class="btn sm" data-act="offerStart" data-arg="${o.id}">Commencer</button>`
          : st.done ? '<button class="btn sm" disabled>Terminée</button>'
          : ready ? `<button class="btn sm gold" data-act="offerClaim" data-arg="${o.id}">Récupérer</button>`
          : `<button class="btn sm" disabled data-offer="${o.id}">Vérification…</button>`;
        return `<div class="list-row" style="margin:0"><span style="font-size:20px">🎯</span><div class="lr"><b>${o.name}</b><span>Validation simulée en ${o.secs} s</span></div><span class="c-fp small"><b>+${o.fp} FP</b></span>${btn}</div>`;
      }).join('')}</div>
    </div>
    <div class="grid g2 mt">${CQ.adBanner('Bannière 468×60')}${CQ.adBanner('Bannière 468×60')}</div>`;
  },
  offers() {
    const s = S(), k = CQ.dayKey();
    if (s.offers.day !== k) s.offers = { day: k, list: {} };
    return s.offers.list;
  },
  tick() {
    const $ = CQ.$, left = CQ.faucetReadyIn();
    if (!$('#orbVal')) return;
    $('#orb').classList.toggle('ready', left === 0);
    $('#orbVal').textContent = left ? CQ.fmtDur(left) : `+${CQ.faucetAmount()}`;
    $('#orbSub').textContent = left ? 'avant le prochain claim' : 'FP disponibles';
    $('#orbRing').setAttribute('stroke-dashoffset', (301.6 * (left / CQ.FAUCET_MS)).toFixed(1));
    $('#faucetBtn').disabled = left > 0;
    // rafraîchir quand une mission offerwall devient récupérable
    const offers = P.faucet.offers();
    if (CQ.OFFERS.some((o) => offers[o.id] && !offers[o.id].done && Date.now() - offers[o.id].start >= o.secs * 1000 && document.querySelector(`[data-offer="${o.id}"]`))) CQ.refresh();
  },
};
A.faucet = () => {
  const amt = CQ.claimFaucet();
  if (!amt) return;
  CQ.ui.lastFaucet = { amt, t: Date.now(), doubled: false };
  // Légion : le doublement est appliqué directement, sans vidéo
  if (CQ.isPremium()) { CQ.gain('fp', amt, 'Faucet : ×2 Légion'); CQ.ui.lastFaucet.doubled = true; CQ.toast(`🦅 ×2 Légion : +${amt} FP`, 'r4'); }
  CQ.toast(`💧 +${amt} FP`, 'green');
  CQ.save(); CQ.refresh();
};
A.doubleFaucet = () => {
  const lf = CQ.ui.lastFaucet;
  if (!lf || lf.doubled) return;
  CQ.watch({ title: 'Vidéo récompensée', secs: 5, label: 'Votre vidéo partenaire', reward: true }, () => {
    lf.doubled = true;
    CQ.gain('fp', lf.amt, 'Faucet : bonus vidéo récompensée');
    CQ.toast(`▶ Claim doublé : +${lf.amt} FP`, 'green');
    CQ.save(); CQ.refresh();
  });
};
A.ptc = (id) => {
  const ad = CQ.PTC_ADS.find((a) => a.id === id), ptc = CQ.ptcToday();
  if (ptc.done[id]) return;
  CQ.watch({ title: 'Publicité rémunérée', secs: ad.secs, label: ad.name }, () => {
    ptc.done[id] = true;
    CQ.gain('fp', ad.fp, `PTC : ${ad.name}`);
    CQ.toast(`👁️ +${ad.fp} FP`, 'green');
    CQ.save(); CQ.refresh();
  });
};
A.offerStart = (id) => { P.faucet.offers()[id] = { start: Date.now(), done: false }; CQ.save(); CQ.refresh(); };
A.offerClaim = (id) => {
  const o = CQ.OFFERS.find((x) => x.id === id), st = P.faucet.offers()[id];
  if (!st || st.done) return;
  st.done = true;
  CQ.gain('fp', o.fp, `Offerwall : ${o.name}`);
  CQ.toast(`🎯 Mission validée : +${o.fp} FP`, 'green');
  CQ.save(); CQ.refresh();
};

/* =========================================================
   9. Boutique
   ========================================================= */
P.shop = {
  title: 'Boutique',
  render() {
    const s = S();
    return `<div class="section-title" style="margin-top:0">Diamants <span class="small muted" style="font-family:var(--font);text-transform:none;letter-spacing:0">· achat direct à l’hôtel des ventes · solde ${CQ.fmt(s.gems)}</span></div>
    <div class="grid g4">${CQ.GEM_PACKS.map((p) => `<div class="card pack ${p.tag ? 'glow' : ''}">${p.tag ? `<span class="chip red ribbon">${p.tag}</span>` : ''}
      <div style="font-size:40px">💠</div><div class="pa c-gem">${CQ.fmt(p.gems)} diamants</div>
      <div class="muted">${p.eur.toFixed(2).replace('.', ',')} €</div>
      <button class="btn gem block" data-act="buyGems" data-arg="${p.id}">Acheter (simulation)</button></div>`).join('')}</div>
    <div class="note mt">Les diamants s’obtiennent aussi aux paliers de connexion (jours 7, 14 et 30) et en fin de saison d’arène (Platine et Écarlate).</div>

    <div class="section-title">Packs de Farm Points</div>
    <div class="grid g4">${CQ.FP_PACKS.map((p) => `<div class="card pack ${p.tag ? 'glow' : ''}">${p.tag ? `<span class="chip red ribbon">${p.tag}</span>` : ''}
      <div style="font-size:40px">💎</div><div class="pa">${CQ.fmt(p.fp)} FP</div>
      <div class="muted">${p.eur.toFixed(2).replace('.', ',')} €</div>
      <button class="btn primary block" data-act="buyPack" data-arg="${p.id}">Acheter (simulation)</button></div>`).join('')}</div>
    <div class="note mt"><b>Prototype : aucun paiement réel.</b> Les achats sont simulés et alimentent les revenus simulés du Crypto Pool du jour. Avant tout lancement réel, la vente de FP contre de l'argent et leur conversion indirecte en récompenses crypto doivent faire l'objet d'une validation juridique et réglementaire.</div>

    <div class="section-title">Énergie</div>
    <div class="grid g3">${CQ.POTIONS.map((p) => {
      const used = CQ.eDay().potions[p.id] || 0, cost = p.cost();
      return `<div class="card"><div class="row"><span style="font-size:34px">${p.icon}</span><div><b>${p.name}</b><div class="small muted">+${p.val} énergie · ${p.perDay - used}/${p.perDay} aujourd’hui</div></div></div>
        <button class="btn block mt" data-act="buyPotion" data-arg="${p.id}" ${CQ.canPay(cost) && used < p.perDay ? '' : 'disabled'}>Acheter · ${CQ.costHtml(cost)}</button></div>`;
    }).join('')}
      <div class="card"><div class="row"><span style="font-size:34px">▶️</span><div><b>Second souffle</b><div class="small muted">Vidéo récompensée · +${CQ.ENERGY.video} énergie · ${CQ.energyVideoLeft()}/${CQ.ENERGY.videoPerDay} aujourd’hui</div></div></div>
        <button class="btn gold block mt" data-act="energyVideo" ${CQ.energyVideoLeft() > 0 ? '' : 'disabled'}>Regarder la vidéo</button></div>
    </div>
    <div class="note mt">Limites quotidiennes : l’énergie achetée ne doit pas devenir un raccourci payant. Au-dessus du maximum, l’énergie est en surcharge (jusqu’à ${CQ.ENERGY.overcap} ×).</div>

    <div class="section-title">Élixirs</div>
    <div class="grid g3">${CQ.ELIXIRS.map((e) => {
      const b = s.buffs[e.stat], on = b && b.until > Date.now();
      return `<div class="card"><div class="row"><span style="font-size:34px">${e.icon}</span><div><b>${e.name}</b><div class="small muted">${e.desc}</div></div></div>
        ${on ? `<div class="chip green mt">Actif · encore ${CQ.fmtDur(b.until - Date.now())}</div>` : ''}
        <button class="btn block mt" data-act="buyElixir" data-arg="${e.id}" ${CQ.canPay(e.cost) ? '' : 'disabled'}>${on ? 'Prolonger' : 'Acheter'} · ${CQ.costHtml(e.cost)}</button></div>`;
    }).join('')}</div>

    <div class="section-title">Coffres</div>
    <div class="card row between wrap"><span class="muted">Coffres de Bronze, d'Argent, d'Or et Mythiques disponibles contre CQ ou FP.</span><a class="btn gold" href="#chests">Voir les coffres</a></div>`;
  },
};
A.buyPack = (id) => {
  const p = CQ.FP_PACKS.find((x) => x.id === id);
  CQ.confirm('Achat simulé', `Vous allez recevoir <b>${CQ.fmt(p.fp)} FP</b> pour ${p.eur.toFixed(2).replace('.', ',')} € — <b>aucun paiement n'est effectué</b> dans ce prototype.`, 'Confirmer (simulation)', () => {
    CQ.buyPack(id);
    CQ.toast(`💎 +${CQ.fmt(p.fp)} FP`, 'green');
    CQ.save(); CQ.refresh();
  });
};
A.buyGems = (id) => {
  const p = CQ.GEM_PACKS.find((x) => x.id === id);
  CQ.confirm('Achat simulé', `Vous allez recevoir <b>${CQ.fmt(p.gems)} diamants</b> pour ${p.eur.toFixed(2).replace('.', ',')} € — <b>aucun paiement n'est effectué</b> dans ce prototype.`, 'Confirmer (simulation)', () => {
    CQ.buyGems(id);
    CQ.toast(`💠 +${CQ.fmt(p.gems)} diamants`, 'green');
    CQ.save(); CQ.refresh();
  });
};
A.buyElixir = (id) => { if (CQ.buyElixir(id)) { CQ.toast('Élixir activé pour 30 min.', 'green'); CQ.save(); CQ.refresh(); } };

/* =========================================================
   10. Staking
   ========================================================= */
P.staking = {
  title: 'Staking',
  render() {
    const s = S(), plan = Number(CQ.ui.sel.plan || 7), amt = CQ.ui.sel.stakeAmt || '';
    const planObj = CQ.STAKE_PLANS.find((p) => p.days === plan);
    const w = CQ.stakeWeight(), now = CQ.stakeBonus();
    const after = (() => { const add = Number(amt) || 0; const ww = w + add * planObj.mult; return ww <= 0 ? 0 : Math.min(60, Math.round(9 * Math.log10(1 + ww / 50) * 10) / 10); })();
    return `<div class="grid g2">
      <div class="card gold">
        <h3>🔒 Bloquer des FP</h3>
        <div class="field"><label>Montant (vous avez ${CQ.fmt(s.fp)} FP)</label><input class="input" id="stakeAmt" type="number" min="10" step="1" value="${amt}" placeholder="Minimum 10" data-input="stakeAmt"></div>
        <div class="quick mt">${[0.25, 0.5, 1].map((f) => `<button class="btn sm" data-act="stakeQuick" data-arg="${f}">${f === 1 ? 'Max' : f * 100 + ' %'}</button>`).join('')}</div>
        <div class="field mt"><label>Durée</label><div class="tabs" style="margin:0">${CQ.STAKE_PLANS.map((p) => `<button class="tab ${plan === p.days ? 'on' : ''}" data-act="stakePlan" data-arg="${p.days}">${p.label} · ×${String(p.mult).replace('.', ',')}</button>`).join('')}</div></div>
        <div class="kv mt"><span>Bonus actuel</span><span>+${pctFmt(now)}</span><span>Bonus après blocage</span><span class="c-cq" id="stakeAfter">+${pctFmt(after)}</span></div>
        <button class="btn gold block mt" data-act="doStake">Bloquer pour ${planObj.label}</button>
      </div>
      <div class="card">
        <h3>Vos avantages</h3>
        <div class="big c-cq">+${pctFmt(now)}</div><div class="muted small">Farm Power et XP Boost</div>
        <div class="kv mt"><span>FP stakés</span><span>${CQ.fmt(s.stakes.reduce((a, x) => a + x.amount, 0))} FP</span><span>Poids pondéré</span><span>${CQ.fmt(w)}</span><span>Plafond</span><span>+60 %</span></div>
        <div class="note mt">Le staking est distinct du Crypto Pool : les FP stakés <b>ne sont pas sacrifiés</b>. Ils vous sont rendus intégralement à l'échéance. Plus la durée est longue, plus chaque FP pèse lourd dans le bonus.</div>
      </div>
    </div>
    <div class="card mt"><h3>Positions en cours</h3>${s.stakes.length ? s.stakes.map((st) => {
      const done = Date.now() >= st.end, p = CQ.clamp((Date.now() - st.start) / (st.end - st.start), 0, 1);
      return `<div class="list-row"><span style="font-size:20px">${done ? '🔓' : '🔒'}</span><div class="lr"><b>${CQ.fmt(st.amount)} FP · ${st.days} j · ×${String(st.mult).replace('.', ',')}</b>
        <span>${done ? 'Arrivé à échéance' : `Échéance dans ${CQ.fmtDur(st.end - Date.now())}`}</span><div class="mt" style="margin-top:6px">${CQ.bar(p * 100, 'gold')}</div></div>
        <button class="btn sm ${done ? 'gold' : ''}" data-act="unstake" data-arg="${st.id}" ${done ? '' : 'disabled'}>Récupérer</button></div>`;
    }).join('') : '<div class="empty">Aucun FP bloqué pour le moment.</div>'}</div>`;
  },
};
A.stakeAmt = (v) => {
  CQ.ui.sel.stakeAmt = v;
  const planObj = CQ.STAKE_PLANS.find((p) => p.days === Number(CQ.ui.sel.plan || 7));
  const ww = CQ.stakeWeight() + (Number(v) || 0) * planObj.mult;
  const el = CQ.$('#stakeAfter');
  if (el) el.textContent = '+' + pctFmt(ww <= 0 ? 0 : Math.min(60, Math.round(9 * Math.log10(1 + ww / 50) * 10) / 10));
};
A.stakeQuick = (f) => { CQ.ui.sel.stakeAmt = String(Math.floor(S().fp * Number(f))); CQ.refresh(); };
A.stakePlan = (d) => { CQ.ui.sel.plan = Number(d); CQ.refresh(); };
A.doStake = () => {
  const amt = Number(CQ.ui.sel.stakeAmt), plan = Number(CQ.ui.sel.plan || 7);
  if (CQ.stake(amt, plan)) { CQ.ui.sel.stakeAmt = ''; CQ.toast(`🔒 ${CQ.fmt(amt)} FP bloqués.`, 'green'); CQ.save(); CQ.refresh(); }
};
A.unstake = (id) => { if (CQ.unstake(Number(id))) { CQ.toast('🔓 FP récupérés.', 'green'); CQ.save(); CQ.refresh(); } };

/* =========================================================
   11. Crypto Pool
   ========================================================= */
P.pool = {
  title: 'Crypto Pool',
  render() {
    const s = S(), p = CQ.poolCycle(), sim = CQ.poolSim(p), est = CQ.poolEstimate();
    const amt = CQ.ui.sel.poolAmt || '';
    return `<div class="pool-hero">
      <div>
        <div class="kicker">Cycle n°${p.id} · clôture à minuit</div>
        <div class="countdown" id="poolT">${CQ.fmtClock(p.end - Date.now())}</div>
        <div class="mt">${CQ.bar(sim.prog * 100, 'gold big', 'poolProg')}</div>
        <div class="grid g3 mt">
          <div><div class="kicker">Revenus encaissés</div><div class="big c-usd" style="font-size:22px" id="poolRev">${CQ.fmtUsd(sim.revenue, 2)}</div></div>
          <div><div class="kicker">À redistribuer (${CQ.POOL_SHARE * 100} %)</div><div class="big c-cq" style="font-size:22px" id="poolDist">${CQ.fmtUsd(sim.distributed, 2)}</div></div>
          <div><div class="kicker">FP sacrifiés</div><div class="big" style="font-size:22px" id="poolTot">${CQ.fmt(sim.total)}</div><div class="small dim" id="poolPl">${CQ.fmt(sim.players)} participants</div></div>
        </div>
      </div>
      <div>
        <div class="kv"><span>Vos FP sacrifiés</span><span>${CQ.fmt(p.mine)} FP</span>
          <span>Part estimée à la clôture</span><span>${pctFmt(est.share * 100, 3)}</span>
          <span>Récompense estimée</span><span class="c-usd">${CQ.fmtUsd(est.reward)}</span></div>
        <div class="sep"></div>
        <div class="field"><label>Sacrifier des FP (solde : ${CQ.fmt(s.fp)} FP)</label><input class="input" type="number" min="1" step="1" placeholder="Montant en FP" value="${amt}" data-input="poolAmt"></div>
        <div class="quick mt">${[0.25, 0.5, 1].map((f) => `<button class="btn sm" data-act="poolQuick" data-arg="${f}">${f === 1 ? 'Max' : f * 100 + ' %'}</button>`).join('')}</div>
        <div class="small muted mt" id="poolPreview">${P.pool.preview(amt)}</div>
        <button class="btn gold block mt" data-act="poolDeposit">🔥 Sacrifier dans le pool</button>
      </div>
    </div>

    <div class="grid g2 mt">
      <div class="card"><h3>Comment fonctionne le pool</h3><div class="steps">
        <div>CryptoQuest comptabilise les revenus réellement encaissés sur le cycle de 24 h.</div>
        <div>${CQ.POOL_SHARE * 100} % de ces revenus sont destinés à la redistribution.</div>
        <div>Les joueurs déposent des FP dans le pool. Ces FP sont <b>définitivement consommés</b>.</div>
        <div>À minuit, chacun reçoit une part proportionnelle à ses FP dans le total final.</div>
      </div><div class="note mt">L'estimation suppose la participation finale projetée des autres joueurs (${CQ.fmt(sim.botsFinal)} FP). La récompense dépend exclusivement des revenus disponibles et encaissés.</div></div>
      <div class="card"><h3>Origine des revenus du cycle<span class="right">simulé</span></h3>
        <div class="kv">${sim.breakdown.map(([n, v]) => `<span>${n}</span><span class="c-usd">${CQ.fmtUsd(v, 2)}</span>`).join('')}${p.extra ? `<span>Vos achats (simulés)</span><span class="c-usd">${CQ.fmtUsd(p.extra, 2)}</span>` : ''}</div>
        <div class="sep"></div>
        <div class="row between"><span class="muted small">Outil de test du prototype</span><button class="btn sm ghost" data-act="poolForce">Clôturer le cycle maintenant</button></div>
      </div>
    </div>

    <div class="card mt"><h3>Historique des distributions<span class="right">solde ${CQ.fmtUsd(s.crypto)}</span></h3>
      ${s.poolHistory.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Cycle</th><th>Clôture</th><th class="r">Revenus</th><th class="r">Redistribué</th><th class="r">FP total</th><th class="r">Vos FP</th><th class="r">Part</th><th class="r">Gain</th></tr>
      ${s.poolHistory.map((h) => `<tr class="${h.mine ? 'me' : ''}"><td>n°${h.id}</td><td>${CQ.fmtDate(h.end)}</td><td class="r">${CQ.fmtUsd(h.revenue, 2)}</td><td class="r">${CQ.fmtUsd(h.distributed, 2)}</td><td class="r">${CQ.fmt(h.total)}</td><td class="r">${CQ.fmt(h.mine)}</td><td class="r">${pctFmt(h.share * 100, 3)}</td><td class="r">${CQ.fmtUsd(h.reward)}</td></tr>`).join('')}
      </table></div>` : '<div class="empty">Aucun cycle clôturé pour l’instant.</div>'}
    </div>
    <div class="note mt"><b>Prototype V0.1 :</b> revenus, participants et solde crypto sont simulés. Les retraits arrivent en V0.5, après validation juridique et réglementaire.</div>`;
  },
  preview(amt) {
    const n = Math.floor(Number(amt) || 0);
    if (n <= 0) return 'Saisissez un montant pour voir l’estimation.';
    const e = CQ.poolEstimate(n);
    return `Avec ${CQ.fmt(n)} FP de plus : part ≈ <b>${pctFmt(e.share * 100, 3)}</b>, gain estimé ≈ <b class="c-usd">${CQ.fmtUsd(e.reward)}</b>`;
  },
  tick() {
    const $ = CQ.$, p = CQ.poolCycle(), sim = CQ.poolSim(p);
    if (!$('#poolT')) return;
    $('#poolT').textContent = CQ.fmtClock(p.end - Date.now());
    $('#poolProg').style.width = (sim.prog * 100) + '%';
    $('#poolRev').textContent = CQ.fmtUsd(sim.revenue, 2);
    $('#poolDist').textContent = CQ.fmtUsd(sim.distributed, 2);
    $('#poolTot').textContent = CQ.fmt(sim.total);
    $('#poolPl').textContent = CQ.fmt(sim.players) + ' participants';
  },
};
A.poolAmt = (v) => { CQ.ui.sel.poolAmt = v; const el = CQ.$('#poolPreview'); if (el) el.innerHTML = P.pool.preview(v); };
A.poolQuick = (f) => { CQ.ui.sel.poolAmt = String(Math.floor(S().fp * Number(f))); CQ.refresh(); };
A.poolDeposit = () => {
  const n = Math.floor(Number(CQ.ui.sel.poolAmt) || 0);
  if (n < 1) { CQ.toast('Indiquez un montant.', 'red'); return; }
  if (n > S().fp) { CQ.toast('Vous n’avez pas assez de FP.', 'red'); return; }
  CQ.confirm('Sacrifier des FP ?', `${CQ.fmt(n)} FP seront <b>définitivement consommés</b>. En échange, vous recevrez à la clôture une part du pool proportionnelle à votre contribution.`, `Sacrifier ${CQ.fmt(n)} FP`, () => {
    if (CQ.poolDeposit(n)) { CQ.ui.sel.poolAmt = ''; CQ.toast(`🔥 ${CQ.fmt(n)} FP sacrifiés.`, 'r4'); CQ.save(); CQ.refresh(); }
  }, true);
};
A.poolForce = () => CQ.confirm('Clôturer le cycle ?', 'Outil de test : le cycle en cours est clôturé immédiatement avec les totaux finaux projetés, puis un nouveau cycle démarre.', 'Clôturer', () => { CQ.forcePoolClose(); CQ.save(); CQ.refresh(); });

/* =========================================================
   12. Classements
   ========================================================= */
P.leaderboard = {
  title: 'Classements',
  render() {
    const tab = CQ.tabOf('lb', 'daily');
    const head = CQ.tabs('lb', [['daily', 'Quotidien'], ['weekly', 'Hebdomadaire'], ['monthly', 'Mensuel'], ['level', 'Niveau']]);
    if (tab === 'level') {
      const rows = CQ.botScores('level', 'all', 1).map((r) => ({ name: r.name, level: r.level }));
      rows.push({ name: S().name, level: S().level, me: true });
      rows.sort((a, b) => b.level - a.level);
      return head + `<div class="card"><h3>Classement par niveau</h3>${P.leaderboard.table(rows, (r) => `Niveau ${r.level}`)}</div>`;
    }
    const P0 = CQ.PERIODS[tab], l = CQ.ladder(tab), rows = CQ.ladderRows(tab);
    const myRank = rows.findIndex((r) => r.me) + 1;
    return head + `<div class="grid g-side">
      <div class="card"><h3>FP farmés · ${P0.name.toLowerCase()}<span class="right">fin dans ${CQ.fmtDur(CQ.periodEnd(tab) - Date.now())}</span></h3>${P.leaderboard.table(rows, (r) => `${CQ.fmt(r.score)} FP`, tab)}</div>
      <div class="card gold"><h3>🏆 Participer</h3>
        ${l.registered ? `<div class="chip green">Inscrit</div><div class="kv mt"><span>Votre rang</span><span>${myRank}e</span><span>FP comptés</span><span>${CQ.fmt(l.score)}</span><span>Gain actuel</span><span class="c-fp">${CQ.fmt(CQ.prizeFor(tab, myRank))} FP</span></div>`
          : `<div class="muted small">Seuls les FP gagnés après l'inscription comptent.</div><button class="btn gold block mt" data-act="register" data-arg="${tab}" ${S().fp >= P0.fee ? '' : 'disabled'}>S'inscrire · ${CQ.money('fp', P0.fee)}</button>`}
        <div class="sep"></div><div class="kv"><span>1re place</span><span>${CQ.fmt(P0.prizes[0])} FP</span><span>2e place</span><span>${CQ.fmt(P0.prizes[1])} FP</span><span>3e place</span><span>${CQ.fmt(P0.prizes[2])} FP</span><span>4e à 10e</span><span>${CQ.fmt(P0.top10)} FP</span><span>11e à 25e</span><span>${CQ.fmt(P0.top25)} FP</span></div>
        <div class="note mt">Joueurs adverses simulés dans ce prototype.</div></div>
    </div>`;
  },
  table(rows, val, tab) {
    const myIdx = rows.findIndex((r) => r.me);
    const show = rows.slice(0, 25);
    const line = (r, i) => `<tr class="${r.me ? 'me' : ''}"><td><span class="rank ${i < 3 ? 'r' + (i + 1) : ''}">${i + 1}</span></td><td>${CQ.esc(r.name)}${r.me ? ' (vous)' : ''}</td><td class="r">${val(r)}</td>${tab ? `<td class="r dim">${CQ.prizeFor(tab, i + 1) ? CQ.fmt(CQ.prizeFor(tab, i + 1)) + ' FP' : '—'}</td>` : ''}</tr>`;
    return `<div class="tbl-wrap"><table class="tbl"><tr><th>Rang</th><th>Joueur</th><th class="r">Score</th>${tab ? '<th class="r">Gain</th>' : ''}</tr>
      ${show.map(line).join('')}${myIdx >= 25 ? `<tr><td colspan="4" class="dim">…</td></tr>${line(rows[myIdx], myIdx)}` : ''}</table></div>`;
  },
};
A.register = (tab) => { if (CQ.registerLadder(tab)) { CQ.toast(`Inscrit au classement ${CQ.PERIODS[tab].name.toLowerCase()}.`, 'green'); CQ.save(); CQ.refresh(); } };

/* =========================================================
   13. Profil
   ========================================================= */
P.profile = {
  title: 'Profil',
  render() {
    const s = S(), st = s.stats, ps = CQ.playerStats();
    const days = Math.max(1, Math.ceil((Date.now() - s.created) / 86400000));
    return `<div class="grid g2">
      <div class="card">
        <h3>👤 Aventurier</h3>
        <div class="row"><div class="avatar">${HERO}</div><div style="flex:1;min-width:0">
          <div class="field"><label>Nom affiché</label><div class="row"><input class="input" id="nameIn" maxlength="18" value="${CQ.esc(s.name)}"><button class="btn" data-act="saveName">Enregistrer</button></div></div>
          <div class="small dim mt">Joue depuis ${days} jour${days > 1 ? 's' : ''} · Niveau ${s.level} · Puissance ${CQ.fmt(ps.power)}</div></div></div>
      </div>
      <div class="card gold">
        <h3>${CQ.CUR.crypto.ico} Crypto Balance</h3>
        <div class="big c-usd">${CQ.fmtUsd(s.crypto)}</div>
        <div class="small muted">Total reçu depuis le début : ${CQ.fmtUsd(st.cryptoEarned)}</div>
        <button class="btn block mt" disabled>Retirer — disponible en V0.5</button>
      </div>
    </div>
    <div class="card mt"><h3>Statistiques</h3><div class="grid g3">
      <div class="kv"><span>Monstres vaincus</span><span>${CQ.fmt(st.kills)}</span><span>Boss vaincus</span><span>${CQ.fmt(st.bosses)}</span><span>Donjons terminés</span><span>${CQ.fmt(st.dungeons)}</span><span>Défaites</span><span>${CQ.fmt(st.deaths)}</span></div>
      <div class="kv"><span>Coffres ouverts</span><span>${CQ.fmt(st.chests)}</span><span>Améliorations</span><span>${CQ.fmt(st.upgrades)}</span><span>Fusions</span><span>${CQ.fmt(st.fusions)}</span><span>Meilleure rareté</span><span>${st.bestRarity >= 0 ? `<span class="r${st.bestRarity} rt">${CQ.RARITIES[st.bestRarity].name}</span>` : '—'}</span></div>
      <div class="kv"><span>FP gagnés</span><span class="c-fp">${CQ.fmt(st.fpEarned)}</span><span>CQ gagnés</span><span class="c-cq">${CQ.fmt(st.cqEarned)}</span><span>FP sacrifiés</span><span>${CQ.fmt(st.fpSacrificed)}</span><span>Pools joués</span><span>${st.poolDays}</span></div>
    </div></div>
    <div class="card mt"><h3>💾 Sauvegarde</h3>
      <div class="muted small mb">La partie est enregistrée dans ce navigateur. Les comptes et la sauvegarde en ligne arrivent avec le lot C.</div>
      <div class="row wrap"><button class="btn" data-act="exportSave">Exporter la sauvegarde</button><label class="btn">Importer<input type="file" accept=".json,application/json" hidden data-change="importSave"></label><button class="btn primary" data-act="resetSave">Recommencer à zéro</button></div>
    </div>`;
  },
};
A.saveName = () => {
  const v = CQ.$('#nameIn').value.trim().slice(0, 18);
  if (!v) return;
  S().name = v; CQ.save(); CQ.toast('Nom enregistré.', 'green'); CQ.refresh();
};
A.exportSave = () => {
  CQ.save();
  const blob = new Blob([JSON.stringify(S(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cryptoquest-${CQ.dayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
A.importSave = (v, el) => {
  const f = el.files && el.files[0];
  if (!f) return;
  f.text().then((txt) => {
    try {
      const data = JSON.parse(txt);
      if (!data || !(data.v >= 1 && data.v <= CQ.SAVE_VERSION) || !Array.isArray(data.inventory)) throw new Error('format');
      localStorage.setItem(CQ.SAVE_KEY, txt);
      CQ.save = () => {}; // sinon la fermeture de la page réécrirait l'ancienne partie par-dessus
      location.reload();
    } catch (e) { CQ.toast('Fichier de sauvegarde invalide.', 'red'); }
  });
};
A.resetSave = () => CQ.confirm('Recommencer à zéro ?', 'Toute la progression de ce navigateur sera effacée : niveau, objets, monnaies et historique.', 'Tout effacer', () => { CQ.reset(); location.hash = 'dashboard'; location.reload(); }, true);

/* =========================================================
   14. Historique
   ========================================================= */
P.history = {
  title: 'Historique',
  render() {
    const tab = CQ.tabOf('hist', 'all');
    const list = S().tx.filter((t) => tab === 'all' || t.cur === tab).slice(0, 200);
    return CQ.tabs('hist', [['all', 'Tout'], ['cq', 'CQ'], ['fp', 'Farm Points'], ['crypto', 'Crypto']]) +
      `<div class="card">${list.length ? `<div class="tbl-wrap"><table class="tbl"><tr><th>Date</th><th>Opération</th><th class="r">Montant</th></tr>
      ${list.map((t) => `<tr><td class="dim" style="white-space:nowrap">${CQ.fmtDate(t.t)}</td><td>${CQ.esc(t.why)}</td><td class="r ${t.amt >= 0 ? CQ.CUR[t.cur].cls : 'dim'}" style="white-space:nowrap">${t.amt >= 0 ? '+' : '−'}${t.cur === 'crypto' ? CQ.fmtUsd(Math.abs(t.amt)) : CQ.fmt(Math.abs(t.amt)) + ' ' + CQ.CUR[t.cur].name}</td></tr>`).join('')}
      </table></div>` : '<div class="empty">Aucune opération.</div>'}</div>
      <div class="note mt">Les gains de combat sont regroupés par minute. Les 400 dernières opérations sont conservées.</div>`;
  },
};
A.buyPotion = (id) => { const n = CQ.buyPotion(id); if (n) { CQ.toast(`⚡ +${n} énergie`, 'green'); CQ.save(); CQ.refresh(); } };
