# CryptoQuest — serveur (Supabase)

Ce dossier contient tout ce qu'il faut pour passer le jeu en ligne. Rien n'est déployé.

## Règle absolue : CryptoQuest est 100 % séparé de LocWeb

On ne mélange rien. Aucun compte, aucune clé, aucune base, aucun dépôt, aucun domaine, aucune facturation en commun.

| Élément | CryptoQuest | Jamais |
| --- | --- | --- |
| Supabase | **Organisation** Supabase à part (« CryptoQuest »), avec son propre projet et sa propre facturation | Un projet dans l'organisation LocWeb, ou une table dans une base LocWeb |
| Clés | `js/cloud-config.js` de CryptoQuest uniquement | Une clé, une URL ou un secret LocWeb |
| Code | Dossier `Bureau\CryptoQuest`, son propre dépôt Git | Un sous-dossier de LocWeb, du code copié ou partagé avec LocWeb |
| Hébergement et domaine | Compte GitHub Pages ou Netlify et nom de domaine propres au jeu | Un sous-domaine de locweb.fr, le Netlify de LocWeb |
| Paiements | Compte Stripe propre au jeu (Légion, diamants) | Le Stripe de LocWeb ou de NICOSERVICES |
| E-mails | Adresse d'expédition propre au jeu (liens de connexion) | Une adresse locweb.fr |
| Outils de travail | Configuration d'aperçu dans `CryptoQuest/.claude/launch.json` | Une entrée dans la configuration de LocWeb |

> L'entité juridique qui exploitera le jeu (encaissement, CGU, loi SREN) reste à décider. C'est une question pour le juriste, à trancher avant d'ouvrir les paiements.

## 1. Mettre en ligne les comptes et la sauvegarde (lot C) — environ 15 minutes

1. Sur supabase.com, créer une **nouvelle organisation** « CryptoQuest » (menu des organisations → New organization), puis un projet dedans, en région Europe (Paris ou Francfort).
2. **SQL Editor** → coller et exécuter `schema.sql`.
3. **Authentication → Providers** : laisser « Email » activé (connexion par lien magique). **URL Configuration** : ajouter l'adresse du jeu, par exemple `https://cryptoquest.example/`.
4. **Project Settings → API** : copier l'URL du projet et la clé publique `anon`.
5. Les mettre dans `js/cloud-config.js` :
   ```js
   window.CQ_CLOUD = { url: 'https://xxxx.supabase.co', anonKey: 'eyJ…' };
   ```
6. Héberger le dossier du jeu (GitHub Pages, Netlify…). En https, le jeu devient aussi installable et les notifications fonctionnent.

Ensuite, Profil → « Compte en ligne » : on reçoit un lien par e-mail. La partie locale est envoyée en ligne, puis synchronisée toutes les 30 s et à la fermeture. La sauvegarde la plus récente l'emporte, et l'autre reste récupérable.

À ce stade, **le client fait encore foi** : un joueur averti peut modifier sa propre partie. C'est sans enjeu tant que rien n'a de valeur réelle.

## 2. Ce qui est prêt pour le lot D (le serveur fait autorité)

Dans `schema.sql` :

| Élément | État |
| --- | --- |
| Tables : portefeuilles, journal `ledger`, objets, lots de combat, pool, staking, marché, enchères, boîte aux lettres, arène, guildes, raids, abonnements | prêtes |
| Sécurité (RLS) : chaque joueur lit ses lignes, les monnaies ne s'écrivent que par fonctions | prête |
| `apply_ledger` : mouvement de monnaie atomique, solde jamais négatif, journalisé | prête |
| `energy_now` : énergie calculée par horodatage (même règle que le client) | prête |
| `pool_deposit`, `settle_pool` (clôture à minuit avec pg_cron) | prêtes |
| `guild_donate` | prête |
| Création automatique du joueur, du portefeuille et de l'arène à l'inscription | prête |

### Ce qu'il reste à écrire avant de manipuler de la vraie valeur

1. **Extraire le moteur** (`js/data.js`, `js/engine.js`, `js/forge.js`, `js/arena.js`) en module pur, sans DOM, pour l'exécuter à l'identique dans une Edge Function Deno : `combat_batch`, forge, coffres, duels.
2. **Edge Functions** : `combat-batch` (graine tirée par le serveur, 50 attaques par appel), `open-chest`, `forge`, `auction-bid`, `market-buy`, `arena-fight`, `guild-war`, `abyss-fight`.
3. **Remplacer les joueurs simulés** (arène, marché, enchères, guildes) par des requêtes sur les vraies tables.
4. **Webhook de paiement** pour la Légion et les diamants (Stripe), qui écrit `subscriptions` et `ledger`.
5. **Anti-abus** : un appel à la fois par joueur, limites de fréquence, détection des comptes liés (marché, guildes, arène).
6. Tâches planifiées : pool à minuit, classements, saisons, raids hebdomadaires.

> Avant toute ouverture avec de l'argent réel : validation juridique (loi SREN et cadre JONUM, MiCA, KYC avant retrait). Voir PLAN-V2 §9 et PLAN-V3 §8.

## Coût

L'offre gratuite de Supabase suffit pour développer et pour les premiers joueurs. Prévoir l'offre Pro (≈ 25 $/mois) à l'ouverture publique : sauvegardes quotidiennes, pas de mise en veille du projet.
