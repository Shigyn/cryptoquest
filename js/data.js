'use strict';
// Données statiques du jeu : emplacements, raretés, zones, coffres, quêtes, boutique.
const CQ = (window.CQ = {});

CQ.SLOTS = [
  { id: 'weapon', name: 'Arme', icon: '⚔️', main: ['atk', 'critd'], bases: ['Épée', 'Hache', 'Masse', 'Lame', 'Faux', 'Glaive'] },
  { id: 'helmet', name: 'Casque', icon: '🪖', main: ['def', 'dodge'], bases: ['Heaume', 'Capuche', 'Couronne', 'Casque'] },
  { id: 'armor', name: 'Armure', icon: '🛡️', main: ['def', 'hp'], bases: ['Cuirasse', 'Brigandine', 'Cotte', 'Plastron'] },
  { id: 'gloves', name: 'Gants', icon: '🧤', main: ['hit', 'crit'], bases: ['Gantelets', 'Poignes', 'Mitaines'] },
  { id: 'boots', name: 'Bottes', icon: '🥾', main: ['spd', 'dodge'], bases: ['Bottes', 'Grèves', 'Solerets'] },
  { id: 'ring', name: 'Anneau', icon: '💍', main: ['luck', 'fp'], bases: ['Anneau', 'Chevalière', 'Sceau'] },
  { id: 'amulet', name: 'Amulette', icon: '📿', main: ['emax', 'eregen'], bases: ['Amulette', 'Talisman', 'Pendentif', 'Reliquaire'] },
];
CQ.SLOT = Object.fromEntries(CQ.SLOTS.map((s) => [s.id, s]));

CQ.SUFFIXES = ['du Loup', 'des Cendres', "de l'Aube rouge", 'du Vide', 'des Cryptes', 'du Sang-Roi', "de l'Ombre",
  "d'Obsidienne", 'des Murmures', 'du Pacte', 'de la Fange', 'du Dernier Serment', 'des Braises', 'du Corbeau'];
// noms uniques des objets Mythiques, par emplacement
CQ.MYTHIC_NAMES = {
  weapon: ['Faux du Crépuscule', 'Larme de Malrith', 'Croc du Roi Cendré'],
  helmet: ['Couronne des Damnés', 'Heaume du Premier Serment'],
  armor: ['Cuirasse de la Première Nuit', 'Peau du Vide'],
  gloves: ['Mains de Malrith', 'Poignes du Pacte Rouge'],
  boots: ['Pas du Crépuscule', 'Grèves du Roi Cendré'],
  ring: ['Cœur du Vide', 'Sceau des Damnés'],
  amulet: ['Écho de la Première Nuit', 'Serment du Roi Cendré'],
};
// niveau requis pour équiper un objet : son niveau moins cette marge
CQ.REQ_MARGIN = 3;

