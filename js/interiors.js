'use strict';
// UI-2 — Intérieurs : chaque page ouverte depuis un bâtiment reçoit un bandeau (dessin du bâtiment, habitant,
// réplique selon la situation, retour à la ville). Première visite : l'habitant explique en 3 lignes.
// Les pages elles-mêmes ne changent pas.

// pages rattachées à un bâtiment en plus de sa page principale
CQ.PAGE_BLD = { inventory: 'maison', equipment: 'maison' };
CQ.bldOfPage = (page) => CQ.TOWN.find((b) => b.id === CQ.PAGE_BLD[page]) || CQ.TOWN.find((b) => b.page === page);

const say = (f) => { try { return f(); } catch (e) { return null; } };
const plural = (n, w) => `${CQ.fmt(n)} ${w}${n > 1 ? 's' : ''}`;

// habitant : portrait, nom, présentation (3 lignes), répliques (la première qui répond l'emporte)
CQ.NPCS = {
  maison: { face: '🧝', name: 'Elwen', role: 'intendante',
    intro: ['Bienvenue chez vous, maître.', 'Ici vous répartissez attributs et talents, et rangez votre équipement.', 'Chaque niveau apporte des points : ne les laissez pas dormir.'],
    lines: [() => { const n = CQ.attrPoints().free + CQ.talentPoints().free; return n && `${plural(n, 'point')} attendent d’être répartis, maître.`; },
      () => 'Tout est en ordre. Votre armure est cirée, vos lames affûtées.'] },
  portes: { face: '💂', name: 'Garde Brannoc', role: 'gardien des portes',
    intro: ['Halte ! Au-delà de ces portes commencent les terres de chasse.', 'Choisissez une zone, puis lancez le combat : votre héros chasse seul.', 'L’énergie s’épuise à chaque combat et revient avec le temps.'],
    lines: [() => !CQ.state.auto && 'Les portes sont ouvertes. Il ne manque que votre ordre.',
      () => 'Votre héros est dehors. Je garde un œil sur la route.'] },
  taverne: { face: '🍺', name: 'Maude', role: 'tavernière',
    intro: ['Entrez, entrez ! Ici on trouve du travail.', 'Les quêtes du jour se renouvellent chaque matin, les secondaires restent.', 'Revenez récupérer vos récompenses une fois le travail fait.'],
    lines: [() => CQ.badges().quests && 'Quelqu’un a laissé une récompense à votre nom au comptoir.',
      () => 'Rien de neuf au comptoir. Les habitués parlent d’un boss dans les Cryptes.'] },
  voliere: { face: '🐦‍⬛', name: 'Corvin', role: 'maître des corbeaux',
    intro: ['Mes corbeaux portent tout ce qu’on vous doit.', 'Lots gagnés aux enchères, ventes du marché, cadeaux : tout arrive ici.', 'Ouvrez les lettres pour récupérer leur contenu.'],
    lines: [() => CQ.state.mail.length && `${plural(CQ.state.mail.length, 'lettre')} pour vous. Les oiseaux s’impatientent.`,
      () => 'Ciel calme. Aucune lettre aujourd’hui.'] },
  echoppe: { face: '🧕', name: 'Ysolde', role: 'marchande',
    intro: ['Fioles, élixirs et diamants, tout se paie comptant.', 'Les fioles rendent de l’énergie, les élixirs donnent des bonus temporaires.', 'Regardez bien les prix : certains articles changent chaque jour.'],
    lines: [() => 'Jetez un œil, rien ne mord. Sauf peut-être les élixirs.'] },
  legion: { face: '🦅', name: 'Centurion Varo', role: 'Légion',
    intro: ['La Légion soutient ceux qui la soutiennent.', 'L’abonnement donne des confort de jeu, jamais de victoire achetée.', 'Il se résilie quand vous voulez.'],
    lines: [() => 'La Légion veille sur la Cité.'] },
  fontaine: { face: '🧚', name: 'L’ondine', role: 'esprit de la fontaine',
    intro: ['Mon eau donne des Farm Points, gratuitement.', 'Puisez une fois, puis attendez que la source se remplisse.', 'Revenez souvent : une source qui déborde ne rapporte rien de plus.'],
    lines: [() => CQ.faucetReadyIn() === 0 && 'La source déborde. Puisez !',
      () => `La source se remplit. Revenez dans ${CQ.fmtDur(CQ.faucetReadyIn())}.`] },
  tresor: { face: '🗝️', name: 'Gorm', role: 'gardien du trésor',
    intro: ['Je garde vos coffres sous clé.', 'Les coffres viennent des combats, des quêtes et des récompenses.', 'Plus le coffre est rare, meilleur est l’équipement dedans.'],
    lines: [() => { const n = CQ.CHEST_KEYS.reduce((a, k) => a + (CQ.state.chests[k] || 0), 0); return n && `${plural(n, 'coffre')} sous ma garde. Ça vous démange, hein ?`; },
      () => 'Salle vide. J’astique les serrures en attendant.'] },
  heraut: { face: '🎺', name: 'Le héraut', role: 'crieur de la Cité',
    intro: ['Oyez ! Ici s’annoncent la saison et les événements.', 'Le passe de saison récompense vos progrès palier par palier.', 'Passez chaque jour pour le bonus de connexion.'],
    lines: [() => CQ.loginAvailable() && 'Oyez ! Votre bonus du jour vous attend.',
      () => CQ.passClaimable() && 'Un palier du passe est atteint : réclamez-le !',
      () => 'Rien à crier pour l’instant. Je garde ma voix.'] },
  forge: { face: '🧔', name: 'Durgan', role: 'forgeron',
    intro: ['Une bonne lame se gagne au marteau.', 'Améliorez vos objets, fondez ceux qui ne servent plus, forgez du neuf.', 'Au-delà de +10, il faut de la Cendre, et le métal peut casser.'],
    lines: [() => { const b = CQ.state.stats.bestPlus; return b >= 10 ? `Un +${b}… Peu de forgerons en ont vu un. Continuez.` : b > 0 && `Votre meilleur ouvrage est à +${b}. On peut faire mieux.`; },
      () => 'Apportez-moi du métal, je vous rends une arme.'] },
  autel: { face: '🕯️', name: 'Le gardien de l’autel', role: 'Crypto Pool',
    intro: ['Ce que vous sacrifiez ici nourrit le Pool.', 'Chaque cycle, une part des revenus est redistribuée aux sacrifiants.', 'Plus votre offrande est grande, plus votre part l’est aussi.'],
    lines: [() => { const left = CQ.poolCycle().end - Date.now(); return left < 3600000 && `Le cycle s’achève dans ${CQ.fmtDur(left)}. Les flammes montent.`; },
      () => 'Les flammes attendent votre offrande.'] },
  encheres: { face: '🧐', name: 'Dame Octavie', role: 'commissaire-priseuse',
    intro: ['Ici se vend le meilleur équipement, au plus offrant.', 'Les mises se font en FP ; un lot gagné arrive par la Volière.', 'Si quelqu’un vous dépasse, vos FP vous sont rendus.'],
    lines: [() => { const n = CQ.state.auction.lots.filter((l) => !l.done && l.top === 'me').length; return n && `Vous menez sur ${plural(n, 'lot')}. Ne relâchez pas.`; },
      () => 'Une enchère, maître ? Les lots partent vite.'] },
  hall: { face: '📜', name: 'L’archiviste', role: 'Hall de gloire',
    intro: ['Ici sont gravés les noms des meilleurs.', 'Les classements comparent niveau, puissance et richesse.', 'Vos succès aussi sont consignés.'],
    lines: [() => 'Les registres attendent votre nom.'] },
  banque: { face: '🏦', name: 'Maître Aurel', role: 'banquier',
    intro: ['Confiez-moi vos FP, ils travailleront pour vous.', 'Un dépôt est bloqué pour une durée choisie, et rapporte un intérêt.', 'À terme, revenez récupérer capital et intérêts.'],
    lines: [() => { const n = CQ.state.stakes.filter((st) => Date.now() >= st.end).length; return n && `${plural(n, 'dépôt')} arrivé${n > 1 ? 's' : ''} à terme. Votre or vous attend.`; },
      () => CQ.state.stakes.length && `${plural(CQ.state.stakes.length, 'dépôt')} en cours. Tout fructifie.`,
      () => 'Le coffre est ouvert à vos dépôts.'] },
  marche: { face: '🧑‍🌾', name: 'Fenn', role: 'marchand',
    intro: ['Au marché, on vend et on achète entre joueurs.', 'Fixez votre prix ; l’argent arrive par la Volière à la vente.', 'Une taxe modeste revient à la Cité.'],
    lines: [() => 'Du beau, du pas cher ! Enfin, surtout du beau.'] },
  colisee: { face: '🏟️', name: 'Le maître des jeux', role: 'Colisée',
    intro: ['La foule veut du sang, et elle paie en Gloire.', 'Affrontez les héros d’autres joueurs, un billet par combat.', 'Votre ligue en fin de saison fixe vos récompenses.'],
    lines: [() => CQ.badges().arena && 'Vos billets débordent. La foule gronde !',
      () => `${CQ.league(CQ.state.arena.glory).icon} ${CQ.league(CQ.state.arena.glory).name}. La foule connaît votre nom.`] },
  citadelle: { face: '🛡️', name: 'Le sénéchal', role: 'Citadelle',
    intro: ['Une guilde, c’est la force du nombre.', 'Rejoignez-en une ou fondez la vôtre.', 'Les dons font grandir ses bâtiments, et leurs bonus profitent à tous.'],
    lines: [() => CQ.state.guild && `Bienvenue, membre de ${CQ.esc(CQ.state.guild.name)}.`,
      () => 'Sans guilde, on chasse seul. Choisissez vos frères d’armes.'] },
  caserne: { face: '⚔️', name: 'Sergent Hask', role: 'Caserne',
    intro: ['Ici on forme des équipes.', 'Recrutez des mercenaires et combattez à plusieurs dans l’arène d’équipe.', 'Une équipe bien composée vaut mieux qu’un héros seul.'],
    lines: [() => 'Rang ! Vos mercenaires attendent vos ordres.'] },
  faille: { face: '👁️', name: 'La voix', role: 'Abysses',
    intro: ['…descends.', 'Chaque étage est plus profond, plus dur, plus riche.', 'On n’en revient pas toujours avec tout.'],
    lines: [() => '…plus bas. Toujours plus bas.'] },
};

