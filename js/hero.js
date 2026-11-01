'use strict';
// Page Héros : attributs, talents et détail des statistiques par source.
// Réutilise P, A et S déclarés dans pages.js.
const fmtPer = (per) => Object.entries(per).map(([k, v]) => `+${CQ.fmtStat(k, v)} ${CQ.STATS[k].name}`).join(' · ');

P.hero = {
  title: 'Héros',
  render() {
    const tab = CQ.tabOf('hero', 'attrs');
    const ap = CQ.attrPoints().free, tp = CQ.talentPoints().free;
    return CQ.tabs('hero', [['attrs', `💪 Attributs${ap ? ` (${ap})` : ''}`], ['talents', `🌳 Talents${tp ? ` (${tp})` : ''}`], ['stats', '📊 Statistiques']]) + P.hero[tab]();
  },

  attrs() {
    const s = S(), pend = CQ.ui.pend || (CQ.ui.pend = {});
    const pts = CQ.attrPoints(), used = Object.values(pend).reduce((a, b) => a + b, 0), left = pts.free - used;
    const cost = CQ.attrRespecCost(s.respecs.attrs);
    return `<div class="grid g-side">
      <div class="card">
        <h3>Attributs<span class="right">${left > 0 ? `<b class="c-cq">${left}</b> point${left > 1 ? 's' : ''} à répartir` : 'Aucun point libre'}</span></h3>
        ${CQ.ATTRS.map((a) => {
          const p = pend[a.id] || 0, v = s.attrs[a.id], t = CQ.trained(a.id), room = CQ.attrCap(s.level) - v - p;
          return `<div class="attr-row">
            <span class="ai">${a.icon}</span>
            <div class="ab"><b>${a.name}</b> <span class="small muted">${a.desc}</span><div class="small dim">${fmtPer(a.per)} par point</div></div>
            <div class="av tnum">${v + t}${p ? `<span class="c-green"> +${p}</span>` : ''}${t ? `<div class="small dim">dont ${t} entraîné${t > 1 ? 's' : ''}</div>` : ''}</div>
            <div class="row" style="gap:4px">
              <button class="btn sm ghost" data-act="attrAdd" data-arg="${a.id}:-1" ${p > 0 ? '' : 'disabled'} aria-label="Retirer un point">−</button>
              <button class="btn sm" data-act="attrAdd" data-arg="${a.id}:1" ${left > 0 && room > 0 ? '' : 'disabled'} aria-label="Ajouter un point">+</button>
              <button class="btn sm" data-act="attrAdd" data-arg="${a.id}:5" ${left >= 5 && room >= 5 ? '' : 'disabled'}>+5</button>
            </div></div>`;
        }).join('')}
        <div class="small dim">Plafond par attribut au niveau ${s.level} : ${CQ.attrCap(s.level)} points répartis.</div>
        <div class="row wrap mt">
          <button class="btn primary" data-act="attrValidate" ${used ? '' : 'disabled'}>Valider ${used ? `${used} point${used > 1 ? 's' : ''}` : ''}</button>
          ${used ? '<button class="btn ghost" data-act="attrCancel">Annuler</button>' : ''}
          <button class="btn ghost" style="margin-left:auto" data-act="attrRespec" ${pts.spent ? '' : 'disabled'}>Réinitialiser · ${cost ? CQ.money('cq', cost) : 'gratuit'}</button>
        </div>
        <div class="note mt">5 points par niveau. Tant que vous n’avez pas validé, la répartition est gratuite et réversible. La première réinitialisation est offerte, les suivantes coûtent des CQ.</div>
      </div>
      <div class="card gold"><h3>Aperçu</h3>${P.hero.preview(pend)}</div>
    </div>
    <div class="card mt"><h3>🏋️ Entraînement<span class="right">jusqu’à ${CQ.trainCap(s.level)} points par attribut au niveau ${s.level}</span></h3>
      <div class="train-grid">${CQ.ATTRS.map((a) => {
        const t = CQ.trained(a.id), c = CQ.trainNext(a.id);
        return `<div class="train"><span class="ai">${a.icon}</span><div class="lr"><b>${a.name} · ${t}</b><span>${c ? `prochain point : ${CQ.fmt(c)} CQ` : 'maximum atteint pour ce niveau'}</span></div>
          <button class="btn sm gold" data-act="train" data-arg="${a.id}" ${c && s.cq >= c ? '' : 'disabled'}>+1</button></div>`;
      }).join('')}</div>
      <div class="note mt">L’entraînement ajoute des points d’attribut au-delà de ceux des niveaux, contre des CQ. Chaque point coûte plus cher que le précédent. La réinitialisation des attributs n’y touche pas.</div></div>`;
  },
  // statistiques avec la répartition en attente, sans la valider
  preview(pend) {
    const s = S(), before = CQ.playerStats();
    if (!Object.values(pend).some(Boolean)) {
      return `<div class="kv">${['atk', 'hp', 'hit', 'dodge', 'crit', 'emax', 'eregen'].map((k) => `<span>${CQ.STATS[k].name}</span><span>${CQ.fmtPs(k, before[k])}</span>`).join('')}</div>
        <div class="small dim mt">Ajoutez des points pour voir l’effet avant de valider.</div>`;
    }
    const saved = Object.assign({}, s.attrs);
    for (const [k, v] of Object.entries(pend)) s.attrs[k] += v;
    const after = CQ.playerStats();
    s.attrs = saved;
    const rows = CQ.STAT_VIEW.filter((k) => Math.abs(after[k] - before[k]) >= 0.05);
    return `<div class="kv">${rows.map((k) => `<span>${CQ.STATS[k].name}</span><span>${CQ.fmtPs(k, before[k])} → <b class="c-green">${CQ.fmtPs(k, after[k])}</b></span>`).join('')}
      <span>Puissance</span><span>${CQ.fmt(before.power)} → <b class="c-green">${CQ.fmt(after.power)}</b></span></div>`;
  },

  talents() {
    const s = S(), pts = CQ.talentPoints(), cost = CQ.talentRespecCost(s.respecs.talents);
    if (s.level < CQ.TALENT_START) {
      return `<div class="empty">Les talents se débloquent au niveau ${CQ.TALENT_START}. Vous êtes niveau ${s.level}.</div>`;
    }
    return `<div class="card row between wrap mb">
        <div><b>${pts.free}</b> point${pts.free > 1 ? 's' : ''} de talent disponible${pts.free > 1 ? 's' : ''} <span class="small muted">· ${pts.spent}/${pts.total} utilisés · 1 point par niveau</span></div>
        <button class="btn ghost sm" data-act="talentRespec" ${pts.spent ? '' : 'disabled'}>Réinitialiser · ${CQ.money('fp', cost)}</button>
      </div>
      <div class="grid g3">${CQ.TALENT_BRANCHES.map((b) => {
        const spent = CQ.branchSpent(b.id);
        return `<div class="card talent-branch">
          <h3>${b.icon} ${b.name}<span class="right">${spent} pt${spent > 1 ? 's' : ''}</span></h3>
          <div class="small muted mb">${b.desc} · 2e rangée à ${CQ.TALENT_GATE} points · ultime à ${CQ.TALENT_ULT}</div>
          ${b.talents.map((t) => {
            const r = s.talents[t.id] || 0, block = CQ.talentBlock(t.id);
            const locked = (t.ult && spent < CQ.TALENT_ULT) || (t.gate && spent < CQ.TALENT_GATE);
            return `<div class="talent ${r ? 'on' : ''} ${locked ? 'locked' : ''} ${t.ult ? 'ult' : ''}">
              <div class="tb"><b>${t.name}</b> <span class="small dim">${r}/${t.max}</span>
                <div class="small ${r ? '' : 'muted'}">${t.desc(Math.max(1, r))}</div>
                ${r && r < t.max ? `<div class="small dim">Rang suivant : ${t.desc(r + 1)}</div>` : ''}
                ${locked ? `<div class="small c-fp">🔒 ${block}</div>` : ''}</div>
              <button class="btn sm ${block ? '' : 'gold'}" data-act="learnTalent" data-arg="${t.id}" ${block ? 'disabled' : ''} aria-label="Apprendre ${CQ.esc(t.name)}">+</button>
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}</div>
      <div class="note mt">Les points se placent un par un et s’appliquent tout de suite. Réinitialiser rend tous les points, contre des FP.</div>`;
  },

  stats() {
    const ps = CQ.playerStats();
    const v = (k, n) => (Math.abs(n) < 0.05 ? '<span class="dim">—</span>' : CQ.fmtPs(k, n));
    return `<div class="card"><h3>Détail des statistiques<span class="right">Puissance <b class="c-cq">${CQ.fmt(ps.power)}</b></span></h3><div class="tbl-wrap"><table class="tbl">
      <tr><th>Statistique</th><th class="r">Base</th><th class="r">Attributs</th><th class="r">Équipement</th><th class="r">Staking / élixirs</th><th class="r">Talents</th><th class="r">Total</th></tr>
      ${CQ.STAT_VIEW.map((k) => {
        const p = ps.parts[k], capped = p.cap != null && p.total >= p.cap;
        return `<tr><td><span title="${CQ.esc(CQ.STAT_HELP[k])}">${CQ.STATS[k].name}</span><div class="small dim">${CQ.STAT_HELP[k]}</div></td>
          <td class="r">${v(k, p.base)}</td><td class="r">${v(k, p.attr)}</td><td class="r">${v(k, p.gear)}</td><td class="r">${v(k, p.other)}</td><td class="r">${v(k, p.talent)}</td>
          <td class="r"><b>${CQ.fmtPs(k, p.total)}</b>${p.pts != null ? `<div class="small dim">${CQ.fmt(Math.round(p.pts))} pts</div>` : ''}${p.cap != null ? `<div class="small ${capped ? 'c-fp' : 'dim'}">plafond ${CQ.fmtPs(k, p.cap)}</div>` : ''}</td></tr>`;
      }).join('')}
    </table></div>
    <div class="note mt">Chance de toucher = Toucher − Esquive de la cible (entre 40 et 100 %). Dégâts = Attaque² ÷ (Attaque + Défense). L’équipement ajoute aussi 2 PV par point de Défense.</div></div>`;
  },
};

A.attrAdd = (arg) => {
  const [id, n] = arg.split(':'), pend = CQ.ui.pend || (CQ.ui.pend = {});
  const left = CQ.attrPoints().free - Object.values(pend).reduce((a, b) => a + b, 0);
  const room = CQ.attrCap(S().level) - S().attrs[id] - (pend[id] || 0);
  const d = Number(n) > 0 ? Math.min(Number(n), left, room) : Math.max(Number(n), -(pend[id] || 0));
  pend[id] = (pend[id] || 0) + d;
  CQ.refresh();
};
A.train = (id) => { if (CQ.train(id)) { CQ.sfx('coin'); CQ.save(); CQ.refresh(); } };
A.attrCancel = () => { CQ.ui.pend = {}; CQ.refresh(); };
A.attrValidate = () => {
  if (CQ.allocateAttrs(CQ.ui.pend || {})) { CQ.ui.pend = {}; CQ.toast('Attributs enregistrés.', 'green'); CQ.save(); CQ.refresh(); }
};
A.attrRespec = () => {
  const cost = CQ.attrRespecCost(S().respecs.attrs);
  CQ.confirm('Réinitialiser les attributs ?', `Tous les points répartis vous sont rendus${cost ? ` contre ${CQ.fmt(cost)} CQ` : ' (gratuit cette fois)'}.`, 'Réinitialiser', () => {
    if (CQ.respecAttrs()) { CQ.ui.pend = {}; CQ.toast('Attributs réinitialisés.', 'green'); CQ.save(); CQ.refresh(); }
  });
};
A.learnTalent = (id) => {
  if (CQ.learnTalent(id)) { CQ.toast(`🌳 ${CQ.TALENTS[id].name} rang ${S().talents[id]}`, 'green'); CQ.save(); CQ.refresh(); }
};
A.talentRespec = () => {
  const cost = CQ.talentRespecCost(S().respecs.talents);
  CQ.confirm('Réinitialiser les talents ?', `Tous vos points de talent vous sont rendus contre ${CQ.fmt(cost)} FP.`, 'Réinitialiser', () => {
    if (CQ.respecTalents()) { CQ.toast('Talents réinitialisés.', 'green'); CQ.save(); CQ.refresh(); }
  });
};