// valeur d'une stat d'objet = (base + per * niveau d'objet) * multiplicateur de rareté
// u : unité affichée · w : poids dans la puissance · minR : rareté minimum pour sortir en affixe
CQ.STATS = {
  atk: { name: 'Attaque', u: '', base: 3, per: 1.5, w: 1.2 },
  def: { name: 'Défense', u: '', base: 2, per: 1.1, w: 1 },
  hp: { name: 'Points de vie', u: '', base: 8, per: 4, w: 0.1 },
  // rt : stat en notation (points). Chance = points / (niveau de l'adversaire + 10) : un objet de votre niveau
  // garde la même efficacité tout au long du jeu, et les plafonds ne sont jamais atteints par simple accumulation.
  hit: { name: 'Toucher', u: 'pts', rt: true, base: 20, per: 2, w: 0.08 },
  dodge: { name: 'Esquive', u: 'pts', rt: true, base: 15, per: 1.5, w: 0.1 },
  crit: { name: 'Critique', u: 'pts', rt: true, base: 20, per: 2, w: 0.08 },
  parry: { name: 'Parade', u: 'pts', rt: true, base: 15, per: 1.5, w: 0.07 },
  resil: { name: 'Résilience', u: 'pts', rt: true, base: 15, per: 1.5, w: 0.06 },
  critd: { name: 'Dégâts critiques', u: '%', base: 4, per: 0.1, w: 0.6 },
  spd: { name: "Vitesse d'attaque", u: 'pts', rt: true, base: 20, per: 2, w: 0.08 },
  pen: { name: 'Pénétration', u: 'pts', rt: true, base: 20, per: 2, w: 0.1, minR: 3 },
  emax: { name: 'Énergie max', u: '', base: 12, per: 1.4, w: 0.12 },
  eregen: { name: "Recharge d'énergie", u: '/h', base: 1.5, per: 0.15, w: 1.2 },
  fp: { name: 'Farm Power', u: '%', base: 2, per: 0.12, w: 2.2 },
  luck: { name: 'Luck', u: '%', base: 1.5, per: 0.09, w: 2.2 },
  xp: { name: 'XP Boost', u: '%', base: 2, per: 0.12, w: 2.2 },
};
CQ.STAT_KEYS = Object.keys(CQ.STATS);
// plafonds des statistiques du héros
CQ.CAPS = { hit: 100, dodge: 40, crit: 60, parry: 40, resil: 40, critd: 300, spd: 50, pen: 60, eregen: 300 };
CQ.RATED = Object.keys(CQ.STATS).filter((k) => CQ.STATS[k].rt);
// explication en une phrase (infobulles)
CQ.STAT_HELP = {
  atk: 'Dégâts de chaque attaque.',
  def: 'Réduit les dégâts reçus. Ne les annule jamais complètement.',
  hp: 'Points de vie. À zéro, le héros retourne au camp.',
  hit: 'Chance de toucher, moins l’Esquive de la cible. Une attaque ratée coûte quand même 1 énergie. Les stats en points se convertissent en % selon le niveau de l’adversaire : points ÷ (niveau + 10).',
  dodge: 'Chance d’éviter un coup ennemi.',
  crit: 'Chance de coup critique.',
  critd: 'Dégâts d’un coup critique, en % des dégâts normaux.',
  spd: 'Raccourcit l’intervalle entre deux attaques. Ne change pas les gains par énergie, mais fait gagner plus vite et réduit les coups reçus.',
  pen: 'Part de la Défense ennemie ignorée.',
  parry: 'Chance de bloquer la moitié d’un coup reçu.',
  resil: 'Réduit la chance de critique de l’adversaire.',
  emax: 'Réserve d’énergie. 1 énergie = 1 attaque.',
  eregen: 'Énergie rendue par heure, même hors ligne.',
  fp: 'Augmente les Farm Points et les CQ gagnés.',
  luck: 'Augmente les chances de butin et de rareté.',
  xp: 'Augmente l’expérience gagnée.',
};

// ---------- Énergie ----------
CQ.ENERGY = { max: 1000, regen: 100, overcap: 2, levelUp: 200, login: 300, video: 100, videoPerDay: 5, chest: { gold: 100, mythic: 300 }, resume: 25, offline: 0.75 };
CQ.ENERGY_GUARDS = [0, 100, 250, 500];
CQ.POTIONS = [
  { id: 'e1', icon: '🧴', name: 'Fiole mineure', val: 100, perDay: 10, cost: () => ({ cq: 300 + CQ.state.level * 60 }) },
  { id: 'e2', icon: '⚱️', name: 'Fiole majeure', val: 500, perDay: 3, cost: () => ({ fp: 60 }) },
];

// ---------- Attributs (5 points par niveau, chaque attribut part à 5) ----------
CQ.ATTR_START = 5;
CQ.ATTR_PER_LEVEL = 5;
CQ.ATTRS = [
  { id: 'force', icon: '💪', name: 'Force', per: { atk: 2, critd: 0.4 }, desc: 'Tuer en moins d’attaques' },
  { id: 'vit', icon: '❤️', name: 'Vitalité', per: { hp: 15, def: 0.5, parry: 2 }, desc: 'Résister aux boss' },
  { id: 'agi', icon: '🌀', name: 'Agilité', per: { dodge: 6, spd: 3, resil: 3 }, desc: 'Éviter les coups, finir plus vite' },
  { id: 'prec', icon: '🎯', name: 'Précision', per: { hit: 8, crit: 4 }, desc: 'Ne pas gaspiller d’énergie' },
  { id: 'endu', icon: '⚡', name: 'Endurance', per: { emax: 3, eregen: 0.4 }, desc: 'Combattre plus longtemps' },
  { id: 'fort', icon: '🍀', name: 'Fortune', per: { luck: 0.15, fp: 0.15 }, desc: 'Meilleur butin, plus de FP' },
];
CQ.attrRespecCost = (n) => (n === 0 ? 0 : Math.min(50000, 2000 * n));

