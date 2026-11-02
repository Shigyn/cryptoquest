'use strict';
// UI-1 — La Cité : l'accueil devient une ville. Chaque bâtiment ouvre une page du jeu (rien ne change à l'intérieur),
// la ville s'agrandit en 5 étapes avec le niveau du héros, et les bâtiments montrent ce qui attend le joueur.

// ---------- Étapes de la ville ----------
// r : rayon des remparts (ellipse) · w : largeur de la vue (la caméra recule quand la ville grandit)
CQ.TOWN_STAGES = [
  { lvl: 1, name: 'Hameau', wall: 'palissade de bois', r: [235, 125], w: 560 },
  { lvl: 5, name: 'Bourg', wall: 'muret de pierre', r: [335, 172], w: 780 },
  { lvl: 10, name: 'Ville', wall: 'remparts', r: [445, 218], w: 1000 },
  { lvl: 40, name: 'Cité', wall: 'grands remparts', r: [545, 258], w: 1200 },
  { lvl: 100, name: 'Capitale', wall: 'grands remparts', r: [545, 258], w: 1200 },
];
CQ.townStage = (lvl = CQ.state.level) => CQ.TOWN_STAGES.reduce((st, s, i) => (lvl >= s.lvl ? i : st), 0);
CQ.TOWN_C = [600, 390]; // centre de la place

// ---------- Bâtiments ----------
// page : page ouverte · lvl : niveau d'apparition (repris des déblocages quand la page en a un)
// sig : clé de pastille (CQ.badges) ou fonction qui renvoie vrai quand il y a quelque chose à faire
CQ.TOWN = [
  { id: 'maison', name: 'Maison du héros', page: 'hero', x: 600, y: 385, art: 'maison', sig: 'hero', npc: 'Votre demeure : attributs, talents, équipement et sac.' },
  { id: 'portes', name: 'Portes de la ville', page: 'combat', x: 600, y: null, art: 'portes', sig: () => !CQ.state.auto, npc: 'Les terres de chasse vous attendent au-delà des murs.' },
  { id: 'taverne', name: 'Taverne', page: 'quests', x: 462, y: 428, art: 'taverne', sig: 'quests', npc: 'Quêtes du jour, quêtes secondaires et Panthéon.' },
  { id: 'voliere', name: 'Volière', page: 'mail', x: 482, y: 312, art: 'voliere', sig: 'mail', npc: 'Les corbeaux apportent lots gagnés, ventes et récompenses.' },
  { id: 'echoppe', name: 'Échoppe', page: 'shop', x: 718, y: 312, art: 'echoppe', npc: 'Fioles, élixirs et diamants.' },
  { id: 'legion', name: 'Pavillon de la Légion', page: 'premium', x: 392, y: 352, art: 'legion', npc: 'L’abonnement Légion.' },
  { id: 'fontaine', name: 'Fontaine', page: 'faucet', x: 600, y: 466, art: 'fontaine', sig: 'faucet', npc: 'Des Farm Points gratuits toutes les 30 minutes.' },
  { id: 'tresor', name: 'Salle du trésor', page: 'chests', x: 372, y: 470, art: 'tresor', sig: 'chests', npc: 'Vos coffres d’équipement.' },
  { id: 'heraut', name: 'Place du héraut', page: 'season', x: 805, y: 356, art: 'heraut', sig: () => CQ.badges().season || CQ.loginAvailable(), npc: 'Saison, passe et événements.' },
  { id: 'forge', name: 'Forge', page: 'forge', x: 738, y: 428, art: 'forge', npc: 'Améliorer, fondre, forger.' },
  { id: 'autel', name: 'Autel du sacrifice', page: 'pool', x: 282, y: 436, art: 'autel', sig: () => CQ.unlocked('pool') && CQ.poolCycle().end - Date.now() < 3600000, npc: 'Le Crypto Pool : 70 % des revenus du jour redistribués.' },
  { id: 'encheres', name: 'Hôtel des ventes', page: 'auction', x: 905, y: 446, art: 'encheres', sig: () => CQ.state.auction.lots.some((l) => !l.done && l.top === 'me'), npc: 'Équipement de qualité supérieure, mises en FP.' },
  { id: 'hall', name: 'Hall de gloire', page: 'leaderboard', x: 352, y: 288, art: 'hall', npc: 'Classements et gloire.' },
  { id: 'banque', name: 'Banque', page: 'staking', x: 848, y: 288, art: 'banque', sig: 'staking', npc: 'Le staking de vos FP.' },
  { id: 'marche', name: 'Marché', page: 'market', x: 600, y: 258, art: 'marche', npc: 'Vendre et acheter entre joueurs.' },
  { id: 'colisee', name: 'Colisée', page: 'arena', x: 182, y: 372, art: 'colisee', sig: 'arena', npc: 'L’arène : affrontez les héros des autres joueurs.' },
  { id: 'citadelle', name: 'Citadelle', page: 'guild', x: 1010, y: 366, art: 'citadelle', npc: 'Votre guilde.' },
  { id: 'caserne', name: 'Caserne', page: 'team', x: 300, y: 562, art: 'caserne', npc: 'Arène d’équipe et mercenaires.' },
  { id: 'faille', name: 'La Faille', page: 'abyss', x: 1075, y: 640, art: 'faille', npc: 'Les Abysses.' },
];
CQ.ART_H = { maison: 100, portes: 70, taverne: 60, voliere: 98, echoppe: 52, legion: 68, fontaine: 44, tresor: 46, heraut: 60, forge: 106, autel: 66, encheres: 70, hall: 64, banque: 68, marche: 32, colisee: 58, citadelle: 124, caserne: 54, faille: 18 };
CQ.bLvl = (b) => (CQ.UNLOCKS[b.page] ? CQ.UNLOCKS[b.page].lvl : 1);
CQ.bOpen = (b) => CQ.state.level >= CQ.bLvl(b);
CQ.bSig = (b) => {
  if (!b.sig || !CQ.bOpen(b)) return false;
  try { return typeof b.sig === 'function' ? !!b.sig() : !!CQ.badges()[b.sig]; } catch (e) { return false; }
};