CQ.npcLine = (id) => {
  const n = CQ.NPCS[id];
  for (const f of n.lines) { const l = say(f); if (l) return l; }
  return '';
};

CQ.npcSeen = () => CQ.state.seenNpc || (CQ.state.seenNpc = {});
CQ.interiorHtml = (page) => {
  const b = CQ.bldOfPage(page), n = b && CQ.NPCS[b.id];
  if (!n || page === 'town' || !CQ.unlocked(page) || (CQ.tutoActive && CQ.tutoActive())) return '';
  const first = !CQ.npcSeen()[b.id];
  const back = CQ.navMode() === 'ville' ? `<a class="btn sm ghost int-back" href="#town">← La Cité</a>` : '';
  return `<div class="interior ${first ? 'first' : ''}" data-bld="${b.id}">
    <svg class="int-art town-svg night" viewBox="-62 -${CQ.ART_H[b.art] + 14} 124 ${CQ.ART_H[b.art] + 24}" aria-hidden="true">${CQ.ART[b.art]()}</svg>
    <div class="int-npc"><span class="int-face" aria-hidden="true">${n.face}</span>
      <div class="int-talk"><div class="int-who"><b>${n.name}</b><span>${n.role} · ${b.name}</span></div>
        ${first ? `<ol class="int-intro">${n.intro.map((l) => `<li>${l}</li>`).join('')}</ol><button class="btn sm gold" data-act="npcSeen" data-arg="${b.id}">Compris</button>`
          : `<p class="int-line">« ${CQ.npcLine(b.id)} »</p>`}</div></div>${back}</div>${CQ.bldTabs(b, page)}`;
};
// pièces d'un même bâtiment : la Maison du héros regroupe héros, équipement et sac
CQ.BLD_TABS = { maison: [['hero', '🧝 Héros'], ['equipment', '🛡️ Équipement'], ['inventory', '🎒 Inventaire']] };
CQ.bldTabs = (b, page) => (CQ.BLD_TABS[b.id] ? `<div class="tabs int-tabs">${CQ.BLD_TABS[b.id].map(([id, l]) => `<a class="tab ${id === page ? 'on' : ''}" href="#${id}">${l}</a>`).join('')}</div>` : '');
CQ.A.npcSeen = (id) => { CQ.npcSeen()[id] = 1; CQ.save(); CQ.renderInterior(); };