// ---------- Talents (1 point par niveau à partir du niveau 5) ----------
// fx : effet par rang. Les clés en « Pct » multiplient une stat, les autres s'ajoutent ou activent une mécanique.
CQ.TALENT_START = 5;
CQ.TALENT_GATE = 5; // points dans la branche pour la 2e rangée
CQ.TALENT_ULT = 20; // points dans la branche pour l'ultime
CQ.TALENT_BRANCHES = [
  { id: 'lame', icon: '⚔️', name: 'La Lame', desc: 'Dégâts', talents: [
    { id: 'tranchant', name: 'Tranchant', max: 5, fx: { atkPct: 3 }, desc: (r) => `+${3 * r} % Attaque` },
    { id: 'boucher', name: 'Œil du boucher', max: 5, fx: { crit: 1 }, desc: (r) => `+${r} % Critique` },
    { id: 'saignee', name: 'Saignée', max: 3, fx: { bleed: 10 }, desc: (r) => `Après un critique, l’attaque suivante inflige +${10 * r} %` },
    { id: 'brise', name: 'Brise-armure', max: 5, fx: { pen: 4 }, desc: (r) => `Ignore ${4 * r} % de la Défense ennemie` },
    { id: 'double', name: 'Coup double', max: 3, fx: { double: 3 }, desc: (r) => `${3 * r} % de chance de frapper deux fois pour 1 énergie`, gate: true },
    { id: 'fleau', name: 'Fléau des rois', max: 3, fx: { bossDmg: 5 }, desc: (r) => `+${5 * r} % de dégâts aux boss`, gate: true },
    { id: 'rage', name: 'Rage', max: 3, fx: { rage: 2 }, desc: (r) => `+${2 * r} % Vitesse pendant 10 s après une victoire`, gate: true },
    { id: 'grace', name: 'Coup de grâce', max: 1, fx: { execute: 12 }, desc: () => 'Les monstres normaux sous 12 % de PV meurent aussitôt', ult: true },
  ] },
  { id: 'rempart', icon: '🛡️', name: 'Le Rempart', desc: 'Survie', talents: [
    { id: 'fer', name: 'Peau de fer', max: 5, fx: { defPct: 4 }, desc: (r) => `+${4 * r} % Défense` },
    { id: 'sang', name: 'Sang épais', max: 5, fx: { hpPct: 4 }, desc: (r) => `+${4 * r} % Points de vie` },
    { id: 'ombre', name: 'Pas de l’ombre', max: 5, fx: { dodge: 0.8 }, desc: (r) => `+${(0.8 * r).toFixed(1).replace('.', ',')} % Esquive` },
    { id: 'riposte', name: 'Riposte', max: 3, fx: { riposte: 15 }, desc: (r) => `Après une esquive, ${15 * r} % de chance de contre-attaquer gratuitement` },
    { id: 'vent', name: 'Second vent', max: 3, fx: { regenWin: 3 }, desc: (r) => `Récupère ${3 * r} % des PV après chaque victoire`, gate: true },
    { id: 'parade', name: 'Parade', max: 3, fx: { parry: 4 }, desc: (r) => `${4 * r} % de chance de bloquer la moitié d’un coup`, gate: true },
    { id: 'endurci', name: 'Endurci', max: 3, fx: { bossRed: 5 }, desc: (r) => `−${5 * r} % de dégâts subis des boss`, gate: true },
    { id: 'refus', name: 'Refus de mourir', max: 1, fx: { undying: 1 }, desc: () => 'Une fois par combat, survit à un coup mortel avec 1 PV', ult: true },
  ] },
  { id: 'moisson', icon: '🌾', name: 'La Moisson', desc: 'Économie et énergie', talents: [
    { id: 'souffle', name: 'Souffle profond', max: 5, fx: { eregenPct: 4 }, desc: (r) => `+${4 * r} % Recharge d’énergie` },
    { id: 'reservoir', name: 'Réservoir', max: 5, fx: { emax: 40 }, desc: (r) => `+${40 * r} Énergie max` },
    { id: 'econome', name: 'Économe', max: 5, fx: { free: 1 }, desc: (r) => `${r} % de chance qu’une attaque ne coûte pas d’énergie` },
    { id: 'pillard', name: 'Pillard', max: 5, fx: { cqPct: 3 }, desc: (r) => `+${3 * r} % CQ gagnés` },
    { id: 'flair', name: 'Flair', max: 3, fx: { luck: 3 }, desc: (r) => `+${3 * r} % Luck`, gate: true },
    { id: 'prospecteur', name: 'Prospecteur', max: 3, fx: { fp: 4 }, desc: (r) => `+${4 * r} % Farm Power`, gate: true },
    { id: 'reveur', name: 'Rêveur', max: 3, fx: { offline: 5 }, desc: (r) => `+${5 * r} % de rendement hors ligne`, gate: true },
    { id: 'eternelle', name: 'Moisson éternelle', max: 1, fx: { fullRefill: 1 }, desc: () => 'Chaque niveau gagné recharge toute l’énergie', ult: true },
  ] },
];
CQ.TALENTS = {};
for (const b of CQ.TALENT_BRANCHES) for (const t of b.talents) { t.branch = b.id; CQ.TALENTS[t.id] = t; }
CQ.talentRespecCost = (n) => 100 + 50 * n;