// ---------- Dessins (SVG, origine au pied du bâtiment) ----------
const K = { stone: '#3a3237', stone2: '#2a2328', dark: '#1b161a', roof: '#5c1c22', slate: '#2e2833', wood: '#4a3324', win: '#f2c66d', gold: '#e8c87e', red: '#a3202a' };
const win = (x, y, w = 6, h = 9) => `<rect class="win" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`;
const house = (w, h, roof = K.roof, rh = 22) => `<rect x="${-w / 2}" y="${-h}" width="${w}" height="${h}" fill="${K.stone}" stroke="${K.stone2}"/>
  <path d="M${-w / 2 - 6} ${-h} L0 ${-h - rh} L${w / 2 + 6} ${-h} Z" fill="${roof}" stroke="${K.dark}"/>
  <rect x="-5" y="-14" width="10" height="14" fill="${K.wood}"/>`;
const tower = (x, w, h, roof = K.slate) => `<rect x="${x - w / 2}" y="${-h}" width="${w}" height="${h}" fill="${K.stone}" stroke="${K.stone2}"/>
  <path d="M${x - w / 2 - 3} ${-h} L${x} ${-h - w * 1.1} L${x + w / 2 + 3} ${-h} Z" fill="${roof}" stroke="${K.dark}"/>`;