// le bandeau vit au-dessus de la page : on le met à jour sans redessiner la page
CQ.renderInterior = () => {
  const view = document.getElementById('view');
  let el = document.getElementById('interior');
  const html = CQ.interiorHtml(CQ.ui.page);
  if (!html) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'interior'; view.prepend(el); el._html = ''; }
  if (el._html !== html) {
    el.innerHTML = html; el._html = html;
    // recadre le dessin sur ce qu'il contient (les bâtiments n'ont pas tous la même taille)
    const svg = el.querySelector('.int-art'), bb = svg && svg.getBBox();
    if (bb && bb.width) svg.setAttribute('viewBox', `${bb.x - 6} ${bb.y - 6} ${bb.width + 12} ${bb.height + 12}`);
  }
};
(() => { const r = CQ.render; CQ.render = CQ.refresh = () => { r(); CQ.renderInterior(); }; })();
setInterval(() => { if (CQ.state) CQ.renderInterior(); }, 2000);


// en mode ville, le menu ne garde que ce qui n'a pas de bâtiment (la ville sert de menu)
CQ.navInTown = (id) => CQ.TOWN.some((b) => b.page === id) || !!CQ.PAGE_BLD[id];
(() => {
  const rn = CQ.renderNav;
  CQ.renderNav = () => {
    if (CQ.navMode() !== 'ville') return rn();
    const all = CQ.NAV;
    CQ.NAV = all.map(([g, items]) => [g, items.filter(([id]) => !CQ.navInTown(id))]).filter(([, items]) => items.length);
    try { rn(); } finally { CQ.NAV = all; }
  };
})();