// ---------- Ensembles (3 pièces, bonus à 2 puis 3 pièces portées) ----------
// b2 / b3 : mêmes clés que les talents. Les ensembles de zone tombent sur les boss (30 %) et boss de donjon (50 %).
// bound : objet lié au compte, impossible à vendre au marché.
CQ.SETS = {
  murmures: { name: 'Chasseur des Murmures', of: 'du Chasseur', zone: 0, slots: ['weapon', 'gloves', 'boots'], b2: { crit: 3 }, b3: { spd: 5 } },
  brumes: { name: 'Veilleur des Brumes', of: 'du Veilleur', zone: 1, slots: ['helmet', 'armor', 'ring'], b2: { dodge: 4 }, b3: { hpPct: 10 } },
  cryptes: { name: 'Gardien des Cryptes', of: 'du Gardien', zone: 2, slots: ['gloves', 'ring', 'amulet'], b2: { hit: 5 }, b3: { free: 3 } },
  braises: { name: 'Forgé des Braises', of: 'des Braises', zone: 3, slots: ['weapon', 'helmet', 'armor'], b2: { pen: 8 }, b3: { atkPct: 8 } },
  ecarlate: { name: 'Pacte Écarlate', of: 'du Pacte', zone: 4, slots: ['weapon', 'boots', 'amulet'], b2: { critd: 20 }, b3: { eregenPct: 15, emax: 150 } },
  givre: { name: 'Jarl du Givre', of: 'du Jarl', zone: 5, slots: ['helmet', 'boots', 'ring'], b2: { resil: 6 }, b3: { hpPct: 12 } },
  engloutie: { name: 'Marée Noire', of: 'de la Marée', zone: 6, slots: ['gloves', 'armor', 'amulet'], b2: { dodge: 6 }, b3: { leech: 3 } },
  crepuscule: { name: 'Roi sans Visage', of: 'du Roi Masqué', zone: 7, slots: ['weapon', 'ring', 'boots'], b2: { crit: 6 }, b3: { double: 8 } },
  sables: { name: 'Pharaon Éternel', of: 'du Pharaon', zone: 8, slots: ['armor', 'helmet', 'gloves'], b2: { pen: 10 }, b3: { defPct: 12 } },
  neant: { name: 'Seuil du Néant', of: 'du Seuil', zone: 9, slots: ['weapon', 'amulet', 'ring'], b2: { critd: 30 }, b3: { atkPct: 12, free: 3 } },
  gladiateur: { name: 'Gladiateur Écarlate', of: 'du Gladiateur', zone: null, slots: ['helmet', 'armor', 'gloves'], b2: { defPct: 6 }, b3: { arena: 10 }, bound: true },
};
CQ.SET_DROP = { normal: 0, elite: 0, boss: 0.3, dboss: 0.5 };
CQ.SET_PIECE = { weapon: 'Lame', helmet: 'Heaume', armor: 'Cuirasse', gloves: 'Gantelets', boots: 'Bottes', ring: 'Sceau', amulet: 'Talisman' };
// texte d'un effet (talents, ensembles)
CQ.FX_TEXT = {
  atkPct: (v) => `+${v} % Attaque`, defPct: (v) => `+${v} % Défense`, hpPct: (v) => `+${v} % Points de vie`, eregenPct: (v) => `+${v} % Recharge d’énergie`,
  free: (v) => `${v} % d’attaques sans énergie`, arena: (v) => `+${v} % de dégâts dans l’arène`,
};
CQ.fxText = (fx) => Object.entries(fx).map(([k, v]) => (CQ.FX_TEXT[k] ? CQ.FX_TEXT[k](v) : CQ.FX_TEXT_EXTRA[k] ? CQ.FX_TEXT_EXTRA[k](v) : CQ.STATS[k] && CQ.STATS[k].rt ? `+${v} % ${CQ.STATS[k].name}` : CQ.STATS[k] ? `+${CQ.fmtStat(k, v)} ${CQ.STATS[k].name}` : `${k} ${v}`)).join(' · ');