CQ.ART = {
  maison: () => `${tower(-30, 18, 62)}${tower(30, 18, 62)}${house(56, 44, K.roof, 28)}${win(-16, -36)}${win(10, -36)}${win(-33, -50, 6, 8)}${win(27, -50, 6, 8)}
    <line x1="0" y1="-72" x2="0" y2="-96" stroke="${K.gold}" stroke-width="1.5"/><path class="flag" d="M0 -96 L18 -91 L0 -85 Z" fill="${K.red}"/>`,
  portes: () => `${tower(-30, 22, 54)}${tower(30, 22, 54)}<rect x="-19" y="-40" width="38" height="40" fill="${K.stone}" stroke="${K.stone2}"/>
    <path d="M-12 0 L-12 -22 Q0 -36 12 -22 L12 0 Z" fill="${K.dark}" stroke="${K.wood}" stroke-width="2"/><circle class="torch" cx="-17" cy="-28" r="2.5"/><circle class="torch" cx="17" cy="-28" r="2.5"/>`,
  taverne: () => `${house(62, 36, K.slate, 20)}${win(-22, -28)}${win(-8, -28)}${win(14, -28)}
    <line x1="31" y1="-30" x2="44" y2="-30" stroke="${K.wood}" stroke-width="2"/><rect x="37" y="-29" width="12" height="10" rx="2" fill="${K.wood}" stroke="${K.gold}"/>`,
  voliere: () => `${tower(0, 20, 70, K.slate)}${win(-3, -52, 6, 8)}<g class="birds"><path d="M-22 -96 q4 -4 8 0 q4 -4 8 0" /><path d="M8 -104 q4 -4 8 0 q4 -4 8 0"/><path d="M-6 -112 q3 -3 6 0 q3 -3 6 0"/></g>`,
  echoppe: () => `${house(46, 30, K.slate, 16)}<path d="M-28 -24 L28 -24 L24 -14 L-24 -14 Z" fill="${K.red}"/><path d="M-18 -24 L-16 -14 M-6 -24 L-5 -14 M6 -24 L5 -14 M18 -24 L16 -14" stroke="${K.gold}" stroke-width="2"/>${win(-15, -10, 5, 7)}${win(10, -10, 5, 7)}`,
  legion: () => `<path d="M-28 0 L0 -46 L28 0 Z" class="legion-tent"/><path d="M-6 0 L0 -14 L6 0 Z" fill="${K.dark}"/><line x1="0" y1="-46" x2="0" y2="-66" stroke="${K.gold}" stroke-width="1.5"/><path d="M0 -66 L16 -61 L0 -56 Z" class="legion-flag"/>`,
  fontaine: () => `<ellipse cx="0" cy="-4" rx="30" ry="9" fill="${K.stone}" stroke="${K.stone2}"/><ellipse class="water" cx="0" cy="-6" rx="24" ry="6"/>
    <rect x="-4" y="-28" width="8" height="22" fill="${K.stone}"/><ellipse cx="0" cy="-28" rx="11" ry="4" fill="${K.stone}"/><circle class="spark" cx="0" cy="-36" r="3"/>`,
  tresor: () => `<rect x="-26" y="-34" width="52" height="34" fill="${K.stone2}" stroke="${K.dark}"/><path d="M-30 -34 L30 -34 L26 -42 L-26 -42 Z" fill="${K.stone}"/>
    <path d="M-10 0 L-10 -18 Q0 -28 10 -18 L10 0 Z" class="vault-door"/><line x1="-26" y1="-24" x2="26" y2="-24" stroke="${K.gold}" stroke-opacity=".4"/>`,
  heraut: () => `<rect x="-26" y="-8" width="52" height="8" fill="${K.stone}"/>${[-18, 0, 18].map((x) => `<line x1="${x}" y1="-8" x2="${x}" y2="-56" stroke="${K.wood}" stroke-width="2"/><path class="banner" d="M${x} -54 L${x + 9} -54 L${x + 9} -36 L${x + 4.5} -40 L${x} -36 Z"/>`).join('')}`,
  forge: () => `${house(58, 34, K.slate, 18)}<rect x="14" y="-66" width="12" height="32" fill="${K.stone2}"/><g class="smoke"><circle cx="20" cy="-74" r="5"/><circle cx="24" cy="-86" r="7"/><circle cx="18" cy="-100" r="9"/></g>
    <rect class="embers" x="-22" y="-24" width="16" height="12" rx="2"/>${win(4, -26)}`,
  autel: () => `<path d="M-34 0 L34 0 L28 -10 L-28 -10 Z M-24 -10 L24 -10 L18 -20 L-18 -20 Z" fill="${K.stone}" stroke="${K.stone2}"/><rect x="-10" y="-30" width="20" height="10" fill="${K.stone2}"/>
    <path class="flame" d="M0 -62 C10 -48 9 -38 0 -30 C-9 -38 -10 -48 0 -62 Z"/>`,
  encheres: () => `<rect x="-36" y="-46" width="72" height="46" fill="${K.stone}" stroke="${K.stone2}"/><path d="M-42 -46 L0 -66 L42 -46 Z" fill="${K.roof}" stroke="${K.dark}"/>
    ${[-24, -8, 8, 24].map((x) => `<rect x="${x - 3}" y="-40" width="6" height="36" fill="${K.stone2}"/>`).join('')}<circle class="lantern" cx="0" cy="-54" r="4"/>`,
  hall: () => `<path d="M-40 0 L40 0 L36 -6 L-36 -6 Z" fill="${K.stone}"/>${[-28, -14, 0, 14, 28].map((x) => `<rect x="${x - 3}" y="-40" width="6" height="34" fill="${K.stone}"/>`).join('')}
    <path d="M-40 -40 L0 -60 L40 -40 Z" fill="${K.stone2}" stroke="${K.gold}" stroke-opacity=".5"/><path d="M-4 -52 L4 -52 L2 -46 L-2 -46 Z" fill="${K.gold}"/>`,
  banque: () => `<rect x="-32" y="-34" width="64" height="34" fill="${K.stone}" stroke="${K.stone2}"/><path d="M-22 -34 A22 22 0 0 1 22 -34 Z" class="dome"/>
    ${[-20, -6, 8, 22].map((x) => `<rect x="${x - 3}" y="-30" width="5" height="28" fill="${K.stone2}"/>`).join('')}<circle class="coin" cx="0" cy="-60" r="4"/>`,
  marche: () => [-30, 0, 30].map((x, i) => `<rect x="${x - 12}" y="-18" width="24" height="18" fill="${K.wood}"/><path d="M${x - 15} -18 L${x + 15} -18 L${x + 12} -28 L${x - 12} -28 Z" fill="${i === 1 ? K.red : '#6b4a1e'}"/>
    <path d="M${x - 6} -28 L${x - 7} -18 M${x + 6} -28 L${x + 7} -18" stroke="${K.gold}" stroke-opacity=".6"/>`).join(''),
  colisee: () => `<ellipse cx="0" cy="-8" rx="52" ry="18" fill="${K.stone2}"/><path d="M-52 -8 L-52 -36 A52 18 0 0 1 52 -36 L52 -8 A52 18 0 0 1 -52 -8 Z" fill="${K.stone}" stroke="${K.stone2}"/>
    ${[-40, -26, -12, 2, 16, 30].map((x) => `<path d="M${x} -10 L${x} -24 Q${x + 5} -30 ${x + 10} -24 L${x + 10} -10 Z" fill="${K.dark}"/>`).join('')}<ellipse cx="0" cy="-36" rx="52" ry="18" fill="none" stroke="${K.stone2}"/>`,
  citadelle: () => `${tower(-34, 20, 70)}${tower(34, 20, 70)}${tower(0, 26, 92, K.roof)}<rect x="-24" y="-48" width="48" height="48" fill="${K.stone}" stroke="${K.stone2}"/>
    ${win(-15, -40)}${win(9, -40)}<path d="M-8 0 L-8 -16 Q0 -24 8 -16 L8 0 Z" fill="${K.dark}"/><text class="emblem" x="0" y="-60" text-anchor="middle">${CQ.state && CQ.state.guild ? CQ.state.guild.emblem : ''}</text>`,
  caserne: () => `<rect x="-46" y="-30" width="92" height="30" fill="${K.stone}" stroke="${K.stone2}"/><path d="M-50 -30 L50 -30 L44 -42 L-44 -42 Z" fill="${K.slate}"/>
    ${[-34, -18, 18, 34].map((x) => win(x - 3, -24)).join('')}<line x1="-56" y1="0" x2="-56" y2="-50" stroke="${K.wood}" stroke-width="2"/><path d="M-56 -50 L-42 -46 L-56 -42 Z" fill="${K.red}"/>`,
  faille: () => `<path class="rift" d="M-60 0 L-30 -6 L-12 4 L6 -10 L22 2 L44 -8 L62 0 L40 10 L18 6 L0 14 L-20 6 L-42 10 Z"/><path class="rift-glow" d="M-30 -6 L-12 4 L6 -10 L22 2"/>`,
};
// chantier : terrain réservé, échafaudage et panneau du niveau
CQ.chantier = (b) => `<g class="chantier"><rect x="-30" y="-2" width="60" height="4" fill="${K.wood}"/>
  <path d="M-24 0 L-24 -40 M24 0 L24 -40 M-24 -20 L24 -20 M-24 -40 L24 -40 M-24 0 L24 -40" stroke="${K.wood}" stroke-width="2" fill="none"/>
  <rect x="-20" y="-60" width="40" height="16" rx="2" fill="${K.dark}" stroke="${K.wood}"/><text x="0" y="-48" text-anchor="middle" class="chantier-t">Niv. ${CQ.bLvl(b)}</text></g>`;

