# CryptoQuest — prototype V3 (jeu complet en local)

RPG dark fantasy de farm avec économie simulée. Aucun paiement, aucune crypto réelle : tout est simulé dans le navigateur.

## Lancer le jeu

- Double-cliquer sur `index.html` : le jeu tourne directement, sans installation.
- Ou servir le dossier : `npx serve . -l 8177`, puis ouvrir http://localhost:8177 (configuration d'aperçu propre au jeu : `.claude/launch.json`)

La partie est sauvegardée dans le navigateur (localStorage). Export, import et remise à zéro se font depuis la page Profil.

## V3 — le jeu complet (01/11/2026)

| Lot | Contenu |
| --- | --- |
| V3-1 | Stats en points selon le niveau, raretés resserrées, affixes uniques des Mythiques, plafond d'attribut, entraînement en CQ |
| V3-4 | **Légion** (abonnement simulé) : aucune publicité, ×2 sans vidéo, +15 % de recharge, surcharge 2,5 ×, 85 % hors ligne, 12 billets, marché 15 ventes / 72 h sans frais, sac de 100, 3 jeux d'équipement, suivi d'enchères, revente auto des Communs, coffre mensuel, titre et aura. Jamais de FP ni de puissance |
| V3-2 | **Forge à matériaux** : fonte, 6 matériaux en 5 qualités, réserve, 24 recettes (10 préfixes, 14 suffixes) à découvrir, forge ciblée, amélioration jusqu'à +15 |
| V3-3 | **Zones 6 à 10** (niveaux 45 à 99) et leurs ensembles, **clés de donjon** (6, 1 toutes les 4 h), donjons à étages Normal (5) et Héroïque (10), collections à paliers, quêtes du **Panthéon** (8 emplacements) |
| V3-5 | **Guildes** : fonder ou rejoindre, 10 bâtiments sur 20 niveaux, dons, rangs et promotion, parchemins de guilde, prière, cachots (boss capturés), raid hebdomadaire, guerres avec pillage, territoires mensuels, quêtes de guilde, classement, journal, réduction Légion |
| V3-6 | **Abysses** (niveau 100) : 4 cercles, 16 adversaires, 3 difficultés, 18 souffles, exclusion à la mort, costumes de 3 jours, objets abyssaux |
| V3-7 | **Arène d'équipe** (niveau 40) : 3 contre 3 en relais, ordre de passage, 2 mercenaires à recruter et équiper (5 étoiles) |
| V3-8 | **Saisons** de 3 mois : passe de 40 niveaux (gratuit et Légion, sans FP), événement mensuel (3 premiers jours), titres, indicateurs de l'économie |
| Serveur | `server/schema.sql` (tables, sécurité, fonctions de monnaie, pool, dons de guilde), `server/README.md`, module `js/cloud.js` (comptes et sauvegarde en ligne, actif dès que `js/cloud-config.js` est rempli) |

Les joueurs « autres » (arène, marché, enchères, guildes, équipes) sont simulés en local en attendant le serveur.

## V3-1 — refonte du cœur