CQ.RARITIES = [
  { name: 'Commun', mult: 1, affixes: 0, sell: 4 },
  { name: 'Peu commun', mult: 1.2, affixes: 1, sell: 10 },
  { name: 'Rare', mult: 1.45, affixes: 2, sell: 30 },
  { name: 'Épique', mult: 1.8, affixes: 3, sell: 90 },
  { name: 'Légendaire', mult: 2.25, affixes: 4, sell: 300 },
  { name: 'Mythique', mult: 2.9, affixes: 5, sell: 1000 }, // + un affixe unique (CQ.UNIQUES)
];
// affixe unique des objets Mythiques : un effet qu'aucun autre objet ne donne (mêmes clés que les talents)
CQ.UNIQUES = {
  furie: { name: 'Furie', fx: { double: 5 }, desc: '5 % de chance de frapper deux fois' },
  colosse: { name: 'Colosse', fx: { hpPct: 8 }, desc: '+8 % de points de vie' },
  avarice: { name: 'Avarice', fx: { cqPct: 12 }, desc: '+12 % de CQ gagnés' },
  souffle: { name: 'Souffle éternel', fx: { free: 4 }, desc: '4 % d’attaques sans énergie' },
  bourreau: { name: 'Bourreau', fx: { bossDmg: 12 }, desc: '+12 % de dégâts aux boss' },
  egide: { name: 'Égide', fx: { parry: 6 }, desc: '+6 % de Parade' },
  sangsue: { name: 'Sangsue', fx: { leech: 3 }, desc: 'Rend 3 % des dégâts infligés en PV' },
  eclair: { name: 'Éclair', fx: { spd: 6 }, desc: '+6 % de Vitesse d’attaque' },
};
CQ.FX_TEXT_EXTRA = { leech: (v) => `${v} % des dégâts rendus en PV`, double: (v) => `${v} % de coups doubles`, cqPct: (v) => `+${v} % de CQ`, bossDmg: (v) => `+${v} % de dégâts aux boss` };

// ---------- Attributs : plafond par niveau et entraînement ----------
CQ.attrCap = (lvl) => 5 + 3 * lvl; // points répartis dans un même attribut
CQ.trainCap = (lvl) => 2 * lvl; // points entraînés dans un même attribut
CQ.trainCost = (t) => Math.round(120 * Math.pow(t + 1, 1.9)); // CQ pour passer de t à t + 1

CQ.RARITY_COLORS = ['#a19b96', '#63c46f', '#4a93ff', '#b06cff', '#f4a227', '#ff3b4e'];
CQ.DROP_WEIGHTS = [600, 280, 90, 24, 5, 1];
CQ.BOSS_WEIGHTS = [0, 0, 62, 28, 8.5, 1.5];
CQ.CRAFT_WEIGHTS = [50, 32, 13, 4, 1, 0];