// ---------- Scène ----------
CQ.townScene = () => {
  const st = CQ.townStage(), S = CQ.TOWN_STAGES[st], [cx, cy] = CQ.TOWN_C, w = S.w, h = Math.round(w * 0.56);
  const vx = cx - w / 2, vy = 370 - h / 2, fs = Math.round(w / 92);
  const lvl = CQ.state.level;
  const night = (() => { const hr = new Date().getHours(); return hr < 7 || hr >= 20; })();
  // bâtiments visibles : ouverts, ou en chantier s'ils sont à l'intérieur des murs de l'étape actuelle
  const nextStage = CQ.TOWN_STAGES[st + 1];
  const list = CQ.TOWN.map((b) => Object.assign({}, b, { y: b.y == null ? cy + S.r[1] + 4 : b.y }))
    .filter((b) => CQ.bOpen(b) || CQ.bLvl(b) < (nextStage ? nextStage.lvl : 999) || (b.id === 'faille' && lvl >= 95))
    .sort((a, b) => a.y - b.y);
  const [rx, ry] = S.r;
  const wallCls = ['palisade', 'muret', 'rempart', 'rempart big', 'rempart big'][st];
  const towers = st >= 2 ? Array.from({ length: 10 }, (_, i) => { const a = (i / 10) * Math.PI * 2 + 0.3; return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)]; })
    .map(([x, y]) => `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})">${tower(0, 14, 26)}</g>`).join('') : '';
  const blds = list.map((b) => {
    const open = CQ.bOpen(b), sig = open && CQ.bSig(b);
    const plate = `<g class="plate"><rect x="${-b.name.length * fs * 0.33 - 5}" y="5" width="${b.name.length * fs * 0.66 + 10}" height="${fs + 6}" rx="3"/><text x="0" y="${fs + 7}" text-anchor="middle" style="font-size:${fs}px">${open ? b.name : '???'}</text></g>`;
    return `<g class="bld ${open ? 'open' : 'locked'} ${sig ? 'sig' : ''} b-${b.id}" transform="translate(${b.x} ${b.y})" ${open ? `data-act="townGo" data-arg="${b.page}" tabindex="0" role="link"` : 'data-act="townLocked" data-arg="' + b.id + '"'} aria-label="${CQ.esc(open ? b.name : `Chantier : ${b.name}, niveau ${CQ.bLvl(b)}`)}">
      <title>${CQ.esc(open ? `${b.name} — ${b.npc}` : `${b.name} : ouvre au niveau ${CQ.bLvl(b)}`)}</title>
      <ellipse class="shadow" cx="0" cy="2" rx="${b.art === 'colisee' ? 56 : 36}" ry="7"/>
      ${open ? CQ.ART[b.art]() : CQ.chantier(b)}${plate}
      ${sig ? `<g class="bang" transform="translate(0 ${-(open ? CQ.ART_H[b.art] : 64) - 12})"><circle cx="0" cy="0" r="9"/><text x="0" y="5" text-anchor="middle">!</text></g>` : ''}</g>`;
  }).join('');
  return `<svg class="town-svg ${night ? 'night' : 'day'} st${st}" viewBox="${vx} ${vy} ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="La Cité, étape ${S.name}">
    <defs><linearGradient id="skyG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${st >= 4 ? '#1d0b26' : night ? '#07060a' : '#1a1216'}"/><stop offset="1" stop-color="${st >= 4 ? '#3a1030' : night ? '#1b1018' : '#3b1d1c'}"/></linearGradient>
    <radialGradient id="groundG" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#2a2227"/><stop offset="1" stop-color="#121014"/></radialGradient></defs>
    <rect x="-200" y="-200" width="1600" height="1100" fill="url(#skyG)"/>
    <circle class="moon" cx="${vx + w * 0.82}" cy="${vy + h * 0.16}" r="${w / 28}"/>
    <path d="M-200 250 L80 150 L200 210 L330 120 L480 200 L610 110 L760 190 L900 130 L1050 210 L1180 140 L1400 230 L1400 900 L-200 900 Z" fill="#141016"/>
    <ellipse cx="${cx}" cy="${cy + 20}" rx="${rx + 160}" ry="${ry + 110}" fill="url(#groundG)"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="wall ${wallCls}"/>
    ${towers}
    <ellipse cx="${cx}" cy="${cy + 8}" rx="${Math.min(150, rx * 0.55)}" ry="${Math.min(70, ry * 0.5)}" class="square"/>
    ${blds}
  </svg>`;
};