- **Stats en points** : Toucher, Esquive, Critique, Vitesse, Pénétration, Parade et Résilience. En combat, chance = points ÷ (niveau de l'adversaire + 10). Un objet de son niveau garde la même efficacité tout au long du jeu.
- **Raretés resserrées**, et un **affixe unique** sur chaque Mythique (Furie, Colosse, Avarice, Souffle éternel, Bourreau, Égide, Sangsue, Éclair).
- **Attributs** : au plus 5 + 3 × niveau points répartis dans un même attribut. **Entraînement** en CQ au-delà, coût croissant, plafonné à 2 × niveau.
- Le plan complet est dans `PLAN-V3.md`.

## Nouveautés V2 — lot B (confort)

- **Réglages** (Compte → Réglages) : sons (synthétisés, coupés par défaut sur téléphone), volume, animations (auto, réduites, complètes), grands nombres abrégés ou complets, seuil d'énergie, combat automatique.
- **Notifications** quand le jeu est en arrière-plan : énergie pleine, faucet prêt, pool qui ferme dans 1 h, billets d'arène au maximum, enchère dépassée ou sur le point de finir.
- **Événements de la semaine** : lundi forgeron (−25 % sur la forge), mercredi chasse au trésor (+50 % de butin), vendredi gladiateurs (+50 % d'Honneur), week-end Nuit de sang (+50 % Farm Power).
- **Tutoriel** en 6 étapes pour les nouvelles parties, à revoir depuis Réglages.
- **Application installable** (manifeste, icônes, service worker : le jeu s'ouvre hors ligne). L'installation et les notifications demandent un site en https ou localhost, pas un fichier ouvert directement. Après une mise à jour du code, changer `VERSION` dans `sw.js`.
- **Cohérence** : niveau requis = niveau de l'objet − 3, noms Mythiques par emplacement, coffre de Bronze indexé sur le niveau, pas d'arbitrage au marché simulé.

La suite est décrite dans `PLAN-V3.md` (analyse de Gladiatus, audit, équilibrage sur plusieurs années, guildes, Premium Légion).

## Nouveautés V2 — lot E (joueurs et économie)

- **Hôtel des ventes** : un arrivage toutes les 2 h, avec 10 objets forts (Rare à Mythique, valeurs hautes, un affixe de plus) et 5 consommables. Mises en FP : bloquées tant qu'on mène, rendues si on est dépassé, détruites si on gagne. Achat direct en diamants, très cher. Les autres enchérisseurs sont simulés.
- **Consommables** : fioles d'énergie et parchemins (Butin, Rareté, Sagesse, Moisson, Fortune) d'une durée limitée, utilisables depuis l'inventaire.
- **Objets liés** : un objet équipé une fois ne peut plus être vendu au marché.
- **Marché** (CQ) : revente des objets jamais équipés. Frais de 2 %, commission de 5 %, prix borné entre 30 % et 5 fois la référence. Vendeurs et acheteurs simulés.
- **Boîte aux lettres** : lots gagnés, ventes, invendus, récompenses de saison.
- **Arène** (dès le niveau 10) : 10 billets, 1 rendu toutes les 2 h 24. Cote de Gloire (Elo), 5 ligues, saison hebdomadaire. Défenses quand vous êtes absent, revanche gratuite, rediffusion des combats. Boutique d'Honneur avec l'ensemble Gladiateur Écarlate.
- **Ensembles** : 5 ensembles de zone (boss 30 %, boss de donjon 50 %), plus le Gladiateur, avec un bonus à 2 et à 3 pièces.
- **Diamants** : packs simulés à la boutique, paliers de connexion, fin de saison d'arène.

## Nouveautés V2 — lot A (énergie et RPG)

- **Énergie** : 1 000 au départ, +100 par heure (même hors ligne), 1 énergie par attaque, touchée ou ratée. À 0, le héros se repose. Il reprend seul à 25 énergie, ou tout de suite avec une fiole ou une vidéo. Le combat peut être mis en pause ou s'arrêter à un seuil (100, 250, 500).
- **Sources d'énergie** : passage de niveau (+200), bonus de connexion (+300), quête « 60 monstres » (+150), vidéo Second souffle (+100, 5 par jour), fioles (10 et 3 par jour), coffres d'Or et Mythiques. Au-dessus du maximum, l'énergie est en surcharge, jusqu'à 2 fois le maximum.
- **Page Héros** : 6 attributs (5 points par niveau), 3 arbres de talents (1 point par niveau dès le niveau 5, ultimes à 20 points), détail de chaque statistique par source.
- **Nouvelles statistiques** : Toucher, Esquive, Critique, Dégâts critiques, Vitesse d'attaque (remplace la Réduction de recharge), Pénétration, Énergie max, Recharge d'énergie, PV.
- **7ᵉ emplacement** : 📿 Amulette (Énergie max, Recharge).
- **Combat** : dégâts = Attaque² ÷ (Attaque + Défense). Chance de toucher = Toucher − Esquive. Les monstres ont leur propre Esquive, Toucher et Critique selon la zone.
- **Économie** : XP et CQ proportionnels aux PV du monstre, avec un bonus par zone. Les monstres trop faibles pour votre niveau rapportent moins (−8 % par niveau d'écart au-delà de 5). Chaque zone affiche son rendement pour 100 énergie et son niveau de danger.
- **Hors ligne** : le héros combat tant qu'il a de l'énergie, à 75 % du rendement, sans plafond horaire.
- **Migration** : les parties V0.1 sont converties au chargement (énergie pleine, points à répartir).

Équilibrage simulé (joueur qui se connecte une fois par jour, ≈ 2 850 énergie par jour) : niveau 6 à J1, 14 à J7, 28 à J30. Joueur assidu : 16 à J7, 32 à J30.

Le plan complet (lots B à E, dont l'arène et le marché) est dans `PLAN-V2.md`.

## Ce que contenait la V0.1

| Page | Contenu |
| --- | --- |
| Accueil | Résumé du héros, bonus de connexion, faucet, pool, liste « à faire » |
| Combat | Combat automatique, 5 zones (15 monstres + 5 boss), boss après 15 victoires, donjons (4 élites + boss, sans soin) |
| Inventaire | 80 places, filtres, tri, comparaison avec l'objet porté, verrouillage, revente |
| Équipement | 7 emplacements, « équiper le meilleur » |
| Coffres | Bronze (CQ), Argent / Or / Mythique (FP), probabilités affichées, animation d'ouverture |
| Forge | Amélioration +1 à +10 avec chance d'échec, fusion 3 → 1 rareté supérieure, création, recyclage |
| Quêtes | 6 quêtes quotidiennes + bonus, 16 succès, bestiaire, codex des raretés |
| Faucet | Claim toutes les 30 min, vidéo récompensée (double le claim), PTC, offerwall |
| Boutique | Packs FP (achat simulé), élixirs XP / Farm Power / Luck |
| Staking | Blocage 1 / 7 / 30 jours, bonus Farm Power + XP, FP rendus à l'échéance |
| Crypto Pool | Cycle de 24 h jusqu'à minuit, 70 % des revenus redistribués au prorata des FP sacrifiés, historique |
| Classements | Quotidien / hebdo / mensuel sur inscription en FP, primes par rang, classement par niveau |
| Profil | Nom, statistiques, solde crypto (retrait en V0.5), sauvegarde |
| Historique | Toutes les opérations CQ / FP / crypto |


## Ce qui est simulé

- Revenus de la plateforme et participants du pool : générés de façon déterministe par cycle.
- Joueurs des classements : 40 adversaires simulés.
- Publicités, PTC, offerwall : annonceurs fictifs, minuteurs de visionnage.
- Achats de FP : aucun paiement ; le montant s'ajoute aux revenus simulés du pool du jour.
- Bouton « Clôturer le cycle maintenant » sur la page Pool : outil de test.

## Organisation du code

```
index.html        coquille de l'application
css/style.css     thème dark fantasy, responsive (ordinateur, tablette, mobile)
js/data.js        données : stats, énergie, attributs, talents, emplacements, zones, coffres, quêtes, boutique
js/state.js       sauvegarde, utilitaires, monnaies, historique
js/engine.js      règles : stats, objets, combat, forge, faucet, staking, pool, classements
js/ui.js          navigation, modales, notifications, actions
js/pages.js       les pages
js/hero.js        page Héros : attributs, talents, statistiques
js/economy.js     consommables, objets liés, boîte aux lettres, diamants, prix de référence
js/auction.js     hôtel des ventes
js/market.js      marché entre joueurs et boîte aux lettres
js/arena.js       arène
js/comfort.js     réglages, sons, notifications, événements, tutoriel, installation
js/forge.js       forge à matériaux et recettes
js/content.js     clés, donjons à étages, collections, Panthéon
js/premium.js     abonnement Légion
js/guild.js       guildes
js/abyss.js       Abysses
js/team.js        arène d'équipe et mercenaires
js/season.js      saisons, passe, titres, indicateurs
js/cloud.js       compte et sauvegarde en ligne (Supabase)
server/           schéma et mode d'emploi du serveur
sw.js             service worker (cache hors ligne)
manifest.webmanifest, icons/   application installable
js/main.js        démarrage, gains hors ligne, boucles de jeu
```

Équilibrage : tous les chiffres (courbe d'XP, coûts, probabilités, part redistribuée) sont regroupés dans `data.js` et en tête des fonctions de `engine.js`.

## Suite prévue

| Version | Contenu |
| --- | --- |
| V0.2 | Comptes, sauvegarde serveur, base de données |
| V0.3 | Pool, staking et classements calculés côté serveur (anti-triche) |
| V0.4 | Vraies régies publicitaires, offerwalls, PTC |
| V0.5 | Paiements et retraits crypto |

Avant tout lancement réel, la vente de FP contre de l'argent et leur conversion indirecte en récompenses crypto doivent passer par une validation juridique et réglementaire.