CQ.ZONES = [
  {
    name: 'Forêt des Murmures', rew: 1, lvl: 1, icon: '🌲',
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(60,90,50,.35), transparent 70%), linear-gradient(180deg,#121a13,#0b0d0b)',
    monsters: [['Loup cendré', '🐺'], ['Araignée sylvestre', '🕷️'], ['Gobelin pillard', '👺']], cs: { dodge: 2, hit: 88, crit: 3 },
    boss: ['Le Roi Sanglier', '🐗'], dungeon: 'Terrier des Ronces',
  },
  {
    name: 'Marais Putride', rew: 1.2, lvl: 8, icon: '🪷',
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(80,95,40,.32), transparent 70%), linear-gradient(180deg,#15170e,#0b0c08)',
    monsters: [['Crapaud acide', '🐸'], ['Spectre des brumes', '👻', { dodge: 10 }], ['Serpent des fanges', '🐍']], cs: { dodge: 5, hit: 90, crit: 4 }, tip: 'Spectres : Esquive élevée, la Précision compte',
    boss: ['La Matriarche des Fanges', '🦂'], dungeon: 'Fosse Engloutie',
  },
  {
    name: 'Cryptes Oubliées', rew: 1.45, lvl: 16, icon: '⚰️',
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(90,90,120,.28), transparent 70%), linear-gradient(180deg,#121218,#0a0a0d)',
    monsters: [['Squelette errant', '💀', { def: 3 }], ['Goule affamée', '🧟'], ['Liche mineure', '🧙']], cs: { dodge: 8, hit: 92, crit: 5 }, tip: 'Squelettes : Défense élevée, la Pénétration compte',
    boss: ['Vharos le Nécromancien', '☠️'], dungeon: 'Ossuaire Scellé',
  },
  {
    name: "Volcan d'Obsidienne", rew: 1.75, lvl: 25, icon: '🌋',
    bg: 'radial-gradient(ellipse at 50% 100%, rgba(220,80,20,.35), transparent 65%), linear-gradient(180deg,#1c0f0b,#0d0807)',
    monsters: [['Élémentaire de lave', '🔥', { atk: 1.15 }], ['Salamandre ardente', '🦎', { atk: 1.1 }], ["Golem d'obsidienne", '🗿', { atk: 1.2 }]], cs: { dodge: 12, hit: 95, crit: 7 }, tip: 'Coups lourds : la Vitalité compte',
    boss: ['Ignar, Dragon des Braises', '🐉'], dungeon: 'Cœur du Magma',
  },
  {
    name: 'Abysse Écarlate', rew: 2.1, lvl: 35, icon: '🩸',
    bg: 'radial-gradient(ellipse at 50% 30%, rgba(180,20,40,.4), transparent 65%), linear-gradient(180deg,#1a080b,#0a0405)',
    monsters: [['Démon mineur', '👹', { atk: 1.1 }], ['Œil du Vide', '👁️', { dodge: 8 }], ['Chevalier déchu', '🗡️', { def: 2 }]], cs: { dodge: 16, hit: 98, crit: 10 }, tip: 'Tout à la fois : Précision, Vitalité et Pénétration',
    boss: ['Malrith, Seigneur Écarlate', '😈'], dungeon: 'Trône de Sang',
  },
  // V3 : zones 6 à 10 (niveaux 45 à 99), puis les Abysses au niveau 100
  {
    name: 'Steppes de Givre', rew: 2.5, lvl: 45, icon: '🏔️',
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(140,180,230,.28), transparent 70%), linear-gradient(180deg,#0f141b,#090b0f)',
    monsters: [['Loup de givre', '🐺', { atk: 1.05 }], ['Ours des neiges', '🐻‍❄️', { def: 1.6 }], ['Géant de glace', '🧊', { atk: 1.2 }]], cs: { dodge: 18, hit: 100, crit: 16 }, tip: 'Froid mordant : critiques fréquents, la Résilience compte',
    boss: ['Hrimnir, Jarl du Gel', '🥶'], dungeon: 'Tombe du Jarl',
  },
  {
    name: 'Cité Engloutie', rew: 3, lvl: 55, icon: '🌊',
    bg: 'radial-gradient(ellipse at 50% 20%, rgba(40,140,150,.3), transparent 70%), linear-gradient(180deg,#081517,#05090a)',
    monsters: [['Sirène des récifs', '🧜', { dodge: 10 }], ['Kraken juvénile', '🦑', { atk: 1.1 }], ['Garde noyé', '🧟', { def: 2 }]], cs: { dodge: 22, hit: 102, crit: 12 }, tip: 'Insaisissables : Précision et Pénétration',
    boss: ['Thalassa, Reine des Profondeurs', '🐙'], dungeon: 'Palais Submergé',
  },
  {
    name: 'Citadelle du Crépuscule', rew: 3.6, lvl: 65, icon: '🏯',
    bg: 'radial-gradient(ellipse at 50% 0%, rgba(150,90,200,.3), transparent 70%), linear-gradient(180deg,#120d18,#08060b)',
    monsters: [['Chevalier spectral', '👤', { def: 2 }], ['Gargouille', '🦇', { dodge: 8 }], ['Archimage noir', '🧙‍♂️', { atk: 1.25 }]], cs: { dodge: 26, hit: 105, crit: 15 }, tip: 'Défenses lourdes et magie : Pénétration et Parade',
    boss: ['Le Roi sans Visage', '🎭'], dungeon: 'Salle du Trône Vide',
  },
  {
    name: 'Désert des Os', rew: 4.3, lvl: 77, icon: '🏜️',
    bg: 'radial-gradient(ellipse at 50% 100%, rgba(210,160,80,.28), transparent 65%), linear-gradient(180deg,#19140b,#0b0905)',
    monsters: [['Scorpion colosse', '🦂', { def: 2.2 }], ['Momie royale', '🧟‍♀️', { atk: 1.15 }], ['Ver des sables', '🪱', { atk: 1.3 }]], cs: { dodge: 24, hit: 108, crit: 18 }, tip: 'Carapaces et coups lourds : Pénétration et Vitalité',
    boss: ['Sekhmar, Pharaon Éternel', '⚱️'], dungeon: 'Pyramide Inversée',
  },
  {
    name: 'Portes du Néant', rew: 5.2, lvl: 90, icon: '🌀',
    bg: 'radial-gradient(ellipse at 50% 40%, rgba(120,60,220,.38), transparent 65%), linear-gradient(180deg,#0d0818,#05030a)',
    monsters: [['Rôdeur du Néant', '👾', { dodge: 12 }], ['Horreur sans forme', '🫥', { atk: 1.2 }], ['Héraut du Vide', '🕳️', { def: 2 }]], cs: { dodge: 30, hit: 112, crit: 20 }, tip: 'L’antichambre des Abysses : tout compte',
    boss: ['Azhkal, Gardien du Seuil', '🌑'], dungeon: 'Seuil de l’Oubli',
  },
];
CQ.BOSS_KILLS = 15; // victoires dans la zone pour défier le boss
// rew : bonus d'XP et de CQ de la zone (compense l'Esquive et la Défense plus hautes)
// monstres trop faibles : -8 % d'XP et de CQ par niveau d'écart au-delà de 5 (plancher 20 %)
CQ.GAP_FREE = 5;
CQ.gapMult = (playerLvl, monsterLvl) => Math.max(0.2, 1 - 0.08 * Math.max(0, playerLvl - monsterLvl - CQ.GAP_FREE));