/* =========================================================
   Page : La Cité
   ========================================================= */
P.town = {
  title: 'La Cité',
  render() {
    const s = S(), st = CQ.townStage(), S0 = CQ.TOWN_STAGES[st], nx = CQ.TOWN_STAGES[st + 1];
    const open = CQ.TOWN.filter(CQ.bOpen), next = CQ.TOWN.filter((b) => !CQ.bOpen(b)).sort((a, b) => CQ.bLvl(a) - CQ.bLvl(b)).slice(0, 3);
    P.town._sig = P.town.sig();
    const login = CQ.loginAvailable() ? (() => { const stk = CQ.loginNextStreak(), r = CQ.loginReward(stk); return `<div class="town-crier"><span>🎺</span><div><b>Le héraut vous salue</b><div class="small muted">Bonus de connexion, jour ${stk} : ${CQ.rewardHtml(r)}</div></div><button class="btn gold sm" data-act="claimLogin">Récupérer</button></div>`; })() : '';
    return `<div class="town-head"><div><div class="kicker">${S0.name} · ${S0.wall}</div><h2>${CQ.heroName(s.name)}</h2></div>
        <div class="small muted">${nx ? `Prochaine étape : <b>${nx.name}</b> au niveau ${nx.lvl}` : 'Votre ville est complète'}</div></div>
      ${login}
      <div class="town-wrap" id="townWrap">${CQ.townScene()}</div>
      <div class="grid g-side mt">
        <div class="card"><h3>📌 À faire</h3><div class="todo">${P.dashboard.todos()}</div></div>
        <div class="card"><h3>🏗️ Bâtiments<span class="right">${open.length}/${CQ.TOWN.length}</span></h3>
          <div class="bld-list">${open.map((b) => `<a class="bld-card ${CQ.bSig(b) ? 'sig' : ''}" href="#${b.page}"><span class="bc-ico">${CQ.navLabel(b.page)[1]}</span><span><b>${b.name}</b><small>${b.npc}</small></span>${CQ.bSig(b) ? '<span class="bc-bang">!</span>' : ''}</a>`).join('')}
          ${next.map((b) => `<div class="bld-card locked"><span class="bc-ico">🏗️</span><span><b>${b.name}</b><small>Les bâtisseurs l’achèveront au niveau ${CQ.bLvl(b)}</small></span></div>`).join('')}</div></div>
      </div>`;
  },
  mount() {
    // sur téléphone, le panorama s'ouvre centré sur la Maison du héros
    const w = CQ.$('#townWrap');
    if (w && w.scrollWidth > w.clientWidth) w.scrollLeft = (w.scrollWidth - w.clientWidth) / 2;
  },
  // les signes de vie changent : on redessine (rarement)
  sig() { return CQ.TOWN.map((b) => (CQ.bOpen(b) ? 1 : 0) + (CQ.bSig(b) ? 2 : 0)).join('') + CQ.state.level + (CQ.loginAvailable() ? 1 : 0); },
  tick() {
    if (!CQ.$('#townWrap')) return;
    P.town._t = (P.town._t || 0) + 1;
    if (P.town._t % 8 === 0 && P.town.sig() !== P.town._sig) CQ.refresh();
  },
};
A.townGo = (page) => CQ.go(page);
A.townLocked = (id) => { const b = CQ.TOWN.find((x) => x.id === id); CQ.toast(`🏗️ ${b.name} : les bâtisseurs l’achèveront au niveau ${CQ.bLvl(b)}.`, ''); };
A.goTown = () => CQ.go(CQ.home());
// clavier : Entrée ou Espace sur un bâtiment
document.addEventListener('keydown', (e) => {
  const el = e.target.closest && e.target.closest('.bld.open');
  if (el && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); A.townGo(el.dataset.arg); }
});

// ---------- Navigation : la ville ou le menu classique ----------
CQ.navMode = () => (CQ.state.settings.nav || 'ville');
CQ.home = () => (CQ.navMode() === 'ville' ? 'town' : 'dashboard');
CQ.BOTTOM_MENU = CQ.BOTTOM;
CQ.BOTTOM_TOWN = [['town', '🏰', 'Ville'], ['combat', '⚔️', 'Combat'], ['hero', '🧝', 'Héros'], ['inventory', '🎒', 'Inventaire']];
CQ.applyNav = () => {
  const v = CQ.navMode() === 'ville';
  document.body.classList.toggle('nav-town', v);
  CQ.BOTTOM = v ? CQ.BOTTOM_TOWN : CQ.BOTTOM_MENU;
};
(() => {
  const r = CQ.render;
  CQ.render = CQ.refresh = () => { r(); document.body.classList.toggle('on-town', CQ.ui.page === CQ.home()); document.body.classList.toggle('legion-on', CQ.isPremium()); };
})();
A.setNav = (v) => { CQ.state.settings.nav = v; CQ.applyNav(); CQ.save(); CQ.refresh(); };

// ---------- Cinématique de construction ----------
CQ.buildQueue = [];
(() => {
  const gx = CQ.gainXp;
  CQ.gainXp = (amt) => {
    const before = CQ.state.level, stBefore = CQ.townStage(before);
    gx(amt);
    const now = CQ.state.level;
    if (now === before) return;
    const built = CQ.TOWN.filter((b) => CQ.bLvl(b) > before && CQ.bLvl(b) <= now);
    const st = CQ.townStage(now);
    if (built.length || st > stBefore) { CQ.buildQueue.push({ built, stage: st > stBefore ? st : null }); setTimeout(CQ.showBuild, 900); }
  };
})();
CQ.showBuild = () => {
  if (!CQ.buildQueue.length || CQ.$('#modalRoot').classList.contains('on')) return;
  const q = CQ.buildQueue.shift(), st = q.stage != null ? CQ.TOWN_STAGES[q.stage] : null;
  const arts = q.built.map((b) => `<div class="build-item"><svg viewBox="-62 -112 124 122" class="build-svg town-svg night">${CQ.ART[b.art]()}</svg><b>${b.name}</b><small>${b.npc}</small></div>`).join('');
  CQ.sfx('level');
  CQ.openModal(`<div class="build-cine"><div class="kicker">${st ? `Votre ville devient : ${st.name}` : 'Les bâtisseurs ont achevé leur ouvrage'}</div>
    <h2>${q.built.length ? q.built.map((b) => b.name).join(' · ') : st.name}</h2>${st ? `<div class="muted">Nouvelle enceinte : ${st.wall}. La ville s’agrandit.</div>` : ''}
    <div class="build-row">${arts}</div>
    <div class="actions">${q.built.length === 1 ? `<button class="btn ghost" data-act="closeModal">Continuer</button><button class="btn primary" data-act="buildVisit" data-arg="${q.built[0].page}">Visiter</button>` : `<button class="btn primary" data-act="buildVisitTown">Voir la ville</button>`}</div></div>`,
  { onClose: () => setTimeout(CQ.showBuild, 300) });
};
A.buildVisit = (page) => { CQ.closeModal(); CQ.go(page); };
A.buildVisitTown = () => { CQ.closeModal(); CQ.go('town'); };