CQ.CHESTS = {
  bronze: { name: 'Coffre de Bronze', icon: '📦', glow: 'rgba(205,127,50,.45)', cost: { cq: 400 }, weights: [60, 30, 9, 1, 0, 0], items: 1, cq: [50, 150] },
  silver: { name: "Coffre d'Argent", icon: '🧰', glow: 'rgba(200,210,230,.4)', cost: { fp: 60 }, weights: [0, 45, 40, 13, 2, 0], items: 2, cq: [150, 400] },
  gold: { name: "Coffre d'Or", icon: '🎁', glow: 'rgba(232,200,126,.55)', cost: { fp: 250 }, weights: [0, 0, 50, 38, 11, 1], items: 3, cq: [400, 1000] },
  mythic: { name: 'Coffre Mythique', icon: '🏺', glow: 'rgba(255,59,78,.6)', cost: { fp: 1200 }, weights: [0, 0, 0, 55, 38, 7], items: 3, cq: [1500, 3000] },
};
CQ.CHEST_KEYS = Object.keys(CQ.CHESTS);

CQ.UPGRADE_CHANCE = [100, 95, 90, 80, 70, 60, 50, 40, 30, 20, 18, 15, 12, 9, 6]; // pour passer de +n à +n+1
CQ.MAX_PLUS = 15; // de +11 à +15 : Cendre de qualité en plus des CQ (forge.js)
CQ.INV_CAP = 80;

CQ.QUESTS = [
  { id: 'kills', icon: '⚔️', name: 'Abattre 60 monstres', goal: 60, reward: { cq: 300, fp: 15, energy: 150 } },
  { id: 'boss', icon: '👑', name: 'Vaincre un boss', goal: 1, reward: { fp: 30 } },
  { id: 'chests', icon: '📦', name: 'Ouvrir 2 coffres', goal: 2, reward: { cq: 400 } },
  { id: 'faucet', icon: '💧', name: 'Récupérer le faucet 3 fois', goal: 3, reward: { fp: 20 } },
  { id: 'forge', icon: '🔨', name: 'Utiliser la forge 2 fois', goal: 2, reward: { cq: 350 } },
  { id: 'pool', icon: '🔥', name: 'Sacrifier des FP dans le Crypto Pool', goal: 1, reward: { cq: 500 } },
];
CQ.QUEST_BONUS = { chest: 'silver', fp: 25 };

// condition de succès : f(state) -> valeur actuelle, comparée au seuil
CQ.ACHIEVEMENTS = [
  { id: 'k100', icon: '⚔️', name: 'Premier sang', desc: '100 monstres vaincus', val: (s) => s.stats.kills, goal: 100, reward: { fp: 20 } },
  { id: 'k1000', icon: '⚔️', name: 'Moissonneur', desc: '1 000 monstres vaincus', val: (s) => s.stats.kills, goal: 1000, reward: { fp: 80 } },
  { id: 'k10000', icon: '⚔️', name: 'Fléau des Terres', desc: '10 000 monstres vaincus', val: (s) => s.stats.kills, goal: 10000, reward: { fp: 400 } },
  { id: 'l10', icon: '⭐', name: 'Aguerri', desc: 'Atteindre le niveau 10', val: (s) => s.level, goal: 10, reward: { fp: 30 } },
  { id: 'l25', icon: '⭐', name: 'Vétéran', desc: 'Atteindre le niveau 25', val: (s) => s.level, goal: 25, reward: { fp: 120 } },
  { id: 'l50', icon: '⭐', name: 'Légende vivante', desc: 'Atteindre le niveau 50', val: (s) => s.level, goal: 50, reward: { fp: 500 } },
  { id: 'b1', icon: '👑', name: 'Régicide', desc: 'Vaincre un premier boss', val: (s) => s.stats.bosses, goal: 1, reward: { fp: 25 } },
  { id: 'b25', icon: '👑', name: 'Chasseur de rois', desc: 'Vaincre 25 boss', val: (s) => s.stats.bosses, goal: 25, reward: { fp: 200 } },
  { id: 'd1', icon: '🏰', name: 'Explorateur', desc: 'Terminer un donjon', val: (s) => s.stats.dungeons, goal: 1, reward: { fp: 40 } },
  { id: 'leg', icon: '🟠', name: 'Or et sang', desc: 'Obtenir un objet Légendaire', val: (s) => (s.stats.bestRarity >= 4 ? 1 : 0), goal: 1, reward: { fp: 100 } },
  { id: 'myth', icon: '🔴', name: "L'Impossible", desc: 'Obtenir un objet Mythique', val: (s) => (s.stats.bestRarity >= 5 ? 1 : 0), goal: 1, reward: { fp: 500 } },
  { id: 'plus7', icon: '🔨', name: 'Maître forgeron', desc: 'Améliorer un objet à +7', val: (s) => s.stats.bestPlus, goal: 7, reward: { fp: 120 } },
  { id: 'pool1', icon: '🔥', name: 'Premier sacrifice', desc: 'Participer à un Crypto Pool', val: (s) => s.stats.poolDays, goal: 1, reward: { cq: 1000 } },
  { id: 'pool7', icon: '🔥', name: 'Dévot du Pool', desc: 'Participer à 7 Crypto Pools', val: (s) => s.stats.poolDays, goal: 7, reward: { fp: 150 } },
  { id: 'streak7', icon: '📅', name: 'Fidèle', desc: '7 jours de connexion d’affilée', val: (s) => s.login.best, goal: 7, reward: { fp: 50 } },
  { id: 'streak30', icon: '📅', name: 'Inébranlable', desc: '30 jours de connexion d’affilée', val: (s) => s.login.best, goal: 30, reward: { fp: 300 } },
];

// connexion quotidienne : récompense de base + paliers
CQ.STREAK_MILESTONES = {
  7: { chest: 'gold', gems: 20, label: "Coffre d'Or + 20 diamants" },
  14: { chest: 'gold', fp: 200, gems: 40, label: "Coffre d'Or + 200 FP + 40 diamants" },
  30: { chest: 'mythic', gems: 100, label: 'Coffre Mythique + 100 diamants' },
};

CQ.FAUCET_MS = 30 * 60 * 1000;

CQ.FP_PACKS = [
  { id: 'p1', fp: 500, eur: 4.99 },
  { id: 'p2', fp: 1200, eur: 9.99, tag: '+20 %' },
  { id: 'p3', fp: 2600, eur: 19.99, tag: '+30 %' },
  { id: 'p4', fp: 7000, eur: 49.99, tag: '+40 %' },
];

CQ.ELIXIRS = [
  { id: 'xp', icon: '🧪', name: 'Élixir de Sagesse', desc: '+50 % XP pendant 30 min', stat: 'xp', val: 50, cost: { cq: 1500 } },
  { id: 'fp', icon: '⚗️', name: 'Élixir de Moisson', desc: '+30 % Farm Power pendant 30 min', stat: 'fp', val: 30, cost: { fp: 40 } },
  { id: 'luck', icon: '🍀', name: 'Trèfle Maudit', desc: '+25 % Luck pendant 30 min', stat: 'luck', val: 25, cost: { cq: 2500 } },
];
CQ.ELIXIR_MS = 30 * 60 * 1000;

CQ.STAKE_PLANS = [
  { days: 1, mult: 1, label: '24 heures' },
  { days: 7, mult: 1.6, label: '7 jours' },
  { days: 30, mult: 2.8, label: '30 jours' },
];

CQ.POOL_SHARE = 0.7; // part des revenus encaissés redistribuée

// annonceurs et partenaires fictifs (prototype — remplacés en V0.4)
CQ.PTC_ADS = [
  { id: 'a1', name: 'Runeforge — jeu de cartes', secs: 10, fp: 3 },
  { id: 'a2', name: 'Taverne du Nord — hébergement', secs: 10, fp: 3 },
  { id: 'a3', name: 'Lames & Légendes — boutique', secs: 15, fp: 4 },
  { id: 'a4', name: 'Ombrelune — application', secs: 15, fp: 4 },
  { id: 'a5', name: 'Brasier VPN', secs: 20, fp: 5 },
  { id: 'a6', name: 'Cartographe — guides de voyage', secs: 20, fp: 5 },
];
CQ.OFFERS = [
  { id: 'o1', name: 'Atteindre le niveau 5 dans « Hautes Tours »', fp: 60, secs: 25 },
  { id: 'o2', name: 'Répondre à un sondage (3 min)', fp: 25, secs: 15 },
  { id: 'o3', name: 'Créer un compte sur « Gemmaria »', fp: 40, secs: 20 },
  { id: 'o4', name: 'Installer « Forteresse Idle » et jouer 10 min', fp: 90, secs: 30 },
];

CQ.BOT_NAMES = ['Kaelthar', 'Morwenna', 'Draven', 'Sylas_77', 'Ysolde', 'Thorgrim', 'Nyxara', 'Baldric', 'Eowyn.fr', 'Valkor',
  'Seraphine', 'Grimbald', 'Lilith_Q', 'Orion', 'Ragnhild', 'Corvus', 'Isolde', 'Fenrir', 'Malakai', 'Elara',
  'Torvald', 'Zephyr', 'Brunhild', 'Cassian', 'Vesper', 'Aldric', 'Mireille', 'Hroth', 'Severine', 'Ulric',
  'Aurelia', 'Kragg', 'Nimue', 'Dagan', 'Selene', 'Bastian', 'Freya_Q', 'Vortigern', 'Liora', 'Gareth'];
